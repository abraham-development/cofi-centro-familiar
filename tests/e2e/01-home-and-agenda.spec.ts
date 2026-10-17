import { expect, test } from "@playwright/test";

import { limaToday, login, watchConsole } from "./helpers";
import { addDays, formatLongDate } from "../../src/lib/time/zoned";

test("sin sesión, las rutas privadas llevan al acceso", async ({ page }) => {
  await page.goto("/casa");
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("la pantalla de casa muestra la fecha real, el próximo evento y el radar", async ({ page }) => {
  const problems = watchConsole(page);
  await login(page, "MAMA");
  const clock = page.getByRole("region", { name: "Reloj y próximo evento" });
  await expect(clock.getByText(formatLongDate(limaToday()))).toBeVisible();
  await expect(clock.locator("time")).toHaveText(/^\d{1,2}:\d{2}$/);
  await expect(clock.getByText(/^En .+|Sin eventos próximos|Ahora/).first()).toBeVisible();

  const radar = page.getByRole("region", { name: "Próximos 7 días" });
  await expect(radar.getByText("Visita de la tía Carmen")).toBeVisible();
  await expect(radar.getByText("Examen de Matemáticas")).toBeVisible();
  // Datos de otra familia nunca aparecen.
  await expect(page.getByText("Cumpleaños del abuelo (Pérez)")).toHaveCount(0);

  const pending = page.getByRole("region", { name: "Pendientes de la casa" });
  await expect(pending.getByText("Comprar gas")).toBeVisible();
  await expect(pending.getByText(/Atrasado/).first()).toBeVisible();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("crear, editar y cancelar un evento persiste en la base de datos", async ({ page }) => {
  await login(page, "MAMA");
  const date = addDays(limaToday(), 2);
  const title = `[E2E] Reunión con el técnico ${Date.now()}`;

  await page.goto(`/agenda/nuevo?fecha=${date}`);
  await page.getByLabel("¿Qué es?").fill(title);
  await page.getByRole("radio", { name: "Hogar" }).click();
  await page.getByLabel("Empieza").fill("11:00");
  await expect(page.getByLabel("Termina (opcional)")).toHaveValue("12:00");
  await page.getByRole("button", { name: /Mateo/ }).click();
  await page.getByRole("button", { name: "Guardar evento" }).click();
  await expect(page).toHaveURL(/\/agenda$/);

  // Persistencia: recargar y verlo en la agenda y en el radar de casa.
  await page.goto(`/agenda?desde=${date}&dias=1`);
  const link = page.getByRole("link", { name: new RegExp(title.replace(/[[\]]/g, "\\$&")) });
  await expect(link).toBeVisible();
  await expect(link).toContainText("11:00 AM – 12:00 PM");
  await page.goto("/casa");
  await expect(page.getByRole("region", { name: "Próximos 7 días" }).getByText(title)).toBeVisible();

  // Editar
  await page.goto(`/agenda?desde=${date}&dias=1`);
  await page.getByRole("link", { name: new RegExp(title.replace(/[[\]]/g, "\\$&")) }).click();
  await page.getByLabel("Empieza").fill("15:30");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await page.goto(`/agenda?desde=${date}&dias=1`);
  await expect(page.getByRole("link", { name: new RegExp(title.replace(/[[\]]/g, "\\$&")) })).toContainText("3:30 PM");

  // Cancelar (con confirmación explícita)
  await page.getByRole("link", { name: new RegExp(title.replace(/[[\]]/g, "\\$&")) }).click();
  await page.getByRole("button", { name: "Cancelar evento" }).click();
  await page.getByLabel("Motivo (opcional)").fill("Prueba automática");
  await page.getByRole("button", { name: "Sí, cancelar evento" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await page.goto("/casa");
  await expect(page.getByText(title)).toHaveCount(0);
});

test("un pendiente del hogar se crea, se completa y sigue completado al recargar", async ({ page }) => {
  await login(page, "MAMA");
  const title = `[E2E] Sacar la basura ${Date.now()}`;
  const pending = page.getByRole("region", { name: "Pendientes de la casa" });
  await pending.getByLabel("Nuevo pendiente para hoy").fill(title);
  await pending.getByRole("button", { name: "Agregar pendiente" }).click();
  await expect(pending.getByText(title)).toBeVisible();

  await pending.getByRole("button", { name: `Marcar como hecho: ${title}` }).click();
  await expect(pending.getByRole("button", { name: `Reabrir: ${title}` })).toHaveAttribute("aria-pressed", "true");
  // Esperar la confirmación del servidor (no solo el estado optimista) antes de recargar.
  await expect(page.getByText(`Hecho: ${title}`)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pendientes de la casa" }).getByRole("button", { name: `Reabrir: ${title}` }),
  ).toBeVisible();
});
