import { test, expect } from '@playwright/test';

for (const locale of ['fr','en','nl','de'] as const) {
  test(`landing ${locale} — titre, hero, stats, simulateur`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level:1 }).first()).toBeVisible();
    // hero CTA
    await expect(page.getByRole('link', { name: /Simuler|Simulate|Simuleren|Simulieren/i }).first()).toBeVisible();
    // simulateur
    await expect(page.locator('#simulateur, [data-testid="simulator"]').first()).toBeVisible();
    // stats
    await expect(page.locator('text=/\\d+[\\s ]*%/').first()).toBeVisible();
    // footer disclaimer SECCI
    await expect(page.locator('footer')).toContainText(/indicative|SECCI|ADMIN/i);
    // manifest link
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toContain('manifest');
  });
}

test('SEO — title + og:image', async ({ page }) => {
  await page.goto('/fr');
  await expect(page).toHaveTitle(/KREDIT/i);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
});
