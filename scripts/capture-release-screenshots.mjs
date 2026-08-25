import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.TERRITORIOS_SCREENSHOT_BASE_URL?.trim();
if (!baseUrl) throw new Error('TERRITORIOS_SCREENSHOT_BASE_URL is required.');

const outputDir = resolve('docs/screenshots');
await mkdir(outputDir, { recursive: true });
const manifestPath = resolve(outputDir, 'release-screenshot-manifest.json');
const mode = process.env.TERRITORIOS_SCREENSHOT_MODE === 'defender' ? 'defender' : 'primary';

const browser = await chromium.launch();
const context = await browser.newContext({
  colorScheme: 'light',
  locale: 'es-ES',
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const manifest = mode === 'defender'
  ? JSON.parse(await readFile(manifestPath, 'utf8'))
  : {
      format: 'territorios-release-screenshots/v1',
      version: 'v0.2.0-beta.1',
      seed: 'fresh-isolated-d1-per-player-perspective',
      locale: 'es',
      captures: [],
    };

async function capture(file, viewport, state, options = {}) {
  const targetPage = options.page ?? page;
  await targetPage.setViewportSize(viewport);
  if (options.scrollTop) await targetPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  if (options.selector) {
    await targetPage.locator(options.selector).evaluate((element, block) => {
      element.scrollIntoView({ behavior: 'instant', block });
    }, options.block ?? 'center');
  }
  await targetPage.screenshot({
    path: resolve(outputDir, file),
    fullPage: false,
    animations: 'disabled',
  });
  manifest.captures.push({ file, viewport: `${viewport.width}x${viewport.height}`, state });
}

try {
  await page.goto(`${baseUrl}/signin-with-chatgpt?return_to=%2F`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('group', { name: /mapa de territorios/i }).waitFor();
  await page.locator('#community-hub').waitFor();

  if (mode === 'defender') {
    await page.getByLabel(/Confirmo que tengo 18 años/i).check();
    await page.getByLabel(/Acepto participar voluntariamente/i).check();
    await page.locator('.focus-provinces').getByRole('button', { name: 'Toledo', exact: true }).click();
    await page.getByRole('button', { name: /Representar Toledo/i }).click();
    const defend = page.getByRole('button', { name: /Enviar 50 refuerzos/i });
    await defend.waitFor();
    await defend.click();
    await page.getByRole('status').filter({ hasText: /\+50/ }).waitFor();
    await capture(
      'after-v0.2-defender-support-1440.png',
      { width: 1440, height: 1000 },
      'joined-defender-after-first-free-support',
      { selector: '.support-impact', block: 'center' },
    );
  } else {
    await capture(
    'after-v0.2-onboarding-1440.png',
    { width: 1440, height: 1000 },
    'authenticated-before-consent-with-focus-provinces',
    { scrollTop: true },
  );

  await page.getByLabel(/Confirmo que tengo 18 años/i).check();
  await page.getByLabel(/Acepto participar voluntariamente/i).check();
  await page.locator('.focus-provinces').getByRole('button', { name: 'Madrid', exact: true }).click();
  await page.getByRole('button', { name: /Representar Madrid/i }).click();
  const support = page.getByRole('button', { name: /Enviar 50 refuerzos/i });
  await support.waitFor();
  await support.click();
  await page.getByRole('status').filter({ hasText: /\+50/ }).waitFor();

  await capture(
    'after-v0.2-support-1440.png',
    { width: 1440, height: 1000 },
    'joined-attacker-after-first-free-support',
    { selector: '.support-impact', block: 'center' },
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('group', { name: /mapa de territorios/i }).waitFor();
  await page.getByRole('tab', { name: 'Consejo' }).click();
  await capture(
    'after-v0.2-council-768.png',
    { width: 768, height: 1024 },
    'joined-player-council-and-campaign-cycle',
    { selector: '#community-hub' },
  );

  await page.getByRole('tab', { name: 'Replay' }).click();
  await capture(
    'after-v0.2-replay-768.png',
    { width: 768, height: 1024 },
    'verifiable-replay-after-first-support',
    { selector: '#community-hub', block: 'start' },
  );

  await capture(
    'after-v0.2-mobile-390.png',
    { width: 390, height: 844 },
    'joined-player-mobile-beta-notice-and-next-action',
    { scrollTop: true },
  );

  await capture(
    'after-v0.2-mobile-map-390.png',
    { width: 390, height: 844 },
    'joined-player-mobile-map-and-command',
    { selector: '#game-map', block: 'start' },
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Mostrar ayuda del mapa' }).click();
  await capture(
    'after-v0.2-map-help-1440.png',
    { width: 1440, height: 1000 },
    'keyboard-and-map-help-dialog',
  );
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await capture(
    'after-v0.2-zoom-200-1440.png',
    { width: 1440, height: 1000 },
    'two-hundred-percent-zoom-core-support-action',
    { selector: '.support-card', block: 'center' },
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });

  await page.locator('.beta-operations').scrollIntoViewIfNeeded();
  await page.getByText(/Contacto y derechos/i).click();
  await capture(
    'after-v0.2-privacy-1440.png',
    { width: 1440, height: 1000 },
    'closed-beta-privacy-support-and-rights',
  );

  await page.evaluate(() => {
    document.documentElement.style.filter = 'grayscale(1)';
  });
  await capture(
    'after-v0.2-grayscale-1440.png',
    { width: 1440, height: 1000 },
    'grayscale-color-independent-map-states',
    { scrollTop: true },
  );
  await page.evaluate(() => {
    document.documentElement.style.filter = '';
  });
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}
