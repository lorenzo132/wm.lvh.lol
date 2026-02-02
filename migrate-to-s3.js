/**
 * Migration Script: Local Storage to S3
 * 
 * This script migrates all existing files from local /uploads folder to S3.
 * It also updates the MongoDB records with the new S3 URLs.
 * 
 * SAFETY FEATURES:
 * - Dry-run mode to preview changes
 * - Verification that files exist in S3 after upload
 * - Backup of MongoDB records before migration
 * - Local files are NEVER deleted (you do that manually after verification)
 * - Rollback capability with backup file
 * 
 * Usage:
 *   node migrate-to-s3.js              # Run migration
 *   node migrate-to-s3.js --dry-run    # Preview without making changes
 *   node migrate-to-s3.js --verify     # Verify existing S3 files without migrating
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { uploadToS3, isS3Configured, getS3Url, existsInS3 } from './s3.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDryRun = process.argv.includes('--dry-run');
const isVerifyOnly = process.argv.includes('--verify');

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wmgallery';

// Media schema (same as server.js)
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
    storageType: { type: String, default: 'local' }
});

const Media = mongoose.model('Media', mediaSchema);

// Progress bar helper
function progressBar(current, total, width = 40) {
    const percent = current / total;
    const filled = Math.round(width * percent);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${current}/${total} (${Math.round(percent * 100)}%)`;
}

// Create a backup of MongoDB records
async function createBackup() {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `media-backup-${timestamp}.json`);

    const allMedia = await Media.find({});
    const backupData = {
        timestamp: new Date().toISOString(),
        totalRecords: allMedia.length,
        records: allMedia.map(doc => doc.toObject())
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`📦 Backup created: ${backupFile}`);
    return backupFile;
}

// Verify a file exists in S3 after upload
async function verifyS3Upload(filename) {
    try {
        const exists = await existsInS3(filename);
        return exists;
    } catch (error) {
        console.error(`   Verification failed for ${filename}:`, error.message);
        return false;
    }
}

// Verify mode - check all S3 files without migrating
async function verifyExistingFiles() {
    console.log('\n🔍 Verification Mode');
    console.log('='.repeat(50));

    const s3Media = await Media.find({ storageType: 's3' });
    console.log(`� Found ${s3Media.length} files marked as S3 storage\n`);

    if (s3Media.length === 0) {
        console.log('No S3 files to verify.');
        return;
    }

    let verified = 0;
    let missing = 0;
    const missingFiles = [];

    for (let i = 0; i < s3Media.length; i++) {
        const media = s3Media[i];
        process.stdout.write(`\r${progressBar(i + 1, s3Media.length)} Verifying...`);

        const exists = await verifyS3Upload(media.filename);
        if (exists) {
            verified++;
        } else {
            missing++;
            missingFiles.push(media.filename);
        }
    }

    console.log('\n\n📊 Verification Results');
    console.log('='.repeat(50));
    console.log(`✅ Verified in S3: ${verified}`);
    console.log(`❌ Missing from S3: ${missing}`);

    if (missingFiles.length > 0) {
        console.log('\n⚠️  Missing files:');
        missingFiles.forEach(f => console.log(`   - ${f}`));
    }
}

async function migrateFiles() {
    console.log('\n🚀 S3 Migration Script');
    console.log('='.repeat(50));

    if (isDryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Check S3 configuration
    if (!isS3Configured()) {
        console.error('❌ S3 is not configured. Please set the following environment variables:');
        console.error('   - S3_ENDPOINT');
        console.error('   - S3_BUCKET');
        console.error('   - S3_ACCESS_KEY');
        console.error('   - S3_SECRET_KEY');
        process.exit(1);
    }

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // If verify only mode
    if (isVerifyOnly) {
        await verifyExistingFiles();
        await mongoose.disconnect();
        return;
    }

    // Create backup before any changes
    if (!isDryRun) {
        console.log('📦 Creating backup of database records...');
        const backupFile = await createBackup();
        console.log(`   Backup saved. You can restore from this if needed.\n`);
    }

    // Find all local files
    const uploadsDir = path.join(__dirname, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

    if (!fs.existsSync(uploadsDir)) {
        console.log('❌ Uploads directory does not exist. Nothing to migrate.');
        process.exit(0);
    }

    // Get all files from database that are still local
    const localMedia = await Media.find({
        $or: [
            { storageType: 'local' },
            { storageType: { $exists: false } }
        ]
    });

    console.log(`📂 Found ${localMedia.length} files to migrate\n`);

    if (localMedia.length === 0) {
        console.log('✅ No files to migrate. All files are already on S3.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // Show what will be migrated
    console.log('Files to migrate:');
    const sampleSize = Math.min(5, localMedia.length);
    for (let i = 0; i < sampleSize; i++) {
        console.log(`   - ${localMedia[i].filename}`);
    }
    if (localMedia.length > sampleSize) {
        console.log(`   - ... and ${localMedia.length - sampleSize} more\n`);
    }

    const results = {
        success: 0,
        verified: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };

    // Migrate each file
    for (let i = 0; i < localMedia.length; i++) {
        const media = localMedia[i];
        const filename = media.filename;
        const filePath = path.join(uploadsDir, filename);

        process.stdout.write(`\r${progressBar(i + 1, localMedia.length)} ${filename.substring(0, 20)}...`);

        // Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            results.skipped++;
            results.errors.push(`${filename}: File not found on disk`);
            continue;
        }

        try {
            if (!isDryRun) {
                // Read file
                const fileBuffer = fs.readFileSync(filePath);
                const fileSize = fileBuffer.length;

                // Upload to S3
                const s3Result = await uploadToS3(fileBuffer, filename, media.mimetype || 'application/octet-stream');

                // VERIFY the upload succeeded
                const verified = await verifyS3Upload(filename);
                if (!verified) {
                    throw new Error('Verification failed - file not found in S3 after upload');
                }
                results.verified++;

                // Upload thumbnail if exists
                let thumbnailUrl = null;
                if (media.thumbnail && media.thumbnail.startsWith('/uploads/thumbnails/')) {
                    const thumbFilename = path.basename(media.thumbnail);
                    const thumbPath = path.join(thumbnailsDir, thumbFilename);

                    if (fs.existsSync(thumbPath)) {
                        const thumbBuffer = fs.readFileSync(thumbPath);
                        const thumbResult = await uploadToS3(thumbBuffer, `thumbnails/${thumbFilename}`, 'image/jpeg');
                        thumbnailUrl = thumbResult.url;
                    }
                }

                // Update MongoDB record ONLY after successful upload and verification
                const updateData = {
                    url: s3Result.url,
                    storageType: 's3'
                };

                if (thumbnailUrl) {
                    updateData.thumbnail = thumbnailUrl;
                }

                await Media.findByIdAndUpdate(media._id, { $set: updateData });
            }

            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push(`${filename}: ${error.message}`);
        }
    }

    console.log('\n\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`✅ Uploaded: ${results.success}`);
    console.log(`🔍 Verified in S3: ${results.verified}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped (file missing): ${results.skipped}`);

    if (results.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        results.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
        if (results.errors.length > 10) {
            console.log(`   ... and ${results.errors.length - 10} more errors`);
        }
    }

    if (!isDryRun && results.success > 0) {
        console.log('\n' + '='.repeat(50));
        console.log('�️  IMPORTANT: Your local files have NOT been deleted.');
        console.log('='.repeat(50));
        console.log('\nNext steps:');
        console.log('1. Verify your gallery still works correctly');
        console.log('2. Run: node migrate-to-s3.js --verify');
        console.log('3. Only after verification, optionally delete local files:');
        console.log('   - Keep uploads/ folder (needed for video processing)');
        console.log('   - You can delete the actual files inside if verified\n');
        console.log('📦 Database backup saved in ./backups/ folder');
    }

    if (isDryRun) {
        console.log('\n📌 This was a dry run. Run without --dry-run to perform actual migration.');
    }

    await mongoose.disconnect();
    console.log('\n✨ Done!\n');
}

migrateFiles().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
