import { expect, test } from "@playwright/test";

import { limaToday, login, watchConsole } from "./helpers";
import { addDays, formatLongDate } from "../../src/lib/time/zoned";

/**
 * Agenda visual: calendario del mes a la izquierda, el día por horas a la
 * derecha y agendar tocando una hora. Crea y cancela sus propios datos.
 */
test.describe.configure({ mode: "serial" });

const escape = (s: string) => s.replace(/[[\]().*+?^$|\\]/g, "\\$&");

test("el calendario lateral elige el día y la grilla muestra sus horas", async ({ page }) => {
  const problems = watchConsole(page);
  await login(page, "MAMA");
  await page.goto("/agenda");
  const today = limaToday();
  const tomorrow = addDays(today, 1);
  const calendar = page.getByRole("complementary", { name: "Calendario" });
  await expect(calendar.getByRole("link", { name: new RegExp(`^${formatLongDate(today)} \\(hoy\\)`) })).toHaveAttribute(
    "aria-current",
    "date",
  );
  // Hoy se ve la línea de la hora actual.
  await expect(page.getByText(/^Ahora · /)).toBeVisible();

  await calendar.getByRole("link", { name: new RegExp(`^${formatLongDate(tomorrow)}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/agenda\\?dia=${tomorrow}$`));
  await expect(page.getByRole("heading", { level: 2, name: formatLongDate(tomorrow) })).toBeVisible();
  await expect(page.getByRole("region", { name: formatLongDate(tomorrow) }).locator("header")).toContainText("Mañana");
  await expect(page.getByRole("button", { name: "Agendar a las 9:00 AM" })).toBeVisible();
  await expect(page.getByText(/^Ahora · /)).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("tocar una hora y escribir: se agenda con su hora de inicio y los avisos marcados", async ({ page }) => {
  const problems = watchConsole(page);
  await login(page, "MAMA");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const date = addDays(limaToday(), 2);
  const title = `[E2E] Encuentro con el arquitecto ${Date.now()}`;
  await page.goto(`/agenda?dia=${date}`);

  // La demostración tiene algo de 5 a 7 PM: la franja derecha sigue libre para agendar.
  const slot = page.getByRole("button", { name: "Agendar a las 5:00 PM" });
  const slotBox = await slot.boundingBox();
  await slot.click({ position: { x: slotBox!.width - 16, y: 10 } });
  const dialog = page.getByRole("dialog", { name: "Agendar" });
  await expect(dialog).toContainText(formatLongDate(date));
  const start = dialog.getByLabel("¿A qué hora empieza?");
  await expect(start).toHaveValue("17:00");
  await expect(dialog.getByRole("button", { name: "No sé" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "1 h antes" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "15 min antes" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Al empezar" })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByLabel("¿Qué vas a hacer?").fill(title);
  await start.fill("17:30");
  await dialog.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(page.getByText(`Agendado: ${title} · 5:30 PM`)).toBeVisible();
  await expect(dialog).toBeHidden();

  const block = page.getByRole("list", { name: "Agendado" }).getByRole("link", { name: new RegExp(escape(title)) });
  await expect(block).toContainText("5:30 PM");
  await expect(
    page.getByRole("complementary", { name: "Calendario" }).getByRole("link", {
      name: new RegExp(`^${formatLongDate(date)}: \\d+ agendados?$`),
    }),
  ).toBeVisible();

  // Persiste y se guardó sin hora de fin, con avisos 1 h y 15 min antes.
  await page.reload();
  await expect(page.getByRole("list", { name: "Agendado" }).getByRole("link", { name: new RegExp(escape(title)) })).toBeVisible();
  await page.screenshot({ path: "docs/capturas/agenda-dia-escritorio.png" });
  await page.getByRole("list", { name: "Agendado" }).getByRole("link", { name: new RegExp(escape(title)) }).press("Enter");
  await expect(page.getByLabel("Empieza")).toHaveValue("17:30");
  await expect(page.getByLabel("Termina (opcional)")).toHaveValue("");
  await expect(page.getByRole("button", { name: "1 h antes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "15 min antes" })).toHaveAttribute("aria-pressed", "true");

  // Limpieza: cancelar el evento de prueba.
  await page.getByRole("button", { name: "Cancelar evento" }).click();
  await page.getByLabel("Motivo (opcional)").fill("Prueba automática");
  await page.getByRole("button", { name: "Sí, cancelar evento" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await page.goto(`/agenda?dia=${date}`);
  await expect(page.getByRole("link", { name: new RegExp(escape(title)) })).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("«Más opciones» lleva al formulario completo con lo escrito", async ({ page }) => {
  await login(page, "MAMA");
  const date = addDays(limaToday(), 3);
  const title = `[E2E] Borrador ${Date.now()}`;
  await page.goto(`/agenda?dia=${date}`);
  // Con teclado: Enter sobre la hora propone la hora en punto.
  await page.getByRole("button", { name: "Agendar a las 9:00 AM" }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Agendar" });
  await dialog.getByLabel("¿Qué vas a hacer?").fill(title);
  await dialog.getByRole("button", { name: "1 h", exact: true }).click();
  await dialog.getByRole("button", { name: "Más opciones" }).click();

  await expect(page).toHaveURL(/\/agenda\/nuevo\?fecha=.+&hora=09:00&borrador=1/);
  await expect(page.getByLabel("¿Qué es?")).toHaveValue(title);
  await expect(page.getByLabel("Empieza")).toHaveValue("09:00");
  await expect(page.getByLabel("Termina (opcional)")).toHaveValue("10:00");
  await expect(page.getByRole("button", { name: "1 h antes" })).toHaveAttribute("aria-pressed", "true");
  // El borrador se consume: al recargar no vuelve a aparecer.
  await page.reload();
  await expect(page.getByLabel("¿Qué es?")).toHaveValue("");
});

test("la vista Lista conserva los próximos 7 y 30 días", async ({ page }) => {
  await login(page, "MAMA");
  await page.goto("/agenda");
  const calendar = page.getByRole("complementary", { name: "Calendario" });
  await calendar.getByRole("button", { name: "Lista" }).click();
  await expect(page).toHaveURL(/vista=lista/);
  await expect(page).toHaveURL(/dias=7/);
  await calendar.getByRole("button", { name: "30 días" }).click();
  await expect(page).toHaveURL(/dias=30/);
  await expect(page.getByRole("link", { name: /Visita de la tía Carmen/ }).first()).toBeVisible();
  await calendar.getByRole("button", { name: "Día", exact: true }).click();
  await expect(page).not.toHaveURL(/vista=lista/);
  await expect(page.getByRole("list", { name: "Agendado" })).toBeAttached();
});

test("«Pendientes de hoy»: lo de otros días queda plegado en «Más adelante»", async ({ page }) => {
  await login(page, "MAMA");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Pendientes de hoy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pendientes de hoy" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  const title = `[E2E] Renovar el seguro ${Date.now()}`;
  await page.goto("/pendientes/nuevo");
  await page.getByLabel("¿Qué hay que hacer?").fill(title);
  await page.getByLabel("Fecha (opcional)").fill(addDays(limaToday(), 3));
  await page.getByRole("button", { name: "Guardar pendiente" }).click();
  await expect(page).toHaveURL(/\/pendientes$/);
  const later = page.getByText(/^Más adelante \(\d+\)$/);
  await expect(later).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeHidden();
  await later.click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Limpieza: marcarlo como hecho.
  await page.getByRole("button", { name: `Marcar como hecho: ${title}` }).click();
  await expect(page.getByText(`Hecho: ${title}`)).toBeVisible();
});

test("en el celular el calendario va arriba, el día debajo y nada desborda", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await login(page, "MAMA");
  const date = addDays(limaToday(), 2);
  await page.goto(`/agenda?dia=${date}`);
  await expect(page.getByRole("heading", { level: 2, name: formatLongDate(date) })).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow(), "agenda desborda").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "docs/capturas/agenda-dia-movil.png", fullPage: true });

  const slot = page.getByRole("button", { name: "Agendar a las 6:00 PM" });
  const slotBox = await slot.boundingBox();
  await slot.click({ position: { x: slotBox!.width - 16, y: 10 } });
  const dialog = page.getByRole("dialog", { name: "Agendar" });
  await expect(dialog.getByRole("button", { name: "Agendar", exact: true })).toBeInViewport();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await dialog.getByLabel("¿Qué vas a hacer?").fill("Visita del técnico del gas");
  await page.screenshot({ path: "docs/capturas/agenda-agendar-movil.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await ctx.close();
});
