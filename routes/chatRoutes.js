// server/routes/chatRoutes.js - AI Chat Route with Claude API + Chart Integration

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/subscriptionMiddleware');
const Anthropic = require('@anthropic-ai/sdk');
const { getChartData } = require('../services/chartService');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============ CHART HELPERS ============

// Extract chart markers from AI response [CHART:SYMBOL:TIMEFRAME]
const extractChartMarkers = (text) => {
    const chartRegex = /\[CHART:([A-Z0-9\-]+)(?::(\w+))?\]/g;
    const markers = [];
    let match;

    while ((match = chartRegex.exec(text)) !== null) {
        markers.push({
            fullMatch: match[0],
            symbol: match[1].toUpperCase(),
            timeframe: match[2] || '1D'
        });
    }

    return markers;
};

// Fetch chart data for all markers
const fetchChartsForMarkers = async (markers) => {
    const charts = [];

    for (const marker of markers) {
        try {
            console.log(`[Chat] 📊 Fetching chart for ${marker.symbol} (${marker.timeframe})`);
            const chartResult = await getChartData(marker.symbol, marker.timeframe);

            if (chartResult.success && chartResult.data.length > 0) {
                // Get last 30 data points for a clean mini chart
                const miniData = chartResult.data.slice(-30);
                const latestPrice = miniData[miniData.length - 1]?.close || 0;
                const firstPrice = miniData[0]?.close || 0;
                const priceChange = latestPrice - firstPrice;
                const priceChangePercent = firstPrice > 0 ? ((priceChange / firstPrice) * 100) : 0;

                charts.push({
                    symbol: marker.symbol,
                    timeframe: marker.timeframe,
                    data: miniData,
                    currentPrice: latestPrice,
                    priceChange,
                    priceChangePercent,
                    isPositive: priceChange >= 0
                });
                console.log(`[Chat] ✅ Chart fetched for ${marker.symbol}: $${latestPrice.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
            }
        } catch (error) {
            console.error(`[Chat] ❌ Failed to fetch chart for ${marker.symbol}:`, error.message);
            // Don't include failed charts - just skip
        }
    }

    return charts;
};

// @route   POST /api/chat/message
// @desc    Send a message to Claude AI and get response
// @access  Private (Pro+ required)
// @route   POST /api/chat/message
// @desc    Send a message to Claude AI and get response
// @access  Private (Pro+ required)
router.post('/message', auth, requireFeature('hasAIChat'), async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;  // ✅ GET HISTORY

        if (!message || message.trim() === '') {
            return res.status(400).json({ msg: 'Message is required' });
        }

        console.log('💬 Chat request from user:', req.user.id);
        console.log('📝 Message:', message);
        console.log('📚 History length:', conversationHistory?.length || 0);

        // Fetch current market data for context
        let marketContext = '';
        try {
            const now = new Date();
            const marketHours = now.getUTCHours();
            const isMarketOpen = marketHours >= 13 && marketHours < 21;
            
            marketContext = `
Current Market Status: ${isMarketOpen ? 'OPEN' : 'CLOSED'}
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
`;
        } catch (error) {
            console.log('Could not fetch market context');
        }

        // Create system prompt with chart marker instructions
        const systemPrompt = `You are Nexus AI Assistant, an expert AI trading assistant for Nexus Signal AI.

${marketContext}

Your knowledge includes:
- Stock market analysis and predictions
- Portfolio optimization strategies
- Technical and fundamental analysis
- Market trends and sector insights
- Risk management and diversification
- Trading strategies for various market conditions

CRITICAL:
- Answer the SPECIFIC question asked - don't give generic responses
- If asked about a specific stock (like AAPL, TSLA, NVDA), provide analysis for THAT stock
- Provide different answers for different questions
- Be conversational and remember context from previous messages

User: ${req.user.name}

CHART FEATURE:
When discussing a specific stock or crypto, include a chart marker to show a price chart.
Format: [CHART:SYMBOL] or [CHART:SYMBOL:TIMEFRAME]
Examples:
- [CHART:AAPL] - Shows Apple daily chart
- [CHART:TSLA:1W] - Shows Tesla weekly chart
- [CHART:BTC-USD] - Shows Bitcoin daily chart
- [CHART:NVDA:1M] - Shows NVIDIA monthly chart

Timeframes: 1D (daily, default), 1W (weekly), 1M (monthly)

WHEN TO USE CHARTS:
- When analyzing a specific stock's price action
- When asked "how is X doing" or "should I buy X"
- When discussing technical analysis of a specific ticker
- When comparing performance (show chart for main stock discussed)
- DO NOT use charts for general market questions or educational content

Place the chart marker on its own line, usually after your initial analysis paragraph.

Guidelines:
- Keep responses under 300 words
- Use emojis strategically (1-3 per response)
- Format with bullet points when listing items
- Provide balanced bull/bear perspectives for stocks
- Mention Nexus Signal features when relevant

Answer the user's question directly and specifically.`;

        console.log('🤖 Sending to Claude API...');

        // ✅ BUILD MESSAGES ARRAY WITH HISTORY
        const messages = [];
        
        // Add conversation history if exists
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }
        
        // Add current message
        messages.push({
            role: 'user',
            content: message
        });

        console.log('📨 Total messages being sent:', messages.length);

        // Call Claude API with full conversation
        const claudeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages,  // ✅ FULL CONVERSATION
        });

        console.log('✅ Got response from Claude');

        // Extract text from Claude's response
        let aiResponse = claudeResponse.content[0].text;

        // Extract chart markers and fetch chart data
        const chartMarkers = extractChartMarkers(aiResponse);
        let charts = [];

        if (chartMarkers.length > 0) {
            console.log(`[Chat] 📊 Found ${chartMarkers.length} chart marker(s):`, chartMarkers.map(m => m.symbol));

            // Fetch chart data for all markers
            charts = await fetchChartsForMarkers(chartMarkers);

            // Remove chart markers from the text (frontend will render actual charts)
            chartMarkers.forEach(marker => {
                aiResponse = aiResponse.replace(marker.fullMatch, '').trim();
            });

            // Clean up any double newlines left behind
            aiResponse = aiResponse.replace(/\n{3,}/g, '\n\n');
        }

        // Return the response with charts
        res.json({
            response: aiResponse,
            charts: charts,
            timestamp: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514'
        });

    } catch (error) {
        console.error('❌ Chat error:', error.message);
        console.error('Full error:', error);

        const fallbackResponse = `I'm having trouble connecting right now. Here are some quick suggestions:

- 📈 Visit the Predictions page for AI stock forecasts
- 💼 Check your Portfolio for detailed analysis
- 👀 Add stocks to your Watchlist for tracking
- 📊 View the Dashboard for market overview

What would you like to explore?`;

        res.json({
            response: fallbackResponse,
            charts: [],
            timestamp: new Date().toISOString(),
            error: 'AI service temporarily unavailable'
        });
    }
});
// @route   POST /api/chat/conversation
// @desc    Have a multi-turn conversation with Claude (with history)
// @access  Private (Pro+ required)
router.post('/conversation', auth, requireFeature('hasAIChat'), async (req, res) => {
    try {
        const { messages } = req.body; // Array of {role, content} objects

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ msg: 'Messages array is required' });
        }

        console.log('💬 Conversation request from user:', req.user.id);
        console.log('📝 Messages count:', messages.length);

        const systemPrompt = `You are Nexus AI Assistant for Nexus Signal AI platform. 
        
User: ${req.user.name} (${req.user.email})

Provide helpful stock market insights, predictions, and trading advice.`;

        console.log('🤖 Sending conversation to Claude API...');

        // Call Claude API with conversation history
        const claudeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages, // Full conversation history
        });

        console.log('✅ Got response from Claude');

        const aiResponse = claudeResponse.content[0].text;

        res.json({
            response: aiResponse,
            timestamp: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514'
        });

    } catch (error) {
        console.error('❌ Conversation error:', error.message);
        res.status(500).json({ 
            msg: 'Error processing conversation',
            error: error.message 
        });
    }
});

// @route   GET /api/chat/history
// @desc    Get chat history for user (placeholder for future implementation)
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        // TODO: Implement chat history from database
        // For now, return empty array
        res.json({ 
            messages: [],
            note: 'Chat history feature coming soon!'
        });
    } catch (error) {
        console.error('Chat history error:', error);
        res.status(500).json({ msg: 'Error fetching chat history' });
    }
});

// @route   DELETE /api/chat/history
// @desc    Clear chat history for user
// @access  Private
router.delete('/history', auth, async (req, res) => {
    try {
        // TODO: Implement chat history deletion
        res.json({ 
            success: true,
            msg: 'Chat history cleared'
        });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ msg: 'Error clearing chat history' });
    }
});

module.exports = router;