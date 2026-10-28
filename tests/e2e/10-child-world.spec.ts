import { existsSync, mkdirSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { expect, type BrowserContext, type Page, test } from "@playwright/test";

import { login, watchConsole } from "./helpers";
import type { Database } from "../../src/lib/supabase/database.types";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

async function apiFor(page: Page) {
  const cookies = await page.context().cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { name: "cofi-device" }, cookies: { getAll: () => cookies, setAll: () => {} },
  });
}

test.describe.configure({ mode: "serial" });
let contexts: BrowserContext[] = [];
let adult: Page, first: Page, second: Page, sister: Page, home: Page;
let original: { accentColor: string | null; avatarKey: string | null };
let memberId: string;
const names: string[] = [];
const problems: string[] = [];

async function pair(device: Page, child: string | null) {
  const name = `Mundo E2E ${child ?? "Casa"} ${Date.now()}`;
  await device.goto("/vincular");
  await device.getByRole("button", { name: "Vincular mediante código desde otro equipo" }).click();
  await device.getByRole("button", { name: "Generar código" }).click();
  const code = device.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(code).toBeVisible();
  await adult.goto("/configuracion/dispositivos");
  await adult.getByLabel("Código de la pantalla").fill((await code.textContent())!.trim());
  if (child) {
    await adult.getByRole("radio", { name: "Cuarto de un hijo" }).click();
    await adult.getByRole("radio", { name: new RegExp(child) }).click();
  }
  await adult.getByLabel("Nombre", { exact: true }).fill(name);
  await adult.getByRole("button", { name: "Vincular pantalla" }).click();
  await expect(device).toHaveURL(/\/pantalla$/);
  names.push(name);
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  [adult, first, second, sister, home] = await Promise.all(contexts.map((ctx) => ctx.newPage()));
  for (const page of [first, second, sister, home]) {
    const log = watchConsole(page);
    page.on("close", () => problems.push(...log));
  }
  // Simulación: verifica el ciclo de vida, no el hardware de un equipo real.
  await contexts[1].addInitScript(() => {
    Object.defineProperty(window, "worldLocks", { value: [] });
    Object.defineProperty(navigator, "wakeLock", { value: { request: async () => {
      const lock = Object.assign(new EventTarget(), { released: false, release: async () => { lock.released = true; lock.dispatchEvent(new Event("release")); } });
      (window as unknown as { worldLocks: unknown[] }).worldLocks.push(lock);
      return lock;
    } } });
  });
  await login(adult, "MAMA");
  for (const [device, child] of [[first, "Mateo"], [second, "Mateo"], [sister, "Sofía"], [home, null]] as const) await pair(device, child);
  const api = await apiFor(first);
  const { data, error } = await api.from("family_members").select("id, child_accent_color, child_avatar_key").eq("display_name", "Mateo").single();
  expect(error).toBeNull();
  original = { accentColor: data!.child_accent_color, avatarKey: data!.child_avatar_key };
  memberId = data!.id;
  mkdirSync("/tmp/cofi-child-world", { recursive: true });
});

test.afterAll(async () => {
  test.setTimeout(90_000);
  if (first && original) {
    const api = await apiFor(first);
    const { error } = await api.rpc("save_child_appearance", { p_accent_color: original.accentColor as string, p_avatar_key: original.avatarKey as string });
    expect(error).toBeNull();
  }
  if (adult && names.length) {
    await adult.goto("/configuracion/dispositivos");
    for (const name of names) {
      const row = adult.getByRole("listitem").filter({ hasText: name });
      if (await row.getByRole("button", { name: "Desvincular", exact: true }).count()) {
        await row.getByRole("button", { name: "Desvincular", exact: true }).click();
        await adult.getByRole("button", { name: "Desvincular", exact: true }).last().click();
      }
    }
  }
  for (const ctx of contexts) await ctx.close();
  expect(problems).toEqual([]);
});

