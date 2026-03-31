const EcomCart = require('../../modal/ecomCart');
const EcomProduct = require('../../modal/ecomProduct');
const { resolveActor, mapProductPublic } = require('./helpers');

async function getCartForActor(actor, createIfMissing = true) {
    const filter = actor.userId ? { user: actor.userId } : { sessionId: actor.sessionId };
    let cart = await EcomCart.findOne(filter);
    if (!cart && createIfMissing && (actor.userId || actor.sessionId)) {
        cart = await EcomCart.create({ ...filter, items: [] });
    }
    return cart;
}

async function cartResponse(cart) {
    if (!cart) return { items: [], total: 0 };
    const ids = cart.items.map((i) => i.product);
    const products = await EcomProduct.find({ _id: { $in: ids } }).populate('category', 'name slug').lean();
    const map = new Map(products.map((p) => [String(p._id), p]));
    const items = cart.items
        .map((row) => {
            const product = map.get(String(row.product));
            if (!product || product.hidden) return null;
            const p = mapProductPublic(product);
            return {
                product: p,
                quantity: row.quantity,
                lineTotal: row.quantity * row.priceSnapshot,
            };
        })
        .filter(Boolean);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, total };
}

exports.getCart = async (req, res) => {
    try {
        const actor = resolveActor(req);
        const cart = await getCartForActor(actor, false);
        return res.status(200).json({ success: true, data: await cartResponse(cart) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'cart_failed' });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const actor = resolveActor(req);
        if (!actor.userId && !actor.sessionId) {
            return res.status(400).json({ success: false, message: 'sessionId required for guest cart' });
        }
        const { productId, quantity = 1 } = req.body || {};
        const product = await EcomProduct.findById(productId).lean();
        if (!product || product.hidden) return res.status(404).json({ success: false, message: 'Product not found' });
        const safeQty = Math.max(1, Number(quantity || 1));

        const cart = await getCartForActor(actor, true);
        const existing = cart.items.find((i) => String(i.product) === String(product._id));
        if (existing) {
            existing.quantity = Math.min(existing.quantity + safeQty, Math.max(1, product.stock));
        } else {
            cart.items.push({
                product: product._id,
                quantity: Math.min(safeQty, Math.max(1, product.stock)),
                priceSnapshot: product.price,
            });
        }
        await cart.save();
        return res.status(200).json({ success: true, data: await cartResponse(cart) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'cart_add_failed' });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const actor = resolveActor(req);
        const { productId, quantity } = req.body || {};
        const cart = await getCartForActor(actor, false);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
        const index = cart.items.findIndex((i) => String(i.product) === String(productId));
        if (index < 0) return res.status(404).json({ success: false, message: 'Item not found in cart' });
        const safeQty = Number(quantity);
        if (!Number.isFinite(safeQty) || safeQty <= 0) {
            cart.items.splice(index, 1);
        } else {
            cart.items[index].quantity = Math.floor(safeQty);
        }
        await cart.save();
        return res.status(200).json({ success: true, data: await cartResponse(cart) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'cart_update_failed' });
    }
};

exports.removeCartItem = async (req, res) => {
    try {
        const actor = resolveActor(req);
        const productId = req.params.productId;
        const cart = await getCartForActor(actor, false);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
        cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
        await cart.save();
        return res.status(200).json({ success: true, data: await cartResponse(cart) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'cart_remove_failed' });
    }
};
