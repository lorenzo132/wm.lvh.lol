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
import rateLimit from 'express-rate-limit';
import { uploadToS3, deleteFromS3, getS3Url, isS3Configured, getS3Status } from './s3.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
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
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Enable CORS for frontend (production and local dev) - MUST be first middleware
app.use(cors({
  origin: [
    'https://wmg.lvh.lol',
    'https://wm.lvh.lol',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create uploads directory if it doesn't exist (for local fallback and thumbnails)
const uploadsDir = path.join(__dirname, 'uploads');
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
    fileSize: 200 * 1024 * 1024 // 200MB limit
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    uploadPasswordConfigured: !!process.env.UPLOAD_PASSWORD,
    uploadPasswordLength: process.env.UPLOAD_PASSWORD ? process.env.UPLOAD_PASSWORD.length : 0,
    storageMode: s3Enabled ? 's3' : 'local',
  });
});

// Debug endpoint to show file dates
app.get('/api/debug/files', async (req, res) => {
  try {
    const files = await Media.find().sort({ uploadedAt: -1 }).limit(50);
    res.json({
      files: files.map(doc => ({
        filename: doc.filename,
        size: doc.size,
        uploadedAt: doc.uploadedAt,
        url: doc.url,
        storageType: doc.url?.includes('contabostorage') || doc.url?.includes('s3') ? 's3' : 'local'
      }))
    });
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Debug page
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

// Serve static files from uploads directory (for local storage fallback)
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
}));

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wmgallery';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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

const Media = mongoose.model('Media', mediaSchema);

