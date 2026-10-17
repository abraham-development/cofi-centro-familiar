import { expect, type Page, test } from "@playwright/test";

import { credentials, login } from "./helpers";

const setupPath = "/configuracion/dispositivos/esta-pantalla";

async function assertAdultClosed(page: Page) {
  expect(await page.evaluate(() => localStorage.getItem("cofi-snapshot-v1:adult"))).toBeNull();
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.startsWith("cofi-device"))).toBe(true);
  expect(cookies.some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(false);
  expect(cookies.some((c) => c.name === "cofi-family")).toBe(false);
  await page.goto("/casa");
  await expect(page).toHaveURL(/\/acceso/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/pantalla$/);
}

test("desde el propio celular: login dirigido, pantalla familiar, salida adulta y regreso persistente", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = `[E2E] Directa casa ${Date.now()}`;
  await page.goto("/vincular");
  await page.getByRole("link", { name: "Entrar como adulto y configurar" }).click();
  await expect(page).toHaveURL(/\/acceso\?next=/);
  const account = credentials("MAMA");
  await page.getByLabel("Correo").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(setupPath + "$"));
  await expect(page.locator("form").getByText("Familia García", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nombre de la pantalla")).toHaveValue("Pantalla familiar");
  await page.getByLabel("Nombre de la pantalla").fill(name);
  await page.getByRole("button", { name: "Activar pantalla", exact: true }).click();
  await expect(page).toHaveURL(/\/pantalla$/, { timeout: 20000 });
  await expect(page.getByRole("region", { name: "Reloj y próximo evento" })).toBeVisible();
  await expect(page.getByText("Reunión de padres (virtual)")).toHaveCount(0);
  await assertAdultClosed(page);
  await page.reload();
  await expect(page.getByRole("region", { name: "Reloj y próximo evento" })).toBeVisible();

  // Reopening adult management does not replace the existing screen.
  await login(page, "MAMA");
  await page.goto(setupPath);
  await expect(page.getByRole("heading", { name: "Esta pantalla ya está vinculada" })).toBeVisible();
  await expect(page.getByLabel("Nombre de la pantalla")).toHaveCount(0);
  await page.getByRole("button", { name: "Usar esta pantalla y cerrar sesión adulta" }).click();
  await expect(page).toHaveURL(/\/pantalla$/);
  const oldCookies = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("cofi-device"));
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("cofi-snapshot-v1:device")))).toBe(true);
  const oldIdentity = await page.evaluate(() => JSON.parse(localStorage.getItem("cofi-snapshot-v1:device")!).identity);

  const adminContext = await browser.newContext();
  try {
    const admin = await adminContext.newPage();
    await login(admin, "MAMA");
    await admin.goto("/configuracion/dispositivos");
    const row = admin.getByRole("listitem").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Desvincular", exact: true }).click();
    await admin.getByRole("button", { name: "Desvincular", exact: true }).last().click();
    await expect(page).toHaveURL(/\/vincular\?revocada=1/, { timeout: 20000 });
    await expect(page.getByText("Esta pantalla fue desvinculada por un adulto")).toBeVisible();

    // Simulate a browser returning with the old, revoked device cookie.
    // The previous database row must survive; a new anonymous identity is required.
    await page.context().addCookies(oldCookies);
    await login(page, "MAMA");
    await page.goto(setupPath);
    await page.getByLabel("Nombre de la pantalla").fill(`[E2E] Reactivada ${Date.now()}`);
    await page.getByRole("button", { name: "Activar pantalla", exact: true }).click();
    await expect(page).toHaveURL(/\/pantalla$/, { timeout: 20000 });
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("cofi-snapshot-v1:device")))).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cofi-snapshot-v1:device")!).identity)).not.toBe(oldIdentity);
    await admin.reload();
    await admin.locator("summary").filter({ hasText: "Desvinculadas" }).click();
    await expect(admin.getByRole("listitem").filter({ hasText: name })).toHaveCount(1);
    await assertAdultClosed(page);
  } finally { await adminContext.close(); }
});

test("pantalla de un hijo: selección obligatoria y recuperación de un fallo al terminar", async ({ page, browser }) => {
  const name = `[E2E] Directa hijo ${Date.now()}`;
  await login(page, "MAMA");
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("cofi-snapshot-v1:adult")))).toBe(true);
  const otherTab = await page.context().newPage();
  await otherTab.goto("/casa");
  await expect(otherTab.getByRole("heading", { name: "Pendientes de la casa" })).toBeVisible();
  await page.goto("/configuracion/dispositivos");
  await page.getByRole("link", { name: "Configurar este dispositivo como pantalla" }).click();
  await page.getByRole("radio", { name: "Pantalla de un hijo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Activar pantalla", exact: true })).toBeDisabled();
  await page.getByLabel("¿Para qué hijo?").selectOption({ label: "Mateo" });
  await expect(page.getByLabel("Nombre de la pantalla")).toHaveValue("Pantalla de Mateo");
  await page.getByLabel("Nombre de la pantalla").fill(name);
  let failedFinish = false;
  await page.route(`**${setupPath}`, async (route) => {
    const req = route.request();
    if (!failedFinish && req.method() === "POST" && req.headers()["next-action"] && !req.postData()?.includes("expectedFamilyId")) {
      failedFinish = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Activar pantalla", exact: true }).click();
  await expect(page.getByRole("button", { name: "Terminar activación", exact: true })).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(failedFinish).toBe(true);
  await page.getByRole("button", { name: "Terminar activación", exact: true }).click();
  await expect(page).toHaveURL(/\/pantalla$/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  await expect(page.getByText("Campamento de Sofía")).toHaveCount(0);
  await expect(page.getByText("Reunión de padres (virtual)")).toHaveCount(0);
  await expect(otherTab).toHaveURL(/\/pantalla$/, { timeout: 20000 });
  await expect(otherTab.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/acceso/);
  await assertAdultClosed(page);
  await expect(page.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  const adminContext = await browser.newContext();
  try {
    const admin = await adminContext.newPage();
    await login(admin, "MAMA");await admin.goto("/configuracion/dispositivos");
    await expect(admin.getByRole("listitem").filter({ hasText: name })).toHaveCount(1);
  } finally { await adminContext.close(); }
});

test("el código sigue disponible y cabe en un celular", async ({ page, browser }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/vincular");
  await expect(page.getByRole("button", { name: "Generar código", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Vincular mediante código desde otro equipo" }).click();
  await page.getByRole("button", { name: "Generar código", exact: true }).click();
  const code = page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(code).toBeVisible();
  expect(await code.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const adminContext = await browser.newContext();
  try {
    const admin = await adminContext.newPage();await login(admin, "MAMA");await admin.goto("/configuracion/dispositivos");
    await admin.getByLabel("Código de la pantalla").fill((await code.textContent())!.trim());
    await admin.getByLabel("Nombre", { exact: true }).fill(`[E2E] Código ${Date.now()}`);
    await admin.getByRole("button", { name: "Vincular pantalla", exact: true }).click();
    await expect(page).toHaveURL(/\/pantalla$/, { timeout: 20000 });
  } finally { await adminContext.close(); }
});
