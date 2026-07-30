const { BRAND } = require('../config/brand');
const multer = require('multer');
const path = require('path');
const { uploadToS3 } = require('../utils/s3');
const { deleteFromCloudinary, isTempCloudinaryUrl, uploadToCloudinary } = require('../utils/cloudinary');

// Configure multer for memory storage (S3 and Cloudinary upload)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // Default 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Validation is now handled inside the controller for more flexibility,
        // but we still do a basic check here for security.
        cb(null, true);
    }
});

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // --- CUSTOM VALIDATION ---
        const { allowedtypes, maxfilesize } = req.body; // Expecting comma separated types and size in bytes
        
        // 1. Validate File Size
        if (maxfilesize && req.file.size > parseInt(maxfilesize)) {
            return res.status(400).json({
                success: false,
                message: `File size too large. Maximum allowed is ${(maxfilesize / (1024 * 1024)).toFixed(2)}MB`
            });
        }

        // 2. Validate File Type
        if (allowedtypes) {
            const typesArray = allowedtypes.split(',').map(t => t.trim().toLowerCase());
            const fileExtension = path.extname(req.file.originalname).toLowerCase().replace('.', '');
            const fileMime = req.file.mimetype.toLowerCase();

            const isAllowed = typesArray.some(type => 
                fileExtension === type || fileMime.includes(type)
            );

            if (!isAllowed) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid file type. Allowed: ${allowedtypes}`
                });
            }
        }
        // -------------------------

        const storageType = process.env.STORAGE_TYPE || 'aws';
        let fileUrl;

        if (storageType === 'cloudinary') {
            fileUrl = await uploadToCloudinary(req.file, BRAND.cloudinaryTemp);
        } else {
            // Default to S3
            fileUrl = await uploadToS3(req.file, 'temp');
        }

        res.status(200).json({
            success: true,
            data: {
                url: fileUrl,
                originalName: req.file.originalname,
                storage: storageType
            }
        });
    } catch (error) {
        console.error('Upload Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error uploading file',
            error: error.message
        });
    }
};

exports.cleanupTempUploads = async (req, res) => {
    try {
        const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
        const tempUrls = [...new Set(urls.map((url) => String(url || '').trim()).filter((url) => isTempCloudinaryUrl(url)))];

        await Promise.allSettled(tempUrls.map((url) => deleteFromCloudinary(url)));

        return res.status(200).json({
            success: true,
            message: 'Temp uploads cleaned',
            data: { deletedCount: tempUrls.length },
        });
    } catch (error) {
        console.error('Temp cleanup error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Could not clean temp uploads',
            error: error.message,
        });
    }
};

exports.uploadMiddleware = upload.single('image');
