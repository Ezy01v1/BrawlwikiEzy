import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('perfil → club: header, miembros y link a cada jugador', async ({ page }) => {
  await page.goto('/jugador/2PP');
  await page.getByRole('main').getByRole('link', { name: 'Los Cracks' }).click();
  await expect(page).toHaveURL('/club/2YPLQ');
  await expect(page.getByRole('heading', { level: 1, name: 'Los Cracks' })).toBeVisible();
  await expect(page.getByText('#2YPLQ · Solo por invitación')).toBeVisible();
  const members = page.getByRole('region', { name: /Miembros/ });
  await expect(members.getByRole('listitem')).toHaveCount(3);
  await expect(members.getByRole('link', { name: 'EzyPlayer' })).toHaveAttribute('href', '/jugador/2PP');
  await expect(members.getByRole('listitem').first()).toContainText('Presidente');
  await expectAccessible(page);
});

test('un club favorito y visitado aparece en Favoritos y en Recientes del inicio', async ({ page }) => {
  await gotoReady(page, '/club/2YPLQ');
  await page.getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'FAVORITOS' }).getByRole('link', { name: /Los Cracks/ })).toHaveAttribute(
    'href',
    '/club/2YPLQ',
  );
  await expect(page.getByRole('region', { name: 'RECIENTES' }).getByRole('link', { name: /Los Cracks/ })).toHaveAttribute(
    'href',
    '/club/2YPLQ',
  );
});

test('club: tag no canónico redirige, inexistente da 404 e inválido da tag inválido', async ({ page }) => {
  await page.goto('/club/2yplq');
  await expect(page).toHaveURL('/club/2YPLQ');
  await page.goto('/club/9Q9Q');
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos ese club' })).toBeVisible();
  await page.goto('/club/HOLA');
  await expect(page.getByRole('heading', { level: 1, name: 'Tag inválido' })).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Tag del club')).toBeVisible();
});

test('#LLLL en un club → aviso de mantenimiento', async ({ page }) => {
  await page.goto('/club/LLLL');
  await expect(page.getByRole('heading', { name: 'Brawl Stars está en mantenimiento' })).toBeVisible();
});

test('a 375px el club no tiene scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/club/2YPLQ');
  await expect(page.getByRole('heading', { level: 1, name: 'Los Cracks' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('a 375px una descripción larga sin espacios no genera scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/club/2YPLQ');
  await expect(page.getByRole('heading', { level: 1, name: 'Los Cracks' })).toBeVisible();
  await page.evaluate(() => {
    document.querySelector('[data-club-description]')!.textContent = 'A'.repeat(300);
  });
  await expectNoHorizontalScroll(page);
});

test('la imagen OG del club responde un PNG', async ({ page, request }) => {
  await page.goto('/club/2YPLQ');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
  const res = await request.get(og!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});
