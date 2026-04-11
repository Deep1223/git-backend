const express = require('express');
const router = express.Router();
const userNotificationManager = require('../../lib/userNotificationManager');
const EcomOrder = require('../../modal/ecomOrder');
const EcomShipment = require('../../modal/ecomShipment');
const EcomReturnRefund = require('../../modal/ecomReturnRefund');
const ProductMaster = require('../../modal/productmaster');

// Middleware to verify user authentication
const authenticateUser = (req, res, next) => {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    req.userId = userId;
    next();
};

// Get user-specific orders
router.get('/:userId/orders', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { status, search, page = 1, limit = 10 } = req.query;

        // Build filter for user-specific orders
        let filter = {};
        
        // In real implementation, filter by assigned user or permissions
        // For now, we'll use mock data
        const mockOrders = [
            {
                id: '1',
                orderNumber: 'ORD-2024-001',
                customerName: 'Rahul Sharma',
                customerEmail: 'rahul@example.com',
                phone: '+91-9876543210',
                status: 'pending',
                totalAmount: 2500,
                paymentStatus: 'paid',
                paymentMethod: 'credit_card',
                shippingAddress: {
                    name: 'Rahul Sharma',
                    address: '123 Main St',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    pincode: '400001',
                    phone: '+91-9876543210'
                },
                items: [
                    {
                        productId: 'prod1',
                        productName: 'Gold Necklace',
                        quantity: 1,
                        price: 2500
                    }
                ],
                assignedTo: userId,
                createdAt: new Date('2024-01-15T10:30:00Z'),
                updatedAt: new Date('2024-01-15T10:30:00Z')
            },
            {
                id: '2',
                orderNumber: 'ORD-2024-002',
                customerName: 'Priya Patel',
                customerEmail: 'priya@example.com',
                phone: '+91-9876543211',
                status: 'confirmed',
                totalAmount: 1800,
                paymentStatus: 'paid',
                paymentMethod: 'upi',
                shippingAddress: {
                    name: 'Priya Patel',
                    address: '456 Park Ave',
                    city: 'Delhi',
                    state: 'Delhi',
                    pincode: '110001',
                    phone: '+91-9876543211'
                },
                items: [
                    {
                        productId: 'prod2',
                        productName: 'Silver Earrings',
                        quantity: 1,
                        price: 1800
                    }
                ],
                assignedTo: userId,
                createdAt: new Date('2024-01-14T15:45:00Z'),
                updatedAt: new Date('2024-01-14T15:45:00Z')
            }
        ];

        // Apply filters
        let filteredOrders = mockOrders;
        
        if (status) {
            filteredOrders = filteredOrders.filter(order => order.status === status);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredOrders = filteredOrders.filter(order => 
                order.orderNumber.toLowerCase().includes(searchLower) ||
                order.customerName.toLowerCase().includes(searchLower) ||
                order.customerEmail.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedOrders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredOrders.length,
                pages: Math.ceil(filteredOrders.length / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
});

// Get user-specific shipments
router.get('/:userId/shipments', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { status, search, page = 1, limit = 10 } = req.query;

        const mockShipments = [
            {
                id: '1',
                orderId: '1',
                orderNumber: 'ORD-2024-001',
                courierName: 'Delhivery',
                courierCode: 'DL',
                serviceLevel: 'standard',
                awbNumber: 'DL-123456789',
                trackingUrl: 'https://delhivery.com/track/DL-123456789',
                shippingLabelUrl: 'https://delhivery.com/label/DL-123456789',
                status: 'in_transit',
                assignmentStatus: 'assigned',
                pickupStatus: 'completed',
                exceptionStatus: 'none',
                weight: 500,
                dimensions: '10x5x2 cm',
                assignedTo: userId,
                shippedAt: new Date('2024-01-15T10:00:00Z'),
                estimatedDelivery: new Date('2024-01-17T18:00:00Z'),
                currentLocation: 'Mumbai Hub',
                events: [
                    {
                        type: 'assigned',
                        label: 'Shipment Assigned',
                        note: 'Assigned to Delhivery',
                        timestamp: new Date('2024-01-15T09:30:00Z')
                    },
                    {
                        type: 'picked_up',
                        label: 'Package Picked Up',
                        note: 'Package picked up from warehouse',
                        timestamp: new Date('2024-01-15T10:00:00Z')
                    }
                ]
            },
            {
                id: '2',
                orderId: '2',
                orderNumber: 'ORD-2024-002',
                courierName: 'Blue Dart',
                courierCode: 'BD',
                serviceLevel: 'express',
                awbNumber: 'BD-987654321',
                trackingUrl: 'https://bluedart.com/track/BD-987654321',
                status: 'assigned',
                assignmentStatus: 'assigned',
                pickupStatus: 'scheduled',
                exceptionStatus: 'none',
                weight: 300,
                dimensions: '8x4x2 cm',
                assignedTo: userId,
                pickupScheduledAt: new Date('2024-01-16T14:00:00Z'),
                events: [
                    {
                        type: 'assigned',
                        label: 'Shipment Assigned',
                        note: 'Assigned to Blue Dart',
                        timestamp: new Date('2024-01-15T16:00:00Z')
                    }
                ]
            }
        ];

        // Apply filters
        let filteredShipments = mockShipments;
        
        if (status) {
            filteredShipments = filteredShipments.filter(shipment => shipment.status === status);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredShipments = filteredShipments.filter(shipment => 
                shipment.orderNumber.toLowerCase().includes(searchLower) ||
                shipment.courierName.toLowerCase().includes(searchLower) ||
                shipment.awbNumber.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedShipments = filteredShipments.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedShipments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredShipments.length,
                pages: Math.ceil(filteredShipments.length / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching user shipments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shipments' });
    }
});

// Get user-specific returns
router.get('/:userId/returns', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { status, search, page = 1, limit = 10 } = req.query;

        const mockReturns = [
            {
                id: '1',
                orderId: '3',
                orderNumber: 'ORD-2024-003',
                customerName: 'Amit Kumar',
                customerEmail: 'amit@example.com',
                phone: '+91-9876543212',
                status: 'approved',
                reason: 'Product not as described',
                customerNote: 'The color is different from what was shown in the pictures',
                totalAmount: 3200,
                requestedAt: new Date('2024-01-13T11:20:00Z'),
                approvedAt: new Date('2024-01-14T15:30:00Z'),
                approvedBy: userId,
                requestProofUrls: ['https://example.com/proof1.jpg', 'https://example.com/proof2.jpg'],
                assignedTo: userId,
                items: [
                    {
                        productId: 'prod3',
                        productName: 'Diamond Ring',
                        quantity: 1,
                        price: 3200
                    }
                ]
            },
            {
                id: '2',
                orderId: '4',
                orderNumber: 'ORD-2024-004',
                customerName: 'Neha Singh',
                customerEmail: 'neha@example.com',
                phone: '+91-9876543213',
                status: 'requested',
                reason: 'Size issue',
                customerNote: 'Ring size is too small',
                totalAmount: 1500,
                requestedAt: new Date('2024-01-15T09:15:00Z'),
                requestProofUrls: ['https://example.com/proof3.jpg'],
                assignedTo: userId,
                items: [
                    {
                        productId: 'prod4',
                        productName: 'Gold Ring',
                        quantity: 1,
                        price: 1500
                    }
                ]
            }
        ];

        // Apply filters
        let filteredReturns = mockReturns;
        
        if (status) {
            filteredReturns = filteredReturns.filter(returnItem => returnItem.status === status);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredReturns = filteredReturns.filter(returnItem => 
                returnItem.orderNumber.toLowerCase().includes(searchLower) ||
                returnItem.customerName.toLowerCase().includes(searchLower) ||
                returnItem.reason.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedReturns = filteredReturns.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedReturns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredReturns.length,
                pages: Math.ceil(filteredReturns.length / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching user returns:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch returns' });
    }
});

// Get user-specific refunds
router.get('/:userId/refunds', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { status, search, page = 1, limit = 10 } = req.query;

        const mockRefunds = [
            {
                id: '1',
                returnId: '1',
                orderId: '3',
                orderNumber: 'ORD-2024-003',
                customerName: 'Amit Kumar',
                status: 'processed',
                amount: 3200,
                method: 'Original Payment',
                reference: 'REF-2024-001',
                processedAt: new Date('2024-01-15T14:30:00Z'),
                proofUrls: ['https://example.com/refund-proof1.png'],
                assignedTo: userId
            },
            {
                id: '2',
                returnId: '2',
                orderId: '4',
                orderNumber: 'ORD-2024-004',
                customerName: 'Neha Singh',
                status: 'pending',
                amount: 1500,
                method: 'Bank Transfer',
                reference: '',
                assignedTo: userId
            }
        ];

        // Apply filters
        let filteredRefunds = mockRefunds;
        
        if (status) {
            filteredRefunds = filteredRefunds.filter(refund => refund.status === status);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredRefunds = filteredRefunds.filter(refund => 
                refund.orderNumber.toLowerCase().includes(searchLower) ||
                refund.customerName.toLowerCase().includes(searchLower) ||
                refund.reference.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedRefunds = filteredRefunds.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedRefunds,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredRefunds.length,
                pages: Math.ceil(filteredRefunds.length / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching user refunds:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch refunds' });
    }
});

// Get user-specific inventory
router.get('/:userId/inventory', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { lowStock, search, page = 1, limit = 10 } = req.query;

        const mockInventory = [
            {
                id: '1',
                productId: 'prod1',
                productName: 'Gold Necklace',
                sku: 'GN-001',
                currentStock: 15,
                threshold: 5,
                lowStock: false,
                category: 'Necklaces',
                price: 2500,
                assignedTo: userId,
                lastUpdated: new Date('2024-01-15T10:00:00Z')
            },
            {
                id: '2',
                productId: 'prod2',
                productName: 'Silver Earrings',
                sku: 'SE-002',
                currentStock: 3,
                threshold: 5,
                lowStock: true,
                category: 'Earrings',
                price: 1800,
                assignedTo: userId,
                lastUpdated: new Date('2024-01-15T11:00:00Z')
            },
            {
                id: '3',
                productId: 'prod3',
                productName: 'Diamond Ring',
                sku: 'DR-003',
                currentStock: 8,
                threshold: 3,
                lowStock: false,
                category: 'Rings',
                price: 3200,
                assignedTo: userId,
                lastUpdated: new Date('2024-01-15T12:00:00Z')
            }
        ];

        // Apply filters
        let filteredInventory = mockInventory;
        
        if (lowStock === 'true') {
            filteredInventory = filteredInventory.filter(item => item.lowStock);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredInventory = filteredInventory.filter(item => 
                item.productName.toLowerCase().includes(searchLower) ||
                item.sku.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedInventory = filteredInventory.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedInventory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredInventory.length,
                pages: Math.ceil(filteredInventory.length / limit)
            },
            summary: {
                totalItems: mockInventory.length,
                lowStockItems: mockInventory.filter(item => item.lowStock).length,
                totalValue: mockInventory.reduce((sum, item) => sum + (item.currentStock * item.price), 0)
            }
        });

    } catch (error) {
        console.error('Error fetching user inventory:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch inventory' });
    }
});

// Get user-specific customers
router.get('/:userId/customers', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;
        const { search, page = 1, limit = 10 } = req.query;

        const mockCustomers = [
            {
                id: '1',
                name: 'Rahul Sharma',
                email: 'rahul@example.com',
                phone: '+91-9876543210',
                totalOrders: 5,
                totalSpent: 12500,
                lastOrderDate: new Date('2024-01-15T10:30:00Z'),
                status: 'active',
                assignedTo: userId,
                addresses: [
                    {
                        type: 'shipping',
                        name: 'Rahul Sharma',
                        address: '123 Main St',
                        city: 'Mumbai',
                        state: 'Maharashtra',
                        pincode: '400001',
                        phone: '+91-9876543210'
                    }
                ]
            },
            {
                id: '2',
                name: 'Priya Patel',
                email: 'priya@example.com',
                phone: '+91-9876543211',
                totalOrders: 3,
                totalSpent: 5400,
                lastOrderDate: new Date('2024-01-14T15:45:00Z'),
                status: 'active',
                assignedTo: userId,
                addresses: [
                    {
                        type: 'shipping',
                        name: 'Priya Patel',
                        address: '456 Park Ave',
                        city: 'Delhi',
                        state: 'Delhi',
                        pincode: '110001',
                        phone: '+91-9876543211'
                    }
                ]
            },
            {
                id: '3',
                name: 'Amit Kumar',
                email: 'amit@example.com',
                phone: '+91-9876543212',
                totalOrders: 2,
                totalSpent: 4700,
                lastOrderDate: new Date('2024-01-13T11:20:00Z'),
                status: 'active',
                assignedTo: userId,
                addresses: [
                    {
                        type: 'shipping',
                        name: 'Amit Kumar',
                        address: '789 Garden Rd',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        pincode: '560001',
                        phone: '+91-9876543212'
                    }
                ]
            }
        ];

        // Apply filters
        let filteredCustomers = mockCustomers;
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredCustomers = filteredCustomers.filter(customer => 
                customer.name.toLowerCase().includes(searchLower) ||
                customer.email.toLowerCase().includes(searchLower) ||
                customer.phone.includes(search)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedCustomers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredCustomers.length,
                pages: Math.ceil(filteredCustomers.length / limit)
            },
            summary: {
                totalCustomers: mockCustomers.length,
                activeCustomers: mockCustomers.filter(c => c.status === 'active').length,
                totalRevenue: mockCustomers.reduce((sum, c) => sum + c.totalSpent, 0)
            }
        });

    } catch (error) {
        console.error('Error fetching user customers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
});

// Get user dashboard statistics
router.get('/:userId/stats', authenticateUser, async (req, res) => {
    try {
        const { userId } = req;

        // In real implementation, calculate from actual database
        const mockStats = {
            orders: {
                total: 25,
                pending: 5,
                confirmed: 8,
                processing: 7,
                shipped: 4,
                delivered: 1,
                cancelled: 0,
                totalValue: 62500
            },
            shipments: {
                total: 12,
                assigned: 3,
                inTransit: 6,
                delivered: 3,
                exceptions: 0
            },
            returns: {
                total: 4,
                requested: 1,
                approved: 2,
                rejected: 0,
                received: 1,
                refunded: 0
            },
            refunds: {
                total: 2,
                pending: 1,
                processed: 1,
                totalAmount: 4700
            },
            inventory: {
                totalItems: 45,
                lowStock: 3,
                outOfStock: 0,
                totalValue: 125000
            },
            customers: {
                total: 18,
                active: 16,
                newThisMonth: 3
            }
        };

        res.status(200).json({
            success: true,
            data: mockStats
        });

    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

module.exports = router;
