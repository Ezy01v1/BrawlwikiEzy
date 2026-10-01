import { expect, expectAccessible, test } from './fixtures';

test('#LLLL → aviso de mantenimiento', async ({ page }) => {
  await page.goto('/jugador/LLLL');
  await expect(page.getByRole('heading', { name: 'Brawl Stars está en mantenimiento' })).toBeVisible();
  await expectAccessible(page);
});

test('tag válido que no existe → 404 del jugador', async ({ page }) => {
  await page.goto('/jugador/9Q9Q');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese jugador' })).toBeVisible();
  await expectAccessible(page);
});

test('tag inválido por URL → página de tag inválido', async ({ page }) => {
  await page.goto('/jugador/HOLA');
  await expect(page.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeVisible();
});

test('tag no canónico redirige y conserva el tab', async ({ page }) => {
  await page.goto('/jugador/2pp?tab=partidas');
  await expect(page).toHaveURL('/jugador/2PP?tab=partidas');
});

test('#GGGG (Supercell tarda 4 s): primero el skeleton, después el perfil', async ({ page }) => {
  // Depende de que la API arranque con la caché vacía; Playwright levanta una API nueva en cada corrida.
  await page.goto('/jugador/GGGG', { waitUntil: 'commit' });
  await expect(page.getByRole('status', { name: 'Cargando perfil' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible({ timeout: 10_000 });
});

test('la imagen OG del perfil responde un PNG', async ({ page, request }) => {
  await page.goto('/jugador/2PP');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
  const res = await request.get(og!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});
