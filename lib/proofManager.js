const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Refund Proof Upload and Management System
 * Handles file uploads, validation, storage, and management of refund proofs
 */

class ProofManager {
    constructor() {
        this.allowedFileTypes = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
            document: ['pdf', 'doc', 'docx', 'txt'],
            video: ['mp4', 'avi', 'mov', 'wmv'],
            audio: ['mp3', 'wav', 'm4a']
        };
        
        this.maxFileSize = {
            image: 10 * 1024 * 1024, // 10MB
            document: 5 * 1024 * 1024, // 5MB
            video: 50 * 1024 * 1024, // 50MB
            audio: 10 * 1024 * 1024 // 10MB
        };
        
        this.proofCategories = {
            'product_condition': {
                name: 'Product Condition',
                required: true,
                description: 'Photos showing product condition and any defects',
                maxFiles: 5,
                fileTypes: ['image']
            },
            'packaging': {
                name: 'Packaging',
                required: false,
                description: 'Photos of original packaging if available',
                maxFiles: 3,
                fileTypes: ['image']
            },
            'delivery_receipt': {
                name: 'Delivery Receipt',
                required: false,
                description: 'Delivery confirmation or receipt',
                maxFiles: 2,
                fileTypes: ['image', 'document']
            },
            'communication': {
                name: 'Communication',
                required: false,
                description: 'Screenshots of customer service communication',
                maxFiles: 3,
                fileTypes: ['image', 'document']
            },
            'refund_proof': {
                name: 'Refund Proof',
                required: false,
                description: 'Bank statements, transaction screenshots for refund verification',
                maxFiles: 3,
                fileTypes: ['image', 'document']
            },
            'identity_proof': {
                name: 'Identity Proof',
                required: false,
                description: 'Customer ID for verification purposes',
                maxFiles: 2,
                fileTypes: ['image', 'document']
            },
            'other': {
                name: 'Other Evidence',
                required: false,
                description: 'Any other supporting documents',
                maxFiles: 5,
                fileTypes: ['image', 'document', 'video', 'audio']
            }
        };
        
