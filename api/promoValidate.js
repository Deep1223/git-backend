const { BRAND } = require('../config/brand');
const SpinLog = require('../modal/spinlog');
const PromoCode = require('../modal/promocodemaster');

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

/** Legacy fallback if Mongo has no row (run `node scripts/seed-promo-codes.js` to use DB). */
const STATIC_PROMOS = [
    { code: BRAND.promoCode10, type: 'percent', value: 10, minOrder: 0 },
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
 * Resolve discount for checkout (spin DB → Mongo promo_codes → legacy static). Does not mark redeemed.
 * @returns {Promise<{ ok: true, discount: number, code: string, description: string, spinLogId?: import('mongoose').Types.ObjectId, promoCodeId?: import('mongoose').Types.ObjectId } | { ok: false, message: string }>}
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

    try {
        const row = await PromoCode.findOne({ code: upper, isActive: true }).lean();
        if (row) {
            const now = new Date();
            if (row.validFrom && now < new Date(row.validFrom)) {
                return { ok: false, message: 'This code is not active yet' };
            }
            if (row.validTo && now > new Date(row.validTo)) {
                return { ok: false, message: 'This code has expired' };
            }
            if (row.maxRedemptions != null && Number(row.redemptionCount || 0) >= row.maxRedemptions) {
                return { ok: false, message: 'This code is no longer available' };
            }

            const promoShape = {
                type: row.type,
                value: Number(row.value) || 0,
                minOrder: Number(row.minOrder) || 0,
            };
            const dbComputed = computeStaticDiscount(promoShape, sub);
            if (!dbComputed.ok) {
                return { ok: false, message: dbComputed.message };
            }
            const desc =
                (typeof row.description === 'string' && row.description.trim()) ||
                (row.type === 'percent' ? `${row.value}% off your order` : `₹${row.value} off`);
            return {
                ok: true,
                discount: dbComputed.discount,
                code: row.code,
                description: desc,
                promoCodeId: row._id,
            };
        }
    } catch (e) {
        // If DB is unavailable, fall through to legacy static list
    }

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
