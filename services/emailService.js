// server/services/emailService.js - Email Service using SendGrid

const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'security@nexussignal.ai';
const FROM_NAME = 'Nexus Signal';

/**
 * Generate a random 6-digit verification code
 * @returns {string} 6-digit code
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send 2FA verification code via email
 * @param {string} email - Recipient email address
 * @param {string} code - Verification code
 * @param {string} username - User's username for personalization
 * @returns {Promise<boolean>} Success status
 */
async function send2FACode(email, code, username = 'Trader') {
    if (!process.env.SENDGRID_API_KEY) {
        console.error('[Email] SendGrid API key not configured');
        throw new Error('Email service not configured');
    }

    const msg = {
        to: email,
        from: {
            email: FROM_EMAIL,
            name: FROM_NAME
        },
        subject: `${code} - Your Nexus Signal Verification Code`,
        text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email or contact support if you have concerns.\n\n- The Nexus Signal Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(0, 173, 239, 0.3); max-width: 500px;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <div style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #00adef 0%, #00ff88 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                NEXUS SIGNAL
                            </div>
                            <div style="color: #64748b; font-size: 14px; margin-top: 8px;">
                                Two-Factor Authentication
                            </div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="color: #e0e6ed; font-size: 16px; margin: 0 0 20px;">
                                Hey ${username},
                            </p>
                            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 30px;">
                                Here's your verification code to complete your login:
                            </p>

                            <!-- Code Box -->
                            <div style="background: rgba(0, 173, 239, 0.1); border: 2px solid rgba(0, 173, 239, 0.4); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px;">
                                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00adef; font-family: 'Courier New', monospace;">
                                    ${code}
                                </div>
                            </div>

                            <p style="color: #64748b; font-size: 13px; margin: 0 0 10px; text-align: center;">
                                ⏱️ This code expires in <strong style="color: #f59e0b;">5 minutes</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Security Notice -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px;">
                                <p style="color: #f87171; font-size: 13px; margin: 0;">
                                    🔒 <strong>Security Notice:</strong> If you didn't request this code, someone may be trying to access your account. Please ignore this email and consider changing your password.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                            <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                                This is an automated message from Nexus Signal.<br>
                                Please do not reply to this email.
                            </p>
                            <p style="color: #475569; font-size: 11px; margin: 16px 0 0; text-align: center;">
                                © 2024 Nexus Signal. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`[Email] 2FA code sent to ${email}`);
        return true;
    } catch (error) {
        console.error('[Email] Error sending 2FA code:', error.message);
        if (error.response) {
            console.error('[Email] SendGrid error details:', error.response.body);
        }
        throw error;
    }
}

/**
 * Send welcome email after 2FA is enabled
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string} method - 2FA method enabled (email, sms, both)
 * @returns {Promise<boolean>} Success status
 */
async function send2FAEnabledNotification(email, username, method) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn('[Email] SendGrid API key not configured - skipping notification');
        return false;
    }

    const methodText = method === 'both' ? 'Email & SMS' : method.toUpperCase();

    const msg = {
        to: email,
        from: {
            email: FROM_EMAIL,
            name: FROM_NAME
        },
        subject: '🔒 Two-Factor Authentication Enabled - Nexus Signal',
        text: `Two-Factor Authentication has been enabled on your account.\n\nMethod: ${methodText}\n\nIf you didn't make this change, please contact support immediately.\n\n- The Nexus Signal Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3); max-width: 500px;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                            <div style="font-size: 24px; font-weight: 700; color: #10b981;">
                                2FA Enabled Successfully!
                            </div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 20px 40px 40px;">
                            <p style="color: #e0e6ed; font-size: 16px; margin: 0 0 20px; text-align: center;">
                                Hey ${username}, your account is now more secure!
                            </p>

                            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
                                <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px;">
                                    Authentication Method:
                                </p>
                                <p style="color: #10b981; font-size: 18px; font-weight: 700; margin: 0;">
                                    ${methodText}
                                </p>
                            </div>

                            <p style="color: #64748b; font-size: 13px; margin: 0; text-align: center;">
                                Make sure to keep your backup codes in a safe place. You can find them in your account settings.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                            <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                                If you didn't enable 2FA, please contact support immediately.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`[Email] 2FA enabled notification sent to ${email}`);
        return true;
    } catch (error) {
        console.error('[Email] Error sending 2FA enabled notification:', error.message);
        return false;
    }
}

/**
 * Send backup codes via email
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string[]} backupCodes - Array of backup codes
 * @returns {Promise<boolean>} Success status
 */
async function sendBackupCodes(email, username, backupCodes) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn('[Email] SendGrid API key not configured');
        return false;
    }

    const codesHtml = backupCodes.map(code =>
        `<div style="background: rgba(0, 173, 239, 0.1); padding: 8px 16px; border-radius: 6px; font-family: 'Courier New', monospace; color: #00adef; font-size: 14px; display: inline-block; margin: 4px;">${code}</div>`
    ).join('');

    const msg = {
        to: email,
        from: {
            email: FROM_EMAIL,
            name: FROM_NAME
        },
        subject: '🔑 Your Nexus Signal Backup Codes',
        text: `Your backup codes:\n\n${backupCodes.join('\n')}\n\nStore these codes in a safe place. Each code can only be used once.\n\n- The Nexus Signal Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(0, 173, 239, 0.3); max-width: 500px;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🔑</div>
                            <div style="font-size: 24px; font-weight: 700; color: #00adef;">
                                Your Backup Codes
                            </div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="color: #e0e6ed; font-size: 16px; margin: 0 0 20px; text-align: center;">
                                Hey ${username}, save these backup codes!
                            </p>

                            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(100, 116, 139, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
                                ${codesHtml}
                            </div>

                            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 16px;">
                                <p style="color: #fbbf24; font-size: 13px; margin: 0;">
                                    ⚠️ <strong>Important:</strong> Each code can only be used once. Store them somewhere safe - you'll need them if you lose access to your 2FA method.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                            <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                                Never share these codes with anyone.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`[Email] Backup codes sent to ${email}`);
        return true;
    } catch (error) {
        console.error('[Email] Error sending backup codes:', error.message);
        return false;
    }
}

