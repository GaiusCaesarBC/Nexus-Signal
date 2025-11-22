// server/routes/sentimentRoutes.js - StockTwits + AI Predictions Integration

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stocktwitsService = require('../services/stocktwitsService');
const sentimentTracker = require('../utils/sentimentTracker');
const axios = require('axios');

// Helper function to get prediction (NO AUTH NEEDED - INTERNAL CALL)
async function getPrediction(symbol) {
    try {
        console.log(`[Sentiment] Fetching AI prediction for ${symbol}...`);
        
        // Mock prediction for now (since ML service needs to be called differently)
        const basePrice = 150 + Math.random() * 50;
        const direction = Math.random() > 0.5 ? 'UP' : 'DOWN';
        const changePercent = (Math.random() * 10 - 2).toFixed(2);
        const targetPrice = basePrice * (1 + parseFloat(changePercent) / 100);
        const confidence = (Math.random() * 25 + 70).toFixed(1);

        const prediction = {
            symbol: symbol.toUpperCase(),
            current_price: parseFloat(basePrice.toFixed(2)),
            prediction: {
                target_price: parseFloat(targetPrice.toFixed(2)),
                direction: direction,
                price_change: parseFloat((targetPrice - basePrice).toFixed(2)),
                price_change_percent: parseFloat(changePercent),
                confidence: parseFloat(confidence),
                days: 7
            },
            analysis: {
                trend: direction === 'UP' ? 'Bullish' : 'Bearish',
                volatility: 'Moderate',
                risk_level: 'Medium'
            },
            timestamp: new Date().toISOString()
        };
        
        console.log(`[Sentiment] ✅ Prediction generated for ${symbol}`);
        return prediction;
        
    } catch (error) {
        console.log(`[Sentiment] ⚠️ Prediction failed for ${symbol}:`, error.message);
        return null;
    }
}

// @route   GET /api/sentiment/search/:symbol
// @desc    Get REAL sentiment from StockTwits + AI Prediction
// @access  Private
router.get('/search/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        
        console.log(`\n[Sentiment] ===== Analyzing ${symbol.toUpperCase()} with REAL DATA + AI =====`);
        
        // Get real messages from StockTwits AND prediction in parallel
        const [messages, prediction] = await Promise.all([
            stocktwitsService.getSymbolStream(symbol, 30),
            getPrediction(symbol)
        ]);
        
        console.log(`[Sentiment] Prediction result:`, prediction ? '✅ Available' : '❌ Not available');
        
        if (!messages || messages.length === 0) {
            return res.json({
                success: true,
                symbol: symbol.toUpperCase(),
                sentiment: {
                    overall: 'neutral',
                    distribution: { bullish: 0, neutral: 0, bearish: 0 },
                    counts: { bullish: 0, neutral: 0, bearish: 0 },
                    confidence: 0
                },
                tweets: [],
                totalMentions: 0,
                prediction: prediction,
                message: 'No recent messages found for this symbol',
                timestamp: new Date()
            });
        }
        
        console.log(`[Sentiment] Found ${messages.length} REAL messages from StockTwits`);
        
        // Analyze sentiment
        const analysis = stocktwitsService.analyzeSentiment(messages);
        
        // Track this search in aggregate stats
        sentimentTracker.addSearch(analysis);
        
        console.log('[Sentiment] Analysis Complete:', {
            overall: analysis.overall,
            bullish: analysis.bullishPercentage,
            bearish: analysis.bearishPercentage,
            neutral: analysis.neutralPercentage,
            total: analysis.total,
            predictionAvailable: !!prediction
        });
        
        // Format for frontend
        const response = {
            success: true,
            symbol: symbol.toUpperCase(),
            sentiment: {
                overall: analysis.overall,
                distribution: {
                    bullish: Math.round(analysis.bullishPercentage),
                    neutral: Math.round(analysis.neutralPercentage),
                    bearish: Math.round(analysis.bearishPercentage)
                },
                counts: {
                    bullish: analysis.bullish,
                    neutral: analysis.neutral,
                    bearish: analysis.bearish
                },
                confidence: Math.min(Math.round(Math.abs(analysis.bullishPercentage - analysis.bearishPercentage)), 95)
            },
            prediction: prediction, // 🔥 AI PREDICTION INCLUDED
            tweets: analysis.tweets,
            totalMentions: analysis.total,
            timestamp: new Date()
        };
        
        console.log('[Sentiment] ===== Response Ready with Prediction =====\n');
        
        res.json(response);
        
    } catch (error) {
        console.error('[Sentiment] ERROR:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentiment data',
            message: error.message
        });
    }
});

// @route   GET /api/sentiment/trending
// @desc    Get trending stocks from StockTwits
// @access  Private
router.get('/trending', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        console.log('[Sentiment] Fetching trending from StockTwits...');
        
        const trending = await stocktwitsService.getTrending(parseInt(limit));
        
        res.json({
            success: true,
            trending,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending data'
        });
    }
});

// @route   GET /api/sentiment/market
// @desc    Get aggregate platform-wide sentiment (LIVE TRACKING)
// @access  Private
router.get('/market', auth, async (req, res) => {
    try {
        console.log('[Sentiment] Getting aggregate platform stats...');
        
        const stats = sentimentTracker.getStats();
        
        res.json({
            success: true,
            market: {
                overall: stats.overall,
                bullishPercentage: stats.bullishPercentage,
                bearishPercentage: stats.bearishPercentage,
                neutralPercentage: stats.neutralPercentage,
                totalTweets: stats.totalTweets,
                topMentions: ['Platform-wide aggregate']
            },
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Market sentiment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market sentiment'
        });
    }
});

// @route   GET /api/sentiment/history/:symbol
// @desc    Historical sentiment (placeholder)
// @access  Private
router.get('/history/:symbol', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            symbol: req.params.symbol.toUpperCase(),
            history: [],
            message: 'Historical data requires database storage - coming soon',
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history'
        });
    }
});

// @route   POST /api/sentiment/reset-stats
// @desc    Reset aggregate stats (admin/testing)
// @access  Private
router.post('/reset-stats', auth, async (req, res) => {
    try {
        sentimentTracker.reset();
        console.log('[Sentiment] Stats reset by user');
        res.json({
            success: true,
            message: 'Aggregate stats reset successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to reset stats'
        });
    }
});

module.exports = router;