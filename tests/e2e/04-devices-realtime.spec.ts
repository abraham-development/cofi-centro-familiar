import { appendFileSync, mkdirSync } from "node:fs";

import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * Hito B de punta a punta con tres navegadores:
 *   Mamá (celular) · Pantalla de la cocina · Tablet del cuarto de Mateo.
 * Se ejecuta en serie: cada paso depende del anterior.
 */
test.describe.configure({ mode: "serial" });

let mamaCtx: BrowserContext;
let kitchenCtx: BrowserContext;
let roomCtx: BrowserContext;
let mama: Page;
let kitchen: Page;
let room: Page;

const latencies: Record<string, number> = {};

function recordLatency(name: string, ms: number) {
  latencies[name] = ms;
  mkdirSync("test-results", { recursive: true });
  appendFileSync("test-results/latencias.txt", `${new Date().toISOString()} ${name}: ${ms} ms\n`);
}

async function pair(device: Page, scope: "home" | "child", name: string) {
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

  // La pantalla detecta la aprobación por sí sola (consulta cada 3 s).
  await expect(device).toHaveURL(/\/pantalla$/, { timeout: 15_000 });
}

test.beforeAll(async ({ browser }) => {
  mamaCtx = await browser.newContext();
  kitchenCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  roomCtx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  mama = await mamaCtx.newPage();
  kitchen = await kitchenCtx.newPage();
  room = await roomCtx.newPage();
  await login(mama, "MAMA");
});

test.afterAll(async () => {
  console.log("Latencias medidas:", latencies);
  await Promise.all([mamaCtx?.close(), kitchenCtx?.close(), roomCtx?.close()]);
});

test("una pantalla sin vincular no ve datos y se vincula con un código aprobado", async () => {
  await kitchen.goto("/pantalla");
  await expect(kitchen).toHaveURL(/\/vincular/);
  await pair(kitchen, "home", "Cocina (E2E)");
  await expect(kitchen.getByRole("region", { name: "Reloj y próximo evento" })).toBeVisible();
  await expect(kitchen.getByText("Visita de la tía Carmen").first()).toBeVisible();
  // Lo marcado «solo adultos» no se proyecta en la cocina.
  await expect(kitchen.getByText("Reunión de padres (virtual)")).toHaveCount(0);
  await expect(kitchen.getByText("Pagar el internet")).toHaveCount(0);
  // La cocina no tiene acceso a la administración de adultos.
  await kitchen.goto("/casa");
  await expect(kitchen).toHaveURL(/\/acceso/);
  await kitchen.goto("/pantalla");
});

test("un evento creado en el celular aparece en la cocina sin recargar", async () => {
  await expect(kitchen.getByText("En vivo")).toBeVisible({ timeout: 20_000 });
  const title = `[E2E] Llega la abuela ${Date.now()}`;
  await mama.goto("/agenda/nuevo?volver=/casa");
  await mama.getByLabel("¿Qué es?").fill(title);
  await mama.getByRole("radio", { name: "Visita" }).click();
  await mama.getByRole("button", { name: "Toda la casa" }).click();
  const start = Date.now();
  await mama.getByRole("button", { name: "Guardar evento" }).click();
  await expect(kitchen.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  recordLatency("evento celular→cocina", Date.now() - start);
});

test("la cocina marca un pendiente y el celular lo ve en vivo", async () => {
  await mama.goto("/casa");
  await expect(mama.getByText("En vivo").first()).toBeVisible({ timeout: 20_000 });
  const kitchenPending = kitchen.getByRole("region", { name: "Pendientes de hoy" });
  const start = Date.now();
  await kitchenPending.getByRole("button", { name: "Marcar como hecho: Comprar gas" }).click();
  await expect(
    mama.getByRole("region", { name: "Pendientes de hoy" }).getByRole("button", { name: "Reabrir: Comprar gas" }),
  ).toBeVisible({ timeout: 15_000 });
  recordLatency("pendiente cocina→celular", Date.now() - start);
});

test("la tablet del cuarto de Mateo solo muestra lo suyo", async () => {
  await pair(room, "child", "Cuarto de Mateo (E2E)");
  await expect(room.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  const board = room.getByRole("region", { name: "Mis tareas de hoy" });
  await expect(board.getByText("Tender la cama")).toBeVisible();
  await expect(
    board.getByRole("listitem").filter({ hasText: "Ordenar el cuarto" }).getByText("Esperando revisión"),
  ).toBeVisible();
  // Nada de otros: ni la reunión de adultos ni el campamento de Sofía.
  await expect(room.getByText("Reunión de padres (virtual)")).toHaveCount(0);
  await expect(room.getByText("Campamento de Sofía")).toHaveCount(0);
  await expect(room.getByRole("region", { name: "Avisos" }).getByText("Dentista de Mateo")).toBeVisible();
});

test("el hijo cumple un hábito y ve sus puntos; el adulto aprueba y el hijo lo ve en vivo", async () => {
  const board = room.getByRole("region", { name: "Mis tareas de hoy" });
  const habit = board.getByRole("listitem").filter({ hasText: "Cepillarse los dientes" });
  await habit.getByRole("button", { name: "¡Listo!" }).click();
  await expect(room.getByText("¡Hecho! +5 puntos")).toBeVisible();
  await expect(room.getByRole("region", { name: "Mis puntos" }).getByText("40", { exact: true })).toBeVisible();

  await expect(room.getByText("En vivo")).toBeVisible({ timeout: 20_000 });
  await mama.goto("/responsabilidades");
  const item = mama.getByRole("listitem").filter({ hasText: "Ordenar el cuarto" }).filter({ hasText: "Mateo" });
  const start = Date.now();
  await item.getByRole("button", { name: /Aprobar/ }).click();
  await expect(room.getByRole("region", { name: "Mis puntos" }).getByText("50", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  recordLatency("aprobación celular→cuarto", Date.now() - start);
});

test("el hijo pide un premio y el adulto lo aprueba con descuento de saldo", async () => {
  const rewards = room.getByRole("region", { name: "Mis puntos" });
  await rewards.getByRole("listitem").filter({ hasText: "30 minutos de videojuego" }).getByRole("button", { name: "Pedir este premio" }).click();
  await expect(
    rewards.getByRole("listitem").filter({ hasText: "30 minutos de videojuego" }).getByText("Esperando a un adulto"),
  ).toBeVisible();

  await mama.goto("/premios");
  const request = mama.getByRole("listitem").filter({ hasText: "30 minutos de videojuego" }).filter({ hasText: "Mateo" });
  await request.getByRole("button", { name: "Aprobar" }).click();
  await expect(rewards.getByText("10", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(rewards.getByText("¡Aprobado! Pronto lo tendrás")).toBeVisible();
});

test("desvincular la tablet corta su acceso de inmediato", async () => {
  await mama.goto("/configuracion/dispositivos");
  const row = mama.getByRole("listitem").filter({ hasText: "Cuarto de Mateo (E2E)" });
  const start = Date.now();
  await row.getByRole("button", { name: "Desvincular" }).click();
  await mama.getByRole("button", { name: "Desvincular", exact: true }).last().click();
  await expect(room).toHaveURL(/\/vincular\?revocada=1/, { timeout: 15_000 });
  recordLatency("revocación→pantalla limpia", Date.now() - start);
  await expect(room.getByText("Esta pantalla fue desvinculada")).toBeVisible();
  // Volver a /pantalla no recupera nada.
  await room.goto("/pantalla");
  await expect(room).toHaveURL(/\/vincular/);
});
