import { test, expect, Page } from '@playwright/test';
import { createPreviewQueue } from '../src/utils/previewQueue';

const collection = Array.from({ length: 2400 }, (_, i) => ({
  id: String(i), filename: `${i}.jpg`, name: `Moment ${String(i).padStart(4, '0')}`,
  type: i % 5 === 0 ? 'video' : 'image',
  url: `https://media.invalid/original/${i}.${i % 5 === 0 ? 'mp4' : 'jpg'}`,
  thumbnail: i % 10 === 0 ? undefined : `https://media.invalid/preview/${i}.jpg`,
  date: '2026-09-15T12:00:00Z', uploadedAt: '2026-09-15T12:00:00Z',
  location: 'Amsterdam', photographer: 'Wendy Moore', tags: ['travel'], size: 4200000,
}));

async function mockGallery(page: Page, files = collection) {
  const requests: string[] = [];
  let active = 0;
  let peak = 0;
  await page.route('**/api/files', route => route.fulfill({ json: { files } }));
  await page.route('https://media.invalid/**', async route => {
    requests.push(route.request().url());
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 120));
    active--;
    const colors = ['#6f8271', '#b79c82', '#7c909b', '#9e827c'];
    const id = Number(route.request().url().match(/(\d+)\./)?.[1] || 0);
    await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${colors[id % 4]}"/><circle cx="460" cy="130" r="65" fill="#e6d6ae"/><path d="M0 360L210 150L440 480H0Z" fill="#334a42"/><path d="M180 480L470 240L640 410V480Z" fill="#4c675a"/></svg>` });
  });
  return { requests, peak: () => peak };
}

test('large collections bound cards, defer offscreen previews, and never fetch gallery videos', async ({ page }) => {
  const network = await mockGallery(page);
  await page.goto('/');
  await expect(page.locator('.media-card')).toHaveCount(24);
  await expect(page.locator('.is-loaded').first()).toBeVisible();
  await expect.poll(() => network.requests.length).toBeGreaterThan(4);
  expect(network.requests.length).toBeLessThan(21);
  expect(network.peak()).toBeLessThanOrEqual(4);
  expect(network.requests.every(url => url.includes('/preview/'))).toBe(true);
  await page.getByRole('navigation', { name: 'Gallery pages' }).scrollIntoViewIfNeeded();
  await expect.poll(() => network.requests.length).toBe(21);
  expect(network.peak()).toBeLessThanOrEqual(4);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 100')).toBeVisible();
  await expect(page.locator('.media-card')).toHaveCount(24);
  await page.getByLabel('Search media', { exact: true }).fill('Moment 2399');
  await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Moment 2399' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Moment 2399' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => network.requests.some(url => url.endsWith('/original/2399.jpg'))).toBe(true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('video without a poster waits for playback, and management shortcut remains available', async ({ page }) => {
  const network = await mockGallery(page, [collection[0]]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Moment 0000' }).click();
  await expect(page.locator('video')).toHaveAttribute('preload', 'none');
  expect(network.requests).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toHaveCount(0);
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('date filters, sorting, empty results, and API retry work', async ({ page }) => {
  await mockGallery(page, collection.slice(0, 30));
  await page.goto('/');
  await page.getByLabel('Filter by date').fill('2026-09-14');
  await expect(page.getByText('No matching moments')).toBeVisible();
  await page.getByRole('button', { name: 'Clear date filter' }).click();
  await expect(page.locator('.media-card')).toHaveCount(24);
  await page.getByLabel('Sort media by').selectOption('name');
  await expect(page.locator('.media-name').first()).toHaveText('Moment 0029');
  await page.getByRole('button', { name: 'Sort ascending' }).click();
  await expect(page.locator('.media-name').first()).toHaveText('Moment 0000');
  await page.route('**/api/files', route => route.fulfill({ status: 500, json: { error: 'Unavailable' } }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  await page.route('**/api/files', route => route.fulfill({ json: { files: [] } }));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Your collection starts here')).toBeVisible();
});

test('desktop and mobile layouts keep controls and viewer within the viewport', async ({ page }, testInfo) => {
  await mockGallery(page, collection.slice(0, 12));
  await page.goto('/');
  await expect(page.locator('.is-loaded').first()).toBeVisible();
  await page.locator('.gallery-footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.is-loaded')).toHaveCount(10);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('gallery-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('gallery-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open Moment 0001' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  await page.screenshot({ path: testInfo.outputPath('viewer-mobile.png') });
});

test('legacy images load on demand and broken previews keep the original accessible', async ({ page }) => {
  const network = await mockGallery(page, [
    { ...collection[1], thumbnail: undefined },
    { ...collection[2], thumbnail: 'https://media.invalid/broken.jpg' },
  ]);
  await page.route('https://media.invalid/broken.jpg', route => route.fulfill({ status: 404 }));
  await page.goto('/');
  await expect(page.locator('.is-loaded')).toHaveCount(1);
  await expect(page.getByText('Preview unavailable')).toBeVisible();
  expect(network.requests).toContain('https://media.invalid/original/1.jpg');
  await page.getByRole('button', { name: 'Open Moment 0002' }).click();
  await expect.poll(() => network.requests.includes('https://media.invalid/original/2.jpg')).toBe(true);
});

test('queue cancels pending work without starting it, releases failed jobs, and tolerates duplicate completion', async () => {
  const queue = createPreviewQueue(1);
  let finish!: () => void;
  let aborted = 0;
  let starts = 0;
  const cancelFirst = queue(done => { finish = done; return () => { aborted++; }; });
  const cancelPending = queue(() => { starts++; return () => {}; });
  cancelFirst();
  cancelPending();
  await Promise.resolve();
  expect(aborted).toBe(1);
  expect(starts).toBe(0);
  finish();
  queue(() => { throw new Error('failed'); });
  queue(done => { starts++; done(); done(); return () => {}; });
  await Promise.resolve();
  expect(starts).toBe(1);
});
