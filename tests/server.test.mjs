import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deleteStoredMedia, storedFilePath, validateMetadata } from '../server-media.js';

const uploadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gallery-test-'));
process.env.UPLOADS_DIR = uploadDirectory;
process.env.UPLOAD_PASSWORD = 'test-password';
// These tests never connect to MongoDB or S3, even if the developer has a .env.
process.env.S3_BUCKET = '';
process.env.S3_ACCESS_KEY = '';
process.env.S3_SECRET_KEY = '';
const { app, Media } = await import('../server.js');
let listener;
let origin;
before(async () => {
  listener = app.listen(0, '127.0.0.1');
  await new Promise(resolve => listener.once('listening', resolve));
  origin = `http://127.0.0.1:${listener.address().port}`;
});
after(async () => {
  await new Promise(resolve => listener.close(resolve));
  // Only remove this test's randomly generated directory, never the real uploads.
  assert.equal(path.dirname(path.resolve(uploadDirectory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(uploadDirectory).startsWith('wm-gallery-test-'));
  await fs.rm(uploadDirectory, { recursive: true, force: true });
});

const headers = { Authorization: 'Bearer test-password' };
const form = (metadata = '{}') => {
  const body = new FormData();
  body.append('metadata', metadata);
  body.append('files', new Blob(['test-image'], { type: 'image/jpeg' }), 'test.jpg');
  return body;
};
const filesOnDisk = async () => (await fs.readdir(uploadDirectory)).filter(name => name !== 'thumbnails');
const waitForCleanup = async () => {
  for (let i = 0; i < 30; i++) {
    if (!(await filesOnDisk()).length) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.deepEqual(await filesOnDisk(), []);
};

test('unauthorized uploads are rejected before files are written, with development CORS headers', async () => {
  const result = await fetch(origin + '/api/upload', { method: 'POST', headers: { Origin: 'http://localhost:8080' }, body: form() });
  assert.equal(result.status, 401);
  assert.equal(result.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  assert.deepEqual(await filesOnDisk(), []);
});

test('invalid multipart metadata is rejected and staged files are cleaned up', async () => {
  const result = await fetch(origin + '/api/upload', { method: 'POST', headers, body: form('{broken') });
  assert.equal(result.status, 400);
  await waitForCleanup();
});

test('failed database saves clean up the uploaded original', async t => {
  t.mock.method(Media.prototype, 'save', async () => { throw new Error('Database unavailable'); });
  const result = await fetch(origin + '/api/upload', { method: 'POST', headers, body: form() });
  assert.equal(result.status, 500);
  await waitForCleanup();
});

test('authenticated upload persists the file and metadata without a real database', async t => {
  let saved;
  t.mock.method(Media.prototype, 'save', async function () { saved = this; return this; });
  const result = await fetch(origin + '/api/upload', { method: 'POST', headers, body: form(JSON.stringify([{ name: 'A photo', tags: ['travel', 'travel'] }])) });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).success, true);
  assert.equal(saved.name, 'A photo');
  assert.deepEqual([...saved.tags], ['travel']);
  assert.equal(await fs.readFile(path.join(uploadDirectory, saved.filename), 'utf8'), 'test-image');
  await fs.unlink(path.join(uploadDirectory, saved.filename));
});

test('remote deletion failure keeps the database record for retry', async t => {
  t.mock.method(Media, 'findOne', async () => ({ filename: 'remote.jpg', url: 'https://storage.invalid/remote.jpg', storageType: 's3' }));
  const deletion = t.mock.method(Media, 'deleteOne', async () => ({}));
  const result = await fetch(origin + '/api/files/remote.jpg', { method: 'DELETE', headers });
  assert.equal(result.status, 500);
  assert.equal(deletion.mock.callCount(), 0);
});

test('storage failures propagate and local filenames cannot escape the uploads directory', async () => {
  for (const filename of ['../outside.jpg', '..\\outside.jpg', 'C:outside.jpg', '..', '.']) assert.throws(() => storedFilePath(uploadDirectory, filename));
  await assert.rejects(deleteStoredMedia({ filename: 'remote.jpg', storageType: 's3' }, {
    uploadsDir: uploadDirectory, s3Enabled: true, deleteFromS3: async () => { throw new Error('Storage unavailable'); },
  }), /Storage unavailable/);
  await assert.rejects(deleteStoredMedia({ filename: 'remote.jpg', storageType: 's3' }, {
    uploadsDir: uploadDirectory, s3Enabled: true, deleteFromS3: async () => false,
  }), /deletion failed/);
});

test('successful local deletion removes both files before removing the record', async t => {
  await fs.writeFile(path.join(uploadDirectory, 'local.jpg'), 'image');
  await fs.writeFile(path.join(uploadDirectory, 'thumbnails', 'local.jpg'), 'thumbnail');
  t.mock.method(Media, 'findOne', async () => ({ filename: 'local.jpg', url: '/uploads/local.jpg', storageType: 'local' }));
  const deletion = t.mock.method(Media, 'deleteOne', async () => {
    await assert.rejects(fs.access(path.join(uploadDirectory, 'local.jpg')));
    await assert.rejects(fs.access(path.join(uploadDirectory, 'thumbnails', 'local.jpg')));
    return {};
  });
  const result = await fetch(origin + '/api/files/local.jpg', { method: 'DELETE', headers });
  assert.equal(result.status, 200);
  assert.equal(deletion.mock.callCount(), 1);
});

test('invalid edit metadata does not reach the database; Unicode password headers work', async t => {
  const update = t.mock.method(Media, 'findOneAndUpdate', async () => ({}));
  process.env.UPLOAD_PASSWORD = 'test-\u{1f512}';
  try {
    const result = await fetch(origin + '/api/files/local.jpg', {
      method: 'PUT', headers: { Authorization: `Bearer ${encodeURIComponent(process.env.UPLOAD_PASSWORD)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: 'not-a-date' }),
    });
    assert.equal(result.status, 400);
    assert.equal(update.mock.callCount(), 0);
  } finally { process.env.UPLOAD_PASSWORD = 'test-password'; }
  assert.throws(() => validateMetadata({ tags: 'not-an-array' }));
});

test('successful batches can exceed 100 uploads without hitting the failure rate limit', async t => {
  t.mock.method(Media.prototype, 'save', async function () { return this; });
  for (let i = 0; i < 105; i++) {
    const result = await fetch(origin + '/api/upload', { method: 'POST', headers, body: form() });
    assert.equal(result.status, 200, `Upload ${i + 1} failed`);
    const { files } = await result.json();
    await fs.unlink(path.join(uploadDirectory, files[0].filename));
  }
});
