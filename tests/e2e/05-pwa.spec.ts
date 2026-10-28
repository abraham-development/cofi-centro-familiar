import { expect, test } from "@playwright/test";

import { login } from "./helpers";

const copyKey = "cofi-snapshot-v1:adult";

test("PWA instalable: copia autorizada, recarga sin conexión y caché exclusivamente pública", async ({ page, context, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBeTruthy();
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), copyKey)).toBe(true);
  const copy = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), copyKey);
  expect(copy.familyName).toBe("Familia García");
  expect(copy.events.length).toBeGreaterThan(0);
  expect(copy.expiresAt - copy.savedAt).toBe(24 * 3600_000);
  expect(JSON.stringify(copy)).not.toMatch(/"(notes|description|location|access_token|refresh_token|email)":/);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((r) => new URL(r.url).pathname)))).flat();
  });
  expect(cached).toContain("/offline.html");
  expect(cached.every((path) => /^\/(offline\.(html|js|css)|icons\/)/.test(path))).toBeTruthy();
  await context.setOffline(true);
  await expect(page.locator("aside[role='status']").filter({ hasText: "Sin conexión" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sin conexión · Solo consulta" })).toBeVisible();
  await expect(page.getByText("Última sincronización:")).toBeVisible();
  await expect(page.locator("#week")).toContainText(copy.events[0].title);
  await expect(page.getByRole("button")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/cofi-pwa-sin-conexion.png", fullPage: true });
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/casa$/);
  await expect(page.getByRole("heading", { name: "Pendientes de hoy" })).toBeVisible();
});

test("la copia caduca abierta, limpia el DOM y no interpreta títulos como HTML", async ({ page }) => {
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), copyKey)).toBe(true);
  await page.evaluate((key) => {
    const copy = JSON.parse(localStorage.getItem(key)!);
    copy.events[0].title = '<img src=x onerror="window.injected=true">';
    localStorage.setItem(key, JSON.stringify(copy));
  }, copyKey);
  await page.clock.install();
  await page.goto("/offline.html?mode=adult");
  await expect(page.locator("#snapshot")).toBeVisible();
  await expect(page.locator("#week img")).toHaveCount(0);
  await expect(page.locator("#week")).toContainText("<img src=x");
  const expiresAt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).expiresAt, copyKey);
  await page.clock.setSystemTime(expiresAt);
  await page.clock.runFor(1100);
  await expect(page.locator("#snapshot")).toBeHidden();
  await expect(page.locator("#week")).toBeEmpty();
  expect(await page.evaluate((key) => localStorage.getItem(key), copyKey)).toBeNull();
});

test("cerrar sesión limpia la copia del adulto", async ({ page }) => {
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), copyKey)).toBe(true);
  await page.getByRole("button", { name: /Menú de/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), copyKey)).toBeNull();
  await page.goto("/offline.html");
  await expect(page.locator("#snapshot")).toBeHidden();
  await expect(page.getByText("No hay una copia vigente")).toBeVisible();
});

test("sin copia no se muestran datos y las copias de adulto no se usan como pantalla", async ({ page }) => {
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), copyKey)).toBe(true);
  await page.goto("/offline.html?mode=device");
  await expect(page.locator("#snapshot")).toBeHidden();
  await expect(page.getByText("No hay una copia vigente")).toBeVisible();
});

test("una pestaña con una copia antigua no elimina la copia más nueva de otra pestaña", async ({ page, context }) => {
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), copyKey)).toBe(true);
  await page.goto("/offline.html?mode=adult");
  await expect(page.locator("#snapshot")).toBeVisible();
  const other = await context.newPage();
  await other.goto("/offline.html?mode=adult");
  await other.evaluate((key) => {
    const copy = JSON.parse(localStorage.getItem(key)!);
    copy.familyId = "otra-familia";
    copy.familyName = "Otro contexto";
    localStorage.setItem(key, JSON.stringify(copy));
  }, copyKey);
  await expect(page.locator("#snapshot")).toBeHidden();
  await expect(page.locator("#week")).toBeEmpty();
  expect(await other.evaluate((key) => JSON.parse(localStorage.getItem(key)!).familyId, copyKey)).toBe("otra-familia");
  await other.close();
});

