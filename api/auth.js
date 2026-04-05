const User = require('../modal/user');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const SeriesMaster = require('../modal/seriesmaster');
const AuditLog = require('../modal/auditlog');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Strip IPv4-mapped / IPv6 loopback for consistent storage and display. */
function normalizeClientIp(ip) {
    let s = String(ip || '').trim();
    if (!s) return '';
    if (s.startsWith('::ffff:')) s = s.slice(7);
    if (s === '::1' || s === '0:0:0:0:0:0:0:1') return '127.0.0.1';
    return s;
}

function isLoopbackIp(normalized) {
    if (!normalized) return false;
    return normalized === '127.0.0.1' || normalized === 'localhost';
}

function displayClientIp(normalized) {
    if (!normalized) return '';
    if (isLoopbackIp(normalized)) return 'This device (local network)';
    return normalized;
}

/** Best-effort client IP: X-Forwarded-For / X-Real-IP / Express req.ip / socket. */
function getClientIp(req) {
    if (!req) return '';
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const first = String(xff).split(',')[0].trim();
        if (first && first.toLowerCase() !== 'unknown') {
            return normalizeClientIp(first).slice(0, 80);
        }
    }
    const xr = req.headers['x-real-ip'];
    if (xr) {
        const p = String(xr).split(',')[0].trim();
        if (p) return normalizeClientIp(p).slice(0, 80);
    }
    const raw = req.ip || req.socket?.remoteAddress || '';
    return normalizeClientIp(String(raw)).slice(0, 80);
}

async function recordLoginHistory(userId, req) {
    if (!req || !userId) return;
    try {
        await User.findByIdAndUpdate(userId, {
            $push: {
                loginHistory: {
                    $each: [
                        {
                            at: new Date(),
                            ip: getClientIp(req),
                            userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
                        },
                    ],
                    $position: 0,
                    $slice: 25,
                },
            },
        });
    } catch (e) {
        console.warn('recordLoginHistory:', e.message);
    }
}

