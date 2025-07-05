#!/bin/bash

echo "🚀 Starting local gallery with file storage..."

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
    echo "VITE_API_URL=http://localhost:3001" > .env
fi

# Start server in background
echo "🖥️  Starting backend server..."
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Build frontend for production
echo "🔨 Building frontend for production..."
npm run build

# Server now serves both API and frontend
echo "🌐 Server is running and serving the production build!"
echo "📱 Access your gallery at: http://localhost:3001"

# Keep server running until user stops the script
echo "🛑 Press Ctrl+C to stop the server..."
wait $SERVER_PID 