test("una pantalla infantil guarda solo su alcance, recupera Wake Lock y limpia su copia al revocarse", async ({ page: adult, browser }) => {
  await login(adult, "MAMA");
  const deviceContext = await browser.newContext();
  await deviceContext.addInitScript(() => {
    const locks: { released: boolean; release: () => Promise<void> }[] = [];
    Object.defineProperty(window, "cofiTestLocks", { value: locks });
    Object.defineProperty(navigator, "wakeLock", { value: { request: async () => {
      const sentinel = Object.assign(new EventTarget(), {
        released: false,
        release: async () => { sentinel.released = true; sentinel.dispatchEvent(new Event("release")); },
      });
      locks.push(sentinel);
      return sentinel;
    } } });
  });
  const screen = await deviceContext.newPage();
  try {
    await screen.goto("/vincular");
    await screen.getByRole("button", { name: "Vincular mediante código desde otro equipo" }).click();
    await screen.getByRole("button", { name: "Generar código" }).click();
    const codeElement = screen.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await expect(codeElement).toBeVisible();
    const code = (await codeElement.textContent())!.trim();
    const name = `PWA Mateo ${Date.now()}`;
    await adult.goto("/configuracion/dispositivos");
    await adult.getByLabel("Código de la pantalla").fill(code);
    await adult.getByRole("radio", { name: "Cuarto de un hijo" }).click();
    await adult.getByRole("radio", { name: /Mateo/ }).click();
    await adult.getByLabel("Nombre", { exact: true }).fill(name);
    await adult.getByRole("button", { name: "Vincular pantalla" }).click();
    await expect(screen).toHaveURL(/\/pantalla$/);
    await expect.poll(() => screen.evaluate(() => Boolean(localStorage.getItem("cofi-snapshot-v1:device")))).toBe(true);
    const serialized = await screen.evaluate(() => localStorage.getItem("cofi-snapshot-v1:device")!);
    expect(JSON.parse(serialized).label).toBe("Mateo");
    // Family-visible events may mention other members; adult-only items never enter the copy.
    expect(serialized).not.toMatch(/Reunión de padres|Pagar el internet/);

    await screen.getByRole("link", { name: "Ajustes de mi pantalla", exact: true }).click();
    await screen.getByRole("button", { name: "Mantener pantalla encendida" }).click();
    await expect(screen.getByText("Pantalla encendida", { exact: true })).toBeVisible();
    await screen.evaluate(async () => {
      const state = window as unknown as { cofiTestLocks: { released: boolean; release: () => Promise<void> }[] };
      await state.cofiTestLocks[0].release();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => screen.evaluate(() => (window as unknown as { cofiTestLocks: unknown[] }).cofiTestLocks.length)).toBe(2);
    await screen.getByRole("button", { name: "Desactivar pantalla encendida" }).click();
    expect(await screen.evaluate(() => (window as unknown as { cofiTestLocks: { released: boolean }[] }).cofiTestLocks.every((lock) => lock.released))).toBe(true);

    await expect.poll(() => screen.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await deviceContext.setOffline(true);
    await screen.reload();
    await expect(screen.locator("#family")).toContainText("Mateo");
    await expect(screen.locator("#snapshot")).toBeVisible();
    const row = adult.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "Desvincular" }).click();
    await adult.getByRole("button", { name: "Desvincular", exact: true }).last().click();
    await deviceContext.setOffline(false);
    await expect(screen).toHaveURL(/\/vincular\?revocada=1/);
    expect(await screen.evaluate(() => localStorage.getItem("cofi-snapshot-v1:device"))).toBeNull();
  } finally {
    await deviceContext.close();
  }
});
