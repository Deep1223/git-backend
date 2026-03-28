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
                folder: folder,
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
 * but we can rename or just return the URL if the logic doesn't require physical moving.
 * For consistency with S3, we'll just return the URL here.
 */
exports.moveToPermanentCloudinary = async (url) => {
    return url;
};

/**
 * Deletes a file from Cloudinary
 */
exports.deleteFromCloudinary = async (url) => {
    if (!url || !isCloudinaryConfigured()) return;

    try {
        // Extract public_id from URL
        // Example: https://res.cloudinary.com/cloudname/image/upload/v123/folder/filename.jpg
        const parts = url.split('/');
        const fileNameWithExtension = parts.pop();
        const folder = parts.pop();
        const publicId = `${folder}/${path.parse(fileNameWithExtension).name}`;

        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error deleting Cloudinary object:', error);
    }
};
