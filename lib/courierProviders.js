function providerName() {
    return String(process.env.COURIER_PROVIDER || 'manual').trim().toLowerCase();
}

// Courier service level configurations
const COURIER_SERVICE_LEVELS = {
    standard: { priority: 1, estimatedDays: 3-5, costMultiplier: 1.0 },
    express: { priority: 2, estimatedDays: 1-2, costMultiplier: 1.5 },
    overnight: { priority: 3, estimatedDays: 1, costMultiplier: 2.0 },
    economy: { priority: 0, estimatedDays: 5-7, costMultiplier: 0.8 }
};

// Courier assignment rules
const ASSIGNMENT_RULES = {
    weight: {
        light: { max: 500, preferred: ['dhl', 'fedex', 'blue_dart'] },
        medium: { max: 2000, preferred: ['dhl', 'fedex', 'delhivery'] },
        heavy: { max: 10000, preferred: ['delhivery', 'xpressbees', 'ekart'] },
        extra_heavy: { max: Infinity, preferred: ['xpressbees', 'ekart'] }
    },
    location: {
        metro: ['dhl', 'fedex', 'blue_dart', 'delhivery'],
        tier2: ['delhivery', 'xpressbees', 'ekart'],
        tier3: ['xpressbees', 'ekart', 'india_post'],
        remote: ['india_post', 'xpressbees']
    },
    urgency: {
        low: ['economy', 'standard'],
        normal: ['standard'],
        high: ['express'],
        critical: ['overnight']
    }
};

// Manual courier functions
async function manualGenerateAwb({ order, shipment }) {
    const awb = shipment.awbNumber || `MANUAL-AWB-${String(order.orderNumber || order._id).slice(-8)}`;
    return {
        provider: 'manual',
        awbNumber: awb,
        trackingUrl: shipment.trackingUrl || `https://tracking.example.com/${encodeURIComponent(awb)}`,
        shippingLabelUrl: shipment.shippingLabelUrl || '',
        awbDocumentUrl: shipment.awbDocumentUrl || '',
        meta: { mode: 'manual' },
    };
}

async function manualSchedulePickup({ order, shipment }) {
    return {
        provider: 'manual',
        pickupReference: shipment.pickupReference || `PU-${String(order.orderNumber || order._id).slice(-8)}`,
        meta: { mode: 'manual' },
    };
}

// DHL integration
async function dhlGenerateAwb({ order, shipment }) {
    const awb = `DHL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
        provider: 'dhl',
        awbNumber: awb,
        trackingUrl: `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(awb)}`,
        shippingLabelUrl: `https://api.dhl.com/label/${awb}`,
        awbDocumentUrl: `https://api.dhl.com/awb/${awb}`,
        meta: { 
            serviceType: shipment.serviceLevel || 'standard',
            estimatedDelivery: calculateEstimatedDelivery(shipment.serviceLevel)
        },
    };
}

async function dhlSchedulePickup({ order, shipment }) {
    const pickupRef = `DHL-PU-${Date.now()}`;
    return {
        provider: 'dhl',
        pickupReference: pickupRef,
        pickupWindowStart: shipment.pickupWindowStart || new Date(),
        pickupWindowEnd: shipment.pickupWindowEnd || new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours window
        meta: { 
            driverContact: '+91-XXXXXXXXXX',
            vehicleType: getVehicleType(shipment.weight)
        },
    };
}

// FedEx integration
async function fedexGenerateAwb({ order, shipment }) {
    const awb = `FX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
        provider: 'fedex',
        awbNumber: awb,
        trackingUrl: `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(awb)}`,
        shippingLabelUrl: `https://api.fedex.com/label/${awb}`,
        awbDocumentUrl: `https://api.fedex.com/awb/${awb}`,
        meta: { 
            serviceType: shipment.serviceLevel || 'standard',
            estimatedDelivery: calculateEstimatedDelivery(shipment.serviceLevel)
        },
    };
}

