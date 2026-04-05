const AdminNotification = require('../modal/adminNotification');
const { toClientShape } = require('../lib/adminNotify');

const LIST_LIMIT = 200;

exports.listNotifications = async (req, res) => {
    try {
        const rows = await AdminNotification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .lean();

        const data = rows.map((row) => toClientShape(row));

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'notifications_list_failed' });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await AdminNotification.findOneAndUpdate(
            { _id: id, recipient: req.user._id },
            { $set: { read: true } },
            { new: true }
        ).lean();

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        return res.status(200).json({ success: true, data: toClientShape(updated) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'mark_read_failed' });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        await AdminNotification.updateMany({ recipient: req.user._id, read: false }, { $set: { read: true } });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'mark_all_failed' });
    }
};
