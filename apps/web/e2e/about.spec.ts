import { expect, expectAccessible, test } from './fixtures';

test('el footer lleva a Acerca de y la página es accesible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Acerca de BrawlWiki' }).click();
  await expect(page).toHaveURL('/acerca');
  await expect(page.getByRole('heading', { level: 1, name: 'Acerca de BrawlWiki' })).toBeVisible();
  // En una navegación del cliente el <title> llega con la metadata, después del contenido: axe no debe correr antes.
  await expect(page).toHaveTitle(/Acerca de/);
  await expect(page.getByRole('link', { name: 'Fan Content Policy de Supercell' })).toHaveAttribute(
    'href',
    'https://supercell.com/en/fan-content-policy/',
  );
  await expectAccessible(page);
});
