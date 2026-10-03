import { expect, expectAccessible, expectNoHorizontalScroll, test } from './fixtures';

test('ranking global de jugadores con podio en texto y links al perfil', async ({ page }) => {
  await page.goto('/rankings');
  await expect(page.getByRole('heading', { level: 1, name: 'Rankings' })).toBeVisible();
  await expect(page.getByText('Top 50 · Global')).toBeVisible();
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Puesto 1');
  await expect(rows.first().getByRole('link', { name: 'xXProXx' })).toHaveAttribute('href', '/jugador/YYYY');
  await expect(rows.nth(2)).toContainText('Sin club');
  await expectAccessible(page);
});

test('cambiar la región con el formulario la deja en la URL', async ({ page }) => {
  await page.goto('/rankings');
  await page.getByLabel('Región').selectOption('MX');
  await page.getByRole('button', { name: 'Ver ranking' }).click();
  await expect(page).toHaveURL('/rankings?tipo=jugadores&region=MX');
  await expect(page.getByText('Top 50 · México')).toBeVisible();
  await expect(page.getByLabel('Región')).toHaveValue('MX');
});

test('la pestaña Clubes conserva la región', async ({ page }) => {
  await page.goto('/rankings?tipo=jugadores&region=MX');
  await page.getByRole('navigation', { name: 'Tipo de ranking' }).getByRole('link', { name: 'Clubes' }).click();
  await expect(page).toHaveURL('/rankings?tipo=clubes&region=MX');
  const first = page.getByRole('main').getByRole('listitem').first();
  await expect(first.getByRole('link', { name: 'Los Cracks' })).toHaveAttribute('href', '/club/2YPLQ');
  await expect(first).toContainText('30 miembros');
  await expectAccessible(page);
});

test('por brawler: primero pide elegir y después muestra el ranking', async ({ page }) => {
  await page.goto('/rankings?tipo=brawler');
  await expect(page.getByText('Usa el selector para ver los mejores jugadores con ese brawler.')).toBeVisible();
  await page.getByLabel('Brawler').selectOption({ label: 'Bull' });
  await page.getByRole('button', { name: 'Ver ranking' }).click();
  await expect(page).toHaveURL('/rankings?tipo=brawler&region=global&brawler=16000002');
  await expect(page.getByText('Top 50 · Global · Bull')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'xXProXx' })).toBeVisible();
});

test('a 375px los rankings no tienen scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ['/rankings', '/rankings?tipo=clubes']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Rankings' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