// Helper to generate a thumbnail for a video file using ffmpeg
function generateVideoThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    // -ss 00:00:02 seeks to 2 seconds, -vframes 1 takes one frame
    execFile('ffmpeg', ['-y', '-ss', '00:00:02', '-i', videoPath, '-vframes', '1', '-vf', 'scale=400:-1', thumbnailPath], (err) => {
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
    ], (err, stdout) => {
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

// Helper to clean up temp file
async function cleanupTempFile(tempPath) {
  try {
    if (fs.existsSync(tempPath)) {
      await fs.promises.unlink(tempPath);
    }
  } catch (error) {
    console.error('Failed to cleanup temp file:', error);
  }
}

// Upload endpoint with password validation
app.post('/api/upload', upload.array('files'), async (req, res) => {
  console.log('Upload request received');
  console.log('Files:', req.files?.length || 0);
  console.log('Password provided:', !!req.body.password);
  console.log('Storage mode:', s3Enabled ? 'S3' : 'Local');

  try {
    // Check if password is provided
    const providedPassword = req.body.password;
    const expectedPassword = process.env.UPLOAD_PASSWORD;

    if (!providedPassword) {
      console.log('No password provided');
      return res.status(401).json({ error: 'Upload password is required' });
    }

    if (!expectedPassword) {
      console.log('No upload password configured on server');
      return res.status(500).json({ error: 'Upload password not configured on server' });
    }

    if (providedPassword !== expectedPassword) {
      console.log('Invalid password provided');
      return res.status(401).json({ error: 'Invalid upload password' });
    }

    if (!req.files || req.files.length === 0) {
      console.log('No files in request');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Parse metadata from request body (if present)
    let metadata = {};
    try {
      if (req.body.metadata) {
        metadata = JSON.parse(req.body.metadata);
      }
    } catch (e) {
      // ignore
    }
    console.log('Parsed metadata:', metadata);

    const uploadTime = new Date();
    const uploadedFiles = await Promise.all(req.files.map(async (file, idx) => {
      // Try to get per-file metadata if sent as array
      let fileMeta = metadata[idx] || metadata || {};
      if (Array.isArray(metadata)) fileMeta = metadata[idx] || {};

      // Generate filename
      const extension = path.extname(file.originalname);
      const uuid = crypto.randomUUID();
      const filename = s3Enabled ? `${uuid}${extension}` : file.filename;

      console.log(`Processing file ${filename} with metadata:`, fileMeta);

      let fileUrl;
      let thumbnail = undefined;
      let dimensions = fileMeta.dimensions || undefined;
      let tempVideoPath = null;

      if (s3Enabled) {
        // Upload to S3
        const s3Result = await uploadToS3(file.buffer, filename, file.mimetype);
        fileUrl = s3Result.url;

        // Handle video thumbnails and dimensions
        if (file.mimetype.startsWith('video/')) {
          // Save to temp file for ffmpeg processing
          tempVideoPath = await saveTempFile(file.buffer, filename);

          // Generate thumbnail
          const thumbFilename = `${path.parse(filename).name}.jpg`;
          const localThumbPath = path.join(thumbnailsDir, thumbFilename);
          try {
            await generateVideoThumbnail(tempVideoPath, localThumbPath);

            // Upload thumbnail to S3
            const thumbBuffer = await fs.promises.readFile(localThumbPath);
            const thumbResult = await uploadToS3(thumbBuffer, `thumbnails/${thumbFilename}`, 'image/jpeg');
            thumbnail = thumbResult.url;

            // Clean up local thumbnail
            await fs.promises.unlink(localThumbPath);
          } catch (err) {
            console.error('Failed to generate video thumbnail:', err);
          }

          // Extract video dimensions
          try {
            dimensions = await getVideoDimensions(tempVideoPath);
          } catch (err) {
            console.error('Failed to get video dimensions:', err);
          }

          // Clean up temp file
          await cleanupTempFile(tempVideoPath);
        }
      } else {
        // Local storage
        fileUrl = `/uploads/${filename}`;

        if (file.mimetype.startsWith('video/')) {
          const thumbFilename = `${path.parse(filename).name}.jpg`;
          const thumbPath = path.join(thumbnailsDir, thumbFilename);
          try {
            await generateVideoThumbnail(path.join(uploadsDir, filename), thumbPath);
            thumbnail = `/uploads/thumbnails/${thumbFilename}`;
          } catch (err) {
            console.error('Failed to generate video thumbnail:', err);
          }

          try {
            dimensions = await getVideoDimensions(path.join(uploadsDir, filename));
          } catch (err) {
            console.error('Failed to get video dimensions:', err);
          }
        }
      }

      const mediaDoc = new Media({
        originalName: file.originalname,
        filename: filename,
        url: fileUrl,
        thumbnail: thumbnail,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: uploadTime,
        name: fileMeta.name || file.originalname.replace(/\.[^/.]+$/, ""),
        type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        date: fileMeta.date || uploadTime.toISOString(),
        location: fileMeta.location || '',
        tags: fileMeta.tags || [],
        photographer: fileMeta.photographer || '',
        dimensions: dimensions,
        storageType: s3Enabled ? 's3' : 'local'
      });
      await mediaDoc.save();
      return mediaDoc;
    }));

    console.log('Files uploaded and saved to DB:', uploadedFiles.length);

    res.json({
      success: true,
      files: uploadedFiles,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      storageType: s3Enabled ? 's3' : 'local'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
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

// Delete file endpoint with password validation
app.delete('/api/files/:filename', async (req, res) => {
  try {
    console.log('Delete request received for:', req.params.filename);
    console.log('Request body:', req.body);

    // Check if password is provided
    const providedPassword = req.body.password;
    const expectedPassword = process.env.UPLOAD_PASSWORD;

    console.log('Provided password:', providedPassword ? '***' : 'none');
    console.log('Expected password:', expectedPassword ? '***' : 'none');

    if (!providedPassword) {
      console.log('No password provided for deletion');
      return res.status(401).json({ error: 'Upload password is required for deletion' });
    }

    if (!expectedPassword) {
      console.log('No upload password configured on server');
      return res.status(500).json({ error: 'Upload password not configured on server' });
    }

    if (providedPassword !== expectedPassword) {
      console.log('Invalid password provided for deletion');
      return res.status(401).json({ error: 'Invalid upload password' });
    }

    const filename = req.params.filename;

    // Find the media document to check storage type
    const mediaDoc = await Media.findOne({ filename });

    if (!mediaDoc) {
      return res.status(404).json({ error: 'File not found in database' });
    }

    // Delete from appropriate storage
    if (mediaDoc.storageType === 's3' && s3Enabled) {
      // Delete from S3
      try {
        await deleteFromS3(filename);

        // Also delete thumbnail if exists
        if (mediaDoc.thumbnail && mediaDoc.thumbnail.includes('thumbnails/')) {
          const thumbKey = `thumbnails/${path.parse(filename).name}.jpg`;
          try {
            await deleteFromS3(thumbKey);
          } catch (err) {
            console.error('Failed to delete thumbnail from S3:', err);
          }
        }
      } catch (err) {
        console.error('Failed to delete from S3:', err);
      }
    } else {
      // Delete from local disk
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete thumbnail if exists
      const thumbPath = path.join(thumbnailsDir, `${path.parse(filename).name}.jpg`);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // Remove from DB
    await Media.deleteOne({ filename });

    console.log(`File deleted: ${filename}`);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Update file endpoint with password validation
app.put('/api/files/:filename', async (req, res) => {
  try {
    const providedPassword = req.body.password;
    const expectedPassword = process.env.UPLOAD_PASSWORD;

    if (!providedPassword) {
      return res.status(401).json({ error: 'Upload password is required for editing' });
    }
    if (!expectedPassword) {
      return res.status(500).json({ error: 'Upload password not configured on server' });
    }
    if (providedPassword !== expectedPassword) {
      return res.status(401).json({ error: 'Invalid upload password' });
    }

    const filename = req.params.filename;
    const allowedFields = ['name', 'location', 'tags', 'photographer', 'date'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (updates.tags && Array.isArray(updates.tags)) {
      // Ensure tags are strings
      updates.tags = updates.tags.map(t => String(t));
    }
    const updated = await Media.findOneAndUpdate(
      { filename },
      { $set: updates },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ success: true, message: 'File updated successfully' });
  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ error: 'Failed to update file' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Uploads: ${uploadsDir}`);
  console.log(`   Storage: ${s3Enabled ? '☁️  S3 (Contabo)' : '💾 Local Disk'}`);
  console.log(`   Build: ${path.join(__dirname, 'dist')}\n`);
});