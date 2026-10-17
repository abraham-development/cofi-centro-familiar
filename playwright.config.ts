import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Credenciales de las cuentas de demostración (generadas por `npm run seed:dev`).
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_PRODUCTION === "1" ? `npx next start --port ${PORT}` : `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/time`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
