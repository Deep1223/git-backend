const EcomProduct = require('../../modal/ecomProduct');

async function runLowStockAlertJob() {
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);
    await EcomProduct.updateMany({ stock: { $lt: threshold } }, { $set: { isLowStock: true } });
    await EcomProduct.updateMany({ stock: { $gte: threshold } }, { $set: { isLowStock: false } });
    const lowStockCount = await EcomProduct.countDocuments({ isLowStock: true, hidden: { $ne: true } });
    return { lowStockCount, threshold };
}

module.exports = { runLowStockAlertJob };
