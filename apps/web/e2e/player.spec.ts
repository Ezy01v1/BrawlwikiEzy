import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

test('buscar → perfil → Partidas → expandir partida → ir a otro jugador', async ({ page }) => {
  await gotoReady(page, '/');
  const main = page.getByRole('main');
  await main.getByLabel('Tag del jugador').fill(' #2pp ');
  await main.getByRole('button', { name: 'Buscar' }).click();

  await expect(page).toHaveURL('/jugador/2PP');
  await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible();
  await expect(page.getByText('43,002')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('navigation', { name: 'Secciones del perfil' }).getByRole('link', { name: 'Partidas' }).click();
  await expect(page).toHaveURL('/jugador/2PP?tab=partidas');
  await expect(page.getByRole('heading', { name: 'Últimas 4 partidas' })).toBeVisible();

  const row = page.getByRole('button', { name: /Atrapagemas/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expectAccessible(page);

  await page.getByRole('link', { name: 'SinClub' }).click();
  await expect(page).toHaveURL('/jugador/8QU');
  await expect(page.getByRole('heading', { level: 1, name: 'SinClub' })).toBeVisible();
  await expect(page.getByRole('main').getByText(/· Sin club/)).toBeVisible();
});

test('jugador sin partidas → estado vacío y ningún NaN', async ({ page }) => {
  await page.goto('/jugador/8QU?tab=partidas');
  await expect(page.getByText('Sin partidas recientes')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
  await expectAccessible(page);
});

test('tab Brawlers ordena por nombre y el orden queda en la URL', async ({ page }) => {
  await page.goto('/jugador/2PP?tab=brawlers');
  await page.getByRole('navigation', { name: 'Ordenar brawlers' }).getByRole('link', { name: 'Nombre' }).click();
  await expect(page).toHaveURL('/jugador/2PP?tab=brawlers&orden=nombre');
  await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', /^Brock,/);
  await expectAccessible(page);
});

test('a 375px no hay scroll horizontal en ningún tab', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const query of ['', '?tab=brawlers', '?tab=partidas']) {
    await page.goto(`/jugador/2PP${query}`);
    await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test('favoritos sobreviven a la recarga y la visita queda en recientes', async ({ page }) => {
  await gotoReady(page, '/jugador/2PP');
  await page.getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: /EzyPlayer/ })).toHaveAttribute('href', '/jugador/2PP');
});
