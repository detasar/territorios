import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openAuthenticatedGame(page: import('@playwright/test').Page) {
  await page.goto('/signin-with-chatgpt?return_to=%2F');
  await expect(page.getByRole('group', { name: /mapa de territorios/i })).toBeVisible();
  await expect(page.locator('#community-hub')).toBeVisible();
}

test('meets the automated WCAG 2.2 AA gate', async ({ page }) => {
  await openAuthenticatedGame(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('supports keyboard tab navigation and 390px reflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedGame(page);

  const leaderboard = page.getByRole('tab', { name: 'Clasificación' });
  await leaderboard.scrollIntoViewIfNeeded();
  await leaderboard.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Consejo' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Consejo' })).toHaveAttribute('aria-selected', 'true');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
