@echo off
echo 🚀 Starting gallery with local file storage...

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
    echo VITE_API_URL=https://wm.lvh.lol > .env
    echo UPLOAD_PASSWORD=your_secure_password_here >> .env
)

REM Check if dist directory exists, if not build frontend
if not exist "dist" (
    echo 🔨 Building frontend for production...
    npm run build
    
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Frontend build failed! Please run build-frontend.bat first
        pause
        exit /b 1
    )
)

REM Start server (serves both API and frontend)
echo 🖥️  Starting server...
echo 📱 Gallery will be available at: https://wm.lvh.lol
echo 🛑 Press Ctrl+C to stop the server

node server.js 