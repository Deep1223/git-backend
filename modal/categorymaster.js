const mongoose = require('mongoose');

const categoryMasterSchema = new mongoose.Schema({
    categoryname: {
        type: String,
        required: [true, 'Category name is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    categoryimage: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: Number,
        default: 1
    },
    defaultdata: {
        type: Boolean,
        default: false
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

categoryMasterSchema.pre('save', function() {
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

module.exports = mongoose.model('CategoryMaster', categoryMasterSchema);
