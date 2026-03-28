const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: false // Optional for failed logins or system actions
    },
    action: {
        type: String,
        required: true,
        enum: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', '2FA_SETUP', '2FA_VERIFY', '2FA_TOGGLE']
    },
    entity: {
        type: String,
        required: true
    },
    entityid: {
        type: mongoose.Schema.Types.Mixed
    },
    ipaddress: {
        type: String
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILURE'],
        required: true
    },
    details: {
        type: String
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

auditLogSchema.pre('save', function() {
    if (this.isNew) {
        // Only ensure createat is set (it has a default anyway)
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else {
        // On update
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
