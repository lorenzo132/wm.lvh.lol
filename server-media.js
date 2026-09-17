import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export function requirePassword(req, res, next) {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected) return res.status(503).json({ error: 'Upload password is not configured on the server.' });
  let provided = req.body?.password;
  const authorization = req.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    try { provided = decodeURIComponent(authorization.slice(7)); }
    catch { return res.status(401).json({ error: 'Invalid upload password.' }); }
  }
  if (typeof provided !== 'string' || !provided) return res.status(401).json({ error: 'Upload password is required.' });
  const actualHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(actualHash, expectedHash)) return res.status(401).json({ error: 'Invalid upload password.' });
  next();
}

export function validateMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid media metadata.');
  const result = {};
  for (const key of ['name', 'location', 'photographer', 'date']) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || input[key].length > 2000) throw new Error(`Invalid ${key}.`);
    result[key] = input[key].trim();
  }
  if (result.name !== undefined && !result.name) throw new Error('Media name is required.');
  if (result.date) {
    const date = new Date(result.date);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid media date.');
    result.date = date.toISOString();
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 100 || input.tags.some(tag => typeof tag !== 'string' || tag.length > 200)) throw new Error('Invalid tags.');
    result.tags = [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))];
  }
  if (input.dimensions !== undefined) {
    const { width, height } = input.dimensions || {};
    if (![width, height].every(value => Number.isInteger(value) && value > 0)) throw new Error('Invalid dimensions.');
    result.dimensions = { width, height };
  }
  return result;
}

export function storedFilePath(directory, filename) {
  if (!filename || filename === '.' || filename === '..' || /[\\/:\x00]/.test(filename)) throw new Error('Invalid stored filename.');
  const target = path.resolve(directory, filename);
  if (path.dirname(target) !== path.resolve(directory)) throw new Error('Invalid stored filename.');
  return target;
}

export async function removeLocalFile(filename) {
  try { await fs.unlink(filename); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

// Delete the database record only after this succeeds. Failed remote storage must
// never silently fall back to disk and discard the only reference to the original.
export async function deleteStoredMedia(media, { uploadsDir, s3Enabled, deleteFromS3 }) {
  const filename = media.filename;
  const original = storedFilePath(uploadsDir, filename);
  const thumbName = `${path.parse(filename).name}.jpg`;
  const remote = media.storageType === 's3' || /^https?:\/\//i.test(media.url || '');
  if (remote) {
    if (!s3Enabled) throw new Error('S3 storage is unavailable. File was not deleted.');
    if (media.thumbnail && await deleteFromS3(`thumbnails/${thumbName}`) === false) throw new Error('Thumbnail deletion failed.');
    if (await deleteFromS3(filename) === false) throw new Error('File deletion failed.');
  } else {
    await removeLocalFile(storedFilePath(path.join(uploadsDir, 'thumbnails'), thumbName));
    await removeLocalFile(original);
  }
}
