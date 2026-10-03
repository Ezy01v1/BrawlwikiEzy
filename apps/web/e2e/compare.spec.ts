import { expect, expectAccessible, test } from './fixtures';

test('desde la navegación inferior: comparar dos clubes con el formulario', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegación inferior' }).getByRole('link', { name: /Clubes/ }).click();
  await expect(page).toHaveURL('/clubes/comparar');
  await expect(page.getByRole('heading', { level: 1, name: 'Clubes' })).toBeVisible();
  await page.getByLabel('Club A').fill('2yplq');
  await page.getByLabel('Club B').fill('#8CGRV');
  await page.getByRole('button', { name: 'Comparar' }).click();
  await expect(page).toHaveURL('/clubes/comparar?a=2yplq&b=%238CGRV');
  const cards = page.getByRole('main').getByRole('listitem');
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText('Trofeos totales');
  await expect(cards.first()).toContainText('1,020,000');
  await expect(cards.first()).toContainText('940,000');
  await expect(cards.first()).toContainText('Mayor');
  await expectAccessible(page);
});

test('errores en línea: tag inválido y el mismo club dos veces', async ({ page }) => {
  await page.goto('/clubes/comparar?a=hola&b=8CGRV');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('0289PYLQGRJCUV');
  await expect(page.getByLabel('Club A')).toHaveAttribute('aria-invalid', 'true');
  await page.goto('/clubes/comparar?a=2YPLQ&b=2yplq');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Elige un club distinto');
  await expectAccessible(page);
});

test('un club que no existe se informa de su lado sin romper la página', async ({ page }) => {
  await page.goto('/clubes/comparar?a=2YPLQ&b=9Q9Q');
  await expect(page.getByText('No encontramos el club #9Q9Q')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Clubes' })).toBeVisible();
});

test('"Comparar con otro club" llega con el Club A completo', async ({ page }) => {
  await page.goto('/club/2YPLQ');
  await page.getByRole('link', { name: 'Comparar con otro club' }).click();
  await expect(page).toHaveURL('/clubes/comparar?a=2YPLQ');
  await expect(page.getByLabel('Club A')).toHaveValue('2YPLQ');
});
