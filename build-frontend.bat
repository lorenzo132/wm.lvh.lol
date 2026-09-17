@echo off
echo 🔨 Building frontend for production...

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Check if .env exists and add API URL if needed
if not exist ".env" (
    echo 🔧 Creating .env file...
    echo VITE_API_URL=https://wm.lvh.lol > .env
    echo UPLOAD_PASSWORD=your_secure_password_here >> .env
)

REM Build the frontend
echo 🏗️  Building production assets...
npm run build

if %ERRORLEVEL% EQU 0 (
    echo ✅ Frontend built successfully!
    echo 📁 Production files created in: dist/
) else (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
) 