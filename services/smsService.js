// server/services/smsService.js - SMS Service using Twilio

const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
}

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Generate a random 6-digit verification code
 * @returns {string} 6-digit code
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If it starts with 1 and is 11 digits, it's already formatted (US)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }

    // If it's 10 digits, assume US and add +1
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }

    // If it already has +, return as-is
    if (phone.startsWith('+')) {
        return phone;
    }

    // Otherwise, add + prefix
    return `+${cleaned}`;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone number is valid
 */
function isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    // Must be at least 10 digits
    return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Send 2FA verification code via SMS
 * @param {string} phone - Recipient phone number
 * @param {string} code - Verification code
 * @returns {Promise<boolean>} Success status
 */
async function send2FACode(phone, code) {
    if (!twilioClient) {
        console.error('[SMS] Twilio not configured');
        throw new Error('SMS service not configured');
    }

    if (!FROM_PHONE) {
        console.error('[SMS] Twilio phone number not configured');
        throw new Error('SMS service not configured');
    }

    if (!isValidPhoneNumber(phone)) {
        throw new Error('Invalid phone number format');
    }

    const formattedPhone = formatPhoneNumber(phone);

    try {
        const message = await twilioClient.messages.create({
            body: `Your Nexus Signal verification code is: ${code}\n\nThis code expires in 5 minutes. Don't share this code with anyone.`,
            from: FROM_PHONE,
            to: formattedPhone
        });

        console.log(`[SMS] 2FA code sent to ${formattedPhone} (SID: ${message.sid})`);
        return true;
    } catch (error) {
        console.error('[SMS] Error sending 2FA code:', error.message);

        // Handle specific Twilio errors
        if (error.code === 21211) {
            throw new Error('Invalid phone number');
        } else if (error.code === 21608) {
            throw new Error('Phone number is not verified in Twilio trial');
        } else if (error.code === 21610) {
            throw new Error('Phone number has been unsubscribed');
        }

        throw error;
    }
}

/**
 * Send phone verification code for initial setup
 * @param {string} phone - Recipient phone number
 * @param {string} code - Verification code
 * @returns {Promise<boolean>} Success status
 */
async function sendPhoneVerificationCode(phone, code) {
    if (!twilioClient) {
        console.error('[SMS] Twilio not configured');
        throw new Error('SMS service not configured');
    }

    if (!FROM_PHONE) {
        console.error('[SMS] Twilio phone number not configured');
        throw new Error('SMS service not configured');
    }

    if (!isValidPhoneNumber(phone)) {
        throw new Error('Invalid phone number format');
    }

    const formattedPhone = formatPhoneNumber(phone);

    try {
        const message = await twilioClient.messages.create({
            body: `Nexus Signal: Your phone verification code is ${code}. This code expires in 10 minutes.`,
            from: FROM_PHONE,
            to: formattedPhone
        });

        console.log(`[SMS] Phone verification code sent to ${formattedPhone} (SID: ${message.sid})`);
        return true;
    } catch (error) {
        console.error('[SMS] Error sending phone verification code:', error.message);
        throw error;
    }
}

/**
 * Send 2FA enabled notification via SMS
 * @param {string} phone - Recipient phone number
 * @returns {Promise<boolean>} Success status
 */
async function send2FAEnabledNotification(phone) {
    if (!twilioClient || !FROM_PHONE) {
        console.warn('[SMS] Twilio not configured - skipping notification');
        return false;
    }

    const formattedPhone = formatPhoneNumber(phone);

    try {
        const message = await twilioClient.messages.create({
            body: `Nexus Signal: Two-Factor Authentication has been enabled on your account. If you didn't make this change, please contact support immediately.`,
            from: FROM_PHONE,
            to: formattedPhone
        });

        console.log(`[SMS] 2FA enabled notification sent to ${formattedPhone} (SID: ${message.sid})`);
        return true;
    } catch (error) {
        console.error('[SMS] Error sending 2FA notification:', error.message);
        return false;
    }
}

/**
 * Check if SMS service is available
 * @returns {boolean} Whether SMS service is configured
 */
function isAvailable() {
    return !!(twilioClient && FROM_PHONE);
}

module.exports = {
    generateVerificationCode,
    formatPhoneNumber,
    isValidPhoneNumber,
    send2FACode,
    sendPhoneVerificationCode,
    send2FAEnabledNotification,
    isAvailable
};
