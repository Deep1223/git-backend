/**
 * Refund Status Tracking System
 * Comprehensive tracking of refund processes with real-time updates and notifications
 */

class RefundTracker {
    constructor() {
        this.refundMethods = {
            'original_payment': {
                name: 'Original Payment Method',
                processingTime: '3-5 business days',
                fees: 0,
                autoProcess: true
            },
            'bank_transfer': {
                name: 'Bank Transfer',
                processingTime: '5-7 business days',
                fees: 25,
                autoProcess: false,
                requiresBankDetails: true
            },
            'wallet_credit': {
                name: 'Wallet Credit',
                processingTime: 'Instant',
                fees: 0,
                autoProcess: true
            },
            'store_credit': {
                name: 'Store Credit',
                processingTime: 'Instant',
                fees: 0,
                autoProcess: true,
                bonusPercentage: 5
            },
            'upi': {
                name: 'UPI Transfer',
                processingTime: '1-2 business days',
                fees: 5,
                autoProcess: true,
                requiresUpiId: true
            }
        };
        
        this.statusTransitions = {
            'not_started': ['pending'],
            'pending': ['processing', 'failed'],
            'processing': ['processed', 'failed'],
            'failed': ['pending'],
            'processed': []
        };
        
        this.notificationTriggers = {
            'pending': ['customer', 'finance'],
            'processing': ['customer'],
            'processed': ['customer', 'finance', 'sales'],
            'failed': ['customer', 'finance', 'support']
        };
    }

