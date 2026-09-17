import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { execFile } from 'child_process';
import compression from 'compression';
import { requirePassword, validateMetadata, storedFilePath, removeLocalFile, deleteStoredMedia } from './server-media.js';
import rateLimit from 'express-rate-limit';
import { uploadToS3, deleteFromS3, isS3Configured, getS3Status } from './s3.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3001;

// Check S3 configuration on startup
const s3Enabled = isS3Configured();
console.log(`📦 S3 Storage: ${s3Enabled ? 'ENABLED' : 'DISABLED (using local storage)'}`);
if (s3Enabled) {
  console.log(`   Status:`, getS3Status());
}

// Compression middleware for API responses
app.use(compression());

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit failures without breaking large, successful upload batches.
  skipSuccessfulRequests: true,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes


// Enable CORS for frontend (production and local dev) - MUST be first middleware
app.use(cors({
  origin: [
    'https://wmg.lvh.lol',
    'https://wm.lvh.lol',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    ...(process.env.FRONTEND_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
  ],
  credentials: true
}));

// CORS also applies to rate-limit and authentication errors.
app.use('/api/', apiLimiter);

// Parse JSON bodies
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create uploads directory if it doesn't exist (for local fallback and thumbnails)
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create thumbnails directory if it doesn't exist
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Configure multer - use memory storage for S3, disk for local fallback
const storage = s3Enabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname);
      const uuid = crypto.randomUUID();
      const filename = `${uuid}${extension}`;
      cb(null, filename);
    }
  });

const allowedExtensions = [
  // Images
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.svg', '.ico', '.avif', '.heic', '.heif', '.jfif', '.pjpeg', '.pjp', '.raw', '.arw', '.cr2', '.nrw', '.k25', '.dng', '.nef', '.orf', '.sr2', '.pef', '.raf', '.rw2', '.rwl', '.srw', '.bay', '.erf', '.mef', '.mos', '.mrw', '.srw', '.x3f',
  // Videos
  '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogg', '.ogv', '.mts', '.m2ts', '.ts', '.m2v', '.f4v', '.f4p', '.f4a', '.f4b', '.divx', '.asf', '.rm', '.rmvb', '.vob', '.dat', '.mpe', '.mpg', '.mpeg'
];
const allowedMimeTypes = [
  // Images
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif', 'image/heic', 'image/heif', 'image/jfif', 'image/pjpeg', 'image/pjp', 'image/x-adobe-dng', 'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-panasonic-rw2', 'image/x-olympus-orf', 'image/x-fuji-raf', 'image/x-pentax-pef', 'image/x-samsung-srw', 'image/x-minolta-mrw', 'image/x-leaf-mos', 'image/x-sigma-x3f',
  // Videos
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv', 'video/webm', 'video/x-matroska', 'video/x-m4v', 'video/3gpp', 'video/ogg', 'video/ogv', 'video/mpeg', 'video/x-ms-asf', 'video/x-ms-mpeg', 'video/x-ms-vob', 'video/x-ms-dat', 'video/x-ms-divx', 'video/x-ms-rmvb', 'video/x-ms-ts', 'video/x-ms-mts', 'video/x-ms-m2ts', 'video/x-f4v', 'video/x-f4p', 'video/x-f4a', 'video/x-f4b'
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only png, jpg, jpeg, webp, gif, bmp, tif, tiff, svg, ico, avif, heic, heif, jfif, pjpeg, pjp, raw, arw, cr2, nrw, k25, dng, nef, orf, sr2, pef, raf, rw2, rwl, srw, bay, erf, mef, mos, mrw, srw, x3f, mp4, mov, avi, wmv, flv, webm, mkv, m4v, 3gp, ogg, ogv, mts, m2ts, ts, m2v, f4v, f4p, f4a, f4b, divx, asf, rm, rmvb, vob, dat, mpe, mpg, mpeg files are allowed'), false);
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    files: 1, fields: 2, fieldSize: 64 * 1024
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    storage: s3Enabled ? 's3' : 'local',
    s3Status: getS3Status(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Serve static files from uploads directory (for local storage fallback)
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
}));

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wmgallery';


const mediaSchema = new mongoose.Schema({
  originalName: String,
  filename: String,
  url: String,
  size: Number,
  mimetype: String,
  uploadedAt: Date,
  name: String,
  type: String,
  date: String,
  location: String,
  tags: [String],
  photographer: String,
  dimensions: {
    width: Number,
    height: Number
  },
  thumbnail: String,
  storageType: { type: String, default: 'local' } // 'local' or 's3'
});

// Add index for faster queries
mediaSchema.index({ uploadedAt: -1 });
mediaSchema.index({ filename: 1 });

export const Media = mongoose.model('Media', mediaSchema);

// Helper to generate a thumbnail for a video file using ffmpeg
function generateVideoThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    // -ss 00:00:02 seeks to 2 seconds, -vframes 1 takes one frame
    execFile('ffmpeg', ['-y', '-ss', '0', '-i', videoPath, '-vframes', '1', '-vf', 'scale=400:-1', thumbnailPath], { timeout: 30000 }, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

// Helper to get video dimensions using ffprobe
function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      videoPath
    ], { timeout: 30000 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams && data.streams[0];
        if (stream && stream.width && stream.height) {
          resolve({ width: stream.width, height: stream.height });
        } else {
          resolve(undefined);
        }
      } catch (e) {
        resolve(undefined);
      }
    });
  });
}

// Helper to save buffer to temp file for ffmpeg processing
async function saveTempFile(buffer, filename) {
  const tempPath = path.join(uploadsDir, `temp_${filename}`);
  await fs.promises.writeFile(tempPath, buffer);
  return tempPath;
}

