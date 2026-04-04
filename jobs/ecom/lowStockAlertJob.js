const EcomProduct = require('../../modal/ecomProduct');
const AdminNotification = require('../../modal/adminNotification');
const { notifyAllAdmins } = require('../../lib/adminNotify');
const { getLowStockThreshold } = require('../../modal/storeInventorySettings');

async function runLowStockAlertJob() {
    const threshold = await getLowStockThreshold();
    await EcomProduct.updateMany({ stock: { $lt: threshold } }, { $set: { isLowStock: true } });
    await EcomProduct.updateMany({ stock: { $gte: threshold } }, { $set: { isLowStock: false } });
    const lowStockCount = await EcomProduct.countDocuments({ isLowStock: true, hidden: { $ne: true } });

    if (lowStockCount > 0) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const alreadyToday = await AdminNotification.findOne({
            type: 'low_stock_digest',
            createdAt: { $gte: start },
        })
            .select('_id')
            .lean();

        if (!alreadyToday) {
            notifyAllAdmins({
                type: 'low_stock_digest',
                boldName: 'Low stock summary',
                text: `Low stock — ${lowStockCount} catalog SKU(s) below threshold (${threshold})`,
                name: 'Low stock summary',
                body: `The scheduled inventory job found ${lowStockCount} active storefront product(s) under ${threshold} units. Review catalog pricing and restock.`,
                boldTag: `${lowStockCount} SKU(s)`,
                subDesc: `threshold ${threshold}`,
                tag: 'Inventory',
                sender: 'Catalog job',
                initials: 'LS',
                redirectPath: '/low-stock-products-master',
                meta: { lowStockCount, threshold },
            });
        }
    }

    return { lowStockCount, threshold };
}

module.exports = { runLowStockAlertJob };