    /**
     * Create new refund tracking record
     */
    async createRefundTracker(returnDoc, refundData) {
        try {
            const {
                method = 'original_payment',
                amount,
                bankDetails = null,
                upiId = null,
                priority = 'normal'
            } = refundData;
            
            // Validate refund method
            if (!this.refundMethods[method]) {
                throw new Error(`Invalid refund method: ${method}`);
            }
            
            // Create refund tracker
            const tracker = {
                id: this.generateRefundId(),
                returnId: returnDoc._id,
                orderId: returnDoc.order,
                orderNumber: returnDoc.orderNumber || 'Unknown',
                customerId: returnDoc.customerId,
                method,
                amount,
                status: 'not_started',
                priority,
                bankDetails: method === 'bank_transfer' ? bankDetails : null,
                upiId: method === 'upi' ? upiId : null,
                processingFees: this.refundMethods[method].fees || 0,
                netAmount: amount - (this.refundMethods[method].fees || 0),
                estimatedCompletion: this.calculateEstimatedCompletion(method),
                milestones: this.initializeMilestones(method),
                events: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Add initial event
            tracker.events.push({
                type: 'created',
                status: 'not_started',
                message: 'Refund tracker created',
                timestamp: new Date(),
                actor: 'system'
            });
            
            // Save tracker (in real implementation, save to database)
            const savedTracker = await this.saveRefundTracker(tracker);
            
            // Start processing if auto-process is enabled
            if (this.refundMethods[method].autoProcess) {
                await this.startRefundProcessing(savedTracker);
            }
            
            return savedTracker;
            
        } catch (error) {
            throw new Error(`Refund tracker creation failed: ${error.message}`);
        }
    }

    /**
     * Generate unique refund ID
     */
    generateRefundId() {
        return `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    /**
     * Calculate estimated completion time
     */
    calculateEstimatedCompletion(method) {
        const processingDays = {
            'original_payment': 4,
            'bank_transfer': 6,
            'wallet_credit': 0,
            'store_credit': 0,
            'upi': 1.5
        };
        
        const days = processingDays[method] || 4;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    /**
     * Initialize refund milestones
     */
    initializeMilestones(method) {
        const baseMilestones = [
            { key: 'initiated', label: 'Refund Initiated', completed: false, completedAt: null },
            { key: 'validated', label: 'Payment Validated', completed: false, completedAt: null },
            { key: 'processed', label: 'Payment Processed', completed: false, completedAt: null },
            { key: 'completed', label: 'Refund Completed', completed: false, completedAt: null }
        ];
        
        // Method-specific milestones
        if (method === 'bank_transfer') {
            baseMilestones.splice(2, 0, {
                key: 'bank_verified',
                label: 'Bank Details Verified',
                completed: false,
                completedAt: null
            });
        }
        
        if (method === 'upi') {
            baseMilestones.splice(2, 0, {
                key: 'upi_verified',
                label: 'UPI ID Verified',
                completed: false,
                completedAt: null
            });
        }
        
        return baseMilestones;
    }

    /**
     * Start refund processing
     */
    async startRefundProcessing(tracker) {
        try {
            // Update status to pending
            await this.updateRefundStatus(tracker.id, 'pending', 'Refund processing started');
            
            // Validate payment details if required
            if (tracker.bankDetails) {
                await this.validateBankDetails(tracker);
            }
            
            if (tracker.upiId) {
                await this.validateUpiId(tracker);
            }
            
            // Process refund based on method
            await this.processRefundByMethod(tracker);
            
        } catch (error) {
            await this.updateRefundStatus(tracker.id, 'failed', `Processing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate bank details
     */
    async validateBankDetails(tracker) {
        // Simulate bank validation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const isValid = this.mockBankValidation(tracker.bankDetails);
        
        if (isValid) {
            await this.completeMilestone(tracker.id, 'bank_verified', 'Bank details validated successfully');
        } else {
            throw new Error('Invalid bank details provided');
        }
    }

    /**
     * Validate UPI ID
     */
    async validateUpiId(tracker) {
        // Simulate UPI validation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isValid = this.mockUpiValidation(tracker.upiId);
        
        if (isValid) {
            await this.completeMilestone(tracker.id, 'upi_verified', 'UPI ID validated successfully');
        } else {
            throw new Error('Invalid UPI ID provided');
        }
    }

    /**
     * Process refund by method
     */
    async processRefundByMethod(tracker) {
        await this.updateRefundStatus(tracker.id, 'processing', 'Processing refund payment');
        await this.completeMilestone(tracker.id, 'validated', 'Payment details validated');
        
        // Simulate processing time based on method
        const processingTime = this.getProcessingTime(tracker.method);
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        // Complete the refund
        const reference = this.generateReferenceNumber(tracker);
        await this.completeRefund(tracker.id, reference);
    }

    /**
     * Get processing time for simulation
     */
    getProcessingTime(method) {
        const times = {
            'original_payment': 3000,
            'bank_transfer': 4000,
            'wallet_credit': 1000,
            'store_credit': 1000,
            'upi': 2000
        };
        
        return times[method] || 3000;
    }

    /**
     * Generate reference number
     */
    generateReferenceNumber(tracker) {
        const prefixes = {
            'original_payment': 'OP',
            'bank_transfer': 'BT',
            'wallet_credit': 'WC',
            'store_credit': 'SC',
            'upi': 'UPI'
        };
        
        const prefix = prefixes[tracker.method] || 'REF';
        return `${prefix}-${Date.now()}-${tracker.id.slice(-4)}`;
    }

    /**
     * Complete refund
     */
    async completeRefund(trackerId, reference) {
        await this.completeMilestone(trackerId, 'processed', `Refund processed with reference: ${reference}`);
        await this.completeMilestone(trackerId, 'completed', 'Refund completed successfully');
        
        const updatedTracker = await this.updateRefundStatus(trackerId, 'processed', 'Refund processed successfully', {
            reference,
            completedAt: new Date()
        });
        
        // Send completion notifications
        await this.sendRefundNotifications(updatedTracker, 'processed');
        
        return updatedTracker;
    }

    /**
     * Update refund status
     */
    async updateRefundStatus(trackerId, newStatus, message, additionalData = {}) {
        const tracker = await this.getRefundTracker(trackerId);
        if (!tracker) {
            throw new Error('Refund tracker not found');
        }
        
        // Validate status transition
        if (!this.statusTransitions[tracker.status].includes(newStatus)) {
            throw new Error(`Invalid status transition from ${tracker.status} to ${newStatus}`);
        }
        
        // Update tracker
        const updatedTracker = {
            ...tracker,
            status: newStatus,
            ...additionalData,
            updatedAt: new Date()
        };
        
        // Add event
        updatedTracker.events.push({
            type: 'status_change',
            status: newStatus,
            message,
            timestamp: new Date(),
            actor: 'system',
            previousStatus: tracker.status
        });
        
        // Save updated tracker
        await this.saveRefundTracker(updatedTracker);
        
        // Send notifications if triggered
        if (this.notificationTriggers[newStatus]) {
            await this.sendRefundNotifications(updatedTracker, newStatus);
        }
        
        return updatedTracker;
    }

    /**
     * Complete milestone
     */
    async completeMilestone(trackerId, milestoneKey, message) {
        const tracker = await this.getRefundTracker(trackerId);
        if (!tracker) {
            throw new Error('Refund tracker not found');
        }
        
        // Update milestone
        const milestone = tracker.milestones.find(m => m.key === milestoneKey);
        if (milestone && !milestone.completed) {
            milestone.completed = true;
            milestone.completedAt = new Date();
            
            // Add event
            tracker.events.push({
                type: 'milestone_completed',
                milestone: milestoneKey,
                message,
                timestamp: new Date(),
                actor: 'system'
            });
            
            await this.saveRefundTracker(tracker);
        }
        
        return tracker;
    }

    /**
     * Get refund tracker
     */
    async getRefundTracker(trackerId) {
        // In real implementation, query database
        return {
            id: trackerId,
            returnId: 'return123',
            orderId: 'order123',
            orderNumber: 'ORD-2024-001',
            method: 'original_payment',
            amount: 2500,
            status: 'pending',
            milestones: [
                { key: 'initiated', label: 'Refund Initiated', completed: true, completedAt: new Date() },
                { key: 'validated', label: 'Payment Validated', completed: false, completedAt: null },
                { key: 'processed', label: 'Payment Processed', completed: false, completedAt: null },
                { key: 'completed', label: 'Refund Completed', completed: false, completedAt: null }
            ],
            events: [
                {
                    type: 'created',
                    status: 'not_started',
                    message: 'Refund tracker created',
                    timestamp: new Date(),
                    actor: 'system'
                }
            ]
        };
    }

    /**
     * Save refund tracker (placeholder)
     */
    async saveRefundTracker(tracker) {
        console.log(`Saving refund tracker: ${tracker.id}`);
        return tracker;
    }

    /**
     * Send refund notifications
     */
    async sendRefundNotifications(tracker, status) {
        const notifications = {
            pending: {
                customer: {
                    subject: 'Refund Process Started',
                    message: `Your refund of INR ${tracker.amount} has been initiated via ${this.refundMethods[tracker.method].name}`,
                    estimatedCompletion: tracker.estimatedCompletion
                },
                finance: {
                    subject: 'New Refund to Process',
                    message: `Refund ${tracker.id} for order ${tracker.orderNumber} requires processing`
                }
            },
            processing: {
                customer: {
                    subject: 'Refund in Progress',
                    message: `Your refund is being processed. Current status: ${status}`
                }
            },
            processed: {
                customer: {
                    subject: 'Refund Completed',
                    message: `Your refund of INR ${tracker.amount} has been processed successfully`,
                    reference: tracker.reference
                },
                finance: {
                    subject: 'Refund Completed',
                    message: `Refund ${tracker.id} completed successfully`
                }
            },
            failed: {
                customer: {
                    subject: 'Refund Processing Issue',
                    message: 'There was an issue processing your refund. Our team will contact you shortly.'
                },
                support: {
                    subject: 'Refund Failed',
                    message: `Refund ${tracker.id} failed processing and requires attention`
                }
            }
        };
        
        const notificationData = notifications[status];
        if (notificationData) {
            // In real implementation, send via email/SMS service
            console.log(`Sending ${status} notifications for refund ${tracker.id}`);
        }
        
        return notificationData;
    }

    /**
     * Get refund status for customer
     */
    async getCustomerRefundStatus(orderId) {
        const tracker = await this.findTrackerByOrder(orderId);
        if (!tracker) {
            return null;
        }
        
        const progress = this.calculateProgress(tracker.milestones);
        const nextStep = this.getNextStep(tracker.milestones);
        
        return {
            refundId: tracker.id,
            status: tracker.status,
            amount: tracker.amount,
            method: this.refundMethods[tracker.method].name,
            progress,
            nextStep,
            estimatedCompletion: tracker.estimatedCompletion,
            reference: tracker.reference || null,
            events: tracker.events.slice(-5) // Last 5 events
        };
    }

    /**
     * Calculate progress percentage
     */
    calculateProgress(milestones) {
        const completed = milestones.filter(m => m.completed).length;
        const total = milestones.length;
        return Math.round((completed / total) * 100);
    }

    /**
     * Get next step
     */
    getNextStep(milestones) {
        return milestones.find(m => !m.completed)?.label || 'Refund complete';
    }

    /**
     * Find tracker by order
     */
    async findTrackerByOrder(orderId) {
        // In real implementation, query database
        return await this.getRefundTracker('REF-123456789');
    }

    /**
     * Get refund analytics
     */
    async getRefundAnalytics(filters = {}) {
        const { dateRange, method, status } = filters;
        
        // Mock analytics data
        return {
            totalRefunds: 125,
            totalAmount: 287500,
            averageProcessingTime: '2.8 days',
            successRate: 94.5,
            refundsByMethod: {
                'original_payment': { count: 45, amount: 112500, successRate: 96 },
                'bank_transfer': { count: 35, amount: 87500, successRate: 92 },
                'wallet_credit': { count: 25, amount: 45000, successRate: 98 },
                'store_credit': { count: 15, amount: 30000, successRate: 100 },
                'upi': { count: 5, amount: 12500, successRate: 90 }
            },
            refundsByStatus: {
                'not_started': 8,
                'pending': 15,
                'processing': 12,
                'processed': 85,
                'failed': 5
            },
            processingTrends: {
                daily: [
                    { date: '2024-01-10', processed: 8, failed: 1 },
                    { date: '2024-01-11', processed: 12, failed: 0 },
                    { date: '2024-01-12', processed: 10, failed: 2 }
                ],
                monthly: [
                    { month: '2023-11', processed: 85, failed: 3 },
                    { month: '2023-12', processed: 92, failed: 5 },
                    { month: '2024-01', processed: 78, failed: 2 }
                ]
            },
            averageProcessingTimeByMethod: {
                'original_payment': '3.2 days',
                'bank_transfer': '5.8 days',
                'wallet_credit': '0.1 days',
                'store_credit': '0.1 days',
                'upi': '1.5 days'
            }
        };
    }

    /**
     * Retry failed refund
     */
    async retryFailedRefund(trackerId, retryData) {
        const tracker = await this.getRefundTracker(trackerId);
        if (!tracker) {
            throw new Error('Refund tracker not found');
        }
        
        if (tracker.status !== 'failed') {
            throw new Error('Only failed refunds can be retried');
        }
        
        // Update retry data
        const updatedTracker = {
            ...tracker,
            retryCount: (tracker.retryCount || 0) + 1,
            lastRetryAt: new Date(),
            ...retryData
        };
        
        // Reset milestones that weren't completed
        updatedTracker.milestones.forEach(milestone => {
            if (!milestone.completed && milestone.key !== 'initiated') {
                milestone.completed = false;
                milestone.completedAt = null;
            }
        });
        
        await this.saveRefundTracker(updatedTracker);
        
        // Restart processing
        await this.startRefundProcessing(updatedTracker);
        
        return updatedTracker;
    }

    /**
     * Cancel refund
     */
    async cancelRefund(trackerId, reason) {
        const tracker = await this.getRefundTracker(trackerId);
        if (!tracker) {
            throw new Error('Refund tracker not found');
        }
        
        if (['processed', 'completed'].includes(tracker.status)) {
            throw new Error('Cannot cancel completed refund');
        }
        
        const cancelledTracker = {
            ...tracker,
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: reason,
            updatedAt: new Date()
        };
        
        cancelledTracker.events.push({
            type: 'cancelled',
            status: 'cancelled',
            message: `Refund cancelled: ${reason}`,
            timestamp: new Date(),
            actor: 'system'
        });
        
        await this.saveRefundTracker(cancelledTracker);
        
        // Send cancellation notifications
        await this.sendRefundNotifications(cancelledTracker, 'cancelled');
        
        return cancelledTracker;
    }

    /**
     * Mock bank validation
     */
    mockBankValidation(bankDetails) {
        // Simple validation logic
        return bankDetails && 
               bankDetails.accountNumber && 
               bankDetails.accountNumber.length >= 9 &&
               bankDetails.ifsc && 
               bankDetails.ifsc.length === 11;
    }

    /**
     * Mock UPI validation
     */
    mockUpiValidation(upiId) {
        // Simple UPI validation
        return upiId && 
               upiId.includes('@') && 
               upiId.length >= 5;
    }
}

module.exports = new RefundTracker();