        this.storagePath = path.join(__dirname, '../../uploads/proofs');
        this.initializeStorage();
    }

    /**
     * Initialize storage directory
     */
    async initializeStorage() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'returns'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'refunds'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'temp'), { recursive: true });
        } catch (error) {
            console.error('Failed to initialize storage:', error);
        }
    }

    /**
     * Configure multer for file uploads
     */
    getMulterConfig() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const tempPath = path.join(this.storagePath, 'temp');
                cb(null, tempPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                cb(null, file.fieldname + '-' + uniqueSuffix + ext);
            }
        });

        const fileFilter = (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase().slice(1);
            const fileType = this.getFileType(ext);
            
            if (this.allowedFileTypes[fileType]?.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error(`File type .${ext} is not allowed`), false);
            }
        };

        return multer({
            storage,
            fileFilter,
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB max
                files: 10 // Max 10 files per upload
            }
        });
    }

    /**
     * Get file type from extension
     */
    getFileType(extension) {
        for (const [type, extensions] of Object.entries(this.allowedFileTypes)) {
            if (extensions.includes(extension)) {
                return type;
            }
        }
        return 'unknown';
    }

    /**
     * Upload and process proof files
     */
    async uploadProofFiles(files, metadata) {
        try {
            const {
                returnId,
                refundId,
                category,
                uploadedBy,
                description = ''
            } = metadata;

            // Validate category
            if (!this.proofCategories[category]) {
                throw new Error(`Invalid proof category: ${category}`);
            }

            // Check file limits
            const categoryConfig = this.proofCategories[category];
            if (files.length > categoryConfig.maxFiles) {
                throw new Error(`Maximum ${categoryConfig.maxFiles} files allowed for ${category}`);
            }

            const processedFiles = [];
            const proofRecord = {
                id: this.generateProofId(),
                returnId,
                refundId,
                category,
                uploadedBy,
                description,
                files: [],
                uploadedAt: new Date(),
                status: 'processing',
                verificationStatus: 'pending'
            };

            // Process each file
            for (const file of files) {
                try {
                    const processedFile = await this.processFile(file, category, proofRecord.id);
                    processedFiles.push(processedFile);
                    proofRecord.files.push(processedFile.metadata);
                } catch (error) {
                    // Clean up failed file
                    await this.cleanupFile(file.path);
                    throw new Error(`Failed to process ${file.originalname}: ${error.message}`);
                }
            }

            // Save proof record
            proofRecord.status = 'completed';
            const savedProof = await this.saveProofRecord(proofRecord);

            // Trigger verification if required
            if (categoryConfig.required) {
                await this.triggerVerification(savedProof);
            }

            return {
                success: true,
                proof: savedProof,
                files: processedFiles
            };

        } catch (error) {
            // Clean up all uploaded files on error
            if (files) {
                for (const file of files) {
                    await this.cleanupFile(file.path);
                }
            }
            throw error;
        }
    }

    /**
     * Process individual file
     */
    async processFile(file, category, proofId) {
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        const fileType = this.getFileType(ext);
        
        // Validate file size
        const maxSize = this.maxFileSize[fileType];
        if (file.size > maxSize) {
            throw new Error(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
        }

        // Generate secure filename
        const secureFilename = this.generateSecureFilename(file.originalname, proofId);
        
        // Move file to permanent location
        const permanentPath = path.join(this.storagePath, this.getStoragePath(category), secureFilename);
        await fs.rename(file.path, permanentPath);

        // Generate file hash for integrity
        const fileHash = await this.generateFileHash(permanentPath);

        // Extract metadata
        const metadata = await this.extractFileMetadata(permanentPath, fileType);

        const processedFile = {
            originalName: file.originalname,
            secureFilename,
            path: permanentPath,
            size: file.size,
            type: fileType,
            extension: ext,
            hash: fileHash,
            uploadedAt: new Date(),
            metadata: {
                ...metadata,
                category,
                proofId
            }
        };

        return processedFile;
    }

    /**
     * Generate secure filename
     */
    generateSecureFilename(originalName, proofId) {
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `${proofId}-${name.substring(0, 20)}-${timestamp}-${random}${ext}`;
    }

    /**
     * Generate file hash
     */
    async generateFileHash(filePath) {
        const fileBuffer = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    /**
     * Extract file metadata
     */
    async extractFileMetadata(filePath, fileType) {
        const stats = await fs.stat(filePath);
        const metadata = {
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
        };

        // Add type-specific metadata
        if (fileType === 'image') {
            // In real implementation, use sharp or similar to extract image dimensions
            metadata.dimensions = { width: 1920, height: 1080 }; // Mock data
        } else if (fileType === 'document') {
            // In real implementation, extract document metadata
            metadata.pages = 1; // Mock data
        }

        return metadata;
    }

    /**
     * Get storage path for category
     */
    getStoragePath(category) {
        const pathMap = {
            'product_condition': 'returns/product_condition',
            'packaging': 'returns/packaging',
            'delivery_receipt': 'returns/delivery_receipt',
            'communication': 'returns/communication',
            'refund_proof': 'refunds/proof',
            'identity_proof': 'refunds/identity',
            'other': 'returns/other'
        };
        
        return pathMap[category] || 'returns/other';
    }

    /**
     * Generate proof ID
     */
    generateProofId() {
        return `PROOF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    /**
     * Save proof record
     */
    async saveProofRecord(proofRecord) {
        // In real implementation, save to database
        console.log(`Saving proof record: ${proofRecord.id}`);
        return proofRecord;
    }

    /**
     * Trigger verification process
     */
    async triggerVerification(proofRecord) {
        // Start automated verification
        const verificationResult = await this.verifyProof(proofRecord);
        
        // Update verification status
        proofRecord.verificationStatus = verificationResult.status;
        proofRecord.verificationDetails = verificationResult.details;
        proofRecord.verifiedAt = new Date();
        
        await this.saveProofRecord(proofRecord);
        
        return verificationResult;
    }

    /**
     * Verify proof documents
     */
    async verifyProof(proofRecord) {
        const verificationDetails = {
            checks: [],
            issues: [],
            score: 0,
            status: 'verified'
        };

        // Verify each file
        for (const file of proofRecord.files) {
            const fileVerification = await this.verifyFile(file, proofRecord.category);
            verificationDetails.checks.push(fileVerification);
            
            if (fileVerification.issues.length > 0) {
                verificationDetails.issues.push(...fileVerification.issues);
            }
            
            verificationDetails.score += fileVerification.score;
        }

        // Calculate overall score
        verificationDetails.score = Math.round(verificationDetails.score / proofRecord.files.length);

        // Determine status
        if (verificationDetails.issues.length > 0) {
            verificationDetails.status = 'warning';
        }
        
        if (verificationDetails.score < 60) {
            verificationDetails.status = 'rejected';
        }

        return verificationDetails;
    }

    /**
     * Verify individual file
     */
    async verifyFile(file, category) {
        const verification = {
            filename: file.originalName,
            score: 0,
            issues: [],
            checks: []
        };

        // Check file integrity
        if (file.hash) {
            verification.checks.push({ type: 'integrity', passed: true });
            verification.score += 25;
        } else {
            verification.issues.push('File hash missing - integrity cannot be verified');
        }

        // Check file size appropriateness
        const categoryConfig = this.proofCategories[category];
        const expectedTypes = categoryConfig.fileTypes;
        
        if (expectedTypes.includes(file.type)) {
            verification.checks.push({ type: 'file_type', passed: true });
            verification.score += 25;
        } else {
            verification.issues.push(`File type ${file.type} not expected for ${category}`);
        }

        // Check image quality for image files
        if (file.type === 'image') {
            const qualityCheck = await this.verifyImageQuality(file.path);
            verification.checks.push({ type: 'image_quality', ...qualityCheck });
            verification.score += qualityCheck.score;
        }

        // Check document readability for document files
        if (file.type === 'document') {
            const readabilityCheck = await this.verifyDocumentReadability(file.path);
            verification.checks.push({ type: 'document_readability', ...readabilityCheck });
            verification.score += readabilityCheck.score;
        }

        return verification;
    }

    /**
     * Verify image quality
     */
    async verifyImageQuality(filePath) {
        // In real implementation, use sharp to analyze image
        const mockAnalysis = {
            passed: true,
            score: 25,
            details: {
                resolution: '1920x1080',
                clarity: 'good',
                brightness: 'optimal'
            }
        };

        return mockAnalysis;
    }

    /**
     * Verify document readability
     */
    async verifyDocumentReadability(filePath) {
        // In real implementation, use OCR or PDF parsing
        const mockAnalysis = {
            passed: true,
            score: 25,
            details: {
                pages: 1,
                textExtractable: true,
                quality: 'good'
            }
        };

        return mockAnalysis;
    }

    /**
     * Get proof files for return/refund
     */
    async getProofFiles(returnId, refundId = null) {
        // In real implementation, query database
        const mockProofs = [
            {
                id: 'PROOF-123456789',
                returnId,
                refundId,
                category: 'product_condition',
                description: 'Photos showing scratched surface',
                status: 'completed',
                verificationStatus: 'verified',
                uploadedAt: new Date('2024-01-15T10:30:00Z'),
                files: [
                    {
                        originalName: 'scratch1.jpg',
                        secureFilename: 'PROOF-123456789-scratch1-1705316200000-abc123.jpg',
                        size: 2048576,
                        type: 'image',
                        hash: 'sha256:abc123...',
                        downloadUrl: '/api/proofs/download/PROOF-123456789-scratch1-1705316200000-abc123.jpg'
                    },
                    {
                        originalName: 'scratch2.jpg',
                        secureFilename: 'PROOF-123456789-scratch2-1705316200000-def456.jpg',
                        size: 1536000,
                        type: 'image',
                        hash: 'sha256:def456...',
                        downloadUrl: '/api/proofs/download/PROOF-123456789-scratch2-1705316200000-def456.jpg'
                    }
                ]
            }
        ];

        return mockProofs;
    }

    /**
     * Download proof file
     */
    async downloadProofFile(filename) {
        const filePath = path.join(this.storagePath, filename);
        
        try {
            await fs.access(filePath);
            return filePath;
        } catch (error) {
            throw new Error('File not found');
        }
    }

    /**
     * Delete proof file
     */
    async deleteProofFile(proofId, filename) {
        try {
            const filePath = path.join(this.storagePath, filename);
            await fs.unlink(filePath);
            
            // Update proof record
            const proofRecord = await this.getProofRecord(proofId);
            if (proofRecord) {
                proofRecord.files = proofRecord.files.filter(f => f.secureFilename !== filename);
                await this.saveProofRecord(proofRecord);
            }
            
            return { success: true };
        } catch (error) {
            throw new Error('Failed to delete file');
        }
    }

    /**
     * Get proof record
     */
    async getProofRecord(proofId) {
        // In real implementation, query database
        return {
            id: proofId,
            files: []
        };
    }

    /**
     * Cleanup temporary file
     */
    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Get proof analytics
     */
    async getProofAnalytics(filters = {}) {
        const { dateRange, category, verificationStatus } = filters;
        
        return {
            totalProofs: 156,
            totalFiles: 423,
            storageUsed: '2.8 GB',
            averageFilesPerProof: 2.7,
            verificationBreakdown: {
                verified: 142,
                warning: 8,
                rejected: 6
            },
            categoryBreakdown: {
                'product_condition': { count: 89, files: 234 },
                'packaging': { count: 23, files: 45 },
                'delivery_receipt': { count: 18, files: 32 },
                'communication': { count: 15, files: 38 },
                'refund_proof': { count: 8, files: 12 },
                'identity_proof': { count: 2, files: 4 },
                'other': { count: 1, files: 8 }
            },
            fileTypeBreakdown: {
                'image': { count: 312, size: '1.2 GB' },
                'document': { count: 98, size: '156 MB' },
                'video': { count: 8, size: '1.4 GB' },
                'audio': { count: 5, size: '24 MB' }
            },
            uploadTrends: {
                daily: [
                    { date: '2024-01-10', uploads: 12 },
                    { date: '2024-01-11', uploads: 18 },
                    { date: '2024-01-12', uploads: 15 }
                ]
            }
        };
    }

    /**
     * Bulk verify proofs
     */
    async bulkVerifyProofs(proofIds) {
        const results = [];
        
        for (const proofId of proofIds) {
            try {
                const proofRecord = await this.getProofRecord(proofId);
                if (proofRecord) {
                    const verificationResult = await this.triggerVerification(proofRecord);
                    results.push({ proofId, success: true, result: verificationResult });
                } else {
                    results.push({ proofId, success: false, error: 'Proof not found' });
                }
            } catch (error) {
                results.push({ proofId, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Archive old proofs
     */
    async archiveOldProofs(daysOld = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        // In real implementation, find and archive old proofs
        const archivedCount = 0; // Mock data
        
        return {
            archivedCount,
            cutoffDate,
            message: `Archived ${archivedCount} proof records older than ${daysOld} days`
        };
    }
}

module.exports = new ProofManager();