// Authentication runs before Multer writes files or buffers request bodies.
app.post('/api/upload', requirePassword, upload.array('files', 1), async (req, res) => {
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ error: 'No files uploaded.' });
  const filename = s3Enabled ? crypto.randomUUID() + path.extname(file.originalname) : file.filename;
  const thumbFilename = path.parse(filename).name + '.jpg';
  const thumbPath = storedFilePath(thumbnailsDir, thumbFilename);
  let tempPath;
  let uploadedOriginal = false;
  let uploadedThumbnail = false;
  let saved = false;
  let fileMeta;
  try {
    try {
      const raw = JSON.parse(req.body.metadata || '{}');
      fileMeta = validateMetadata(Array.isArray(raw) ? raw[0] : raw);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    let fileUrl;
    let thumbnail;
    let dimensions = fileMeta.dimensions;
    if (s3Enabled) {
      const result = await uploadToS3(file.buffer, filename, file.mimetype);
      uploadedOriginal = true;
      fileUrl = result.url;
    } else fileUrl = '/uploads/' + filename;

    if (file.mimetype.startsWith('video/')) {
      tempPath = s3Enabled ? await saveTempFile(file.buffer, filename) : file.path;
      try {
        await generateVideoThumbnail(tempPath, thumbPath);
        if (s3Enabled) {
          const result = await uploadToS3(await fs.promises.readFile(thumbPath), 'thumbnails/' + thumbFilename, 'image/jpeg');
          uploadedThumbnail = true;
          thumbnail = result.url;
        } else thumbnail = '/uploads/thumbnails/' + thumbFilename;
      } catch (error) { console.error('Video preview unavailable:', error.message); }
      try { dimensions = await getVideoDimensions(tempPath) || dimensions; }
      catch (error) { console.error('Video dimensions unavailable:', error.message); }
    }
    const uploadedAt = new Date();
    const media = new Media({
      originalName: file.originalname, filename, url: fileUrl, thumbnail,
      size: file.size, mimetype: file.mimetype, uploadedAt,
      name: fileMeta.name || file.originalname.replace(/\.[^/.]+$/, ''),
      type: file.mimetype.startsWith('video/') ? 'video' : 'image',
      date: fileMeta.date || uploadedAt.toISOString(),
      location: fileMeta.location || '', tags: fileMeta.tags || [],
      photographer: fileMeta.photographer || '', dimensions,
      storageType: s3Enabled ? 's3' : 'local',
    });
    await media.save();
    saved = true;
    res.json({ success: true, files: [media], message: 'File uploaded successfully.' });
  } catch (error) {
    console.error('Upload failed:', error.message);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  } finally {
    // Invalid metadata and failed DB writes must not leave untracked local files.
    const cleanup = [];
    if (s3Enabled) {
      if (tempPath) cleanup.push(removeLocalFile(tempPath));
      cleanup.push(removeLocalFile(thumbPath));
      if (!saved && uploadedThumbnail) cleanup.push(deleteFromS3('thumbnails/' + thumbFilename));
      if (!saved && uploadedOriginal) cleanup.push(deleteFromS3(filename));
    } else if (!saved) {
      cleanup.push(removeLocalFile(file.path), removeLocalFile(thumbPath));
    }
    for (const result of await Promise.allSettled(cleanup)) {
      if (result.status === 'rejected') console.error('Upload cleanup failed:', result.reason.message);
    }
  }
});

// Get all uploaded files
app.get('/api/files', async (req, res) => {
  try {
    const files = await Media.find().sort({ uploadedAt: -1 });
    const mapped = files.map(doc => ({
      id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      thumbnail: doc.thumbnail,
      type: doc.type,
      date: doc.date,
      location: doc.location,
      size: doc.size,
      dimensions: doc.dimensions,
      tags: doc.tags || [],
      photographer: doc.photographer || '',
      mimetype: doc.mimetype,
      uploadedAt: doc.uploadedAt,
      filename: doc.filename,
    }));
    res.json({ files: mapped });
  } catch (error) {
    console.error('Error reading files from DB:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Keep the record available for retry if storage deletion fails.
app.delete('/api/files/:filename', requirePassword, async (req, res) => {
  try {
    const filename = req.params.filename;
    storedFilePath(uploadsDir, filename);
    const media = await Media.findOne({ filename });
    if (!media) return res.status(404).json({ error: 'File not found.' });
    await deleteStoredMedia(media, { uploadsDir, s3Enabled, deleteFromS3 });
    await Media.deleteOne({ filename });
    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete failed:', error.message);
    res.status(500).json({ error: 'File could not be deleted. Please try again.' });
  }
});

app.put('/api/files/:filename', requirePassword, async (req, res) => {
  let updates;
  try {
    updates = validateMetadata(req.body);
    delete updates.dimensions;
    storedFilePath(uploadsDir, req.params.filename);
  } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const media = await Media.findOneAndUpdate({ filename: req.params.filename }, { $set: updates }, { new: true, runValidators: true });
    if (!media) return res.status(404).json({ error: 'File not found.' });
    res.json({ success: true, message: 'Media updated.' });
  } catch (error) {
    console.error('Edit failed:', error.message);
    res.status(500).json({ error: 'Media could not be updated. Please try again.' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 200MB.' });
    }
    // Other Multer errors
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
  next();
});

// Serve static files from the production build (after API routes)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Importing the app for tests does not connect to production storage or start a listener.
export async function startServer() {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  return app.listen(PORT, '0.0.0.0', () => console.log('Gallery server listening on port ' + PORT));
}
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch(error => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}
