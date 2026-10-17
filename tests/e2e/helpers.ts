import { expect, type Page } from "@playwright/test";

export type DemoAccount = "MAMA" | "PAPA" | "ROSA";

export function credentials(who: DemoAccount) {
  const email = process.env[`DEMO_${who}_EMAIL`];
  const password = process.env[`DEMO_${who}_PASSWORD`];
  if (!email || !password) throw new Error("Faltan cuentas de demostración: ejecuta `npm run seed:dev`.");
  return { email, password };
}

export async function login(page: Page, who: DemoAccount) {
  const { email, password } = credentials(who);
  await page.goto("/acceso");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/casa$/);
}

/** Falla la prueba si React informa errores de hidratación o hay errores de consola. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/favicon|Download the React DevTools/.test(msg.text())) problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  return problems;
}

export function limaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // YYYY-MM-DD
}
