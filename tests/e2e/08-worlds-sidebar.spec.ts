import { expect, type Page, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * Mundos (padres / hijos / casa) e identificación de quién usa cada pantalla,
 * y barra lateral por hijo en Tareas y Premios.
 */
test.describe.configure({ mode: "serial" });

async function pair(mama: Page, device: Page, scope: "home" | "child", name: string) {
  await device.goto("/vincular");
  await device.getByRole("button", { name: "Vincular mediante código desde otro equipo" }).click();
  await device.getByRole("button", { name: "Generar código" }).click();
  const codeEl = device.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.textContent())!.trim();
  await mama.goto("/configuracion/dispositivos");
  await mama.getByLabel("Código de la pantalla").fill(code);
  if (scope === "child") {
    await mama.getByRole("radio", { name: "Cuarto de un hijo" }).click();
    await mama.getByRole("radio", { name: /Mateo/ }).click();
  }
  await mama.getByLabel("Nombre", { exact: true }).fill(name);
  await mama.getByRole("button", { name: "Vincular pantalla" }).click();
  await expect(mama.getByText("Pantalla vinculada")).toBeVisible();
  await expect(device).toHaveURL(/\/pantalla$/, { timeout: 15_000 });
}

test("el panel de adultos indica quién está conectado y que es el mundo de padres", async ({ page }) => {
  await login(page, "MAMA");
  const badge = page.locator('[data-world="parents"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("Mamá");
  await expect(badge).toContainText("Padres");
  await expect(page.getByText("Conectado como Mamá · Mundo de padres", { exact: false })).toBeAttached();
  // El indicador va a la izquierda de «En vivo».
  const live = page.getByRole("status").filter({ hasText: /En vivo|Conectando|Reconectando/ }).first();
  const [badgeBox, liveBox] = await Promise.all([badge.boundingBox(), live.boundingBox()]);
  expect(badgeBox!.x).toBeLessThan(liveBox!.x);
});

test("Tareas: la barra lateral abre la vista centrada en cada hijo", async ({ page }) => {
  await login(page, "MAMA");
  await page.goto("/responsabilidades");
  const sidebar = page.getByRole("navigation", { name: "Hijos" });
  await expect(sidebar.getByRole("link", { name: /Todos/ })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: /Mateo/ })).toContainText(/hoy/);
  // Otras pruebas (p. ej., 04) aprueban entregas: el conteo se lee de la barra y no se da por fijo.
  const reviewCount = Number((await sidebar.getByRole("link", { name: /Mateo/ }).textContent())?.match(/(\d+) por revisar/)?.[1] ?? 0);

  await sidebar.getByRole("link", { name: /Mateo/ }).click();
  await expect(page).toHaveURL(/\/responsabilidades\?hijo=[0-9a-f-]{36}$/);
  await expect(sidebar.getByRole("link", { name: /Mateo/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Mateo", level: 2, exact: true })).toBeVisible();
  const today = page.getByRole("region", { name: "Hoy" });
  await expect(today.getByText("Tender la cama")).toBeVisible();
  // El estado depende del día (la semilla es de otro día): basta con que se muestre.
  await expect(today.getByText(/^(Pendiente|Vencida|Por corregir|Cumplida|Cumplida tarde|Exenta)$|revisión/).first()).toBeVisible();
  const review = page.getByRole("region", { name: reviewCount ? `Por revisar (${reviewCount})` : "Por revisar", exact: true });
  await expect(review).toBeVisible();
  if (reviewCount) await expect(review.getByRole("button", { name: /Aprobar/ })).toHaveCount(reviewCount);
  await expect(page.getByRole("heading", { name: "Responsabilidades de Mateo" })).toBeVisible();
  // Nada de Sofía en lo que hizo ni en lo que tiene hoy Mateo.
  await expect(today.getByText("Sofía")).toHaveCount(0);
  await expect(page.getByRole("region", { name: /Lo que hizo/ }).getByText("Sofía")).toHaveCount(0);
  await expect(review.getByText("Sofía")).toHaveCount(0);

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: "docs/capturas/tareas-hijo-escritorio.png", fullPage: true });
  await page.getByRole("link", { name: "Ver 30 días" }).click();
  await expect(page).toHaveURL(/dias=30/);
  await expect(page.getByRole("heading", { name: "Lo que hizo · últimos 30 días" })).toBeVisible();

  // Sofía: su tarea de ayer sin entregar aparece como vencida en su historial.
  await sidebar.getByRole("link", { name: /Sofía/ }).click();
  await expect(page.getByRole("heading", { name: "Sofía", level: 2, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /Lo que hizo/ }).getByText("Vencida").first()).toBeVisible();
});

