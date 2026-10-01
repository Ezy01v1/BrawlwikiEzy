import { expect, test } from '@playwright/test';

test('la API de E2E corre con fixtures (nunca con la key real)', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:4100/api/v1/health');
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { supercell: string } };
  expect(body.data.supercell).toBe('mock');
});
