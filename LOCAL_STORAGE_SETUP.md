# Local File Storage Setup

This gallery now supports storing media files locally in an `/uploads` folder with a backend server.

## Setup Instructions

### 1. Install Server Dependencies

First, install the server dependencies:

```bash
# Copy the server package.json
cp server-package.json package-server.json

# Install server dependencies
npm install --prefix . express multer cors
npm install --save-dev nodemon
```

### 2. Start the Backend Server

Start the backend server to handle file uploads:

```bash
node server.js
```

The server will run on port 3001 by default. You can change this by setting the `PORT` environment variable.

### 3. Configure Frontend

Add the API URL to your `.env` file:

```
VITE_API_URL=http://localhost:3001
```

### 4. Start the Application

The server now serves both the API and the production frontend. Simply start the server:

```bash
npm run server
```

Or use the automated startup script:

```bash
# On Windows:
start-local.bat

# On Mac/Linux:
./start-local.sh
```

## How It Works

### File Storage
- All uploaded files are stored in the `/uploads` folder
- Files are renamed with timestamps to prevent conflicts
- File metadata is stored in localStorage
- The server serves files statically from the `/uploads` directory

### Production Setup
- Frontend is built for production and served by the Express server
- Single server handles both API requests and static file serving
- Optimized for performance with minified assets
- SPA routing handled by the server

### API Endpoints
- `POST /api/upload` - Upload files
- `GET /api/files` - Get list of uploaded files
- `DELETE /api/files/:filename` - Delete a file
- `GET /uploads/:filename` - Serve uploaded files

### Features
- **Public Gallery**: All uploaded content is publicly viewable by everyone
- **File Upload**: Drag and drop or select files to upload
- **Password Protection**: Each upload requires a password for security
- **Bulk Upload**: Upload multiple files with shared metadata
- **Local Storage**: Files are stored locally in the `/uploads` folder
- **Metadata Management**: File metadata (name, location, date, tags) is stored in localStorage
- **View & Download**: Public users can view and download all media
- **Fallback**: If server is unavailable, falls back to localStorage-only mode
- **Production Ready**: Optimized build served by the same server

## File Structure

```
project/
├── server.js              # Backend server + production frontend
├── uploads/               # Local file storage
├── dist/                  # Production build (generated)
├── src/
│   ├── utils/
│   │   ├── api.ts         # API communication
│   │   └── storage.ts     # Storage utilities
│   └── components/
│       ├── UploadModal.tsx # File upload interface
│       └── MediaCard.tsx   # Media display with delete
└── package.json
```

## Environment Variables

- `VITE_API_URL` - Backend server URL (default: http://localhost:3001)
- `VITE_UPLOAD_PASSWORD` - Password for upload access
- `PORT` - Backend server port (default: 3001)

## Security Notes

- **Public Gallery**: All uploaded content is publicly accessible to anyone
- Files are stored locally on your machine
- **Password required for each upload** - only uploads are protected
- File size limit is 50MB per file
- Only image and video files are allowed
- Files are served statically without authentication
- No user authentication required for viewing or downloading

## Troubleshooting

### Server Won't Start
- Make sure port 3001 is available
- Check that all dependencies are installed
- Verify the uploads directory can be created
- Ensure the production build exists (run `npm run build` first)

### Uploads Fail
- Check that the server is running
- Verify the API URL in your `.env` file
- Check browser console for CORS errors

### Files Not Loading
- Ensure the server is running and accessible
- Check that files exist in the `/uploads` folder
- Verify file permissions on the uploads directory

## Development

### Adding New File Types
Edit the `fileFilter` in `server.js` to allow additional file types.

### Changing Storage Location
Modify the `uploadsDir` variable in `server.js` to change the storage location.

### Customizing File Naming
Update the `filename` function in the multer configuration to change how files are named. 