/** Dashboard SPA on another origin (e.g. Vercel → Railway) needs SameSite=None + Secure or the token cookie is not sent on fetch(). */
function getDashboardAuthCookieOptions(expires) {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        expires,
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
    };
}

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = async (user, statusCode, res, message = '', req = null) => {
    // Create token
    const token = user.getSignedJwtToken();

    const options = getDashboardAuthCookieOptions(
        new Date(
            Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
        )
    );

    // Get user's assigned series directly from SeriesMaster
    let usercode = user.usercode || ''; // Use existing usercode if available
    
    // Only generate new usercode if user doesn't have one
    if (!usercode) {
        const seriesMaster = await SeriesMaster.findOne({
            status: 1
        });
        
        if (seriesMaster) {
            // Generate usercode using current number + 1
            const nextNumber = seriesMaster.currentnumber + 1;
            const paddedNumber = nextNumber.toString().padStart(seriesMaster.numberlength, '0');
            usercode = `${seriesMaster.seriescode}${seriesMaster.separator}${paddedNumber}${seriesMaster.suffix}`;
            
            // Update the current number in series master
            await SeriesMaster.findByIdAndUpdate(seriesMaster._id, {
                currentnumber: nextNumber
            });
            
            // Update user with usercode in database
            await User.findByIdAndUpdate(user._id, {
                usercode: usercode
            });
        }
    }

    await recordLoginHistory(user._id, req);

    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            message,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                role: user.role,
                roleid: user.roleid,
                twofactorenabled: user.twofactorenabled,
                usercode: usercode,
                status: user.status,
            }
        });
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set OTP and expire (2 minutes)
        user.resetpasswordotp = otp;
        user.resetpasswordexpire = Date.now() + 2 * 60 * 1000;
        await user.save();

        const requestId = crypto.randomBytes(4).toString('hex').toUpperCase();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }
    
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    
    .header {
      background-color: #2563eb;
      padding: 32px;
      text-align: center;
    }
    
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    
    .content {
      padding: 40px;
      line-height: 1.6;
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom:16px;
    }
    
    .otp-container {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 32px 0;
      border: 1px solid #e2e8f0;
    }
    
    .otp-label {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    
    .otp-code {
      font-size: 36px;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 8px;
      font-family: monospace;
    }
    
    .expiry {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 12px;
    }
    
    .footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
    
    .warning {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      font-size: 14px;
      color: #92400e;
    }
    
    .link {
      color: #2563eb;
      text-decoration: none;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DEMO Project</h1>
    </div>
    
    <div class="content">
      <div class="greeting">Hello, ${user.username}</div>
      <p>We received a request to reset your password for your account (<strong>${user.email}</strong>). Please use the following verification code to complete the process:</p>
      
      <div class="otp-container">
        <div class="otp-label">Your Verification Code</div>
        <div class="otp-code">${otp}</div>
        <div class="expiry">This code will expire in 2 minutes.</div>
      </div>
      
      <div class="warning">
        <strong>Important:</strong> Never share this code with anyone. If you didn't request a password reset, Please ignore this email or contact our support team.
      </div>
      
      <p>If you need further assistance, please visit our <a href="#" class="link">Help Center</a> or contact <a href="#" class="link">Support</a>.</p>
    </div>
    
    <div class="footer">
      <p>&copy; 2026 DEMO Project. All rights reserved.</p>
      <p>Request ID: ${requestId}</p>
    </div>
  </div>
</body>
</html>`;

        await sendEmail({
            email: user.email,
            subject: 'Password Reset OTP',
            html
        });

        res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide email, otp and new password' });
        }

        const user = await User.findOne({
            email,
            resetpasswordotp: otp,
            resetpasswordexpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid OTP or OTP expired' });
        }

        // Set new password
        user.password = newPassword;
        user.resetpasswordotp = undefined;
        user.resetpasswordexpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
};

// Google Login
exports.googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: 'Google ID token is required'
            });
        }

        // Verify token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const { sub: googleid, email, name: username, given_name: firstname, family_name: lastname } = ticket.getPayload();

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            // If user exists but doesn't have googleid, update it
            if (!user.googleid) {
                user.googleid = googleid;
                await user.save();
            }
        } else {
            // Create new user
            user = await User.create({
                googleid,
                email,
                username: username || email.split('@')[0], // Use name or email prefix
                firstname: firstname || username || email.split('@')[0],
                lastname: lastname || '',
                status: 1, // Use number instead of string
                recordinfo: {
                    createby: username || email.split('@')[0]
                }
            });
        }

        // Set entity for audit log
        res.locals.entity = { id: user._id };

        sendTokenResponse(user, 200, res, 'Google Login successful', req);
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({
            success: false,
            message: 'Google authentication failed',
            error: error.message
        });
    }
};

// Signup User
exports.signup = async (req, res) => {
    try {
        const { username, email, password, firstname, lastname, phoneno, firstName, lastName } = req.body;

        // Handle both camelCase and lowercase field names
        const userFirstname = firstname || firstName;
        const userLastname = lastname || lastName;
        const userPhoneno = phoneno || req.body.phone || req.body.mobilenumber;

        // Generate usercode if not provided
        let usercode = '';
        const SeriesMaster = require('../modal/seriesmaster');
        const seriesMaster = await SeriesMaster.findOne({
            status: 1
        });
        
        if (seriesMaster) {
            // Generate usercode using current number + 1
            const nextNumber = seriesMaster.currentnumber + 1;
            const paddedNumber = nextNumber.toString().padStart(seriesMaster.numberlength, '0');
            usercode = `${seriesMaster.seriescode}${seriesMaster.separator}${paddedNumber}${seriesMaster.suffix}`;
            
            // Update the current number in series master
            await SeriesMaster.findByIdAndUpdate(seriesMaster._id, {
                currentnumber: nextNumber
            });
        }

        // Create user with recordinfo (create only)
        const user = await User.create({
            username,
            email,
            password,
            firstname: userFirstname,
            lastname: userLastname,
            mobilenumber: userPhoneno,
            usercode,
            status: 1, // Set default status to 1 (Active)
            recordinfo: {
                createby: username
            }
        });

        // Set entity for audit log
        res.locals.entity = { id: user._id };

        sendTokenResponse(user, 201, res, 'User registered successfully', req);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email/username'
            });
        }
        console.error('Signup Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password +twofactorsecret +twofactorenabled');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return res.status(403).json({
                success: false,
                message: `Account is locked. Try again in ${minutesLeft} minutes` 
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            // Increment failed attempts
            user.loginAttempts += 1;
            
            // If more than 5 attempts, lock for 1 hour
            if (user.loginAttempts >= 5) {
                user.lockUntil = Date.now() + 60 * 60 * 1000;
                await user.save();
                return res.status(403).json({
                    success: false,
                    message: 'Account locked due to 5 failed attempts. Please try again after 1 hour'
                });
            }
            
            await user.save();
            return res.status(401).json({
                success: false,
                message: `Invalid credentials. Attempts left: ${5 - user.loginAttempts}` 
            });
        }

        // Reset attempts on successful login
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();

        // 2FA is now OPTIONAL - only required if user has enabled it
        if (user.twofactorenabled) {
            // If 2FA is enabled, ask for token
            return res.status(200).json({
                success: true,
                twoFactorRequired: true,
                userId: user._id,
                message: 'Please provide 2FA token'
            });
        } else {
            // If 2FA is not enabled, proceed with login
            sendTokenResponse(user, 200, res, 'Login successful', req);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Log user out / clear cookie
exports.logout = async (req, res) => {
    res.cookie('token', 'none', {
        ...getDashboardAuthCookieOptions(new Date(Date.now() + 10 * 1000)),
    });

    res.status(200).json({
        success: true,
        message: 'User logged out'
    });
};

// 2FA Setup
exports.setup2FA = async (req, res) => {
    try {
        // Support both protected middleware and userId from body
        const id = (req.user && req.user.id) || req.body.userId;
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const user = await User.findById(id).select('+twofactorsecret');

        const secret = speakeasy.generateSecret({ 
            name: `DEMO Project (${user.email})`,
            issuer: 'DEMO Project'
        });
        
        user.twofactorsecret = secret.base32;
        await user.save();

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                console.error('QR Code generation error:', err);
                return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
            }
            
            res.status(200).json({
                success: true,
                data: data_url,
                secret: secret.base32,
                userId: user._id
            });
        });
    } catch (error) {
        console.error('2FA Setup Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Verify 2FA
exports.verify2FA = async (req, res) => {
    try {
        const { token, userId } = req.body;
        
        // Use userId from body (for login flow) OR from protect middleware
        const id = userId || (req.user && req.user.id);
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        // Always include twofactorsecret in query
        const user = await User.findById(id).select('+twofactorsecret +twofactorenabled');

        if (!user || !user.twofactorsecret) {
            return res.status(400).json({ success: false, message: '2FA not initialized' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twofactorsecret,
            encoding: 'base32',
            token: token,
            window: 0, // Only current time window
            time: Math.floor(Date.now() / 1000)
        });

        if (verified) {
            // Use findOneAndUpdate to ensure proper save
            await User.findByIdAndUpdate(
                user._id, 
                { twofactorenabled: true },
                { new: true, runValidators: false }
            ).select('+twofactorsecret +twofactorenabled');
            
            // Log this success
            res.locals.entity = { id: user._id };
            
            // Return full token response to finish login
            sendTokenResponse(user, 200, res, '2FA verified. Login successful.', req);
        } else {
            res.status(400).json({ success: false, message: 'Invalid 2FA token' });
        }
    } catch (error) {
        console.error('2FA Verification Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

function sanitizeUserForClient(doc) {
    if (!doc) return null;
    const u = doc.toObject ? doc.toObject() : { ...doc };
    return {
        id: u._id,
        _id: u._id,
        username: u.username,
        firstname: u.firstname,
        lastname: u.lastname,
        email: u.email,
        mobilenumber: u.mobilenumber,
        usercode: u.usercode,
        status: u.status,
        twofactorenabled: Boolean(u.twofactorenabled),
        profileimage: u.profileimage,
        addressline1: u.addressline1,
        city: u.city,
        state: u.state,
        country: u.country,
        pincode: u.pincode,
        role: u.role,
        roleid: u.roleid,
    };
}

// Get current logged in user
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            data: sanitizeUserForClient(user),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
        });
    }
};

/** Update own profile (dashboard “My Profile”). */
exports.updateProfile = async (req, res) => {
    try {
        const allowed = [
            'firstname',
            'lastname',
            'mobilenumber',
            'addressline1',
            'city',
            'state',
            'country',
            'pincode',
            'profileimage',
        ];
        const body = req.body || {};
        const $set = {};
        for (const k of allowed) {
            if (body[k] === undefined || body[k] === null) continue;
            $set[k] = typeof body[k] === 'string' ? String(body[k]).trim() : body[k];
        }
        if (Object.keys($set).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }
        const user = await User.findByIdAndUpdate(req.user.id, { $set }, { new: true, runValidators: true }).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Profile updated',
            data: sanitizeUserForClient(user),
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Update failed',
        });
    }
};

/** Change password (current + new). */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'currentPassword and newPassword are required',
            });
        }
        if (String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters',
            });
        }
        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.googleid && !user.password) {
            return res.status(400).json({
                success: false,
                message: 'Google sign-in accounts use Google to manage password',
            });
        }
        const ok = await user.matchPassword(currentPassword);
        if (!ok) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

/** Recent sign-ins for “My devices”. */
exports.getLoginSessions = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('loginHistory').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const rows = user.loginHistory || [];
        const data = rows.map((row, idx) => {
            const rawIp = row.ip || '';
            const normalized = normalizeClientIp(rawIp);
            return {
                id: row._id ? String(row._id) : `h-${idx}`,
                at: row.at,
                ip: rawIp,
                ipDisplay: displayClientIp(normalized),
                isLoopback: isLoopbackIp(normalized),
                userAgent: row.userAgent || '',
                current: idx === 0,
            };
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/** Remove one login history row (does not invalidate tokens on remote devices). */
exports.removeLoginSession = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id || String(id).startsWith('h-')) {
            return res.status(400).json({ success: false, message: 'Invalid session id' });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const rows = user.loginHistory || [];
        if (rows.length && String(rows[0]._id) === String(id)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove your current session from this list',
            });
        }
        const before = rows.length;
        user.loginHistory = rows.filter((h) => String(h._id) !== String(id));
        if (user.loginHistory.length === before) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        await user.save();
        res.locals.auditDetails = 'Removed a device from sign-in history';
        res.status(200).json({ success: true, message: 'Session removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

function activityCategory(log) {
    const a = log.action;
    if (a === 'LOGIN' || a === 'LOGOUT') return 'signin';
    if (a === '2FA_TOGGLE' || a === '2FA_SETUP' || a === '2FA_VERIFY') return 'security';
    if (a === 'UPDATE' && log.entity === 'User') {
        const d = String(log.details || '').toLowerCase();
        if (d.includes('session') || d.includes('device') || d.includes('sign-in')) return 'security';
        return 'settings';
    }
    if (['CREATE', 'UPDATE', 'DELETE'].includes(a)) return 'data';
    return 'data';
}

function activityTitle(log) {
    switch (log.action) {
        case 'LOGIN':
            return 'Signed in successfully';
        case 'LOGOUT':
            return 'Signed out';
        case '2FA_TOGGLE':
            return 'Two-factor authentication updated';
        case '2FA_SETUP':
            return 'Two-factor authentication setup';
        case '2FA_VERIFY':
            return 'Two-factor verification completed';
        case 'CREATE':
            return `Created ${log.entity}`;
        case 'UPDATE':
            return log.entity === 'User' ? 'Account or profile updated' : `Updated ${log.entity}`;
        case 'DELETE':
            return `Deleted ${log.entity}`;
        default:
            return `${log.action} · ${log.entity}`;
    }
}

/** Recent audit trail rows for the signed-in user (Activity Log). */
exports.getMyActivity = async (req, res) => {
    try {
        const logs = await AuditLog.find({ user: req.user.id })
            .sort({ 'recordinfo.createat': -1 })
            .limit(100)
            .lean();
        const data = logs.map((log) => {
            const at = log.recordinfo?.createat;
            return {
                id: String(log._id),
                action: log.action,
                entity: log.entity,
                category: activityCategory(log),
                title: activityTitle(log),
                details: log.details || '',
                status: log.status,
                ip: log.ipaddress || '',
                at,
            };
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Toggle 2FA
exports.toggle2FA = async (req, res) => {
    try {
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ 
                success: false, 
                message: 'enabled field must be a boolean' 
            });
        }

        const user = await User.findById(req.user.id).select('+twofactorsecret +twofactorenabled');

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        if (enabled) {
            // Enable 2FA - generate secret if not exists
            if (!user.twofactorsecret) {
                const secret = speakeasy.generateSecret({ 
                    name: `DEMO Project (${user.email})`,
                    issuer: 'DEMO Project'
                });
                user.twofactorsecret = secret.base32;
            }
            user.twofactorenabled = true;
        } else {
            // Disable 2FA - only remove flag, keep secret for future use
            user.twofactorenabled = false;
            // Don't remove the secret, keep it for future re-enable
        }

        await user.save();

        // Set entity for audit log
        res.locals.entity = { id: user._id };

        res.status(200).json({
            success: true,
            message: enabled ? '2FA enabled successfully' : '2FA disabled successfully',
            data: {
                twofactorenabled: user.twofactorenabled
            }
        });

    } catch (error) {
        console.error('Toggle 2FA Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update 2FA settings' 
        });
    }
};
