const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    usercode: {
        type: String,
        trim: true,
        unique: true
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
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    mobilenumber: {
        type: String,
        trim: true,
        maxlength: 15
    },
    profileimage: {
        type: String,
        trim: true
    },
    gender: {
        type: String,
        trim: true
    },
    genderid: {
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
    cityid: {
        type: String,
        trim: true
    },

    stateid: {
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
    state: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    pincode: {
        type: String,
        trim: true,
        maxlength: 10
    },
    password: {
        type: String,
        select: false,
        required: function () {
            return !this.googleid;
        },
        validate: {
            validator: function (v) {
                // Only validate if password is being set/modified
                if (!this.isModified('password')) return true;
                // If googleid is present, password is not required
                if (this.googleid) return true;
                // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(v);
            },
            message: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character'
        }
    },
    googleid: {
        type: String,
        unique: true,
        sparse: true // Allows multiple nulls (for non-google users)
    },
    status: {
        type: Number,
        enum: [0, 1],
        default: 1,
        trim: true
    },
    twofactorsecret: {
        type: String,
        select: false
    },
    twofactorenabled: {
        type: Boolean,
    },
    resetpasswordotp: String,
    resetpasswordexpire: Date,
    loginAttempts: {
        type: Number,
        required: true,
        default: 0
    },
    lockUntil: {
        type: Number
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else {
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }

    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET || 'secretkey', {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
