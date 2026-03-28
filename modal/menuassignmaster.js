const mongoose = require('mongoose');

const menuAssignMasterSchema = new mongoose.Schema({
    moduleid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleMaster',
        required: false
    },
    module: {
        type: String,
        required: false,
        trim: true
    },
    menuid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuMaster',
        required: false,
        unique: true
    },
    menu: {
        type: String,
        required: false,
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

menuAssignMasterSchema.pre('save', function () {
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

module.exports = mongoose.model('MenuAssignMaster', menuAssignMasterSchema);
