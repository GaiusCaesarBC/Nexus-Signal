// server/routes/sentimentRoutes.js - REAL StockTwits + REAL AI Predictions

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stocktwitsService = require('../services/stocktwitsService');
const sentimentTracker = require('../utils/sentimentTracker');
const axios = require('axios');

// ============ ML SERVICE CONFIG ============
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://nexus-signal-ml.onrender.com';

// ============ HELPER FUNCTIONS ============

// Get REAL prediction from ML service
async function getPrediction(symbol, token) {
    try {
        console.log(`[Sentiment] Fetching REAL AI prediction for ${symbol}...`);
        
        // Call the actual ML prediction service
        const response = await axios.post(
            `${ML_SERVICE_URL}/predict`,
            {
                symbol: symbol.toUpperCase(),
                days: 7,
                type: isCrypto(symbol) ? 'crypto' : 'stock'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout for ML processing
            }
        );

        if (response.data && response.data.prediction) {
            console.log(`[Sentiment] ✅ REAL prediction received for ${symbol}`);
            return {
                symbol: symbol.toUpperCase(),
                current_price: response.data.current_price || response.data.prediction.current_price,
                prediction: {
                    target_price: response.data.prediction.target_price,
                    direction: response.data.prediction.direction,
                    price_change: response.data.prediction.price_change,
                    price_change_percent: response.data.prediction.price_change_percent,
                    confidence: response.data.prediction.confidence,
                    days: response.data.prediction.days || 7
                },
                analysis: response.data.analysis || {
                    trend: response.data.prediction.direction === 'UP' ? 'Bullish' : 'Bearish',
                    volatility: 'Moderate',
                    risk_level: 'Medium'
                },
                indicators: response.data.indicators || null,
                timestamp: new Date().toISOString(),
                source: 'ml_service'
            };
        }
        
        console.log(`[Sentiment] ⚠️ ML service returned no prediction data`);
        return null;
        
    } catch (error) {
        console.log(`[Sentiment] ⚠️ ML prediction failed for ${symbol}:`, error.message);
        
        // Try backup prediction endpoint if main one fails
        try {
            console.log(`[Sentiment] Trying backup prediction method...`);
            const backupResponse = await axios.get(
                `${ML_SERVICE_URL}/quick-predict/${symbol.toUpperCase()}`,
                { timeout: 15000 }
            );
            
            if (backupResponse.data) {
                console.log(`[Sentiment] ✅ Backup prediction received for ${symbol}`);
                return backupResponse.data;
            }
        } catch (backupError) {
            console.log(`[Sentiment] ⚠️ Backup prediction also failed:`, backupError.message);
        }
        
        return null;
    }
}

// Detect if symbol is crypto
function isCrypto(symbol) {
    const cryptoSymbols = [
        'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'DOT', 'MATIC', 'SHIB',
        'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL',
        'THETA', 'XMR', 'AAVE', 'EOS', 'MKR', 'XTZ', 'NEO', 'CAKE', 'COMP', 'SNX'
    ];
    const upperSymbol = symbol.toUpperCase().replace('.X', '');
    return cryptoSymbols.includes(upperSymbol) || symbol.toUpperCase().endsWith('.X');
}

// ============ ROUTES ============

// @route   GET /api/sentiment/search/:symbol
// @desc    Get REAL sentiment from StockTwits + REAL AI Prediction
// @access  Private
router.get('/search/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        
        console.log(`\n[Sentiment] ===== Analyzing ${symbol.toUpperCase()} with REAL DATA + REAL AI =====`);
        
        // Get real messages from StockTwits AND real prediction in parallel
        const [messages, prediction] = await Promise.all([
            stocktwitsService.getSymbolStream(symbol, 30),
            getPrediction(symbol, req.headers.authorization)
        ]);
        
        console.log(`[Sentiment] StockTwits: ${messages?.length || 0} messages`);
        console.log(`[Sentiment] Prediction: ${prediction ? '✅ Available' : '❌ Not available'}`);
        
        if (!messages || messages.length === 0) {
            return res.json({
                success: true,
                symbol: symbol.toUpperCase(),
                type: isCrypto(symbol) ? 'crypto' : 'stock',
                sentiment: {
                    overall: 'neutral',
                    distribution: { bullish: 0, neutral: 100, bearish: 0 },
                    counts: { bullish: 0, neutral: 0, bearish: 0 },
                    confidence: 0
                },
                tweets: [],
                totalMentions: 0,
                prediction: prediction,
                message: 'No recent messages found for this symbol on StockTwits',
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
            bullish: analysis.bullishPercentage + '%',
            bearish: analysis.bearishPercentage + '%',
            neutral: analysis.neutralPercentage + '%',
            total: analysis.total,
            predictionAvailable: !!prediction,
            predictionSource: prediction?.source || 'none'
        });
        
        // Format for frontend
        const response = {
            success: true,
            symbol: symbol.toUpperCase(),
            type: isCrypto(symbol) ? 'crypto' : 'stock',
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
            prediction: prediction, // 🔥 REAL AI PREDICTION
            tweets: analysis.tweets,
            totalMentions: analysis.total,
            dataSource: 'stocktwits',
            predictionSource: prediction?.source || 'unavailable',
            timestamp: new Date()
        };
        
        console.log('[Sentiment] ===== Response Ready =====\n');
        
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
// @desc    Get REAL trending stocks from StockTwits
// @access  Private
router.get('/trending', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        console.log('[Sentiment] Fetching REAL trending from StockTwits...');
        
        const trending = await stocktwitsService.getTrending(parseInt(limit));
        
        console.log(`[Sentiment] ✅ Found ${trending.length} trending symbols`);
        
        res.json({
            success: true,
            trending,
            dataSource: 'stocktwits',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('[Sentiment] Trending error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending data',
            message: error.message
        });
    }
});

// @route   GET /api/sentiment/market
// @desc    Get aggregate platform-wide sentiment (LIVE TRACKING from user searches)
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
                topMentions: ['Platform-wide aggregate from user searches']
            },
            dataSource: 'aggregated_searches',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('[Sentiment] Market sentiment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market sentiment'
        });
    }
});

// @route   GET /api/sentiment/history/:symbol
// @desc    Historical sentiment (placeholder for future database storage)
// @access  Private
router.get('/history/:symbol', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            symbol: req.params.symbol.toUpperCase(),
            history: [],
            message: 'Historical sentiment tracking coming soon - requires database storage',
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
        console.log('[Sentiment] ✅ Stats reset by user');
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

// @route   GET /api/sentiment/health
// @desc    Check sentiment service health and data sources
// @access  Private
router.get('/health', auth, async (req, res) => {
    try {
        // Check StockTwits
        let stocktwitsStatus = 'unknown';
        try {
            await stocktwitsService.getTrending(1);
            stocktwitsStatus = 'connected';
        } catch (e) {
            stocktwitsStatus = 'error: ' + e.message;
        }

        // Check ML Service
        let mlStatus = 'unknown';
        try {
            const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
            mlStatus = mlResponse.data?.status || 'connected';
        } catch (e) {
            mlStatus = 'error: ' + e.message;
        }

        res.json({
            success: true,
            services: {
                stocktwits: stocktwitsStatus,
                mlService: mlStatus,
                mlServiceUrl: ML_SERVICE_URL
            },
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

module.exports = router;