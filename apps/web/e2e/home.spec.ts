import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('inicio: hero, eventos de los fixtures, navegación inferior y disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Busca tu perfil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atrapagemas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balón Brawl' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toBeVisible();
  await expect(page.getByText('Este material es no oficial y no está avalado por Supercell.')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test('tag inválido: error en línea y no navega', async ({ page }) => {
  await gotoReady(page, '/');
  const main = page.getByRole('main');
  await main.getByLabel('Tag del jugador').fill('hola!');
  await main.getByRole('button', { name: 'Buscar' }).click();
  await expect(main.getByRole('alert')).toContainText('0289PYLQGRJCUV');
  await expect(page).toHaveURL('/');
});