async function fedexSchedulePickup({ order, shipment }) {
    const pickupRef = `FX-PU-${Date.now()}`;
    return {
        provider: 'fedex',
        pickupReference: pickupRef,
        pickupWindowStart: shipment.pickupWindowStart || new Date(),
        pickupWindowEnd: shipment.pickupWindowEnd || new Date(Date.now() + 4 * 60 * 60 * 1000),
        meta: { 
            driverContact: '+91-XXXXXXXXXX',
            vehicleType: getVehicleType(shipment.weight)
        },
    };
}

// Blue Dart integration
async function blueDartGenerateAwb({ order, shipment }) {
    const awb = `BD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
        provider: 'blue_dart',
        awbNumber: awb,
        trackingUrl: `https://www.bluedart.com/servlet/RoutingServlet?handler=tnt&action=courier&awb=${encodeURIComponent(awb)}`,
        shippingLabelUrl: `https://api.bluedart.com/label/${awb}`,
        awbDocumentUrl: `https://api.bluedart.com/awb/${awb}`,
        meta: { 
            serviceType: shipment.serviceLevel || 'standard',
            estimatedDelivery: calculateEstimatedDelivery(shipment.serviceLevel)
        },
    };
}

async function blueDartSchedulePickup({ order, shipment }) {
    const pickupRef = `BD-PU-${Date.now()}`;
    return {
        provider: 'blue_dart',
        pickupReference: pickupRef,
        pickupWindowStart: shipment.pickupWindowStart || new Date(),
        pickupWindowEnd: shipment.pickupWindowEnd || new Date(Date.now() + 4 * 60 * 60 * 1000),
        meta: { 
            driverContact: '+91-XXXXXXXXXX',
            vehicleType: getVehicleType(shipment.weight)
        },
    };
}

// Delhivery integration
async function delhiveryGenerateAwb({ order, shipment }) {
    const awb = `DL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
        provider: 'delhivery',
        awbNumber: awb,
        trackingUrl: `https://www.delhivery.com/track/${encodeURIComponent(awb)}`,
        shippingLabelUrl: `https://track.delhivery.com/label/${awb}`,
        awbDocumentUrl: `https://track.delhivery.com/awb/${awb}`,
        meta: { 
            serviceType: shipment.serviceLevel || 'standard',
            estimatedDelivery: calculateEstimatedDelivery(shipment.serviceLevel)
        },
    };
}

async function delhiverySchedulePickup({ order, shipment }) {
    const pickupRef = `DL-PU-${Date.now()}`;
    return {
        provider: 'delhivery',
        pickupReference: pickupRef,
        pickupWindowStart: shipment.pickupWindowStart || new Date(),
        pickupWindowEnd: shipment.pickupWindowEnd || new Date(Date.now() + 4 * 60 * 60 * 1000),
        meta: { 
            driverContact: '+91-XXXXXXXXXX',
            vehicleType: getVehicleType(shipment.weight)
        },
    };
}

// Helper functions
function calculateEstimatedDelivery(serviceLevel) {
    const level = COURIER_SERVICE_LEVELS[serviceLevel] || COURIER_SERVICE_LEVELS.standard;
    const days = level.estimatedDays;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    return deliveryDate;
}

function getVehicleType(weight) {
    if (weight <= 500) return 'bike';
    if (weight <= 2000) return 'van';
    if (weight <= 5000) return 'small_truck';
    return 'large_truck';
}

function getWeightCategory(weight) {
    if (weight <= 500) return 'light';
    if (weight <= 2000) return 'medium';
    if (weight <= 10000) return 'heavy';
    return 'extra_heavy';
}

function getLocationCategory(pincode) {
    // Simplified logic - in real implementation, use pincode database
    const metroPincodes = ['110001', '400001', '560001', '600001', '700001', '500001', '380001', '110002'];
    const tier2Pincodes = ['110003', '400002', '560002', '600002', '700002'];
    
    if (metroPincodes.includes(pincode)) return 'metro';
    if (tier2Pincodes.includes(pincode)) return 'tier2';
    return 'tier3';
}

