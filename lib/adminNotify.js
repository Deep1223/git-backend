const User = require('../modal/user');
const AdminNotification = require('../modal/adminNotification');

const COLORS = {
    new_order: 'linear-gradient(135deg,#059669,#10b981)',
    payment_success: 'linear-gradient(135deg,#059669,#34d399)',
    payment_failed: 'linear-gradient(135deg,#dc2626,#f87171)',
    low_stock: 'linear-gradient(135deg,#d97706,#fbbf24)',
    low_stock_digest: 'linear-gradient(135deg,#d97706,#fbbf24)',
    out_of_stock: 'linear-gradient(135deg,#b91c1c,#ef4444)',
    profile_updated: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    user_created: 'linear-gradient(135deg,#2563eb,#60a5fa)',
    product_updated: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
};

function initialsFrom(str) {
    if (!str || typeof str !== 'string') return '•';
    const parts = str.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return str.slice(0, 2).toUpperCase();
}

function formatTime(d) {
    const date = new Date(d);
    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    const t = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Today at ${t}`;
    if (isYesterday) return `Yesterday at ${t}`;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateGroup(d) {
    const date = new Date(d);
    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();
    if (sameDay) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

async function getActiveAdminIds() {
    const users = await User.find({ status: 1 }).select('_id').lean();
    return users.map((u) => u._id);
}

/**
 * Create the same notification for every active dashboard user (status = 1).
 * Fire-and-forget safe: errors logged, never throws to caller.
 */
async function notifyAllAdmins(payload) {
    try {
        const ids = await getActiveAdminIds();
        if (!ids.length) return;
        const color = payload.color || COLORS[payload.type] || COLORS.profile_updated;
        const docs = ids.map((recipient) => ({
            recipient,
            type: payload.type,
            read: false,
            boldName: payload.boldName || '',
            text: payload.text || '',
            name: payload.name || payload.boldName || 'Notification',
            body: payload.body || '',
            boldTag: payload.boldTag || '',
            subDesc: payload.subDesc || '',
            tag: payload.tag || 'Alert',
            sender: payload.sender || 'System',
            initials: payload.initials || initialsFrom(payload.boldName || payload.name || 'N'),
            color,
            redirectPath: payload.redirectPath || '/dashboard',
            meta: payload.meta || {},
        }));
        await AdminNotification.insertMany(docs);
    } catch (e) {
        console.error('[adminNotify] notifyAllAdmins failed:', e.message);
    }
}

function toClientShape(o) {
    if (!o) return null;
    const plain = o.toObject ? o.toObject() : o;
    const createdAt = plain.createdAt || new Date();
    return {
        id: String(plain._id),
        unread: !plain.read,
        boldName: plain.boldName,
        text: plain.text || `${plain.boldName}${plain.boldTag ? ` — ${plain.boldTag}` : ''}`,
        name: plain.name || plain.boldName,
        body: plain.body,
        boldTag: plain.boldTag,
        subDesc: plain.subDesc,
        tag: plain.tag,
        sender: plain.sender,
        time: formatTime(createdAt),
        dateGroup: dateGroup(createdAt),
        color: plain.color,
        initials: plain.initials,
        redirectPath: plain.redirectPath,
        type: plain.type,
        meta: plain.meta || {},
    };
}

module.exports = {
    notifyAllAdmins,
    toClientShape,
    formatTime,
    dateGroup,
    initialsFrom,
    COLORS,
};
