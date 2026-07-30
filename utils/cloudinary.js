const { BRAND } = require('../config/brand');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const isCloudinaryConfigured = () => {
    return (
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

// Function to ensure cloudinary is configured
const ensureConfig = () => {
    if (isCloudinaryConfigured()) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
    }
};

const normalizeFolder = (folder = 'temp') =>
    String(folder || 'temp').replace(/^\/+|\/+$/g, '');

const isCloudinaryUrl = (url = '') => /res\.cloudinary\.com/i.test(String(url || ''));

const extractPublicIdFromUrl = (url = '') => {
    if (!isCloudinaryUrl(url)) return '';

    try {
        const parsed = new URL(url);
        const uploadMarker = '/upload/';
        const uploadIndex = parsed.pathname.indexOf(uploadMarker);
        if (uploadIndex === -1) return '';

        let assetPath = parsed.pathname.slice(uploadIndex + uploadMarker.length);
        assetPath = assetPath.replace(/^v\d+\//, '');
        if (!assetPath) return '';

        const segments = assetPath.split('/').filter(Boolean);
        if (!segments.length) return '';

        const lastSegment = segments.pop();
        segments.push(path.posix.parse(lastSegment).name);
        return segments.join('/');
    } catch (error) {
        return '';
    }
};

const isTempCloudinaryUrl = (url = '') => {
    const publicId = extractPublicIdFromUrl(url);
    return /(^|\/)temp\//i.test(publicId);
};

/**
 * Uploads a file buffer to Cloudinary
 */
exports.uploadToCloudinary = async (file, folder = 'temp') => {
    ensureConfig(); // Ensure config is applied before upload
    
    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured. Please add CLOUDINARY credentials to your .env file.');
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: normalizeFolder(folder),
                resource_type: 'auto',
                public_id: `${Date.now()}-${path.parse(file.originalname).name}`
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        uploadStream.end(file.buffer);
    });
};

/**
 * Cloudinary doesn't strictly need a 'move' operation like S3 for folders, 
 * but rename gives us a clean temp -> permanent workflow.
 */
exports.moveToPermanentCloudinary = async (url, folder = BRAND.cloudinaryBlog) => {
    ensureConfig();
    if (!url || !isCloudinaryConfigured()) return url;

    const sourcePublicId = extractPublicIdFromUrl(url);
    if (!sourcePublicId || !/(^|\/)temp\//i.test(sourcePublicId)) {
        return url;
    }

    const targetFolder = normalizeFolder(folder);
    const baseName = path.posix.basename(sourcePublicId);
    const targetPublicId = `${targetFolder}/${baseName}`;

    if (sourcePublicId === targetPublicId) return url;

    const result = await cloudinary.uploader.rename(sourcePublicId, targetPublicId, {
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
    });

    return result.secure_url || url;
};

/**
 * Deletes a file from Cloudinary
 */
exports.deleteFromCloudinary = async (url) => {
    if (!url || !isCloudinaryConfigured()) return;

    try {
        ensureConfig();
        const publicId = extractPublicIdFromUrl(url);
        if (!publicId) return;

        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
        console.error('Error deleting Cloudinary object:', error);
    }
};

exports.extractPublicIdFromUrl = extractPublicIdFromUrl;
exports.isCloudinaryUrl = isCloudinaryUrl;
exports.isTempCloudinaryUrl = isTempCloudinaryUrl;
