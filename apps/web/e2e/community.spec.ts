import type { Page } from '@playwright/test';
import { expect, expectAccessible, expectNoHorizontalScroll, gotoReady, test } from './fixtures';

// Proyecto `community` (ver playwright.config.ts): la API corre con MySQL (base bw_test_e2e recién migrada),
// AUTH_MOCK=1 y AUTH_MOCK_ADMIN=1. Todos los tests usan el mismo MockUser y la misma base, así que corren en orden
// y de a uno: el primero abre la temporada que necesitan el editor y /tierlist.
test.skip(!process.env.TEST_DATABASE_URL, 'Sin TEST_DATABASE_URL no hay MySQL para Comunidad');
// Dependen del primero (la temporada): si uno falla, los siguientes se omiten y un reintento corre todo desde el inicio.
test.describe.configure({ mode: 'serial' });

const SEASON = 'Temporada E2E';
/** Los 4 brawlers de los fixtures, cada uno en un tier distinto. */
const PLACEMENTS = [
  { name: 'Shelly', tier: 'S' },
  { name: 'Colt', tier: 'A' },
  { name: 'Bull', tier: 'B' },
  { name: 'Brock', tier: 'C' },
] as const;

/** Login mock: /auth/discord crea la sesión de MockUser (sin pasar por Discord) y redirige a `next`. */
async function login(page: Page, next: string) {
  await gotoReady(page, `/auth/discord?next=${next}`);
  await expect(page).toHaveURL(next);
}

const header = (page: Page) => page.getByRole('banner');

/** Espera a que termine la Server Action (POST con el header Next-Action) que dispara `act`. */
async function untilActionDone(page: Page, act: () => Promise<void>) {
  const response = page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action']);
  await act();
  await (await response).finished();
}

test('admin: abre "Temporada E2E" y aparece en el selector de /tierlist', async ({ page }) => {
  await login(page, '/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();

  await page.getByLabel('Nombre de la temporada').fill(SEASON);
  await page.getByRole('button', { name: 'Abrir temporada' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Temporada abierta' })).toBeVisible();
  // En un reintento ya hay una "Temporada E2E" (cerrada al abrir esta): se busca la activa.
  const seasonsList = page.getByRole('region', { name: 'Temporadas', exact: true });
  await expect(seasonsList.getByRole('listitem').filter({ hasText: SEASON }).filter({ hasText: 'Activa' })).toHaveCount(1);

  await gotoReady(page, '/tierlist');
  await expect(page.getByRole('heading', { level: 1, name: 'Tier list' })).toBeVisible();
  const picker = page.getByRole('form', { name: 'Elegir temporada' }).locator('select');
  await expect(picker.locator('option', { hasText: `${SEASON} (actual)` })).toHaveCount(1);
  await expect(picker.locator('option:checked')).toHaveText(`${SEASON} (actual)`);
});

test('editor: ubica los 4 brawlers, guarda y la tier list propia sobrevive a recargar', async ({ page }) => {
  await login(page, '/tierlist/editar');
  await expect(page.getByRole('heading', { level: 1, name: 'Armar mi tier list' })).toBeVisible();
  await expect(page.getByText(`${SEASON} · Toca un brawler`)).toBeVisible();

  const cards = page.getByRole('list', { name: 'Brawlers', exact: true });
  for (const { name, tier } of PLACEMENTS) {
    await cards.getByRole('button', { name: `${name}, sin ubicar` }).click();
    const dialog = page.getByRole('dialog', { name, exact: true });
    await dialog.getByRole('button', { name: tier, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(cards.getByRole('button', { name: `${name}, tier ${tier}` })).toBeVisible();
  }

  // 4 < 10: el voto se guarda pero todavía no cuenta para la comunidad.
  await expect(page.getByText('Ubica al menos 10 brawlers para que tu voto cuente')).toBeVisible();
  await expect(page.getByText('Tienes cambios sin guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tu tier list se guardó' })).toBeVisible();

  // Tras guardar se borra el borrador de sessionStorage: lo que se ve al recargar viene de la API.
  await page.reload();
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
  for (const { name, tier } of PLACEMENTS) {
    await expect(cards.getByRole('button', { name: `${name}, tier ${tier}` })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  await expect(page.getByText('Tienes cambios sin guardar')).toHaveCount(0);
});

test('/tierlist: "0 votantes" y ningún brawler ubicado (MockUser ubicó menos de 10)', async ({ page }) => {
  await login(page, '/tierlist');
  await expect(page.getByText(`${SEASON} · 0 votantes`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Armar mi tier list' })).toHaveAttribute('href', '/tierlist/editar');

  // Los votos de quien ubicó menos de 10 brawlers se descartan: el agregado no tiene filas, así que S a D quedan
  // vacías y todo el catálogo cae en "Pocos votos" con 0 votos. El promedio con votos reales lo cubren los tests de la API.
  const fewVotes = page.getByRole('region', { name: 'Pocos votos' });
  await expect(fewVotes).toBeVisible();
  await expect(fewVotes.getByText('Sin brawlers')).toHaveCount(0);
  await expect(fewVotes.getByRole('link', { name: /Shelly, .*0 votos/ })).toBeVisible();
  await expect(page.getByRole('main').getByText('Sin brawlers')).toHaveCount(5);
});

test('favorito con sesión: sobrevive a recargar y no usa localStorage', async ({ page }) => {
  await login(page, '/club/2YPLQ');
  const save = page.getByRole('button', { name: 'Guardar en favoritos' });
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await untilActionDone(page, () => save.click());

  await page.reload();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.localStorage.getItem('bw:favorites'))).toBeNull();
});

test('"Este soy yo" en /jugador/2PP → "Mi perfil" en el header', async ({ page }) => {
  await login(page, '/jugador/2PP');
  await expect(page.getByRole('heading', { level: 1, name: 'EzyPlayer' })).toBeVisible();
  await page.getByRole('button', { name: 'Este soy yo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tag vinculado' })).toBeVisible();

  const profile = header(page).getByRole('link', { name: 'Mi perfil' });
  await expect(profile).toHaveAttribute('href', '/jugador/2PP');
  await page.reload();
  await expect(header(page).getByRole('link', { name: 'Mi perfil' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Este soy yo' })).toHaveCount(0);
});

test('a 375 px: /tierlist, /tierlist/editar y /cuenta son accesibles y sin scroll horizontal', async ({ page }) => {
  await login(page, '/tierlist');
  await page.setViewportSize({ width: 375, height: 800 });
  for (const [path, title] of [
    ['/tierlist', 'Tier list'],
    ['/tierlist/editar', 'Armar mi tier list'],
    ['/cuenta', 'Mi cuenta'],
  ] as const) {
    await gotoReady(page, path);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  }
});

test('cerrar sesión desde /cuenta vuelve a "Entrar"', async ({ page }) => {
  await login(page, '/cuenta');
  await expect(header(page).getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page).toHaveURL('/');
  await expect(header(page).getByRole('link', { name: 'Entrar' })).toBeVisible();
  await expect(header(page).getByRole('link', { name: 'Mi cuenta' })).toHaveCount(0);
});

test('sin sesión: "Entrar" lleva al login con la ruta actual en `next`', async ({ page }) => {
  await gotoReady(page, '/');
  await expect(header(page).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/auth/discord?next=/');

  await gotoReady(page, '/tierlist');
  await expect(page.getByRole('link', { name: 'Entra con Discord para votar' })).toHaveAttribute(
    'href',
    '/auth/discord?next=/tierlist',
  );
});

test('sin sesión, /admin responde 404', async ({ page }) => {
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administración' })).toHaveCount(0);
});
