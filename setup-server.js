#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up local file storage for gallery...\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json not found. Please run this script from the project root.');
  process.exit(1);
}

try {
  // Install server dependencies
  console.log('📦 Installing server dependencies...');
  execSync('npm install express multer cors', { stdio: 'inherit' });
  execSync('npm install --save-dev nodemon', { stdio: 'inherit' });
  
  console.log('✅ Server dependencies installed successfully!\n');
  
  // Create uploads directory
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory');
  }
  
  // Check if .env exists and add API URL if needed
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('VITE_API_URL')) {
      fs.appendFileSync(envPath, '\nVITE_API_URL=http://localhost:3001\n');
      console.log('🔧 Added VITE_API_URL to .env file');
    }
  } else {
    fs.writeFileSync(envPath, 'VITE_API_URL=http://localhost:3001\n');
    console.log('🔧 Created .env file with API URL');
  }
  
  console.log('\n🎉 Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start the server: node server.js');
  console.log('2. Start the frontend: npm run dev');
  console.log('3. Upload files through the gallery interface');
  
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
} 