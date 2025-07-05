import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname;
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);
    const filename = `${nameWithoutExt}-${timestamp}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Only allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running!', 
    timestamp: new Date().toISOString(),
    uploadPasswordConfigured: !!process.env.UPLOAD_PASSWORD,
    uploadPasswordLength: process.env.UPLOAD_PASSWORD ? process.env.UPLOAD_PASSWORD.length : 0
  });
});

// Debug endpoint to show file dates
app.get('/api/debug/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const fileList = files.map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      
      // Extract timestamp from filename (format: name-timestamp.ext)
      let uploadedAt = stats.mtime; // fallback to file modification time
      const timestampMatch = filename.match(/-(\d+)\./);
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1]);
        if (!isNaN(timestamp)) {
          uploadedAt = new Date(timestamp);
        }
      }
      
      return {
        filename,
        size: stats.size,
        mtime: stats.mtime,
        uploadedAt: uploadedAt,
        extractedTimestamp: timestampMatch ? timestampMatch[1] : null
      };
    });
    
    // Sort by upload date (newest first)
    fileList.sort((a, b) => {
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
    
    res.json({ files: fileList });
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Debug page
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Upload endpoint with password validation
app.post('/api/upload', upload.array('files'), (req, res) => {
  console.log('Upload request received');
  console.log('Files:', req.files);
  console.log('Password provided:', !!req.body.password);
  
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

    const uploadTime = new Date();
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: uploadTime.toISOString()
    }));

    console.log('Files uploaded successfully:', uploadedFiles);

    res.json({ 
      success: true, 
      files: uploadedFiles,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Set higher body size limits for JSON and URL-encoded bodies (after upload route)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Get all uploaded files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const fileList = files.map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      
      // Extract timestamp from filename (format: name-timestamp.ext)
      let uploadedAt = stats.mtime; // fallback to file modification time
      const timestampMatch = filename.match(/-(\d+)\./);
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1]);
        if (!isNaN(timestamp)) {
          uploadedAt = new Date(timestamp);
        }
      }
      
      return {
        filename,
        url: `/uploads/${filename}`,
        size: stats.size,
        uploadedAt: uploadedAt
      };
    });
    
    // Sort by upload date (newest first)
    fileList.sort((a, b) => {
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
    
    res.json({ files: fileList });
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// Delete file endpoint with password validation
app.delete('/api/files/:filename', (req, res) => {
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
      console.log('Password comparison failed');
      return res.status(401).json({ error: 'Invalid upload password' });
    }

    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File deleted: ${filename}`);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve static files from the production build (after API routes)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Production build served from: ${path.join(__dirname, 'dist')}`);
}); 