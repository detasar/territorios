import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openAuthenticatedGame(page: import('@playwright/test').Page) {
  await page.goto('/signin-with-chatgpt?return_to=%2F');
  await expect(page.getByRole('group', { name: /mapa de territorios/i })).toBeVisible();
  await expect(page.locator('#community-hub')).toBeVisible();
}

test('meets the automated WCAG 2.2 AA gate', async ({ page }) => {
  await openAuthenticatedGame(page);
  const mapFill = await page.locator('.map-stage').evaluate((stage) => {
    const stageRect = stage.getBoundingClientRect();
    const paths = Array.from(stage.querySelectorAll<SVGGraphicsElement>('.province-layer path:not([data-inset])'));
    const boxes = paths.map((path) => path.getBoundingClientRect());
    const left = Math.min(...boxes.map((box) => box.left));
    const right = Math.max(...boxes.map((box) => box.right));
    const top = Math.min(...boxes.map((box) => box.top));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return {
      widthRatio: (right - left) / stageRect.width,
      heightRatio: (bottom - top) / stageRect.height,
    };
  });
  expect(mapFill.widthRatio).toBeGreaterThan(0.53);
  expect(mapFill.heightRatio).toBeGreaterThan(0.45);
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

  const center = page.getByRole('button', { name: 'Centrar mapa' });
  const fullscreen = page.getByRole('button', { name: 'Pantalla completa' });
  const help = page.getByRole('button', { name: 'Mostrar ayuda del mapa' });
  await expect(center).toBeVisible();
  await expect(fullscreen).toBeVisible();
  await expect(help).toBeVisible();
  expect((await center.boundingBox())?.width).toBeGreaterThanOrEqual(34);

  const overlap = await page.locator('.map-stage').evaluate(() => {
    const legend = document.querySelector('.map-legend')!.getBoundingClientRect();
    const nav = document.querySelector('.mobile-nav')!.getBoundingClientRect();
    return Math.max(0, Math.min(legend.bottom, nav.bottom) - Math.max(legend.top, nav.top));
  });
  expect(overlap).toBe(0);

  await help.click();
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('keeps the completed onboarding state accessible', async ({ page }) => {
  await openAuthenticatedGame(page);
  const represent = page.getByRole('button', { name: /Representar / });
  const support = page.getByRole('button', { name: /Enviar 50 refuerzos/ });
  if (await represent.count()) {
    await represent.click();
    await expect(support).toBeVisible();
    await expect(support).toBeEnabled();
    await support.click();
  } else if (await support.count() && await support.isEnabled()) {
    await support.click();
  }
  await expect(page.getByText(/Preparación completada/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('exposes a transparent sandbox store and accessible legal surface', async ({ page }) => {
  await openAuthenticatedGame(page);
  const store = page.getByRole('tab', { name: 'Tienda sandbox' });
  await store.scrollIntoViewIfNeeded();
  await store.click();

  await expect(page.getByText('Stripe Sandbox', { exact: true })).toBeVisible();
  await expect(page.getByText('LÍMITE DE JUEGO LIMPIO 20%', { exact: true })).toBeVisible();
  await expect(page.getByText(/no se puede transferir ni canjear por dinero/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir pago sandbox' }).first()).toBeDisabled();

  const storeAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(storeAxe.violations).toEqual([]);

  await page.goto('/legal/terms');
  await expect(page.getByRole('heading', { name: /Condiciones de la beta/i })).toBeVisible();
  const legalAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(legalAxe.violations).toEqual([]);

  await page.goto('/legal/terms?lang=en');
  await expect(page.getByRole('heading', { name: /Territorios Beta Terms/i })).toBeVisible();
  await expect(page.getByText(/non-transferable digital content/i)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Legal documents' }).getByRole('link').first()).toHaveAttribute('href', '/legal/terms?lang=en');
});
