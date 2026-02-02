/**
 * S3-Compatible Object Storage Service (Contabo)
 * 
 * This module handles all S3 operations for media storage.
 * Uses AWS SDK v3 for S3-compatible storage.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// S3 Configuration from environment variables
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://eu2.contabostorage.com';
const S3_REGION = process.env.S3_REGION || 'eu-central-1';
const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
// Contabo uses tenant ID in public URLs: https://endpoint/tenant_id:bucket/key
const S3_TENANT_ID = process.env.S3_TENANT_ID || '';

// Validate required configuration
const validateConfig = () => {
    const missing = [];
    if (!S3_BUCKET) missing.push('S3_BUCKET');
    if (!S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY');
    if (!S3_SECRET_KEY) missing.push('S3_SECRET_KEY');

    if (missing.length > 0) {
        console.warn(`⚠️  S3 configuration incomplete. Missing: ${missing.join(', ')}`);
        console.warn('   S3 storage will not work until these are configured.');
        return false;
    }
    return true;
};

// Create S3 client
const createS3Client = () => {
    return new S3Client({
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
        },
        forcePathStyle: true, // Required for Contabo and most S3-compatible services
    });
};

let s3Client = null;

const getS3Client = () => {
    if (!s3Client) {
        s3Client = createS3Client();
    }
    return s3Client;
};

/**
 * Check if S3 is properly configured
 */
export const isS3Configured = () => {
    return validateConfig();
};

/**
 * Upload a file buffer to S3
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} key - S3 object key (filename with path)
 * @param {string} mimetype - MIME type of the file
 * @param {Object} metadata - Optional metadata to attach
 * @returns {Promise<{url: string, key: string}>}
 */
export const uploadToS3 = async (buffer, key, mimetype, metadata = {}) => {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured. Please set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY environment variables.');
    }

    const client = getS3Client();

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        Metadata: metadata,
        ACL: 'public-read', // Make files publicly accessible
    });

    try {
        await client.send(command);
        const url = getS3Url(key);
        console.log(`✅ Uploaded to S3: ${key}`);
        return { url, key };
    } catch (error) {
        console.error(`❌ Failed to upload to S3: ${key}`, error);
        throw error;
    }
};

/**
 * Upload a stream to S3 (for large files)
 * Uses multipart upload for better reliability
 * @param {ReadableStream} stream - File stream to upload
 * @param {string} key - S3 object key
 * @param {string} mimetype - MIME type of the file
 * @param {function} onProgress - Optional progress callback (0-100)
 * @returns {Promise<{url: string, key: string}>}
 */
export const uploadStreamToS3 = async (stream, key, mimetype, onProgress = null) => {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured. Please set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY environment variables.');
    }

    const client = getS3Client();

    const upload = new Upload({
        client,
        params: {
            Bucket: S3_BUCKET,
            Key: key,
            Body: stream,
            ContentType: mimetype,
            ACL: 'public-read',
        },
        queueSize: 4, // Concurrent upload parts
        partSize: 5 * 1024 * 1024, // 5MB parts
    });

    if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            onProgress(percentage);
        });
    }

    try {
        await upload.done();
        const url = getS3Url(key);
        console.log(`✅ Stream uploaded to S3: ${key}`);
        return { url, key };
    } catch (error) {
        console.error(`❌ Failed to stream upload to S3: ${key}`, error);
        throw error;
    }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key to delete
 * @returns {Promise<boolean>}
 */
export const deleteFromS3 = async (key) => {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured.');
    }

    const client = getS3Client();

    const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    try {
        await client.send(command);
        console.log(`✅ Deleted from S3: ${key}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to delete from S3: ${key}`, error);
        throw error;
    }
};

/**
 * Check if a file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
export const existsInS3 = async (key) => {
    if (!isS3Configured()) {
        return false;
    }

    const client = getS3Client();

    const command = new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    try {
        await client.send(command);
        return true;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw error;
    }
};

/**
 * Get the public URL for an S3 object
 * @param {string} key - S3 object key
 * @returns {string} - Public URL
 */
export const getS3Url = (key) => {
    // Contabo S3 URL format: https://{endpoint}/{tenant_id}:{bucket}/{key}
    // Example: https://eu2.contabostorage.com/5f046e2c2dbe48bdb609cc07f804d216:wendy-moore-gallery/file.jpg

    const endpoint = S3_ENDPOINT.replace('https://', '').replace('http://', '');

    if (S3_TENANT_ID) {
        // Contabo format with tenant ID
        return `https://${endpoint}/${S3_TENANT_ID}:${S3_BUCKET}/${key}`;
    } else {
        // Fallback to standard path-style URL
        return `https://${endpoint}/${S3_BUCKET}/${key}`;
    }
};

/**
 * Get a signed URL for temporary private access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
export const getSignedS3Url = async (key, expiresIn = 3600) => {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured.');
    }

    const client = getS3Client();

    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    try {
        const signedUrl = await getSignedUrl(client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error(`❌ Failed to generate signed URL for: ${key}`, error);
        throw error;
    }
};

/**
 * Get S3 configuration status for debugging
 */
export const getS3Status = () => {
    return {
        configured: isS3Configured(),
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        bucket: S3_BUCKET ? `${S3_BUCKET.substring(0, 3)}...` : 'NOT SET',
        accessKey: S3_ACCESS_KEY ? `${S3_ACCESS_KEY.substring(0, 4)}...` : 'NOT SET',
    };
};

export default {
    uploadToS3,
    uploadStreamToS3,
    deleteFromS3,
    existsInS3,
    getS3Url,
    getSignedS3Url,
    isS3Configured,
    getS3Status,
};
