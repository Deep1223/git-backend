/**
 * User-wise Notification Manager
 * Handles notifications for all management activities with user-specific data
 */

class UserNotificationManager {
    constructor() {
        this.webSocketServer = require('./websocketServer');
        this.notificationService = require('./notificationService');
        this.userSessions = new Map(); // userId -> session data
        this.userPermissions = new Map(); // userId -> permissions
    }

    /**
     * Register user session with permissions
     */
    registerUserSession(userId, userData, permissions = []) {
        this.userSessions.set(userId, {
            ...userData,
            loginTime: new Date(),
            lastActivity: new Date(),
            permissions
        });
        
        this.userPermissions.set(userId, permissions);
        
        console.log(`User session registered: ${userId}`);
    }

    /**
     * Get user-specific data based on permissions
     */
    async getUserSpecificData(userId, dataType, filters = {}) {
        const permissions = this.userPermissions.get(userId) || [];
        const userSession = this.userSessions.get(userId);
        
        if (!userSession) {
            throw new Error('User session not found');
        }

        // Filter data based on user permissions and role
        switch (dataType) {
            case 'orders':
                return await this.getUserOrders(userId, permissions, filters);
            case 'shipments':
                return await this.getUserShipments(userId, permissions, filters);
            case 'returns':
                return await this.getUserReturns(userId, permissions, filters);
            case 'refunds':
                return await this.getUserRefunds(userId, permissions, filters);
            case 'inventory':
                return await this.getUserInventory(userId, permissions, filters);
            case 'customers':
                return await this.getUserCustomers(userId, permissions, filters);
            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }
    }

    /**
     * Get user-specific orders
     */
    async getUserOrders(userId, permissions, filters) {
        // In real implementation, query database with user filters
        const mockOrders = [
            {
                id: '1',
                orderNumber: 'ORD-2024-001',
                customerName: 'Rahul Sharma',
                status: 'pending',
                totalAmount: 2500,
                assignedTo: userId, // User-specific assignment
                createdAt: new Date()
            },
            {
                id: '2',
                orderNumber: 'ORD-2024-002',
                customerName: 'Priya Patel',
                status: 'confirmed',
                totalAmount: 1800,
                assignedTo: userId,
                createdAt: new Date()
            }
        ];

        return mockOrders.filter(order => {
            // Filter by assigned user
            if (order.assignedTo !== userId) return false;
            
            // Apply additional filters
            if (filters.status && order.status !== filters.status) return false;
            if (filters.search && !order.orderNumber.toLowerCase().includes(filters.search.toLowerCase())) return false;
            
            return true;
        });
    }

    /**
     * Get user-specific shipments
     */
    async getUserShipments(userId, permissions, filters) {
        const mockShipments = [
            {
                id: '1',
                orderNumber: 'ORD-2024-001',
                courierName: 'Delhivery',
                awbNumber: 'DL-123456789',
                status: 'in_transit',
                assignedTo: userId,
                shippedAt: new Date()
            }
        ];

        return mockShipments.filter(shipment => shipment.assignedTo === userId);
    }

    /**
     * Get user-specific returns
     */
    async getUserReturns(userId, permissions, filters) {
        const mockReturns = [
            {
                id: '1',
                orderNumber: 'ORD-2024-003',
                customerName: 'Amit Kumar',
                status: 'approved',
                assignedTo: userId,
                requestedAt: new Date()
            }
        ];

        return mockReturns.filter((ret) => ret.assignedTo === userId);
    }

    /**
     * Get user-specific refunds
     */
    async getUserRefunds(userId, permissions, filters) {
        const mockRefunds = [
            {
                id: '1',
                orderNumber: 'ORD-2024-003',
                status: 'processed',
                amount: 3200,
                assignedTo: userId,
                processedAt: new Date()
            }
        ];

        return mockRefunds.filter(refund => refund.assignedTo === userId);
    }

    /**
     * Get user-specific inventory
     */
    async getUserInventory(userId, permissions, filters) {
        // Only show inventory based on user permissions
        if (!permissions.includes('inventory_view')) {
            return [];
        }

        const mockInventory = [
            {
                id: '1',
                productName: 'Gold Necklace',
                sku: 'GN-001',
                currentStock: 15,
                threshold: 5,
                assignedTo: userId
            }
        ];

        return mockInventory.filter(item => item.assignedTo === userId);
    }