test("la tuerca abre ajustes propios y las pestañas conservan su navegación", async () => {
  const nav = first.getByRole("navigation", { name: "Mi mundo" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(first.getByRole("region", { name: "Mi día", exact: true })).toBeVisible();
  await first.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).click();
  await expect(first).toHaveURL(/vista=ajustes$/);
  await expect(first.getByRole("region", { name: "Ajustes de mi pantalla", exact: true })).toBeVisible();
  await expect(first.getByRole("textbox", { name: "Correo" })).toHaveCount(0);
  await first.reload();
  await expect(first.getByRole("region", { name: "Así se ve mi mundo" })).toBeVisible();
  await nav.getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(first.getByRole("region", { name: "Mis tareas de hoy" })).toBeVisible();
  await nav.getByRole("link", { name: "Premios", exact: true }).click();
  await expect(first.getByRole("region", { name: "Mis puntos" })).toBeVisible();
  await first.goBack();
  await expect(nav.getByRole("link", { name: "Tareas", exact: true })).toHaveAttribute("aria-current", "page");
  await first.goForward();
  await expect(nav.getByRole("link", { name: "Premios", exact: true })).toHaveAttribute("aria-current", "page");
  await first.goto("/pantalla?vista=desconocida");
  await expect(nav.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute("aria-current", "page");
});

test("la apariencia se sincroniza sin alterar otro hijo ni perder un borrador", async () => {
  const siblingBefore = await sister.locator('[data-world="child"]').innerHTML();
  await first.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).click();
  const settings = first.getByRole("region", { name: "Así se ve mi mundo" });
  await settings.getByRole("radio", { name: "Azul", exact: true }).click();
  await settings.getByRole("radio", { name: "Cohete", exact: true }).click();
  await settings.getByRole("button", { name: "Guardar apariencia", exact: true }).click();
  await expect(first.getByText("Tu apariencia está guardada", { exact: true })).toBeVisible();
  await expect.poll(async () => (await second.locator('[data-world="child"] svg').getAttribute("class")) ?? "").toContain("lucide-rocket");
  await adult.goto(`/hijos/${memberId}`);
  await expect(adult.getByRole("note")).toContainText("Estás viendo el mundo de Mateo como Mamá");
  await expect(adult.locator("svg.lucide-rocket")).toBeVisible();
  await expect(sister.locator('[data-world="child"]')).toHaveJSProperty("innerHTML", siblingBefore);
  await first.reload();
  await expect(settings.getByRole("radio", { name: "Cohete", exact: true })).toHaveAttribute("aria-checked", "true");
  await settings.getByRole("radio", { name: "Gato", exact: true }).click();
  await second.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).click();
  await second.getByRole("radio", { name: "Perro", exact: true }).click();
  await second.getByRole("button", { name: "Guardar apariencia", exact: true }).click();
  await expect(first.locator('[data-world="child"] svg')).toHaveClass(/lucide-dog/);
  await expect(settings.getByRole("radio", { name: "Gato", exact: true })).toHaveAttribute("aria-checked", "true");
  await settings.getByRole("button", { name: "Guardar apariencia", exact: true }).click();
  await expect(second.locator('[data-world="child"] svg')).toHaveClass(/lucide-cat/);
});

test("los controles son locales y Wake Lock sigue activo fuera de ajustes", async () => {
  await first.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).click();
  await first.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(first.locator("html")).toHaveClass(/dark/);
  await first.getByRole("button", { name: "Mantener pantalla encendida", exact: true }).click();
  await first.getByRole("navigation", { name: "Mi mundo" }).getByRole("link", { name: "Tareas", exact: true }).click();
  expect(await first.evaluate(() => (window as unknown as { worldLocks: { released: boolean }[] }).worldLocks.every((l) => !l.released))).toBe(true);
  await first.getByRole("navigation", { name: "Mi mundo" }).getByRole("link", { name: "Ajustes", exact: true }).click();
  await expect(first.getByRole("button", { name: "Oscuro", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(second.getByRole("button", { name: "Según el equipo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await first.getByRole("button", { name: "Noche automática", exact: true }).click();
  await first.getByRole("button", { name: "Noche automática", exact: true }).click();
  await expect(first.locator("html")).toHaveClass(/dark/);
  await first.getByRole("button", { name: "Desactivar pantalla encendida", exact: true }).click();
  await first.getByRole("radio", { name: "Pez", exact: true }).click();
  await expect(first.getByRole("button", { name: "Guardar apariencia", exact: true })).toBeEnabled();
  await first.context().setOffline(true);
  await expect(first.getByRole("button", { name: "Guardar apariencia", exact: true })).toBeDisabled();
  await first.context().setOffline(false);
});

test("celular, tablet y pantalla familiar tienen ajustes sin desbordamientos", async () => {
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1180, 820], [1440, 1000]]) {
    await first.setViewportSize({ width, height });
    for (const view of ["Inicio", "Tareas", "Premios", "Ajustes"]) {
      await first.getByRole("navigation", { name: "Mi mundo" }).getByRole("link", { name: view, exact: true }).click();
      await expect(first.getByRole("navigation", { name: "Mi mundo" }).getByRole("link", { name: view, exact: true })).toHaveAttribute("aria-current", "page");
      expect(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await first.evaluate(() => window.scrollTo(0, 0));
    await first.screenshot({ path: `/tmp/cofi-child-world/ajustes-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await first.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(first.locator("html")).toHaveClass(/light/);
  await first.screenshot({ path: "/tmp/cofi-child-world/ajustes-claro.png", fullPage: true, animations: "disabled" });
  await first.getByRole("navigation", { name: "Mi mundo" }).getByRole("link", { name: "Inicio", exact: true }).click();
  await expect(first.getByRole("region", { name: "Mi día", exact: true })).toBeVisible();
  await first.screenshot({ path: "/tmp/cofi-child-world/inicio-claro.png", fullPage: true, animations: "disabled" });
  await home.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).press("Enter");
  await expect(home.getByRole("region", { name: "En este equipo" })).toBeVisible();
  await expect(home.getByRole("region", { name: "Así se ve mi mundo" })).toHaveCount(0);
  await expect(home.getByRole("link", { name: "Acceso para adultos", exact: true })).toHaveAttribute("href", "/acceso?next=/casa");
  const api = await apiFor(home);
  const { error } = await api.rpc("save_child_appearance", { p_accent_color: "#2563EB", p_avatar_key: "cat" });
  expect(error?.message).toContain("COFI:FORBIDDEN");
  await home.getByRole("link", { name: "Acceso para adultos", exact: true }).click();
  await expect(home.getByRole("textbox", { name: "Correo" })).toBeVisible();
});