test("Premios: la barra lateral muestra saldo, pedidos y movimientos de cada hijo", async ({ page }) => {
  await login(page, "MAMA");
  await page.goto("/premios");
  const sidebar = page.getByRole("navigation", { name: "Hijos" });
  await expect(sidebar.getByRole("link", { name: /Mateo/ })).toContainText("pts");
  await expect(sidebar.getByRole("link", { name: /Mateo/ })).toContainText("1 pedido");

  await sidebar.getByRole("link", { name: /Mateo/ }).click();
  await expect(page).toHaveURL(/\/premios\?hijo=/);
  await expect(page.getByRole("region", { name: "Pedidos pendientes" }).getByText("Escoger el postre")).toBeVisible();
  await expect(page.getByRole("region", { name: "Movimientos de puntos" }).getByText(/Puntos de bienvenida/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Premios para Mateo" }).getByText(/Le alcanza|Le faltan/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Historial de canjes" }).getByText("Escoger el postre")).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: "docs/capturas/premios-hijo-escritorio.png", fullPage: true });
  for (const region of ["Pedidos pendientes", "Movimientos de puntos", "Historial de canjes"]) {
    await expect(page.getByRole("region", { name: region }).getByText("Sofía")).toHaveCount(0);
  }
});

test("el adulto que abre la vista de un hijo sabe que está en el mundo del hijo", async ({ page }) => {
  await login(page, "MAMA");
  await page.goto("/responsabilidades");
  await page.getByRole("navigation", { name: "Hijos" }).getByRole("link", { name: /Mateo/ }).click();
  await page.getByRole("link", { name: "Ver su pantalla" }).click();
  await expect(page.getByRole("note")).toContainText("Estás viendo el mundo de Mateo como Mamá");
  await expect(page.locator('[data-world="parents"]')).toContainText("Mamá");
});

test("las pantallas vinculadas muestran «Hijos» con el nombre del hijo y «Casa» en la cocina", async ({ browser }) => {
  const mamaCtx = await browser.newContext();
  const roomCtx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const kitchenCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const mama = await mamaCtx.newPage();
  const room = await roomCtx.newPage();
  const kitchen = await kitchenCtx.newPage();
  await login(mama, "MAMA");

  await pair(mama, room, "child", "Cuarto de Mateo (E2E 08)");
  const childBadge = room.locator('[data-world="child"]');
  await expect(childBadge).toContainText("Mateo");
  await room.screenshot({ path: "docs/capturas/pantalla-hijo.png" });
  await expect(childBadge).toContainText("Hijos");
  await expect(room.locator('[data-world="parents"]')).toHaveCount(0);

  await pair(mama, kitchen, "home", "Cocina (E2E 08)");
  const homeBadge = kitchen.locator('[data-world="home"]');
  await expect(homeBadge).toContainText("Cocina (E2E 08)");
  await expect(homeBadge).toContainText("Casa");
  await kitchen.screenshot({ path: "docs/capturas/pantalla-cocina.png" });

  // Desvincular al terminar para no dejar pantallas de prueba activas.
  await mama.goto("/configuracion/dispositivos");
  for (const name of ["Cuarto de Mateo (E2E 08)", "Cocina (E2E 08)"]) {
    await mama.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Desvincular" }).click();
    await mama.getByRole("button", { name: "Desvincular", exact: true }).last().click();
    await expect(mama.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Desvincular" })).toHaveCount(0);
  }
  await Promise.all([mamaCtx.close(), roomCtx.close(), kitchenCtx.close()]);
});

test("en el celular la barra lateral es una fila de chips sin desbordes", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await login(page, "MAMA");
  for (const path of ["/responsabilidades", "/premios"]) {
    await page.goto(path);
    const sidebar = page.getByRole("navigation", { name: "Hijos" });
    await expect(sidebar.getByRole("link", { name: /Mateo/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} desborda`).toBeLessThanOrEqual(0);
  }
  // En el celular, el avatar del adulto es el botón del menú.
  await expect(page.getByRole("button", { name: /Menú de Mamá/ })).toBeVisible();
  await page.goto("/responsabilidades");
  await page.getByRole("navigation", { name: "Hijos" }).getByRole("link", { name: /Mateo/ }).click();
  await expect(page.getByRole("heading", { name: "Mateo", level: 2, exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "vista del hijo desborda").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "docs/capturas/tareas-hijo-movil.png", fullPage: true });
  await ctx.close();
});

test("el menú del usuario cambia entre tema claro, oscuro y el del equipo", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await login(page, "MAMA");
  const html = page.locator("html");
  const choose = async (name: string) => {
    await page.getByRole("button", { name: /Menú de Mamá/ }).click();
    await page.getByRole("menuitemradio", { name }).click();
  };
  await choose("Claro");
  await expect(html).not.toHaveClass(/\bdark\b/);
  await choose("Oscuro");
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await choose("Claro");
  await expect(html).not.toHaveClass(/\bdark\b/);
  // «Según el equipo» sigue al sistema (aquí, oscuro).
  await choose("Según el equipo");
  await expect(html).toHaveClass(/\bdark\b/);
  await ctx.close();
});