    /**
     * Get user-specific customers
     */
    async getUserCustomers(userId, permissions, filters) {
        const mockCustomers = [
            {
                id: '1',
                name: 'Rahul Sharma',
                email: 'rahul@example.com',
                phone: '+91-9876543210',
                assignedTo: userId
            }
        ];

        return mockCustomers.filter(customer => customer.assignedTo === userId);
    }

    /**
     * Send user-specific notification
     */
    async sendUserNotification(userId, notificationType, data, priority = 'medium') {
        const userSession = this.userSessions.get(userId);
        
        if (!userSession) {
            console.log(`User ${userId} not online, queuing notification`);
            return false;
        }

        const notification = {
            type: notificationType,
            title: this.getNotificationTitle(notificationType),
            message: this.getNotificationMessage(notificationType, data),
            data,
            priority,
            userId,
            timestamp: new Date().toISOString(),
            category: this.getNotificationCategory(notificationType)
        };

        // Send via WebSocket
        const sent = this.webSocketServer.sendNotificationToUser(userId, notification);

        // Also send email/SMS if high priority
        if (priority === 'high' && userSession.email) {
            await this.notificationService.sendShippingNotification(notificationType, {
                ...data,
                customerEmail: userSession.email,
                customerPhone: userSession.phone
            });
        }

        return sent;
    }

    /**
     * Broadcast management notifications to relevant users
     */
    async sendManagementNotification(eventType, eventData, targetRole = null) {
        const normalizedEventData =
            eventData && typeof eventData === 'object' ? eventData : {};
        const normalizedEventType =
            eventType ?? normalizedEventData.type ?? 'system_alert';

        // Find relevant users based on role or assignment (event type may live on eventType only)
        const targetUsers = this.getRelevantUsers(
            { ...normalizedEventData, type: normalizedEventType },
            targetRole
        );

        let sentCount = 0;
        for (const userId of targetUsers) {
            if (
                await this.sendUserNotification(
                    userId,
                    normalizedEventType,
                    normalizedEventData
                )
            ) {
                sentCount++;
            }
        }

        console.log(`Management notification sent to ${sentCount} users`);
        return sentCount;
    }

    /**
     * Get relevant users for notification
     */
    getRelevantUsers(eventData, targetRole) {
        const relevantUsers = new Set();
        const normalizedEventData =
            eventData && typeof eventData === 'object' ? eventData : {};

        for (const [userId, session] of this.userSessions.entries()) {
            // Check if user is assigned to the specific item
            if (normalizedEventData.assignedTo === userId) {
                relevantUsers.add(userId);
                continue;
            }

            // Check role-based notifications
            if (targetRole && session.role === targetRole) {
                relevantUsers.add(userId);
                continue;
            }

            // Check permissions
            const permissions = this.userPermissions.get(userId) || [];
            
            switch (normalizedEventData.type) {
                case 'order_created':
                case 'order_updated':
                    if (permissions.includes('order_manage')) {
                        relevantUsers.add(userId);
                    }
                    break;
                case 'low_stock':
                case 'inventory_updated':
                    if (permissions.includes('inventory_manage')) {
                        relevantUsers.add(userId);
                    }
                    break;
                case 'customer_query':
                case 'customer_created':
                    if (permissions.includes('customer_manage')) {
                        relevantUsers.add(userId);
                    }
                    break;
                case 'shipment_created':
                case 'delivery_exception':
                    if (permissions.includes('shipping_manage')) {
                        relevantUsers.add(userId);
                    }
                    break;
                case 'return_request':
                case 'refund_processed':
                    if (permissions.includes('return_manage')) {
                        relevantUsers.add(userId);
                    }
                    break;
            }
        }

        return [...relevantUsers];
    }

    /**
     * Get notification title
     */
    getNotificationTitle(type) {
        const titles = {
            // Order notifications
            order_created: 'New Order Created',
            order_updated: 'Order Updated',
            order_cancelled: 'Order Cancelled',
            order_confirmed: 'Order Confirmed',
            
            // Shipment notifications
            shipment_assigned: 'Shipment Assigned',
            pickup_scheduled: 'Pickup Scheduled',
            in_transit: 'Shipment In Transit',
            delivered: 'Order Delivered',
            delivery_exception: 'Delivery Exception',
            
            // Return/Refund notifications
            return_request: 'Return Request',
            return_approved: 'Return Approved',
            return_rejected: 'Return Rejected',
            refund_processed: 'Refund Processed',
            
            // Inventory notifications
            low_stock: 'Low Stock Alert',
            out_of_stock: 'Out of Stock',
            inventory_updated: 'Inventory Updated',
            
            // Customer notifications
            customer_query: 'Customer Query',
            customer_created: 'New Customer',
            customer_updated: 'Customer Updated',
            
            // System notifications
            system_alert: 'System Alert',
            maintenance: 'Maintenance Notice'
        };

        return titles[type] || 'Notification';
    }

