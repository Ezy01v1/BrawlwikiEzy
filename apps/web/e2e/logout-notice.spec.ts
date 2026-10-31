import { expect, gotoReady, test } from './fixtures';

// Sin TEST_DATABASE_URL la API corre sin Comunidad: POST /auth/logout le responde 404 y el route handler de la web
// tiene que volver a /?logout=error (no a /?login=error), donde LoginNotice muestra su aviso.
test('si la API no puede cerrar la sesión, vuelve a / con el aviso de logout', async ({ page }) => {
  test.skip(!!process.env.TEST_DATABASE_URL, 'Con MySQL la API sí cierra la sesión (401 sin sesión → /)');
  await gotoReady(page, '/');
  // El mismo POST que el botón "Cerrar sesión" de /cuenta (que sin sesión no se muestra).
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/auth/logout';
    document.body.append(form);
    form.submit();
  });
  await expect(page).toHaveURL('/?logout=error');
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo cerrar la sesión' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo iniciar sesión' })).toHaveCount(0);
});
