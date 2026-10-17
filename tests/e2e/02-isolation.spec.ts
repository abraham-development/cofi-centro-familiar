import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("otra familia no puede abrir un evento ajeno ni por URL directa", async ({ browser }) => {
  const mama = await browser.newContext();
  const mamaPage = await mama.newPage();
  await login(mamaPage, "MAMA");
  await mamaPage.goto("/agenda?dias=30");
  const href = await mamaPage.getByRole("link", { name: /Visita de la tía Carmen/ }).first().getAttribute("href");
  expect(href).toMatch(/^\/agenda\/[0-9a-f-]{36}$/);
  await mama.close();

  const rosa = await browser.newContext();
  const rosaPage = await rosa.newPage();
  await login(rosaPage, "ROSA");
  await expect(rosaPage.getByText("Visita de la tía Carmen")).toHaveCount(0);
  await expect(rosaPage.getByText("Cumpleaños del abuelo (Pérez)").first()).toBeVisible();
  await rosaPage.goto(href!);
  await expect(rosaPage.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await rosa.close();
});

test("cambiar la cookie de familia no amplía permisos", async ({ browser }) => {
  const rosa = await browser.newContext();
  const page = await rosa.newPage();
  await login(page, "ROSA");
  await rosa.addCookies([
    { name: "cofi-family", value: "00000000-0000-4000-8000-000000000000", url: "http://localhost:3000" },
  ]);
  await page.goto("/casa");
  await expect(page.getByText("Visita de la tía Carmen")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Familia Pérez/ })).toBeVisible();
  await rosa.close();
});
