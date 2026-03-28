const mongoose = require('mongoose');

const subCategoryMasterSchema = new mongoose.Schema({
    subcategoryname: {
        type: String,
        required: [true, 'Sub category name is required'],
        trim: true
    },
    categoryid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CategoryMaster',
        required: [true, 'Category is required']
    },
    category: {
        type: String,
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

subCategoryMasterSchema.index({ subcategoryname: 1, categoryid: 1 }, { unique: true });

subCategoryMasterSchema.pre('save', function () {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else if (this.recordinfo) {
        this.recordinfo.updateat = Date.now();
    }
});

module.exports = mongoose.model('SubCategoryMaster', subCategoryMasterSchema);
