@echo off
echo 🚀 Starting local gallery with file storage...

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Create uploads directory if it doesn't exist
if not exist "uploads" (
    echo 📁 Creating uploads directory...
    mkdir uploads
)

REM Check if .env exists and add API URL if needed
if not exist ".env" (
    echo 🔧 Creating .env file...
    echo VITE_API_URL=http://localhost:3001 > .env
)

REM Start server in background
echo 🖥️  Starting backend server...
start /B node server.js

REM Wait a moment for server to start
timeout /t 2 /nobreak > nul

REM Build frontend for production
echo 🔨 Building frontend for production...
npm run build

REM Server now serves both API and frontend
echo 🌐 Server is running and serving the production build!
echo 📱 Access your gallery at: http://localhost:3001

REM Keep server running until user stops the script
echo 🛑 Press Ctrl+C to stop the server...
pause 