const mongoose = require('mongoose');

const countryMasterSchema = new mongoose.Schema({
    countryname: {
        type: String,
        required: [true, 'Country name is required'],
        unique: true,
        trim: true
    },
    countrycode: {
        type: String,
        required: [true, 'Country code is required'],
        unique: true,
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

countryMasterSchema.pre('save', function() {
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

module.exports = mongoose.model('CountryMaster', countryMasterSchema);