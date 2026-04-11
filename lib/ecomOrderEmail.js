const sendEmail = require('../utils/sendEmail');

const FROM_NAME = process.env.FROM_NAME || 'Orinket Store';

function statusSubject(status, orderNumber) {
    const label = orderNumber ? `Order ${orderNumber}` : 'Your order';
    const map = {
        confirmed: `${label} confirmed`,
        packed: `${label} is being packed`,
        shipped: `${label} has been shipped`,
        delivered: `${label} has been delivered`,
        cancelled: `${label} has been cancelled`,
        return_requested: `Return requested for ${label}`,
        returned: `Return received for ${label}`,
        refunded: `Refund processed for ${label}`,
    };
    return map[status] || `${label} — status update`;
}

function statusHtml(status, order) {
    const orderNumber = order.orderNumber || String(order._id);
    const name = order.shippingAddress?.name || order.user?.name || 'Customer';
    const totalAmount = Number(order.totalAmount || 0).toLocaleString('en-IN');
    const trackingUrl = order.trackingUrl || '';
    const cancelReason = order.cancelReason || '';

    const baseStyle = `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;`;
    const headerStyle = `background: #1a1a1a; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;`;
    const bodyStyle = `background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;`;
    const badgeColors = {
        confirmed: '#2563eb',
        packed: '#0891b2',
        shipped: '#7c3aed',
        delivered: '#16a34a',
        cancelled: '#dc2626',
        return_requested: '#d97706',
        returned: '#6b7280',
        refunded: '#10b981',
    };
    const badgeColor = badgeColors[status] || '#6b7280';

    const statusMessages = {
        confirmed: `Great news! Your order has been confirmed and is being prepared for you.`,
        packed: `Your items have been carefully packed and are ready for dispatch.`,
        shipped: `Your order is on its way! ${trackingUrl ? `Track it here: <a href="${trackingUrl}" style="color:#2563eb;">${trackingUrl}</a>` : 'Tracking information will be shared soon.'}`,
        delivered: `Your order has been successfully delivered. We hope you love your purchase! If you have any issues, please contact us within 7 days to request a return.`,
        cancelled: `Your order has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''} If you have any questions, please reach out to our support team.`,
        return_requested: `We've received your return request and our team will review it shortly.`,
        returned: `We've received your returned items and are processing your refund.`,
        refunded: `Your refund has been processed. Please allow 5–7 business days for it to reflect in your account.`,
    };

    const message = statusMessages[status] || `Your order status has been updated.`;

    return `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <h1 style="margin:0; font-size:22px; letter-spacing:1px;">${FROM_NAME}</h1>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px; margin-bottom:4px;">Hi ${name},</p>
    <p style="font-size:14px; color:#555; margin-bottom:20px;">${message}</p>

    <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:16px; margin-bottom:20px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:6px 0; color:#888;">Order Number</td>
          <td style="padding:6px 0; font-weight:bold; text-align:right;">${orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#888;">Status</td>
          <td style="padding:6px 0; text-align:right;">
            <span style="background:${badgeColor}; color:#fff; padding:3px 10px; border-radius:12px; font-size:12px; text-transform:capitalize;">${status.replace(/_/g, ' ')}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#888;">Total Amount</td>
          <td style="padding:6px 0; font-weight:bold; text-align:right;">Rs ${totalAmount}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:12px; color:#999; margin-top:24px; border-top:1px solid #e0e0e0; padding-top:16px;">
      This is an automated email from ${FROM_NAME}. Please do not reply to this email.
      If you need help, contact our support team.
    </p>
  </div>
</div>`;
}

/**
 * Send order status update email to customer.
 * Silently swallows errors so a failed email never breaks the order flow.
 * @param {object} order - Mongoose lean order document
 * @param {string} status - new status string
 */
async function sendOrderStatusEmail(order, status) {
    try {
        const email =
            order.shippingAddress?.email ||
            order.user?.email ||
            null;
        if (!email) return;

        const NOTIFIABLE = new Set([
            'confirmed', 'packed', 'shipped', 'delivered',
            'cancelled', 'return_requested', 'returned', 'refunded',
        ]);
        if (!NOTIFIABLE.has(status)) return;

        await sendEmail({
            email,
            subject: statusSubject(status, order.orderNumber),
            html: statusHtml(status, order),
        });
    } catch (_e) {
        // Never block the order flow for email failure
        console.error('[ecomOrderEmail] Failed to send status email:', _e?.message || _e);
    }
}

module.exports = { sendOrderStatusEmail };
