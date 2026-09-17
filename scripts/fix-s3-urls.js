/**
 * Fix S3 URLs in database to use correct Contabo format
 * Run: node scripts/fix-s3-urls.js
 * 
 * This updates all S3 URLs from:
 *   https://eu2.contabostorage.com/bucket/file
 * To:
 *   https://eu2.contabostorage.com/tenant_id:bucket/file
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const S3_TENANT_ID = process.env.S3_TENANT_ID;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = (process.env.S3_ENDPOINT || 'https://eu2.contabostorage.com').replace(/\/$/, ''); // Remove trailing slash

if (!S3_TENANT_ID) {
    console.error('❌ S3_TENANT_ID is not set in .env file');
    console.error('   Add: S3_TENANT_ID=5f046e2c2dbe48bdb609cc07f804d216');
    process.exit(1);
}

if (!S3_BUCKET) {
    console.error('❌ S3_BUCKET is not set in .env file');
    process.exit(1);
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wmgallery';

const mediaSchema = new mongoose.Schema({
    filename: String,
    url: String,
    thumbnail: String,
    storageType: String,
});

const Media = mongoose.model('Media', mediaSchema);

async function fixUrls() {
    console.log('\n🔧 Fixing S3 URLs in database\n');

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Build patterns - ensure no double slashes
    const endpoint = S3_ENDPOINT.replace('https://', '').replace('http://', '');
    const wrongUrlStart = `https://${endpoint}/${S3_BUCKET}/`;
    const correctUrlStart = `https://${endpoint}/${S3_TENANT_ID}:${S3_BUCKET}/`;

    console.log(`Looking for:  ${wrongUrlStart}...`);
    console.log(`Will change to: ${correctUrlStart}...\n`);

    // Find all S3 files that DON'T have the tenant ID in the URL
    const filesToFix = await Media.find({
        storageType: 's3',
        url: {
            $regex: `^https://${endpoint}/${S3_BUCKET}/`,
            $not: { $regex: `:${S3_BUCKET}/` }  // Exclude already-fixed URLs with tenant:bucket
        }
    });

    console.log(`📂 Found ${filesToFix.length} files to fix (missing tenant ID)\n`);

    if (filesToFix.length === 0) {
        // Double check - show a sample URL
        const sample = await Media.findOne({ storageType: 's3' });
        if (sample) {
            console.log('Sample URL in database:');
            console.log(`   ${sample.url}`);

            if (sample.url.includes(`:${S3_BUCKET}/`)) {
                console.log('\n✅ URLs already have tenant ID format!');
            } else {
                console.log('\n⚠️  URL format might not match expected pattern.');
                console.log('   Expected pattern: https://eu2.contabostorage.com/wendy-moore-gallery/...');
            }
        }
    } else {
        let fixed = 0;
        for (const file of filesToFix) {
            const oldUrl = file.url;
            const newUrl = oldUrl.replace(wrongUrlStart, correctUrlStart);

            let newThumbnail = file.thumbnail;
            if (file.thumbnail && file.thumbnail.includes(wrongUrlStart)) {
                newThumbnail = file.thumbnail.replace(wrongUrlStart, correctUrlStart);
            }

            await Media.findByIdAndUpdate(file._id, {
                $set: {
                    url: newUrl,
                    thumbnail: newThumbnail || file.thumbnail
                }
            });

            fixed++;
            process.stdout.write(`\r   Fixed ${fixed}/${filesToFix.length}`);
        }
        console.log('\n');
    }

    // === Pass 2: Fix double-slash URLs ===
    // These occur when S3_ENDPOINT had a trailing slash, producing URLs like:
    // https://eu2.contabostorage.com//tenant:bucket/key
    console.log('🔧 Checking for double-slash URLs...\n');

    const doubleSlashFiles = await Media.find({
        storageType: 's3',
        url: { $regex: `https://${endpoint}//` }
    });

    console.log(`📂 Found ${doubleSlashFiles.length} files with double-slash URLs\n`);

    if (doubleSlashFiles.length > 0) {
        let fixed2 = 0;
        for (const file of doubleSlashFiles) {
            const oldUrl = file.url;
            // Replace double (or more) slashes after the domain with a single slash
            const newUrl = oldUrl.replace(`https://${endpoint}//`, `https://${endpoint}/`);

            let newThumbnail = file.thumbnail;
            if (file.thumbnail && file.thumbnail.includes(`https://${endpoint}//`)) {
                newThumbnail = file.thumbnail.replace(`https://${endpoint}//`, `https://${endpoint}/`);
            }

            await Media.findByIdAndUpdate(file._id, {
                $set: {
                    url: newUrl,
                    thumbnail: newThumbnail || file.thumbnail
                }
            });

            fixed2++;
            process.stdout.write(`\r   Fixed ${fixed2}/${doubleSlashFiles.length}`);
        }
        console.log('\n');
    }

    console.log('✅ All URL fixes complete!');

    // Show sample
    const sample = await Media.findOne({ storageType: 's3' });
    if (sample) {
        console.log(`\nSample URL: ${sample.url}`);
    }

    await mongoose.disconnect();
    console.log('\n✨ Done!\n');
}

fixUrls().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
