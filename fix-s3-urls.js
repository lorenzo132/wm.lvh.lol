/**
 * Fix S3 URLs in database to use correct Contabo format
 * Run: node fix-s3-urls.js
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
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://eu2.contabostorage.com';

if (!S3_TENANT_ID) {
    console.error('❌ S3_TENANT_ID is not set in .env file');
    console.error('   Add: S3_TENANT_ID=5f046e2c2dbe48bdb609cc07f804d216');
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

    // Find all S3 files with wrong URL format
    const endpoint = S3_ENDPOINT.replace('https://', '');
    const wrongPattern = `https://${endpoint}/${S3_BUCKET}/`;
    const correctPattern = `https://${endpoint}/${S3_TENANT_ID}:${S3_BUCKET}/`;

    console.log(`Wrong format:   ${wrongPattern}...`);
    console.log(`Correct format: ${correctPattern}...\n`);

    const filesToFix = await Media.find({
        storageType: 's3',
        url: { $regex: `^https://${endpoint}/${S3_BUCKET}/` }
    });

    console.log(`📂 Found ${filesToFix.length} files to fix\n`);

    if (filesToFix.length === 0) {
        console.log('✅ All URLs are already correct!');
        await mongoose.disconnect();
        return;
    }

    let fixed = 0;
    for (const file of filesToFix) {
        const oldUrl = file.url;
        const newUrl = oldUrl.replace(wrongPattern, correctPattern);

        let newThumbnail = file.thumbnail;
        if (file.thumbnail && file.thumbnail.includes(wrongPattern)) {
            newThumbnail = file.thumbnail.replace(wrongPattern, correctPattern);
        }

        await Media.findByIdAndUpdate(file._id, {
            $set: {
                url: newUrl,
                thumbnail: newThumbnail
            }
        });

        fixed++;
        process.stdout.write(`\r   Fixed ${fixed}/${filesToFix.length}`);
    }

    console.log('\n\n✅ All URLs fixed!');
    console.log(`\nSample URL: ${correctPattern}filename.jpg`);

    await mongoose.disconnect();
    console.log('\n✨ Done!\n');
}

fixUrls().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
