const { schedulePickup } = require('./courierProviders');

/**
 * Pickup Scheduling System
 * Handles pickup scheduling, time slot management, and driver coordination
 */

class PickupScheduler {
    constructor() {
        this.timeSlots = this.initializeTimeSlots();
        this.pickupRules = {
            cutoffTime: '15:00', // 3 PM cutoff for same-day pickup
            maxPickupsPerSlot: 10,
            prepTimeMinutes: 30,
            bufferTimeMinutes: 15
        };
        
        this.holidays = [
            '2024-01-26', '2024-03-25', '2024-08-15', '2024-10-02',
            '2024-12-25' // Add more holidays as needed
        ];
    }

    /**
     * Initialize available time slots
     */
    initializeTimeSlots() {
        const slots = [];
        const startHour = 9; // 9 AM
        const endHour = 18; // 6 PM
        
        for (let hour = startHour; hour < endHour; hour++) {
            slots.push({
                id: `${hour}:00-${hour + 1}:00`,
                start: `${hour.toString().padStart(2, '0')}:00`,
                end: `${(hour + 1).toString().padStart(2, '0')}:00`,
                available: true,
                bookings: 0,
                maxBookings: 10
            });
        }
        
        return slots;
    }

    /**
     * Get available pickup slots for a date
     */
    async getAvailableSlots(date, courier = null) {
        const targetDate = new Date(date);
        
        // Check if date is valid for pickup
        if (!this.isValidPickupDate(targetDate)) {
            return { available: false, reason: 'Date not available for pickup' };
        }
        
        // Get available slots
        const availableSlots = this.timeSlots.filter(slot => {
            return slot.available && slot.bookings < slot.maxBookings;
        });
        
        // Filter by courier if specified
        if (courier) {
            const courierSlots = await this.getCourierSpecificSlots(courier, targetDate);
            return availableSlots.filter(slot => courierSlots.includes(slot.id));
        }
        
        return {
            available: true,
            date: targetDate.toISOString().split('T')[0],
            slots: availableSlots,
            cutoffTime: this.pickupRules.cutoffTime
        };
    }

    /**
     * Check if date is valid for pickup
     */
    isValidPickupDate(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        // Check if date is in the past
        if (targetDate < today) return false;
        
        // Check if it's a weekend
        if (date.getDay() === 0 || date.getDay() === 6) return false;
        
        // Check if it's a holiday
        const dateStr = date.toISOString().split('T')[0];
        if (this.holidays.includes(dateStr)) return false;
        
        // Check if same-day pickup is still possible
        if (targetDate.getTime() === today.getTime()) {
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const cutoffMinutes = this.parseTime(this.pickupRules.cutoffTime);
            return currentTime < cutoffMinutes;
        }
        
        return true;
    }

