const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

/**
 * WebSocket Server for Real-time Notifications
 * Handles real-time shipping notifications, updates, and alerts
 */

class WebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // userId -> WebSocket connection
        this.rooms = new Map(); // room -> Set of client IDs
        this.notificationQueue = new Map(); // userId -> queued notifications
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        try {
            this.wss = new WebSocket.Server({ 
                server,
                path: '/ws'
            });

            this.wss.on('connection', (ws, request) => {
                this.handleConnection(ws, request);
            });

            this.wss.on('error', (error) => {
                console.error('WebSocket server error:', error);
            });

            console.log('WebSocket server initialized');
            return true;

        } catch (error) {
            console.error('Failed to initialize WebSocket server:', error);
            return false;
        }
    }

    /**
     * Handle new WebSocket connection
     */
    async handleConnection(ws, request) {
        let userId = null;
        let isAuthenticated = false;

        try {
            // Extract token from query parameters or headers
            const token = this.extractToken(request);
            
            if (token) {
                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                userId = decoded.id || decoded.userId;
                isAuthenticated = true;
            }

            // Set up connection handlers
            ws.on('message', (data) => {
                this.handleMessage(ws, data, userId, isAuthenticated);
            });

            ws.on('close', () => {
                this.handleDisconnection(ws, userId);
            });

            ws.on('error', (error) => {
                console.error('WebSocket client error:', error);
                this.handleDisconnection(ws, userId);
            });

            // Store client connection
            if (isAuthenticated && userId) {
                this.clients.set(userId, ws);
                ws.userId = userId;
                ws.isAuthenticated = true;

                // Send queued notifications
                this.sendQueuedNotifications(userId);

                // Send welcome message
                this.sendToClient(userId, {
                    type: 'connection',
                    status: 'connected',
                    timestamp: new Date().toISOString(),
                    message: 'Connected to notification service'
                });

                console.log(`Client connected: ${userId}`);
            } else {
                // Anonymous connection - limited functionality
                ws.isAuthenticated = false;
                this.sendToClient(ws, {
                    type: 'connection',
                    status: 'anonymous',
                    timestamp: new Date().toISOString(),
                    message: 'Connected with limited access'
                });
            }

        } catch (error) {
            console.error('Connection handling error:', error);
            ws.close();
        }
    }

    /**
     * Extract JWT token from request
     */
    extractToken(request) {
        // Try query parameters first
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');
        
        if (token) return token;

        // Try headers
        const authHeader = request.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Handle incoming messages from clients
     */
    handleMessage(ws, data, userId, isAuthenticated) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(ws, message, userId, isAuthenticated);
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(ws, message, userId, isAuthenticated);
                    break;

                case 'ping':
                    this.handlePing(ws, userId);
                    break;

                case 'mark_read':
                    this.handleMarkRead(ws, message, userId, isAuthenticated);
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }

        } catch (error) {
            console.error('Message handling error:', error);
            this.sendToClient(userId || ws, {
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle subscription to notification channels
     */
    handleSubscribe(ws, message, userId, isAuthenticated) {
        if (!isAuthenticated) {
            this.sendToClient(ws, {
                type: 'error',
                message: 'Authentication required for subscriptions',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const { channel, filters = {} } = message;

        // Add client to room
        if (!this.rooms.has(channel)) {
            this.rooms.set(channel, new Set());
        }
        this.rooms.get(channel).add(userId);

        // Store subscription info
        if (!ws.subscriptions) {
            ws.subscriptions = new Set();
        }
        ws.subscriptions.add(channel);

        this.sendToClient(userId, {
            type: 'subscribed',
            channel,
            timestamp: new Date().toISOString(),
            message: `Subscribed to ${channel}`
        });

        console.log(`Client ${userId} subscribed to ${channel}`);
    }

    /**
     * Handle unsubscription from channels
     */
    handleUnsubscribe(ws, message, userId, isAuthenticated) {
        if (!isAuthenticated) return;

        const { channel } = message;

        // Remove client from room
        if (this.rooms.has(channel)) {
            this.rooms.get(channel).delete(userId);
        }

        // Remove subscription info
        if (ws.subscriptions) {
            ws.subscriptions.delete(channel);
        }

        this.sendToClient(userId, {
            type: 'unsubscribed',
            channel,
            timestamp: new Date().toISOString(),
            message: `Unsubscribed from ${channel}`
        });
    }

    /**
     * Handle ping for connection health check
     */
    handlePing(ws, userId) {
        this.sendToClient(userId || ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle mark as read request
     */
    async handleMarkRead(ws, message, userId, isAuthenticated) {
        if (!isAuthenticated) return;

        const { notificationId } = message;

        try {
            // In real implementation, update database
            console.log(`Marking notification ${notificationId} as read for user ${userId}`);

            this.sendToClient(userId, {
                type: 'notification_read',
                notificationId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Mark as read error:', error);
        }
    }

    /**
     * Handle client disconnection
     */
    handleDisconnection(ws, userId) {
        if (userId && this.clients.has(userId)) {
            this.clients.delete(userId);

            // Remove from all rooms
            for (const [channel, clients] of this.rooms.entries()) {
                clients.delete(userId);
            }

            console.log(`Client disconnected: ${userId}`);
        }
    }

    /**
     * Send message to specific client
     */
    sendToClient(clientIdOrWs, message) {
        try {
            const ws = typeof clientIdOrWs === 'string' 
                ? this.clients.get(clientIdOrWs)
                : clientIdOrWs;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                return true;
            }
            return false;

        } catch (error) {
            console.error('Send to client error:', error);
            return false;
        }
    }

    /**
     * Send notification to specific user
     */
    sendNotificationToUser(userId, notification) {
        const ws = this.clients.get(userId);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            return this.sendToClient(userId, {
                type: 'notification',
                notification: {
                    ...notification,
                    id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: notification.timestamp || new Date().toISOString()
                }
            });
        } else {
            // Queue notification for when user comes online
            this.queueNotification(userId, notification);
            return false;
        }
    }

    /**
     * Broadcast notification to room/channel
     */
    broadcastToRoom(room, notification, excludeUserId = null) {
        const clients = this.rooms.get(room);
        
        if (!clients) return 0;

        let sentCount = 0;
        const message = {
            type: 'notification',
            notification: {
                ...notification,
                id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: notification.timestamp || new Date().toISOString()
            }
        };

        for (const userId of clients) {
            if (userId !== excludeUserId) {
                if (this.sendToClient(userId, message)) {
                    sentCount++;
                }
            }
        }

        return sentCount;
    }

    /**
     * Queue notification for offline user
     */
    queueNotification(userId, notification) {
        if (!this.notificationQueue.has(userId)) {
            this.notificationQueue.set(userId, []);
        }

        this.notificationQueue.get(userId).push({
            ...notification,
            id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: notification.timestamp || new Date().toISOString()
        });

        // Limit queue size
        const queue = this.notificationQueue.get(userId);
        if (queue.length > 50) {
            queue.shift(); // Remove oldest notification
        }
    }

    /**
     * Send queued notifications to user
     */
    sendQueuedNotifications(userId) {
        const queue = this.notificationQueue.get(userId);
        
        if (queue && queue.length > 0) {
            queue.forEach(notification => {
                this.sendToClient(userId, {
                    type: 'notification',
                    notification
                });
            });

            // Clear queue
            this.notificationQueue.delete(userId);
            console.log(`Sent ${queue.length} queued notifications to ${userId}`);
        }
    }

    /**
     * Get server statistics
     */
    getStats() {
        return {
            connectedClients: this.clients.size,
            rooms: Array.from(this.rooms.entries()).map(([room, clients]) => ({
                room,
                clients: clients.size
            })),
            queuedNotifications: Array.from(this.notificationQueue.entries()).map(([userId, queue]) => ({
                userId,
                count: queue.length
            }))
        };
    }

    /**
     * Send shipping notification
     */
    sendShippingNotification(type, data, targetUserId = null) {
        const notification = {
            type,
            title: this.getNotificationTitle(type),
            message: this.getNotificationMessage(type, data),
            data,
            priority: this.getNotificationPriority(type),
            category: 'shipping'
        };

        if (targetUserId) {
            return this.sendNotificationToUser(targetUserId, notification);
        } else {
            // Broadcast to all shipping notification subscribers
            return this.broadcastToRoom('shipping_notifications', notification);
        }
    }

    /**
     * Get notification title by type
     */
    getNotificationTitle(type) {
        const titles = {
            shipment_assigned: 'Shipment Assigned',
            pickup_scheduled: 'Pickup Scheduled',
            delivery_exception: 'Delivery Exception',
            return_approved: 'Return Approved',
            return_rejected: 'Return Rejected',
            refund_processed: 'Refund Processed',
            system_alert: 'System Alert'
        };

        return titles[type] || 'Notification';
    }

    /**
     * Get notification message by type
     */
    getNotificationMessage(type, data) {
        const messages = {
            shipment_assigned: `Order ${data.orderNumber} has been assigned to ${data.courierName}`,
            pickup_scheduled: `Pickup scheduled for order ${data.orderNumber} on ${data.pickupDate}`,
            delivery_exception: `Delivery exception for order ${data.orderNumber}: ${data.exceptionType}`,
            return_approved: `Return request approved for order ${data.orderNumber}`,
            return_rejected: `Return request rejected for order ${data.orderNumber}`,
            refund_processed: `Refund of INR ${data.amount} processed for order ${data.orderNumber}`,
            system_alert: data.message || 'System notification'
        };

        return messages[type] || 'New notification';
    }

    /**
     * Get notification priority by type
     */
    getNotificationPriority(type) {
        const priorities = {
            delivery_exception: 'high',
            system_alert: 'high',
            shipment_assigned: 'medium',
            pickup_scheduled: 'medium',
            return_approved: 'medium',
            return_rejected: 'medium',
            refund_processed: 'low'
        };

        return priorities[type] || 'medium';
    }

    /**
     * Health check
     */
    healthCheck() {
        return {
            status: 'healthy',
            connectedClients: this.clients.size,
            activeRooms: this.rooms.size,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new WebSocketServer();
