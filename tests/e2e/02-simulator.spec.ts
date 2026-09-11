import { test, expect } from '@playwright/test';

test('simulateur — sliders recalcul Decimal 338.62', async ({ page }) => {
  await page.goto('/fr');
  const simulator = page.locator('#simulateur, [data-testid="simulator"]').first();
  await expect(simulator).toBeVisible();

  // remplir si formulaire
  const amount = page.locator('input[name="amount"], input[type="range"]:near(:text("Montant"))').first();
  const term = page.locator('input[name="termMonths"], input[type="range"]:near(:text("Durée"))').first();
  if (await amount.count()) {
    await amount.fill('15000');
    await amount.dispatchEvent('input');
  }
  if (await term.count()) {
    await term.fill('48');
    await term.dispatchEvent('input');
  }

  // Résultat mensualité
  await expect(page.locator('text=/338[.,]62/').first()).toBeVisible({ timeout: 15000 });
  // disclaimer
  await expect(page.locator('text=/indicative/').first()).toBeVisible();
  // CTA vers création dossier
  await expect(page.getByRole('button', { name: /Continuer|Créer.*dossier|Demander/i }).first()).toBeVisible();
});
