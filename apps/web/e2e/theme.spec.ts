import { expect, expectAccessible, gotoReady, test } from './fixtures';

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
