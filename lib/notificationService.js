const { BRAND } = require('../config/brand');
/**
 * Real Notification Service
 * Integrates SMS, Email, and Push notifications
 */

class NotificationService {
    constructor() {
        // Initialize notification providers
        this.smsProvider = null;
        this.emailProvider = null;
        this.pushProvider = null;
        
        this.initializeProviders();
    }

    async initializeProviders() {
        try {
            // Initialize SMS (Twilio)
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                const twilio = require('twilio');
                this.smsProvider = twilio(
                    process.env.TWILIO_ACCOUNT_SID,
                    process.env.TWILIO_AUTH_TOKEN
                );
                console.log('SMS provider initialized');
            }

            // Initialize Email (Nodemailer)
            if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
                const nodemailer = require('nodemailer');
                this.emailProvider = nodemailer.createTransporter({
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });
                console.log('Email provider initialized');
            }

            // Initialize Push (Firebase)
            if (process.env.FIREBASE_PROJECT_ID) {
                const admin = require('firebase-admin');
                const serviceAccount = require('../../firebase-service-account.json');
                
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                this.pushProvider = admin;
                console.log('Push provider initialized');
            }
        } catch (error) {
            console.error('Notification providers initialization failed:', error);
        }
    }

    /**
     * Send SMS notification
     */
    async sendSMS(to, message) {
        try {
            if (!this.smsProvider) {
                console.log('SMS (Mock):', to, message);
                return { success: true, provider: 'mock' };
            }

            const result = await this.smsProvider.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: `+91${to.replace(/\D/g, '')}` // Format for India
            });

            console.log('SMS sent:', result.sid);
            return { success: true, provider: 'twilio', sid: result.sid };

        } catch (error) {
            console.error('SMS sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Email notification
     */
    async sendEmail(to, subject, htmlContent, textContent = null) {
        try {
            if (!this.emailProvider) {
                console.log('Email (Mock):', to, subject);
                return { success: true, provider: 'mock' };
            }

            const mailOptions = {
                from: `"${BRAND.emailFromDisplay}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to,
                subject,
                text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
                html: htmlContent
            };

            const result = await this.emailProvider.sendMail(mailOptions);
            console.log('Email sent:', result.messageId);
            return { success: true, provider: 'nodemailer', messageId: result.messageId };

        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Push notification
     */
    async sendPushNotification(userTokens, title, body, data = {}) {
        try {
            if (!this.pushProvider) {
                console.log('Push (Mock):', title, body);
                return { success: true, provider: 'mock' };
            }

            const message = {
                notification: { title, body },
                data,
                tokens: Array.isArray(userTokens) ? userTokens : [userTokens]
            };

            const result = await this.pushProvider.messaging().sendMulticast(message);
            console.log('Push sent:', result.successCount, 'successes');
            return { success: true, provider: 'firebase', result };

        } catch (error) {
            console.error('Push sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send multi-channel notification
     */
    async sendNotification(channels, recipient, content) {
        const results = {};

        for (const channel of channels) {
            switch (channel) {
                case 'sms':
                    if (recipient.phone && content.sms) {
                        results.sms = await this.sendSMS(recipient.phone, content.sms);
                    }
                    break;

                case 'email':
                    if (recipient.email && content.email) {
                        results.email = await this.sendEmail(
                            recipient.email,
                            content.email.subject,
                            content.email.html,
                            content.email.text
                        );
                    }
                    break;

                case 'push':
                    if (recipient.pushTokens && content.push) {
                        results.push = await this.sendPushNotification(
                            recipient.pushTokens,
                            content.push.title,
                            content.push.body,
                            content.push.data
                        );
                    }
                    break;
            }
        }

        return results;
    }

    /**
     * Send shipping notifications
     */
    async sendShippingNotification(type, data) {
        const templates = {
            shipment_assigned: {
                channels: ['email', 'sms'],
                recipient: {
                    email: data.customerEmail,
                    phone: data.customerPhone
                },
                content: {
                    sms: `Your order ${data.orderNumber} has been assigned to ${data.courierName}. AWB: ${data.awbNumber}`,
                    email: {
                        subject: 'Your Order Has Been Shipped',
                        html: this.getShipmentEmailTemplate(data)
                    }
                }
            },
            pickup_scheduled: {
                channels: ['email', 'sms'],
                recipient: {
                    email: data.customerEmail,
                    phone: data.customerPhone
                },
                content: {
                    sms: `Pickup scheduled for order ${data.orderNumber} on ${data.pickupDate}. Reference: ${data.pickupReference}`,
                    email: {
                        subject: 'Pickup Scheduled',
                        html: this.getPickupEmailTemplate(data)
                    }
                }
            },
            delivery_exception: {
                channels: ['email', 'sms'],
                recipient: {
                    email: data.customerEmail,
                    phone: data.customerPhone
                },
                content: {
                    sms: `Issue with delivery of order ${data.orderNumber}. We're working to resolve it. Status: ${data.exceptionType}`,
                    email: {
                        subject: 'Delivery Update Required',
                        html: this.getExceptionEmailTemplate(data)
                    }
                }
            },
            return_approved: {
                channels: ['email', 'sms'],
                recipient: {
                    email: data.customerEmail,
                    phone: data.customerPhone
                },
                content: {
                    sms: `Your return request for order ${data.orderNumber} has been approved. We'll contact you for pickup.`,
                    email: {
                        subject: 'Return Request Approved',
                        html: this.getReturnApprovedEmailTemplate(data)
                    }
                }
            },
            refund_processed: {
                channels: ['email', 'sms'],
                recipient: {
                    email: data.customerEmail,
                    phone: data.customerPhone
                },
                content: {
                    sms: `Refund of INR ${data.amount} processed for order ${data.orderNumber}. Reference: ${data.reference}`,
                    email: {
                        subject: 'Refund Processed Successfully',
                        html: this.getRefundEmailTemplate(data)
                    }
                }
            }
        };

        const template = templates[type];
        if (!template) {
            console.log('No template found for notification type:', type);
            return { success: false, error: 'Template not found' };
        }

        return await this.sendNotification(
            template.channels,
            template.recipient,
            template.content
        );
    }

    /**
     * Email templates
     */
    getShipmentEmailTemplate(data) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Your Order Has Been Shipped!</h2>
                <p>Dear Customer,</p>
                <p>Great news! Your order ${data.orderNumber} has been shipped and is on its way.</p>
                
                <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Shipping Details:</h3>
                    <p><strong>Order:</strong> ${data.orderNumber}</p>
                    <p><strong>Courier:</strong> ${data.courierName}</p>
                    <p><strong>AWB Number:</strong> ${data.awbNumber}</p>
                    <p><strong>Tracking:</strong> <a href="${data.trackingUrl}">Track here</a></p>
                    <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
                </div>
                
                <p>You can track your package using the AWB number above.</p>
                <p>${BRAND.thankYouShopping}</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        `;
    }

    getPickupEmailTemplate(data) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Pickup Scheduled</h2>
                <p>Dear Customer,</p>
                <p>Your return pickup has been scheduled for order ${data.orderNumber}.</p>
                
                <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3>Pickup Details:</h3>
                    <p><strong>Order:</strong> ${data.orderNumber}</p>
                    <p><strong>Date:</strong> ${data.pickupDate}</p>
                    <p><strong>Time:</strong> ${data.pickupTime}</p>
                    <p><strong>Reference:</strong> ${data.pickupReference}</p>
                    <p><strong>Courier:</strong> ${data.courierName}</p>
                </div>
                
                <p>Please ensure the items are properly packaged.</p>
                <p>${BRAND.thankYouChoosing}</p>
            </div>
        `;
    }

    getExceptionEmailTemplate(data) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d32f2f;">Delivery Update Required</h2>
                <p>Dear Customer,</p>
                <p>We encountered an issue with the delivery of your order ${data.orderNumber}.</p>
                
                <div style="background: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <h3>Issue Details:</h3>
                    <p><strong>Order:</strong> ${data.orderNumber}</p>
                    <p><strong>Issue:</strong> ${data.exceptionType}</p>
                    <p><strong>Description:</strong> ${data.description}</p>
                </div>
                
                <p>Our team is working to resolve this issue. We'll update you shortly.</p>
                <p>If you have any questions, please contact our support team.</p>
            </div>
        `;
    }

    getReturnApprovedEmailTemplate(data) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2e7d32;">Return Request Approved</h2>
                <p>Dear Customer,</p>
                <p>Your return request for order ${data.orderNumber} has been approved.</p>
                
                <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h3>Return Details:</h3>
                    <p><strong>Order:</strong> ${data.orderNumber}</p>
                    <p><strong>Approved At:</strong> ${data.approvedAt}</p>
                    <p><strong>Next Steps:</strong> We'll contact you to schedule pickup</p>
                </div>
                
                <p>Please keep the items ready for pickup.</p>
                <p>Thank you for your patience!</p>
            </div>
        `;
    }

    getRefundEmailTemplate(data) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2e7d32;">Refund Processed Successfully</h2>
                <p>Dear Customer,</p>
                <p>Your refund has been processed successfully!</p>
                
                <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h3>Refund Details:</h3>
                    <p><strong>Order:</strong> ${data.orderNumber}</p>
                    <p><strong>Amount:</strong> INR ${data.amount}</p>
                    <p><strong>Method:</strong> ${data.method}</p>
                    <p><strong>Reference:</strong> ${data.reference}</p>
                    <p><strong>Processed At:</strong> ${data.processedAt}</p>
                </div>
                
                <p>The refund should reflect in your account within 3-5 business days.</p>
                <p>Thank you for your understanding!</p>
            </div>
        `;
    }
}

module.exports = new NotificationService();
