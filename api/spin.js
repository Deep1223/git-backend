const SpinLog = require('../modal/spinlog');
const Settings = require('../modal/settings');
const GeneralSetting = require('../modal/generalsetting');

/** Labels must match storefront wheel (`SpinToWinPopup`) for result → segment mapping */
const REWARDS = [
    { label: 'Buy 2 at 45% off', couponPrefix: 'BUY2-45', weight: 20 },
    { label: 'Maybe next time', couponPrefix: 'MAYBE', weight: 18 },
    { label: 'Buy 3 at 55% off', couponPrefix: 'BUY3-55', weight: 12 },
    { label: 'No luck today', couponPrefix: 'NOLUCK', weight: 14 },
    { label: 'Flat Rs. 400 off', couponPrefix: 'SPIN400', weight: 13 },
    { label: "You didn't win", couponPrefix: 'NOWIN', weight: 14 },
    { label: 'Flat Rs. 200 off', couponPrefix: 'SPIN200', weight: 24 },
    { label: 'Try again', couponPrefix: 'TRY', weight: 17 },
];

function sanitizeString(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function normalizeEmail(email) {
    return sanitizeString(email).toLowerCase();
}

function normalizePhone(phone) {
    const raw = sanitizeString(phone);
    return raw.replace(/[^\d+]/g, '');
}

function normalizeSessionId(sessionId) {
    return sanitizeString(sessionId);
}

function getDaysDiff(fromDate, toDate) {
    const diffMs = Math.max(0, toDate.getTime() - fromDate.getTime());
    return diffMs / (1000 * 60 * 60 * 24);
}

function selectReward() {
    const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    for (const reward of REWARDS) {
        random -= reward.weight;
        if (random <= 0) return reward;
    }
    return REWARDS[0];
}

function couponCode(prefix) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
}

async function getFrequencyDays() {
    const gs = await GeneralSetting.findOne().sort({ _id: -1 }).select('spin_popup_frequency_days').lean();
    const fromGs = Number(gs?.spin_popup_frequency_days);
    if (Number.isFinite(fromGs) && fromGs >= 1) {
        return Math.floor(fromGs);
    }
    const settings = await Settings.findOne().sort({ _id: 1 }).lean();
    const n = Number(settings?.spin_popup_frequency_days);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
}

function buildIdentityConditions({ email, sessionId }) {
    const conditions = [];
    if (email) conditions.push({ email });
    if (sessionId) conditions.push({ session_id: sessionId });
    return conditions;
}

exports.checkSpin = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const sessionId = normalizeSessionId(req.body?.session_id);
        const identityConditions = buildIdentityConditions({ email, sessionId });

        if (identityConditions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide email or session_id',
            });
        }

        const record = await SpinLog.findOne({ $or: identityConditions }).sort({ created_at: -1 }).lean();

        if (!record) {
            return res.status(200).json({ success: true, show_popup: true });
        }

        if (!record.is_spinned) {
            return res.status(200).json({ success: true, show_popup: true });
        }

        const frequencyDays = await getFrequencyDays();
        const daysPassed = getDaysDiff(new Date(record.created_at), new Date());
        const showPopup = daysPassed >= frequencyDays;

        return res.status(200).json({
            success: true,
            show_popup: showPopup,
            frequency_days: frequencyDays,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.spin = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const phone = normalizePhone(req.body?.phone);
        const sessionId = normalizeSessionId(req.body?.session_id);

        if (!phone || (!email && !sessionId)) {
            return res.status(400).json({
                success: false,
                message: 'Phone and (email or session_id) are required',
            });
        }

        const identityConditions = buildIdentityConditions({ email, sessionId });
        identityConditions.push({ phone });
        const existing = await SpinLog.findOne({ $or: identityConditions }).sort({ created_at: -1 });
        const frequencyDays = await getFrequencyDays();

        if (existing?.is_spinned) {
            const daysPassed = getDaysDiff(new Date(existing.created_at), new Date());
            if (daysPassed < frequencyDays) {
                return res.status(409).json({
                    success: false,
                    message: `Already spin in current cycle. Try again after ${frequencyDays} day(s).`,
                });
            }
        }

        const rewardObj = selectReward();
        const generatedCoupon = couponCode(rewardObj.couponPrefix);
        const now = new Date();

        const updatePayload = {
            phone,
            is_spinned: true,
            reward: rewardObj.label,
            coupon_code: generatedCoupon,
            created_at: now,
        };
        if (email) updatePayload.email = email;
        if (sessionId) updatePayload.session_id = sessionId;

        await SpinLog.findOneAndUpdate(
            { $or: identityConditions },
            { $set: updatePayload },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            reward: rewardObj.label,
            coupon_code: generatedCoupon,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Spin already exists for this email/phone/session',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
