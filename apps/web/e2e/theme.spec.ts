import { expect, expectAccessible, gotoReady, test } from './fixtures';

test('en modo claro los chips del battle log cumplen AA y el foco se ve', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'theme', value: 'light', url: baseURL }]);
  await gotoReady(page, '/jugador/2PP?tab=partidas');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const row = page.getByRole('button', { name: /Atrapagemas/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expectAccessible(page);

  const link = page.getByRole('main').getByRole('link').first();
  await link.focus();
  const outlineColor = await link.evaluate((el) => getComputedStyle(el).outlineColor);
  expect(outlineColor).toBe('rgb(138, 99, 0)');
});

test('el tema claro persiste al recargar y la página sigue accesible', async ({ page }) => {
  await gotoReady(page, '/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expectAccessible(page);
});

test('en modo claro las secciones nuevas no tienen violaciones de axe', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'theme', value: 'light', url: baseURL }]);
  const paths = [
    '/club/2YPLQ',
    '/clubes/comparar?a=2YPLQ&b=8CGRV',
    '/rankings',
    '/brawlers',
    '/brawlers/16000000',
    '/acerca',
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});
