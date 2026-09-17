#!/bin/bash

echo "🔨 Building frontend for production..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists and add API URL if needed
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file..."
    echo "VITE_API_URL=https://wm.lvh.lol" > .env
    echo "UPLOAD_PASSWORD=your_secure_password_here" >> .env
fi

# Build the frontend
echo "🏗️  Building production assets..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend built successfully!"
    echo "📁 Production files created in: dist/"
else
    echo "❌ Frontend build failed!"
    exit 1
fi 