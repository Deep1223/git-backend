const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ecomUserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    },
    { timestamps: true }
);

ecomUserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

ecomUserSchema.methods.matchPassword = function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

ecomUserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id, role: this.role, type: 'ecom' }, process.env.JWT_SECRET || 'secretkey', {
        expiresIn: process.env.JWT_EXPIRE || '30d',
    });
};

module.exports = mongoose.model('EcomUser', ecomUserSchema);
