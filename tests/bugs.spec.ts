import { test, expect, Page } from '@playwright/test';

const media = {
  id: 'one', filename: 'one.jpg', name: 'Original name', url: '/uploads/one.jpg',
  type: 'image', date: '2026-09-15T12:30:45.000Z', uploadedAt: '2026-09-15T12:30:45.000Z',
  location: 'Amsterdam', photographer: 'Wendy', tags: [], size: 10,
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII=', 'base64');

async function setup(page: Page, files = [media]) {
  await page.route('**/api/files', route => route.fulfill({ json: { files } }));
  await page.route('**/uploads/**', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/');
}

async function openEdit(page: Page) {
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('local media URLs resolve against the API, and malformed dates do not crash the collection', async ({ page }) => {
  await setup(page, [{ ...media, date: 'bad-date', uploadedAt: 'bad-date' }]);
  await expect(page.getByText('Undated', { exact: true })).toBeVisible();
  await expect(page.locator('.preview-image')).toHaveAttribute('src', 'http://localhost:3001/uploads/one.jpg');
  await openEdit(page);
  await expect(page.locator('input[type="datetime-local"]')).toHaveValue('');
});

test('editing a name preserves the exact timestamp and succeeds without refetching the collection', async ({ page }) => {
  await setup(page);
  let saved: { name: string; date: string } | undefined;
  await page.route('**/api/files/one.jpg', route => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });
  await openEdit(page);
  await page.getByLabel('Name', { exact: true }).fill('Updated name');
  await page.getByLabel('Password', { exact: true }).fill('test');
  await page.route('**/api/files', route => route.fulfill({ status: 500, json: { error: 'Unavailable' } }));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Updated name' })).toBeVisible();
  expect(saved?.date).toBe(media.date);
});

test('editing local time stores the equivalent UTC timestamp', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Europe/Amsterdam' });
  const page = await context.newPage();
  let storedDate = '';
  await setup(page);
  await page.route('**/api/files/one.jpg', route => {
    storedDate = route.request().postDataJSON().date;
    return route.fulfill({ json: { success: true } });
  });
  await openEdit(page);
  await expect(page.locator('input[type="datetime-local"]')).toHaveValue('2026-09-15T14:30');
  await page.locator('input[type="datetime-local"]').fill('2026-09-15T15:30');
  await page.getByLabel('Password', { exact: true }).fill('test');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(storedDate).toBe('2026-09-15T13:30:00.000Z');
  await context.close();
});

test('video uploads work without preview decoding or a frontend password setting', async ({ page }) => {
  await setup(page);
  const requests: { url: string; authorization: string | undefined; body: string }[] = [];
  let release!: () => void;
  const holdUpload = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/upload', async route => {
    requests.push({ url: route.request().url(), authorization: route.request().headers().authorization, body: route.request().postData() || '' });
    await holdUpload;
    await route.fulfill({ json: { success: true, files: [], message: 'Uploaded' } });
  });
  await page.getByRole('button', { name: 'Upload media', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'unsupported-codec.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not-decodable-in-browser') });
  await expect(page.getByText('Selected Files (1)')).toBeVisible();
  await page.getByLabel('Upload Password').fill('test-\u{1f512}');
  await page.getByRole('button', { name: 'Upload 1 File', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(requests[0].url).toBe('http://localhost:3001/api/upload');
  expect(requests[0].authorization).toBe('Bearer ' + encodeURIComponent('test-\u{1f512}'));
  expect(requests[0].body).not.toContain('name="password"');
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('retrying a partial batch skips successful files and displays the server error', async ({ page }) => {
  await setup(page);
  const filenames: string[] = [];
  await page.route('**/api/upload', route => {
    filenames.push(route.request().postData()?.match(/filename="([^"]+)"/)?.[1] || '');
    return filenames.length === 2
      ? route.fulfill({ status: 401, json: { error: 'Invalid upload password.' } })
      : route.fulfill({ json: { success: true, files: [], message: 'Uploaded' } });
  });
  await page.getByRole('button', { name: 'Upload media', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'first.jpg', mimeType: 'image/jpeg', buffer: png },
    { name: 'second.jpg', mimeType: 'image/jpeg', buffer: png },
  ]);
  await page.getByLabel('Upload Password').fill('test');
  await page.getByRole('button', { name: 'Upload 2 Files', exact: true }).click();
  await expect(page.getByText('Invalid upload password.', { exact: true })).toBeVisible();
  await expect(page.getByText('Selected Files (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Upload 1 File', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(filenames).toEqual(['first.jpg', 'second.jpg', 'second.jpg']);
});

test('date grouping combines matching places even when capture times are interleaved', async ({ page }) => {
  await setup(page, Array.from({ length: 8 }, (_, i) => ({ ...media, id: String(i), location: i % 2 ? 'Amsterdam' : 'Utrecht', date: `2026-09-15T12:${String(i).padStart(2, '0')}:00Z` })));
  await expect(page.locator('.media-card')).toHaveCount(8);
  await expect(page.locator('.group-heading')).toHaveCount(2);
});

test('cleared dates stay empty and legacy video records do not fetch video previews', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await setup(page, [{ ...media, date: '', type: '', mimetype: 'video/mp4', url: '/uploads/legacy.mp4' } as typeof media]);
  await expect(page.getByText('Undated', { exact: true })).toBeVisible();
  await expect(page.getByText('Open video', { exact: true })).toBeVisible();
  expect(requests.some(url => url.includes('legacy.mp4'))).toBe(false);
});
