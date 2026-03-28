const mongoose = require('mongoose');

const moduleMasterSchema = new mongoose.Schema({
    module: {
        type: String,
        required: [true, 'Module is required'],
        unique: true,
        trim: true
    },      
    status: {
        type: Number,
        default: 1
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
    bgcolor: {
        type: String,
        required: false,
        trim: true,
        default: ''
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

moduleMasterSchema.pre('save', function() {
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

module.exports = mongoose.model('ModuleMaster', moduleMasterSchema);
