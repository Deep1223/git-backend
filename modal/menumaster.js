const mongoose = require('mongoose');

const menuMasterSchema = new mongoose.Schema({
    menuname: {
        type: String,
        required: [true, 'Menu Name is required'],
        trim: true
    },
    pagename: {
        type: String,
        required: [true, 'Page Name is required'],
        trim: true
    },
    aliasname: {
        type: String,
        required: [true, 'Alias Name is required'],
        trim: true
    },
    iconid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'IconMaster',
        required: false
    },
    icon: {
        type: String,
        required: false,
        trim: true
    },
    showinsidebar: {
        type: Number,
        default: 1
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

menuMasterSchema.pre('save', function() {
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

module.exports = mongoose.model('MenuMaster', menuMasterSchema);
