import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/** IP distinta por test (rango 198.18.0.0/15): cada test tiene su propio cupo de 60 req/min en Express. */
function ipFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `198.18.${(h >>> 8) & 255}.${(h & 255) || 1}`;
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ipFor(testInfo.testId) });
    await use(page);
  },
});

export { expect };

/** Navega y espera la hidratación: antes de eso, un clic se pierde. */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}
