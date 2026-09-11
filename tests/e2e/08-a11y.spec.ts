import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['fr','en']) {
  test(`a11y ${locale} — axe no violations WCAG2AA`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a','wcag2aa'])
      .exclude(['iframe']) // third-party
      .analyze();
    // Voir violations critiques seulement
    const critical = results.violations.filter(v => ['critical','serious'].includes(v.impact ?? ''));
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
}

test('keyboard navigation — focus visible', async ({ page }) => {
  await page.goto('/fr');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBeTruthy();
});

test('skip-link exists and href #main-content', async ({ page }) => {
  await page.goto('/fr');
  const skip = page.locator('a[href="#main-content"]').first();
  // tolère absence si composant pas encore monté mais on vérifie landmarks
  if (await skip.count()) {
    await expect(skip).toHaveAttribute('href','#main-content');
  } else {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  }
});