/**
 * Send price alert notification via email
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {Object} alert - Alert object with details
 * @returns {Promise<boolean>} Success status
 */
async function sendPriceAlertEmail(email, username, alert) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn('[Email] SendGrid API key not configured - skipping alert email');
        return false;
    }

    // Determine alert type styling
    const isUp = alert.type === 'price_above';
    const emoji = isUp ? '🚀' : '📉';
    const color = isUp ? '#10b981' : '#ef4444';
    const direction = isUp ? 'above' : 'below';

    const formattedPrice = alert.triggeredPrice?.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: alert.triggeredPrice < 1 ? 8 : 2
    });

    const formattedTarget = alert.targetPrice?.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: alert.targetPrice < 1 ? 8 : 2
    });

    const msg = {
        to: email,
        from: {
            email: FROM_EMAIL,
            name: FROM_NAME
        },
        subject: `${emoji} ${alert.symbol} Price Alert - ${direction} ${formattedTarget}`,
        text: `${alert.symbol} has reached ${formattedPrice}!\n\nYour alert for ${alert.symbol} to go ${direction} ${formattedTarget} has been triggered.\n\nCurrent Price: ${formattedPrice}\nTarget: ${formattedTarget}\n\n- The Nexus Signal Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid ${color}40; max-width: 500px;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 16px;">${emoji}</div>
                            <div style="font-size: 28px; font-weight: 800; color: ${color};">
                                ${alert.symbol} ALERT
                            </div>
                            <div style="color: #64748b; font-size: 14px; margin-top: 8px;">
                                Price ${direction} target reached!
                            </div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="color: #e0e6ed; font-size: 16px; margin: 0 0 20px;">
                                Hey ${username},
                            </p>
                            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 30px;">
                                Your price alert for <strong style="color: ${color};">${alert.symbol}</strong> has been triggered!
                            </p>

                            <!-- Price Box -->
                            <div style="background: ${color}15; border: 2px solid ${color}40; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                                <div style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                                    Current Price
                                </div>
                                <div style="font-size: 32px; font-weight: 800; color: ${color};">
                                    ${formattedPrice}
                                </div>
                            </div>

                            <!-- Target Info -->
                            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                                <div style="background: rgba(100, 116, 139, 0.1); border-radius: 8px; padding: 16px; flex: 1; text-align: center;">
                                    <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Target</div>
                                    <div style="color: #e0e6ed; font-size: 16px; font-weight: 600;">${formattedTarget}</div>
                                </div>
                            </div>

                            ${alert.customMessage ? `
                            <div style="background: rgba(0, 173, 239, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                                <p style="color: #94a3b8; font-size: 13px; margin: 0; font-style: italic;">
                                    "${alert.customMessage}"
                                </p>
                            </div>
                            ` : ''}

                            <div style="text-align: center; margin-top: 24px;">
                                <a href="https://nexussignal.ai/predictions" style="display: inline-block; background: linear-gradient(135deg, #00adef 0%, #00ff88 100%); color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 14px;">
                                    View on Nexus Signal
                                </a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                            <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                                You received this because you set up a price alert on Nexus Signal.<br>
                                <a href="https://nexussignal.ai/settings" style="color: #00adef; text-decoration: none;">Manage your alerts</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`[Email] Price alert sent to ${email} for ${alert.symbol}`);
        return true;
    } catch (error) {
        console.error('[Email] Error sending price alert:', error.message);
        return false;
    }
}

module.exports = {
    generateVerificationCode,
    send2FACode,
    send2FAEnabledNotification,
    sendBackupCodes,
    sendPriceAlertEmail
};
