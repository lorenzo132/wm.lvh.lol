#!/bin/bash

echo "🚀 Starting gallery with local file storage..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
    echo "📁 Creating uploads directory..."
    mkdir -p uploads
fi

# Check if .env exists and add API URL if needed
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file..."
    echo "VITE_API_URL=https://wm.lvh.lol" > .env
    echo "UPLOAD_PASSWORD=your_secure_password_here" >> .env
fi

# Check if dist directory exists, if not build frontend
if [ ! -d "dist" ]; then
    echo "🔨 Building frontend for production..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Frontend build failed! Please run ./build-frontend.sh first"
        exit 1
    fi
fi

# Start server (serves both API and frontend)
echo "🖥️  Starting server..."
echo "📱 Gallery will be available at: https://wm.lvh.lol"
echo "🛑 Press Ctrl+C to stop the server"

node server.js 