// Intelligent courier assignment
function assignBestCourier(order, shipment, preferences = {}) {
    const weight = shipment.weight || 1000; // default 1kg
    const pincode = order.shippingAddress?.pincode || '';
    const urgency = preferences.urgency || 'normal';
    
    const weightCategory = getWeightCategory(weight);
    const locationCategory = getLocationCategory(pincode);
    
    // Get preferred couriers based on rules
    const weightCouriers = ASSIGNMENT_RULES.weight[weightCategory].preferred;
    const locationCouriers = ASSIGNMENT_RULES.location[locationCategory];
    const urgencyLevels = ASSIGNMENT_RULES.urgency[urgency];
    
    // Find intersection of preferences
    let candidates = weightCouriers.filter(c => locationCouriers.includes(c));
    
    if (candidates.length === 0) {
        candidates = locationCouriers; // fallback to location-based
    }
    
    if (candidates.length === 0) {
        candidates = ['delhivery']; // ultimate fallback
    }
    
    // Select based on service level priority
    const selectedCourier = candidates[0];
    const serviceLevel = urgencyLevels[0] || 'standard';
    
    return {
        courier: selectedCourier,
        serviceLevel,
        confidence: candidates.length >= 2 ? 'high' : 'medium',
        reasoning: `Weight: ${weightCategory}, Location: ${locationCategory}, Urgency: ${urgency}`
    };
}

// Main functions
async function generateAwb(ctx) {
    const name = providerName();
    const { order, shipment } = ctx;
    
    // Auto-assign courier if not specified
    if (!shipment.courierName || shipment.courierName === 'auto') {
        const assignment = assignBestCourier(order, shipment);
        shipment.courierName = assignment.courier;
        shipment.serviceLevel = assignment.serviceLevel;
    }
    
    switch (shipment.courierName) {
        case 'dhl':
            return await dhlGenerateAwb(ctx);
        case 'fedex':
            return await fedexGenerateAwb(ctx);
        case 'blue_dart':
            return await blueDartGenerateAwb(ctx);
        case 'delhivery':
            return await delhiveryGenerateAwb(ctx);
        case 'manual':
        default:
            return await manualGenerateAwb(ctx);
    }
}

async function schedulePickup(ctx) {
    const { order, shipment } = ctx;
    
    switch (shipment.courierName) {
        case 'dhl':
            return await dhlSchedulePickup(ctx);
        case 'fedex':
            return await fedexSchedulePickup(ctx);
        case 'blue_dart':
            return await blueDartSchedulePickup(ctx);
        case 'delhivery':
            return await delhiverySchedulePickup(ctx);
        case 'manual':
        default:
            return await manualSchedulePickup(ctx);
    }
}

// Additional utility functions
async function getAvailableCouriers(order, shipment) {
    const weight = shipment.weight || 1000;
    const pincode = order.shippingAddress?.pincode || '';
    
    const weightCategory = getWeightCategory(weight);
    const locationCategory = getLocationCategory(pincode);
    
    return {
        available: ASSIGNMENT_RULES.weight[weightCategory].preferred,
        recommended: ASSIGNMENT_RULES.location[locationCategory],
        serviceLevels: Object.keys(COURIER_SERVICE_LEVELS)
    };
}

async function calculateShippingCost(order, shipment, courier, serviceLevel) {
    const baseCost = 50; // Base cost in INR
    const weightCost = Math.ceil((shipment.weight || 1000) / 500) * 20; // Per 500g
    const distanceCost = 30; // Simplified distance calculation
    const serviceMultiplier = COURIER_SERVICE_LEVELS[serviceLevel]?.costMultiplier || 1.0;
    
    const totalCost = (baseCost + weightCost + distanceCost) * serviceMultiplier;
    
    return {
        baseCost,
        weightCost,
        distanceCost,
        serviceMultiplier,
        totalCost: Math.round(totalCost),
        currency: 'INR'
    };
}

module.exports = {
    providerName,
    generateAwb,
    schedulePickup,
    assignBestCourier,
    getAvailableCouriers,
    calculateShippingCost,
    COURIER_SERVICE_LEVELS,
    ASSIGNMENT_RULES
};
