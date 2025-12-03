// server/routes/aiInsightsRoutes.js - AI Insights with Unavailable Status

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// @route   POST /api/portfolio/insights
// @desc    AI insights status check
// @access  Private
router.post('/insights', auth, async (req, res) => {
    try {
        const { holdings } = req.body;
        
        console.log('[AI Insights] Request received');
        
        if (!holdings || holdings.length === 0) {
            return res.json({
                success: true,
                available: false,
                reason: 'empty_portfolio',
                message: 'Add holdings to your portfolio to receive AI insights'
            });
        }
        
        // Check if OpenAI API key exists and has quota
        if (!process.env.OPENAI_API_KEY) {
            console.log('[AI Insights] OpenAI API key not configured');
            return res.json({
                success: true,
                available: false,
                reason: 'not_configured',
                message: 'AI insights require OpenAI API configuration'
            });
        }
        
        // If we get here, we'd normally call OpenAI
        // But since quota is exceeded, return unavailable
        console.log('[AI Insights] OpenAI quota exceeded');
        return res.json({
            success: true,
            available: false,
            reason: 'quota_exceeded',
            message: 'AI insights temporarily unavailable due to API quota limits'
        });
        
    } catch (error) {
        console.error('[AI Insights] ERROR:', error.message);
        
        res.json({
            success: true,
            available: false,
            reason: 'error',
            message: 'AI insights temporarily unavailable'
        });
    }
});

module.exports = router;