// server/routes/chatRoutes.js - NO GATES VERSION (Everything Works)

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Chat routes working!',
        timestamp: new Date().toISOString()
    });
});

// Main chat endpoint - NO SUBSCRIPTION CHECK
router.post('/message', auth, async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ 
                success: false,
                error: 'Message is required' 
            });
        }

        console.log('💬 Chat:', message);

        const systemPrompt = `You are a stock market analyst. Answer questions directly and specifically.

CRITICAL RULES:
- NEVER say "I'm here to help" or "Feel free to ask" or "What would you like to know"
- ANSWER THE EXACT QUESTION ASKED
- Be specific about the stock/topic mentioned
- Give real analysis with price levels and opinions

If asked about SPY: Talk about the S&P 500 ETF specifically, mention current levels, trend, key support/resistance
If asked "should I buy": Give yes/no/maybe with 2-3 specific reasons
If asked about Tesla: Analyze TSLA specifically with recent price action

Answer directly and specifically now:`;

        const messages = [];
        
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.slice(-10).forEach(msg => {
                messages.push({ role: msg.role, content: msg.content });
            });
        }
        
        messages.push({ role: 'user', content: message });

        console.log('🤖 Calling Claude...');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            temperature: 1.0,
            system: systemPrompt,
            messages: messages,
        });

        const aiResponse = response.content[0].text;
        
        console.log('✅ Response:', aiResponse.substring(0, 100));

        res.json({
            success: true,
            response: aiResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;