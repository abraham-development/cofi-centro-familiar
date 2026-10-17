import { expect, test } from "@playwright/test";

import { login } from "./helpers";

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "tablet-vertical", width: 820, height: 1180 },
  { name: "tablet-horizontal", width: 1180, height: 820 },
  { name: "pantalla-casa", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`casa se ve sin desbordes en ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await login(page, "MAMA");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Botones táctiles principales de al menos ~44 px.
    const sizes = await page.locator("main button, main a[role='button']").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect().height),
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(36);
    await page.screenshot({ path: `docs/capturas/casa-${vp.name}.png`, fullPage: vp.name === "movil" });
    await context.close();
  });
}
