const SpinLog = require('../modal/spinlog');

/** Must match spin wheel / spin.js reward labels */
const NON_REDEEMABLE_REWARDS = new Set([
    'Maybe next time',
    'No luck today',
    "You didn't win",
    'Try again',
]);

const REWARD_RULES = {
    'Buy 2 at 45% off': { type: 'percent', value: 45, minQuantity: 2 },
    'Buy 3 at 55% off': { type: 'percent', value: 55, minQuantity: 3 },
    'Flat Rs. 400 off': { type: 'fixed', value: 400 },
    'Flat Rs. 200 off': { type: 'fixed', value: 200 },
};

/** Same rules as storefront `orinket/data/promoCodes.ts` (INR) */
const STATIC_PROMOS = [
    { code: 'ORINKET10', type: 'percent', value: 10, minOrder: 0 },
    { code: 'WELCOME15', type: 'percent', value: 15, minOrder: 0 },
    { code: 'FEST500', type: 'fixed', value: 500, minOrder: 2000 },
    { code: 'GOLD100', type: 'fixed', value: 100, minOrder: 500 },
];

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeStaticDiscount(promo, subtotal) {
    if (promo.minOrder > 0 && subtotal < promo.minOrder) {
        return {
            ok: false,
            message: `Minimum order of ₹${promo.minOrder} required for this code`,
        };
    }
    if (promo.type === 'percent') {
        const discount = Math.round((subtotal * promo.value) / 100);
        return { ok: true, discount: Math.min(discount, subtotal) };
    }
    return { ok: true, discount: Math.min(promo.value, subtotal) };
}

/**
 * Resolve discount for checkout (spin DB + static list). Does not mark redeemed.
 * @returns {Promise<{ ok: true, discount: number, code: string, description: string, spinLogId?: import('mongoose').Types.ObjectId } | { ok: false, message: string }>}
 */
async function computePromoDiscountForOrder(rawCode, subtotal, totalQuantity) {
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!code) {
        return { ok: false, message: 'Promo code is required' };
    }
    const sub = Math.max(0, Number(subtotal) || 0);
    const qty = Math.max(0, Math.floor(Number(totalQuantity) || 0));

    const spinRow = await SpinLog.findOne({
        coupon_code: new RegExp(`^${escapeRegex(code)}$`, 'i'),
    }).lean();

    if (spinRow) {
        if (!spinRow.is_spinned) {
            return { ok: false, message: 'Invalid coupon' };
        }
        if (spinRow.coupon_redeemed) {
            return { ok: false, message: 'This coupon has already been used' };
        }
        if (NON_REDEEMABLE_REWARDS.has(spinRow.reward)) {
            return { ok: false, message: 'This reward cannot be redeemed at checkout' };
        }
        const rule = REWARD_RULES[spinRow.reward];
        if (!rule) {
            return { ok: false, message: 'This coupon cannot be applied' };
        }
        if (rule.minQuantity && qty < rule.minQuantity) {
            return {
                ok: false,
                message: `Add at least ${rule.minQuantity} items in your cart to use this offer`,
            };
        }
        let discount = 0;
        if (rule.type === 'percent') {
            discount = Math.round((sub * rule.value) / 100);
            discount = Math.min(discount, sub);
        } else {
            discount = Math.min(rule.value, sub);
        }
        return {
            ok: true,
            discount,
            code: spinRow.coupon_code,
            description: spinRow.reward,
            spinLogId: spinRow._id,
        };
    }

    const upper = code.toUpperCase();
    const staticPromo = STATIC_PROMOS.find((p) => p.code === upper);
    if (!staticPromo) {
        return { ok: false, message: 'Invalid or expired code' };
    }
    const result = computeStaticDiscount(staticPromo, sub);
    if (!result.ok) {
        return { ok: false, message: result.message };
    }
    return {
        ok: true,
        discount: result.discount,
        code: staticPromo.code,
        description:
            staticPromo.type === 'percent'
                ? `${staticPromo.value}% off your order`
                : `₹${staticPromo.value} off`,
    };
}

exports.computePromoDiscountForOrder = computePromoDiscountForOrder;

exports.validatePromo = async (req, res) => {
    try {
        const code = req.body?.code;
        const subtotal = Number(req.body?.subtotal);
        const totalQuantity = Number(req.body?.totalQuantity);
        const result = await computePromoDiscountForOrder(code, subtotal, totalQuantity);
        if (!result.ok) {
            return res.status(200).json({
                success: true,
                valid: false,
                message: result.message,
            });
        }
        return res.status(200).json({
            success: true,
            valid: true,
            discount: result.discount,
            code: result.code,
            description: result.description,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            valid: false,
            message: error.message || 'Server Error',
        });
    }
};
