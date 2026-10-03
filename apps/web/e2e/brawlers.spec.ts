import { expect, expectAccessible, expectNoHorizontalScroll, test } from './fixtures';

test('catálogo sin metadatos: 4 brawlers, sin selects de rareza ni clase, accesible y sin scroll a 375px', async ({
  page,
}) => {
  await page.goto('/brawlers');
  await expect(page.getByRole('heading', { level: 1, name: 'Brawlers' })).toBeVisible();
  await expect(page.getByText('Mostrando 4 de 4 brawlers')).toBeVisible();
  await expect(page.getByText('La rareza y la clase todavía no están disponibles.')).toBeVisible();
  await expect(page.getByLabel('Rareza')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Shelly' })).toHaveAttribute('href', '/brawlers/16000000');
  await expectAccessible(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);
});

test('buscar sin acentos ni mayúsculas y quitar filtros', async ({ page }) => {
  await page.goto('/brawlers');
  await page.getByLabel('Buscar brawler').fill('BÚ');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL('/brawlers?q=B%C3%9A');
  await expect(page.getByText('Mostrando 1 de 4 brawlers')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bull' })).toBeVisible();
  await page.getByRole('link', { name: 'Quitar filtros' }).click();
  await expect(page).toHaveURL('/brawlers');
  await expect(page.getByText('Mostrando 4 de 4 brawlers')).toBeVisible();
});

test('sin coincidencias → estado vacío', async ({ page }) => {
  await page.goto('/brawlers?q=zzz');
  await expect(page.getByText('Ningún brawler coincide')).toBeVisible();
  await expect(page.getByText('Mostrando 0 de 4 brawlers')).toBeVisible();
});

test('detalle: gadgets, habilidades estelares y mejores jugadores con link al ranking completo', async ({ page }) => {
  await page.goto('/brawlers');
  await page.getByRole('link', { name: 'Shelly' }).click();
  await expect(page).toHaveURL('/brawlers/16000000');
  await expect(page.getByRole('heading', { level: 1, name: 'Shelly' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Gadgets' })).toContainText('Fast Forward');
  await expect(page.getByRole('region', { name: 'Habilidades estelares' })).toContainText('Shell Shock');
  const top = page.getByRole('region', { name: 'Mejores jugadores' });
  await expect(top.getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
  await expect(top.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute(
    'href',
    '/rankings?tipo=brawler&brawler=16000000',
  );
  await expectAccessible(page);
});

test('id inexistente o mal formado → 404 del brawler', async ({ page }) => {
  await page.goto('/brawlers/99999999');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeVisible();
  await page.goto('/brawlers/abc');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese brawler' })).toBeVisible();
});
