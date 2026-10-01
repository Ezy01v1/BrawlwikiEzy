import { expect, expectAccessible, test } from './fixtures';

// Proyecto `cooldown`: corre después de todos los demás (ver playwright.config.ts).
test('#RRRR → "Vas muy rápido" con cuenta regresiva', async ({ page }) => {
  await page.goto('/jugador/RRRR');
  // getByRole('alert') también resuelve al anunciador de rutas de Next (__next-route-announcer__),
  // que no es nuestro componente: filtramos por el texto del ErrorState.
  const alert = page.getByRole('alert').filter({ hasText: 'Vas muy rápido' });
  await expect(alert).toContainText('Vas muy rápido');
  await expect(alert.getByRole('button', { name: /Reintentar en \d+ s/ })).toBeDisabled();
  await expectAccessible(page);
});
