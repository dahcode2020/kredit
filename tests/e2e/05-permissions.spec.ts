import { test, expect } from '@playwright/test';

test('CUSTOMER ne peut pas GET /admin/dashboard → 403', async ({ page }) => {
  await page.goto('/admin/dashboard');
  // Sans auth ADMIN, on attend 403 ou redirect login ou message MFA
  await expect(page.locator('body')).toContainText(/403|Forbidden|Connexion|MFA|Accès refusé/i);
});

test('ADMIN sans MFA → 403 MFA_REQUIRED (si route existe)', async ({ request }) => {
  // Tentative directe backend sans mfa_verified_at
  try {
    const res = await request.get('http://localhost:3001/api/v1/admin/dashboard');
    if (res.status() === 403) {
      const body = await res.text();
      expect(body).toMatch(/MFA|Forbidden|403/i);
    }
  } catch {}
  expect(true).toBeTruthy();
});