    /**
     * Parse time string to minutes
     */
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Get courier-specific available slots
     */
    async getCourierSpecificSlots(courier, date) {
        // Different couriers have different pickup schedules
        const courierSchedules = {
            dhl: ['9:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'],
            fedex: ['10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'],
            blue_dart: ['9:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '16:00-17:00'],
            delhivery: ['9:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00']
        };
        
        return courierSchedules[courier] || courierSchedules.delhivery;
    }

    /**
     * Schedule pickup for an order
     */
    async schedulePickup(order, shipment, options = {}) {
        try {
            const {
                preferredDate,
                preferredSlot,
                courier = shipment.courierName,
                specialInstructions = '',
                packageReady = false
            } = options;
            
            // Validate pickup date and slot
            const slotValidation = await this.validatePickupSlot(preferredDate, preferredSlot, courier);
            if (!slotValidation.valid) {
                throw new Error(slotValidation.reason);
            }
            
            // Calculate pickup window
            const pickupWindow = this.calculatePickupWindow(preferredDate, preferredSlot);
            
            // Schedule with courier
            const courierResult = await schedulePickup({ 
                order, 
                shipment, 
                req: options.req 
            });
            
            // Create pickup record
            const pickupRecord = {
                orderId: order._id,
                orderNumber: order.orderNumber,
                courier,
                date: preferredDate,
                slot: preferredSlot,
                window: pickupWindow,
                reference: courierResult.pickupReference,
                status: 'scheduled',
                specialInstructions,
                packageReady,
                address: order.shippingAddress,
                estimatedWeight: shipment.weight,
                packageCount: shipment.packageCount || 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                driverInfo: courierResult.meta || {}
            };
            
            // Update slot availability
            await this.updateSlotAvailability(preferredDate, preferredSlot, courier, 'book');
            
            // Send notifications
            await this.sendPickupNotifications(pickupRecord, 'scheduled');
            
            return {
                success: true,
                pickup: pickupRecord,
                courier: courierResult
            };
            
        } catch (error) {
            throw new Error(`Pickup scheduling failed: ${error.message}`);
        }
    }

    /**
     * Validate pickup slot availability
     */
    async validatePickupSlot(date, slot, courier) {
        const availableSlots = await this.getAvailableSlots(date, courier);
        
        if (!availableSlots.available) {
            return { valid: false, reason: availableSlots.reason };
        }
        
        const slotExists = availableSlots.slots.find(s => s.id === slot);
        if (!slotExists) {
            return { valid: false, reason: 'Selected slot not available' };
        }
        
        if (slotExists.bookings >= slotExists.maxBookings) {
            return { valid: false, reason: 'Slot is fully booked' };
        }
        
        return { valid: true };
    }

    /**
     * Calculate pickup window with buffer times
     */
    calculatePickupWindow(date, slot) {
        const [startTime] = slot.split('-');
        const [startHour, startMin] = startTime.split(':').map(Number);
        
        const pickupDate = new Date(date);
        pickupDate.setHours(startHour, startMin, 0, 0);
        
        // Add prep time buffer
        const windowStart = new Date(pickupDate.getTime() - this.pickupRules.prepTimeMinutes * 60 * 1000);
        
        // Add buffer time at end
        const [endTime] = slot.split('-')[1].split(':');
        const windowEnd = new Date(date);
        windowEnd.setHours(parseInt(endTime), 0, 0, 0);
        windowEnd.setTime(windowEnd.getTime() + this.pickupRules.bufferTimeMinutes * 60 * 1000);
        
        return {
            start: windowStart,
            end: windowEnd,
            estimatedArrival: pickupDate
        };
    }

    /**
     * Update slot availability
     */
    async updateSlotAvailability(date, slot, courier, action) {
        const slotData = this.timeSlots.find(s => s.id === slot);
        if (!slotData) return;
        
        if (action === 'book') {
            slotData.bookings++;
            if (slotData.bookings >= slotData.maxBookings) {
                slotData.available = false;
            }
        } else if (action === 'cancel') {
            slotData.bookings = Math.max(0, slotData.bookings - 1);
            slotData.available = true;
        }
    }

    /**
     * Reschedule pickup
     */
    async reschedulePickup(pickupId, newDate, newSlot, reason) {
        try {
            // Find existing pickup
            const existingPickup = await this.findPickupById(pickupId);
            if (!existingPickup) {
                throw new Error('Pickup not found');
            }
            
            // Validate new slot
            const validation = await this.validatePickupSlot(newDate, newSlot, existingPickup.courier);
            if (!validation.valid) {
                throw new Error(validation.reason);
            }
            
            // Calculate new window
            const newWindow = this.calculatePickupWindow(newDate, newSlot);
            
            // Update existing pickup
            const updatedPickup = {
                ...existingPickup,
                date: newDate,
                slot: newSlot,
                window: newWindow,
                status: 'rescheduled',
                rescheduledAt: new Date(),
                rescheduleReason: reason,
                updatedAt: new Date()
            };
            
            // Update slot availabilities
            await this.updateSlotAvailability(existingPickup.date, existingPickup.slot, existingPickup.courier, 'cancel');
            await this.updateSlotAvailability(newDate, newSlot, existingPickup.courier, 'book');
            
            // Send notifications
            await this.sendPickupNotifications(updatedPickup, 'rescheduled');
            
            return { success: true, pickup: updatedPickup };
            
        } catch (error) {
            throw new Error(`Reschedule failed: ${error.message}`);
        }
    }

    /**
     * Cancel pickup
     */
    async cancelPickup(pickupId, reason) {
        try {
            const pickup = await this.findPickupById(pickupId);
            if (!pickup) {
                throw new Error('Pickup not found');
            }
            
            // Update pickup status
            pickup.status = 'cancelled';
            pickup.cancelledAt = new Date();
            pickup.cancelReason = reason;
            pickup.updatedAt = new Date();
            
            // Update slot availability
            await this.updateSlotAvailability(pickup.date, pickup.slot, pickup.courier, 'cancel');
            
            // Send notifications
            await this.sendPickupNotifications(pickup, 'cancelled');
            
            return { success: true, pickup };
            
        } catch (error) {
            throw new Error(`Cancel failed: ${error.message}`);
        }
    }

    /**
     * Get pickup status
     */
    async getPickupStatus(pickupId) {
        const pickup = await this.findPickupById(pickupId);
        if (!pickup) {
            throw new Error('Pickup not found');
        }
        
        // Get real-time status from courier
        const courierStatus = await this.getCourierPickupStatus(pickup.reference, pickup.courier);
        
        return {
            ...pickup,
            courierStatus,
            timeToPickup: this.calculateTimeToPickup(pickup.window.start),
            isOverdue: this.isPickupOverdue(pickup.window.end, pickup.status)
        };
    }

    /**
     * Calculate time to pickup
     */
    calculateTimeToPickup(pickupTime) {
        const now = new Date();
        const diff = pickupTime.getTime() - now.getTime();
        
        if (diff <= 0) return 'Overdue';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes} minutes`;
        }
    }

    /**
     * Check if pickup is overdue
     */
    isPickupOverdue(windowEnd, status) {
        if (status === 'completed' || status === 'cancelled') return false;
        return new Date() > new Date(windowEnd);
    }

    /**
     * Send pickup notifications
     */
    async sendPickupNotifications(pickup, action) {
        // In real implementation, send SMS, email, push notifications
        console.log(`Pickup ${action} notification sent for order ${pickup.orderNumber}`);
        
        // Example notification content
        const notifications = {
            scheduled: {
                sms: `Pickup scheduled for ${pickup.date} between ${pickup.slot}. Ref: ${pickup.reference}`,
                email: {
                    subject: 'Pickup Scheduled',
                    body: `Your pickup has been scheduled for order ${pickup.orderNumber}`
                }
            },
            rescheduled: {
                sms: `Pickup rescheduled to ${pickup.date} between ${pickup.slot}. Ref: ${pickup.reference}`,
                email: {
                    subject: 'Pickup Rescheduled',
                    body: `Your pickup has been rescheduled for order ${pickup.orderNumber}`
                }
            },
            cancelled: {
                sms: `Pickup cancelled. Ref: ${pickup.reference}`,
                email: {
                    subject: 'Pickup Cancelled',
                    body: `Your pickup has been cancelled for order ${pickup.orderNumber}`
                }
            }
        };
        
        return notifications[action] || null;
    }

    /**
     * Get courier pickup status
     */
    async getCourierPickupStatus(reference, courier) {
        // In real implementation, call courier API
        return {
            status: 'assigned',
            driverName: 'Raj Kumar',
            driverPhone: '+91-9876543210',
            vehicleNumber: 'MH-12-AB-1234',
            estimatedArrival: new Date(Date.now() + 30 * 60 * 1000),
            lastUpdated: new Date()
        };
    }

    /**
     * Find pickup by ID (placeholder - would use database)
     */
    async findPickupById(pickupId) {
        // In real implementation, query database
        return {
            id: pickupId,
            orderId: 'order123',
            orderNumber: 'ORD-2024-001',
            courier: 'delhivery',
            date: '2024-01-15',
            slot: '10:00-11:00',
            window: {
                start: new Date('2024-01-15T09:30:00'),
                end: new Date('2024-01-15T11:15:00')
            },
            reference: 'DL-PU-123456',
            status: 'scheduled'
        };
    }

    /**
     * Get daily pickup summary
     */
    async getDailyPickupSummary(date, courier = null) {
        // In real implementation, query database
        return {
            date,
            totalPickups: 15,
            completedPickups: 12,
            pendingPickups: 3,
            cancelledPickups: 0,
            courier: courier || 'all',
            slots: this.timeSlots.map(slot => ({
                ...slot,
                utilization: `${slot.bookings}/${slot.maxBookings}`
            }))
        };
    }

    /**
     * Optimize pickup routes
     */
    async optimizePickupRoutes(date, courier) {
        // In real implementation, use route optimization algorithms
        return {
            optimized: true,
            routes: [
                {
                    driverId: 'driver1',
                    vehicle: 'bike',
                    pickups: ['pickup1', 'pickup2', 'pickup3'],
                    estimatedTime: '2 hours 30 minutes',
                    distance: '15.5 km'
                }
            ],
            savings: {
                time: '45 minutes',
                distance: '5.2 km',
                fuel: '2.1 liters'
            }
        };
    }
}

module.exports = new PickupScheduler();
