const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            index: true,
        },
        read: { type: Boolean, default: false, index: true },
        boldName: { type: String, default: '' },
        text: { type: String, default: '' },
        name: { type: String, default: '' },
        body: { type: String, default: '' },
        boldTag: { type: String, default: '' },
        subDesc: { type: String, default: '' },
        tag: { type: String, default: '' },
        sender: { type: String, default: 'System' },
        initials: { type: String, default: '•' },
        color: { type: String, default: 'linear-gradient(135deg,#6366f1,#818cf8)' },
        redirectPath: { type: String, default: '/dashboard' },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

adminNotificationSchema.index({ recipient: 1, createdAt: -1 });
adminNotificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
