const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');

const isS3Configured = () => {
    return (
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION &&
        process.env.AWS_BUCKET_NAME
    );
};

let s3 = null;
if (isS3Configured()) {
    s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
}

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

/**
 * Uploads a file to S3 temp folder
 */
exports.uploadToS3 = async (file, folder = 'temp') => {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured. Please add AWS credentials to your .env file.');
    }

    const fileName = `${folder}/${Date.now()}-${file.originalname}`;
    
    const upload = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
            // ACL: 'public-read' // Uncomment if you want public access
        }
    });

    await upload.done();
    
    // Return the URL (assuming bucket is public or using cloudfront)
    // Adjust URL format based on your S3 configuration
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

/**
 * Moves a file from temp to permanent folder
 */
exports.moveToPermanent = async (tempUrl, permanentFolder = 'uploads') => {
    if (!tempUrl || !tempUrl.includes('/temp/')) return tempUrl;
    if (!isS3Configured()) {
        console.warn('S3 is not configured. Skipping move operation.');
        return tempUrl;
    }

    try {
        const tempKey = tempUrl.split('.com/')[1];
        const fileName = path.basename(tempKey);
        const permanentKey = `${permanentFolder}/${fileName}`;

        // Copy object to new location
        await s3.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${tempKey}`,
            Key: permanentKey
        }));

        // Delete original temp object
        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: tempKey
        }));

        return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${permanentKey}`;
    } catch (error) {
        console.error('Error moving S3 object:', error);
        return tempUrl;
    }
};

/**
 * Deletes an object from S3
 */
exports.deleteFromS3 = async (url) => {
    if (!url || !isS3Configured()) return;

    try {
        const key = url.split('.com/')[1];
        if (!key) return;

        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        }));
    } catch (error) {
        console.error('Error deleting S3 object:', error);
    }
};
