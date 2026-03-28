const mongoose = require('mongoose');

const iconMasterSchema = new mongoose.Schema({
    icon: {
        type: String,
        required: [true, 'Icon is required'],
        unique: true,
        trim: true
    },
    iconclass: {
        type: String,
        required: [true, 'Icon class is required'],
        trim: true
    },
    status: {
        type: Number,
        default: 1
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

iconMasterSchema.pre('save', function() {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else {
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }
});

module.exports = mongoose.model('IconMaster', iconMasterSchema);
