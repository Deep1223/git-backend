const PDFDocument = require('pdfkit');
const { generateAwb } = require('./courierProviders');

/**
 * AWB (Air Waybill) Generation System
 * Handles PDF generation, label printing, and document management
 */

class AWBGenerator {
    constructor() {
        this.labelTemplates = {
            standard: 'standard-thermal',
            express: 'express-thermal', 
            international: 'international-label'
        };
    }

    /**
     * Generate AWB with PDF label
     */
    async generateAWBWithLabel(order, shipment, options = {}) {
        try {
            // Generate AWB details from courier provider
            const awbDetails = await generateAwb({ order, shipment, req: options.req });
            
            // Generate PDF label
            const labelBuffer = await this.generateLabelPDF(order, shipment, awbDetails, options);
            
            // Generate AWB document
            const documentBuffer = await this.generateAWBDocument(order, shipment, awbDetails, options);
            
            return {
                ...awbDetails,
                labelBuffer,
                documentBuffer,
                labelUrl: await this.uploadLabel(labelBuffer, awbDetails.awbNumber),
                documentUrl: await this.uploadDocument(documentBuffer, awbDetails.awbNumber)
            };
        } catch (error) {
            throw new Error(`AWB generation failed: ${error.message}`);
        }
    }

    /**
     * Generate thermal label PDF
     */
    async generateLabelPDF(order, shipment, awbDetails, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [4, 6], // 4x6 inches thermal label
                    margins: { top: 10, left: 10, bottom: 10, right: 10 }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Add label content
                this.addLabelContent(doc, order, shipment, awbDetails, options);
                
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Add content to thermal label
     */
    addLabelContent(doc, order, shipment, awbDetails, options) {
        const courier = awbDetails.provider.toUpperCase();
        
        // Header with courier logo placeholder
        doc.fontSize(20).font('Helvetica-Bold').text(courier, 10, 10);
        doc.fontSize(10).font('Helvetica').text('FRAGILE', 150, 10);
        
        // AWB Number (large and prominent)
        doc.fontSize(24).font('Courier-Bold').text(awbDetails.awbNumber, 10, 35);
        
        // Barcode placeholder (in real implementation, use barcode library)
        doc.fontSize(8).text('|||||||||||||||||||||||||', 10, 65);
        
        // Sender information
        doc.fontSize(10).font('Helvetica-Bold').text('FROM:', 10, 85);
        doc.fontSize(8).font('Helvetica').text('Orinket Jewelry', 10, 95);
        doc.fontSize(8).text('123 Business Avenue', 10, 105);
        doc.fontSize(8).text('Mumbai, 400001', 10, 115);
        doc.fontSize(8).text('+91-9876543210', 10, 125);
        
        // Recipient information
        doc.fontSize(10).font('Helvetica-Bold').text('TO:', 150, 85);
        doc.fontSize(8).font('Helvetica').text(order.shippingAddress?.name || '', 150, 95);
        doc.fontSize(8).text(order.shippingAddress?.address || '', 150, 105);
        doc.fontSize(8).text(`${order.shippingAddress?.city || ''}, ${order.shippingAddress?.pincode || ''}`, 150, 115);
        doc.fontSize(8).text(order.shippingAddress?.phone || '', 150, 125);
        
        // Order information
        doc.fontSize(10).font('Helvetica-Bold').text('ORDER:', 10, 145);
        doc.fontSize(8).font('Helvetica').text(`Order: ${order.orderNumber}`, 10, 155);
        doc.fontSize(8).text(`Weight: ${shipment.weight || 'N/A'}g`, 10, 165);
        doc.fontSize(8).text(`Service: ${shipment.serviceLevel || 'Standard'}`, 10, 175);
        
        // Special handling
        if (shipment.specialHandling) {
            doc.fontSize(10).font('Helvetica-Bold').text('SPECIAL:', 150, 145);
            doc.fontSize(8).font('Helvetica').text(shipment.specialHandling.join(', '), 150, 155);
        }
        
        // Tracking QR code placeholder
        doc.fontSize(8).text('Scan to track', 10, 195);
        doc.rect(10, 205, 50, 50).stroke(); // QR placeholder
        
        // Footer
        doc.fontSize(6).text(awbDetails.trackingUrl, 10, 260);
        doc.fontSize(6).text(`Generated: ${new Date().toLocaleDateString()}`, 150, 260);
    }

    /**
     * Generate AWB document (detailed shipping document)
     */
    async generateAWBDocument(order, shipment, awbDetails, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 20, left: 20, bottom: 20, right: 20 }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Add document content
                this.addDocumentContent(doc, order, shipment, awbDetails, options);
                
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Add content to AWB document
     */
    addDocumentContent(doc, order, shipment, awbDetails, options) {
        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('AIR WAYBILL', 50, 30);
        doc.fontSize(12).font('Helvetica').text(awbDetails.provider.toUpperCase(), 50, 55);
        
        // AWB Number
        doc.fontSize(16).font('Courier-Bold').text(`AWB: ${awbDetails.awbNumber}`, 50, 80);
        
        // Date and tracking
        doc.fontSize(10).font('Helvetica').text(`Date: ${new Date().toLocaleDateString()}`, 50, 105);
        doc.fontSize(10).text(`Track: ${awbDetails.trackingUrl}`, 250, 105);
        
        // Sender Section
        doc.fontSize(14).font('Helvetica-Bold').text('SENDER', 50, 140);
        doc.fontSize(10).font('Helvetica').text('Orinket Jewelry', 50, 160);
        doc.fontSize(10).text('123 Business Avenue, Andheri West', 50, 175);
        doc.fontSize(10).text('Mumbai, Maharashtra - 400001', 50, 190);
        doc.fontSize(10).text('India', 50, 205);
        doc.fontSize(10).text('Phone: +91-9876543210', 50, 220);
        doc.fontSize(10).text('Email: support@orinket.com', 50, 235);
        
        // Recipient Section
        doc.fontSize(14).font('Helvetica-Bold').text('RECIPIENT', 300, 140);
        doc.fontSize(10).font('Helvetica').text(order.shippingAddress?.name || '', 300, 160);
        doc.fontSize(10).text(order.shippingAddress?.address || '', 300, 175);
        doc.fontSize(10).text(order.shippingAddress?.city || '', 300, 190);
        doc.fontSize(10).text(order.shippingAddress?.state || '', 300, 205);
        doc.fontSize(10).text(order.shippingAddress?.pincode || '', 300, 220);
        doc.fontSize(10).text(order.shippingAddress?.phone || '', 300, 235);
        
        // Shipment Details
        doc.fontSize(14).font('Helvetica-Bold').text('SHIPMENT DETAILS', 50, 280);
        doc.fontSize(10).font('Helvetica').text(`Order Number: ${order.orderNumber}`, 50, 300);
        doc.fontSize(10).text(`Service Type: ${shipment.serviceLevel || 'Standard'}`, 50, 315);
        doc.fontSize(10).text(`Weight: ${shipment.weight || 'N/A'} grams`, 50, 330);
        doc.fontSize(10).text(`Dimensions: ${shipment.dimensions || 'N/A'}`, 50, 345);
        doc.fontSize(10).text(`Declared Value: INR ${order.totalAmount || 0}`, 50, 360);
        
        // Contents
        doc.fontSize(14).font('Helvetica-Bold').text('CONTENTS', 50, 395);
        doc.fontSize(10).font('Helvetica').text('Jewelry Items', 50, 415);
        doc.fontSize(10).text('Quantity: 1', 50, 430);
        doc.fontSize(10).text('Description: Premium Jewelry Product', 50, 445);
        
        // Special Instructions
        if (shipment.specialHandling && shipment.specialHandling.length > 0) {
            doc.fontSize(14).font('Helvetica-Bold').text('SPECIAL HANDLING', 50, 480);
            doc.fontSize(10).font('Helvetica').text(shipment.specialHandling.join(', '), 50, 500);
        }
        
        // Terms and Conditions
        doc.fontSize(8).font('Helvetica').text('Terms & Conditions:', 50, 550);
        doc.fontSize(8).text('1. Goods are transported as per courier terms', 50, 565);
        doc.fontSize(8).text('2. Risk of loss passes to recipient upon delivery', 50, 580);
        doc.fontSize(8).text('3. Claims must be filed within 7 days of delivery', 50, 595);
        
        // Signature areas
        doc.fontSize(10).font('Helvetica-Bold').text('Sender Signature:', 50, 650);
        doc.lineCap('butt').lineJoin('miter').strokeColor('black').lineWidth(1);
        doc.moveTo(50, 670).lineTo(200, 670).stroke();
        
        doc.fontSize(10).font('Helvetica-Bold').text('Recipient Signature:', 300, 650);
        doc.moveTo(300, 670).lineTo(450, 670).stroke();
    }

    /**
     * Upload label to storage (placeholder)
     */
    async uploadLabel(buffer, awbNumber) {
        // In real implementation, upload to S3, Cloudinary, etc.
        return `https://storage.example.com/labels/${awbNumber}.pdf`;
    }

    /**
     * Upload document to storage (placeholder)
     */
    async uploadDocument(buffer, awbNumber) {
        // In real implementation, upload to S3, Cloudinary, etc.
        return `https://storage.example.com/documents/${awbNumber}.pdf`;
    }

    /**
     * Generate batch AWBs for multiple orders
     */
    async generateBatchAWBs(orders, options = {}) {
        const results = [];
        
        for (const orderData of orders) {
            try {
                const { order, shipment } = orderData;
                const result = await this.generateAWBWithLabel(order, shipment, options);
                results.push({ success: true, orderId: order._id, ...result });
            } catch (error) {
                results.push({ 
                    success: false, 
                    orderId: orderData.order._id, 
                    error: error.message 
                });
            }
        }
        
        return results;
    }

    /**
     * Reprint AWB
     */
    async reprintAWB(order, shipment, awbNumber, options = {}) {
        // Find existing AWB details
        const existingAWB = {
            provider: shipment.courierName,
            awbNumber: awbNumber,
            trackingUrl: shipment.trackingUrl
        };
        
        // Regenerate with same AWB number
        return await this.generateAWBWithLabel(order, shipment, { 
            ...options, 
            reprint: true,
            awbNumber 
        });
    }

    /**
     * Cancel AWB
     */
    async cancelAWB(awbNumber, courier, reason) {
        // In real implementation, call courier API to cancel
        return {
            success: true,
            awbNumber,
            cancelledAt: new Date(),
            reason,
            confirmationCode: `CANCEL-${Date.now()}`
        };
    }

    /**
     * Validate AWB format
     */
    validateAWBFormat(awbNumber, courier) {
        const patterns = {
            dhl: /^DHL-\d+-\d{3}$/,
            fedex: /^FX-\d+-\d{3}$/,
            blue_dart: /^BD-\d+-\d{3}$/,
            delhivery: /^DL-\d+-\d{3}$/,
            manual: /^MANUAL-AWB-[\w\d]{8}$/
        };
        
        const pattern = patterns[courier] || patterns.manual;
        return pattern.test(awbNumber);
    }

    /**
     * Get AWB status from courier
     */
    async getAWBStatus(awbNumber, courier) {
        // In real implementation, call courier tracking API
        return {
            awbNumber,
            status: 'in_transit',
            currentLocation: 'Mumbai Hub',
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            lastUpdated: new Date(),
            events: [
                {
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    location: 'Mumbai',
                    status: 'picked_up',
                    description: 'Package picked up from sender'
                },
                {
                    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
                    location: 'Mumbai Hub',
                    status: 'in_transit',
                    description: 'Package in transit to destination'
                }
            ]
        };
    }
}

module.exports = new AWBGenerator();
