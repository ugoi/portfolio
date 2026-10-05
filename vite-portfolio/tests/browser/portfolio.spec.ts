import { test, expect } from '@playwright/test';
import { handleContact, type ContactServices } from '../../src/server/contact';

test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith('WebGL scene')) return;
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
});

test('without WebGL the scene is never downloaded; native navigation and depth still work', async ({ page }, info) => {
  const scripts: string[] = []; page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto('/'); await expect(page.locator('.motion-button')).toBeHidden();
  await expect.poll(() => page.locator('.ocean-poster img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('hero-fallback.png') });
  await page.getByRole('link', { name: 'Sag Hallo' }).click();
  await expect(page.locator('.contact-form-area summary')).toBeVisible();
  await expect(page.locator('#contact-form')).not.toBeVisible();
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '50', { timeout: 20_000 });
  expect(scripts.some(url => /ocean[.-]/.test(url))).toBe(false);
  await expect(page.locator('.hero-scene canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bauplan', exact: true })).toHaveCount(0);
});
test('mobile form shows server error inline, keeps text and focuses status', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#contact');
  await page.locator('.contact-form-area summary').click();
  await page.getByLabel('Dein Name', { exact: true }).fill('Browser Test');
  await page.getByLabel('Deine E-Mail', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Deine Nachricht', { exact: true }).fill('Diese Nachricht wird nicht wirklich versendet.');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.locator('#contact-status')).toContainText('momentan nicht verfügbar');
  await expect(page.locator('#contact-status')).toBeFocused();
  await expect(page.getByLabel('Deine Nachricht', { exact: true })).toHaveValue('Diese Nachricht wird nicht wirklich versendet.');
  expect(new URL(page.url()).pathname).toBe('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('contact-mobile.png') });
});
test('HTMX success uses the actual handler with a simulated sender and resets fields', async ({ page }) => {
  let sent = 0;
  const services: ContactServices = { hash: value => value, reserve: async () => 'reserved', complete: async () => {}, release: async () => {}, send: async () => { sent++; } };
  await page.route('**/api/contact', async route => {
    const r = route.request();
    const response = await handleContact(new Request(r.url(), { method: 'POST', headers: r.headers(), body: r.postData() }), services, '127.0.0.1');
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.goto('/#contact');
  await page.locator('.contact-form-area summary').click();
  await page.getByLabel('Dein Name', { exact: true }).fill('Browser Test');
  await page.getByLabel('Deine E-Mail', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Deine Nachricht', { exact: true }).fill('Simulierter Versand, keine echte E-Mail.');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.locator('#contact-status')).toContainText('zum Versand angenommen');
  await expect(page.getByLabel('Deine Nachricht', { exact: true })).toHaveValue('');
  expect(sent).toBe(1);
});
test('content, anchors and POST error recovery work with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Element.');
  await page.getByRole('link', { name: 'Sag Hallo' }).click();
  await page.locator('.contact-form-area summary').click();
  await page.getByLabel('Dein Name', { exact: true }).fill('Ohne JavaScript');
  await page.getByLabel('Deine E-Mail', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Deine Nachricht', { exact: true }).fill('Diese Nachricht bleibt bei einem Fehler erhalten.');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('noch nicht versendet');
  await expect(page.getByLabel('Deine Nachricht', { exact: true })).toHaveValue('Diese Nachricht bleibt bei einem Fehler erhalten.');
  await context.close();
});
test('WebGL scene, keyboard ring, pause, depth and context loss', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 900, height: 650 });
  const diagnostics: string[] = [];
  page.on('pageerror', error => diagnostics.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) diagnostics.push(message.text()); });
  page.on('close', () => { if (diagnostics.length) console.log('WebGL diagnostics:', diagnostics); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseScene!: () => void;
  const sceneGate = new Promise<void>(resolve => { releaseScene = resolve; });
  await page.route('**/ocean.*.js', async route => { await sceneGate; await route.continue(); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // A slow connection displays an actual frame of this ocean, without blocking content.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.hero-scene canvas')).toHaveCount(0);
  await expect.poll(() => page.locator('.ocean-poster img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('hero-loading.png') });
  releaseScene();
  await expect(page.locator('.hero-scene canvas')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.dive-viewport')).toHaveClass(/scene-ready/);
  await expect(page.getByRole('button', { name: 'Animation starten' })).toBeVisible();
  const ring = page.getByRole('button', { name: /Rettungsring bewegen/ });
  await ring.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('r');
  await expect(ring).toBeFocused();
  await page.screenshot({ path: info.outputPath('hero-webgl.png') });
  await expect(page.getByRole('button', { name: 'Bauplan', exact: true })).toHaveCount(0);
  const horizon = { x: 430, y: 190, width: 350, height: 50 };
  const before = await page.screenshot({ clip: horizon });
  await page.getByRole('button', { name: 'Animation starten' }).click();
  await expect(page.getByRole('button', { name: 'Animation pausieren' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Animation pausieren' }).click();
  const after = await page.screenshot({ clip: horizon });
  expect(before.equals(after), 'distant water changes with the same running scene').toBe(false);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '50', { timeout: 20_000 });
  await page.screenshot({ path: info.outputPath('bikini-bottom-webgl.png') });
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    gl.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('.dive-viewport')).toHaveClass(/is-fallback/);
  await expect(page.locator('.hero-scene canvas')).toHaveCount(0);
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '50', { timeout: 20_000 });
  expect(diagnostics.filter(message => /Shader Error|VALIDATE_STATUS|Uncaught|TypeError/.test(message))).toEqual([]);
});
