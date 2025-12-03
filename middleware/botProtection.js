// server/middleware/botProtection.js
// Vercel Bot Protection Middleware

const botProtection = (strictness = 'medium') => {
    return (req, res, next) => {
        const botScore = parseInt(req.headers['x-vercel-bot-score']) || 0;
        const botType = req.headers['x-vercel-bot-type'] || 'UNKNOWN';
        
        // Define thresholds based on strictness
        const thresholds = {
            low: 90,      // Only block obvious bots
            medium: 70,   // Block likely bots
            high: 50      // Strict - block suspicious activity
        };
        
        const threshold = thresholds[strictness] || 70;
        
        // Log for monitoring
        if (botScore > 30) {
            console.log(`[BotProtection] Score: ${botScore}, Type: ${botType}, Path: ${req.path}, IP: ${req.ip}`);
        }
        
        // Block high-confidence bots
        if (botScore > threshold) {
            console.warn(`[BotProtection] BLOCKED - Score: ${botScore}, Type: ${botType}, Path: ${req.path}`);
            return res.status(403).json({ 
                success: false,
                error: 'Access denied',
                code: 'BOT_DETECTED'
            });
        }
        
        // Flag suspicious requests (let them through but mark them)
        if (botType === 'LIKELY_AUTOMATED' || botScore > 50) {
            req.suspiciousRequest = true;
        }
        
        next();
    };
};

// Strict protection for auth routes
const strictBotProtection = botProtection('high');

// Medium protection for general API
const mediumBotProtection = botProtection('medium');

// Light protection for public routes
const lightBotProtection = botProtection('low');

module.exports = {
    botProtection,
    strictBotProtection,
    mediumBotProtection,
    lightBotProtection
};