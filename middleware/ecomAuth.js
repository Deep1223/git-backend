const jwt = require('jsonwebtoken');
const EcomUser = require('../modal/ecomUser');

async function optionalEcomAuth(req, _res, next) {
    try {
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.ecomToken) {
            token = req.cookies.ecomToken;
        }
        if (!token) return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded?.type !== 'ecom') return next();
        const user = await EcomUser.findById(decoded.id);
        if (user) req.ecomUser = user;
        return next();
    } catch (_err) {
        return next();
    }
}

module.exports = { optionalEcomAuth };
