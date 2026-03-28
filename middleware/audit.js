const AuditLog = require('../modal/auditlog');

const audit = (action, entity, options = {}) => async (req, res, next) => {
    // Let the actual route handler run first
    res.on('finish', async () => {
        try {
            const log = {
                user: req.user ? req.user.id : (res.locals.entity && res.locals.entity.id) || null,
                action,
                entity,
                entityid: req.params.id || (res.locals.entity && res.locals.entity.id) || null,
                ipaddress: req.ip,
                status: res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS',
                details: res.locals.auditDetails || (res.statusCode >= 400 ? `Failed with status ${res.statusCode}` : null),
                recordinfo: {
                    createby: req.user ? req.user.username : (res.locals.entity && res.locals.entity.username) || 'guest'
                }
            };

            // Don't log if user is not available for protected routes
            if (!log.user && options.protect) {
                return;
            }

            await AuditLog.create(log);
        } catch (error) {
            console.error('Audit Trail Error:', error);
        }
    });

    next();
};

module.exports = audit;
