const mongoose = require('mongoose');

const userMasterSchema = new mongoose.Schema({
    usercode: {
        type: String,
        required: [true, 'User code is required'],
        unique: true,
        trim: true
    },
    firstname: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    middlename: {
        type: String,
        trim: true
    },
    lastname: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    mobilenumber: {
        type: String,
        trim: true
    },
    profileimage: {
        type: String,
        trim: true
    },
    genderid: {
        type: String,
        trim: true
    },
    gender: {
        type: String,
        trim: true
    },
    dateofbirth: {
        type: Date
    },
    addressline1: {
        type: String,
        trim: true
    },
    countryid: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    stateid: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    cityid: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    pincode: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        default: '1'
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

userMasterSchema.pre('save', function() {
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

module.exports = mongoose.model('UserMaster', userMasterSchema);