    /**
     * Get notification message
     */
    getNotificationMessage(type, data) {
        const messages = {
            order_created: `New order ${data.orderNumber} from ${data.customerName} - INR ${data.totalAmount}`,
            order_updated: `Order ${data.orderNumber} updated - Status: ${data.status}`,
            order_cancelled: `Order ${data.orderNumber} cancelled by ${data.customerName}`,
            order_confirmed: `Order ${data.orderNumber} confirmed - Processing started`,
            
            shipment_assigned: `Shipment assigned for order ${data.orderNumber} - ${data.courierName}`,
            pickup_scheduled: `Pickup scheduled for order ${data.orderNumber} on ${data.pickupDate}`,
            in_transit: `Order ${data.orderNumber} is in transit via ${data.courierName}`,
            delivered: `Order ${data.orderNumber} delivered successfully`,
            delivery_exception: `Delivery exception for order ${data.orderNumber}: ${data.exceptionType}`,
            
            return_request: `Return request for order ${data.orderNumber}: ${data.reason}`,
            return_approved: `Return approved for order ${data.orderNumber}`,
            return_rejected: `Return rejected for order ${data.orderNumber}`,
            refund_processed: `Refund of INR ${data.amount} processed for order ${data.orderNumber}`,
            
            low_stock: `Low stock alert: ${data.productName} (${data.sku}) - Only ${data.currentStock} left`,
            out_of_stock: `Out of stock: ${data.productName} (${data.sku})`,
            inventory_updated: `Inventory updated: ${data.productName} - New stock: ${data.newStock}`,
            
            customer_query: `New customer query from ${data.customerName}: ${data.subject}`,
            customer_created: `New customer registered: ${data.customerName}`,
            customer_updated: `Customer profile updated: ${data.customerName}`,
            
            system_alert: data.message || 'System notification',
            maintenance: `Scheduled maintenance: ${data.scheduledTime}`
        };

        return messages[type] || 'New notification';
    }

    /**
     * Get management notification title
     */
    getManagementNotificationTitle(type) {
        return this.getNotificationTitle(type);
    }

    /**
     * Get management notification message
     */
    getManagementNotificationMessage(type, data) {
        return this.getNotificationMessage(type, data);
    }

    /**
     * Get notification category
     */
    getNotificationCategory(type) {
        const categories = {
            order_created: 'orders',
            order_updated: 'orders',
            order_cancelled: 'orders',
            order_confirmed: 'orders',
            
            shipment_assigned: 'shipping',
            pickup_scheduled: 'shipping',
            in_transit: 'shipping',
            delivered: 'shipping',
            delivery_exception: 'shipping',
            
            return_request: 'returns',
            return_approved: 'returns',
            return_rejected: 'returns',
            refund_processed: 'returns',
            
            low_stock: 'inventory',
            out_of_stock: 'inventory',
            inventory_updated: 'inventory',
            
            customer_query: 'customers',
            customer_created: 'customers',
            customer_updated: 'customers',
            
            system_alert: 'system',
            maintenance: 'system'
        };

        return categories[type] || 'general';
    }

    /**
     * Handle user logout
     */
    handleUserLogout(userId) {
        this.userSessions.delete(userId);
        this.userPermissions.delete(userId);
        console.log(`User session removed: ${userId}`);
    }

    /**
     * Get user session info
     */
    getUserSession(userId) {
        return this.userSessions.get(userId);
    }

    /**
     * Update user activity
     */
    updateUserActivity(userId) {
        const session = this.userSessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    /**
     * Get active users count
     */
    getActiveUsersCount() {
        return this.userSessions.size;
    }

    /**
     * Get all active users
     */
    getActiveUsers() {
        const users = [];
        for (const [userId, session] of this.userSessions.entries()) {
            users.push({
                userId,
                name: session.name,
                email: session.email,
                role: session.role,
                loginTime: session.loginTime,
                lastActivity: session.lastActivity,
                permissions: this.userPermissions.get(userId) || []
            });
        }
        return users;
    }
}

module.exports = new UserNotificationManager();
