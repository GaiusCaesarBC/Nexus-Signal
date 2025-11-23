// server/routes/predictionsRoutes.js - WITH CRYPTO AUTO-DETECTION FIX

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Prediction = require('../models/Prediction');
const GamificationService = require('../services/gamificationService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const USE_MOCK_PREDICTIONS = process.env.USE_MOCK_PREDICTIONS === 'true' || false;

// ✅ List of known crypto symbols for auto-detection
const CRYPTO_SYMBOLS = [
    'BTC', 'ETH', 'XRP', 'LTC', 'ADA', 'SOL', 'DOGE', 'DOT',
    'BNB', 'LINK', 'UNI', 'MATIC', 'SHIB', 'TRX', 'AVAX', 'ATOM', 'XMR'
];

// Mock prediction generator
function generateMockPrediction(symbol, days) {
    const basePrice = Math.random() * 500 + 50;
    const direction = Math.random() > 0.5 ? 'UP' : 'DOWN';
    const changePercent = (Math.random() * 10 - 5).toFixed(2);
    const targetPrice = basePrice * (1 + parseFloat(changePercent) / 100);
    const confidence = (Math.random() * 30 + 70).toFixed(1);

    return {
        symbol: symbol.toUpperCase(),
        current_price: parseFloat(basePrice.toFixed(2)),
        prediction: {
            target_price: parseFloat(targetPrice.toFixed(2)),
            direction: direction,
            price_change: parseFloat((targetPrice - basePrice).toFixed(2)),
            price_change_percent: parseFloat(changePercent),
            confidence: parseFloat(confidence),
            days: days
        },
        analysis: {
            trend: direction === 'UP' ? 'Bullish' : 'Bearish',
            volatility: 'Moderate',
            risk_level: 'Medium'
        },
        timestamp: new Date().toISOString()
    };
}

// @route   POST /api/predictions/predict
// @desc    Get prediction for a single stock/crypto and save it
// @access  Private
router.post('/predict', auth, async (req, res) => {
    try {
        let { symbol, days = 7, assetType } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        // ✅ AUTO-DETECT: If no assetType provided, detect based on symbol
        if (!assetType) {
            const upperSymbol = symbol.toUpperCase();
            assetType = CRYPTO_SYMBOLS.includes(upperSymbol) ? 'crypto' : 'stock';
            console.log(`[Predictions] Auto-detected ${symbol} as ${assetType}`);
        }

        console.log(`[Predictions] Getting prediction for ${symbol} (${assetType})`);
        
        let predictionData;
        
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for ${symbol}`);
            predictionData = generateMockPrediction(symbol, days);
        } else {
            try {
                const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
                
                // ✅ Use correct endpoint based on asset type
                const endpoint = assetType === 'crypto' 
                    ? `/api/crypto/prediction/${symbol}?range=6M`
                    : `/api/stocks/prediction/${symbol}?range=6M`;
                
                console.log(`[Predictions] Calling: ${baseUrl}${endpoint}`);
                const response = await axios.get(`${baseUrl}${endpoint}`);
                
                predictionData = {
                    symbol: response.data.symbol,
                    current_price: response.data.currentPrice,
                    prediction: {
                        target_price: response.data.predictedPrice,
                        direction: response.data.predictedDirection === 'Up' ? 'UP' : 'DOWN',
                        price_change: response.data.predictedPrice - response.data.currentPrice,
                        price_change_percent: response.data.percentageChange,
                        confidence: response.data.confidence,
                        days: days
                    },
                    analysis: {
                        trend: response.data.predictedDirection === 'Up' ? 'Bullish' : 'Bearish',
                        volatility: 'Moderate',
                        risk_level: 'Medium',
                        message: response.data.message
                    },
                    indicators: response.data.indicators
                };
                
            } catch (mlError) {
                console.log(`[Predictions] API failed, using mock data:`, mlError.message);
                predictionData = generateMockPrediction(symbol, days);
            }
        }
        
        // Save prediction to database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        const prediction = new Prediction({
            user: req.user.id,
            symbol: symbol.toUpperCase(),
            assetType,
            currentPrice: predictionData.current_price,
            targetPrice: predictionData.prediction.target_price,
            direction: predictionData.prediction.direction,
            priceChange: predictionData.prediction.price_change,
            priceChangePercent: predictionData.prediction.price_change_percent,
            confidence: predictionData.prediction.confidence,
            timeframe: days,
            indicators: predictionData.indicators || {},
            analysis: {
                trend: predictionData.analysis?.trend || (predictionData.prediction.direction === 'UP' ? 'Bullish' : 'Bearish'),
                volatility: predictionData.analysis?.volatility || 'Moderate',
                riskLevel: predictionData.analysis?.risk_level || 'Medium',
                message: predictionData.analysis?.message || 'Prediction generated'
            },
            expiresAt
        });
        
        await prediction.save();
        
        console.log(`[Predictions] Saved prediction ${prediction._id} for ${symbol} (${assetType})`);
        
        // 🎮 GAMIFICATION: Track prediction creation
        try {
            await GamificationService.trackPrediction(req.user.id);
            await GamificationService.awardXP(req.user.id, 15, `Prediction created for ${symbol}`);
        } catch (error) {
            console.warn('Failed to track prediction in gamification:', error.message);
        }
        
        res.json({
            ...predictionData,
            predictionId: prediction._id
        });
        
    } catch (error) {
        console.error('[Predictions] Error:', error.message);
        return res.status(500).json({
            error: 'Prediction service error',
            message: error.message
        });
    }
});

// @route   GET /api/predictions/recent
// @desc    Get recent predictions for user
// @access  Private
router.get('/recent', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const predictions = await Prediction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        res.json(predictions);
    } catch (error) {
        console.error('[Predictions] Error fetching recent:', error.message);
        res.status(500).json({ error: 'Failed to fetch recent predictions' });
    }
});

// @route   GET /api/predictions/stats
// @desc    Get user's prediction statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = await Prediction.getUserAccuracy(req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('[Predictions] Error fetching stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch prediction stats' });
    }
});

// @route   GET /api/predictions/platform-stats
// @desc    Get platform-wide prediction statistics (PUBLIC - no auth needed)
// @access  Public
router.get('/platform-stats', async (req, res) => {
    try {
        const stats = await Prediction.getPlatformAccuracy();
        
        res.json({
            success: true,
            accuracy: stats.accuracy || 0,
            totalPredictions: stats.totalPredictions || 0,
            correctPredictions: stats.correctPredictions || 0
        });
    } catch (error) {
        console.error('[Predictions] Error fetching platform stats:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch platform stats',
            accuracy: 0,
            totalPredictions: 0,
            correctPredictions: 0
        });
    }
});

// @route   GET /api/predictions/trending
// @desc    Get trending predictions
// @access  Public
router.get('/trending', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const trending = await Prediction.getTrending(parseInt(limit));
        res.json(trending);
    } catch (error) {
        console.error('[Predictions] Error fetching trending:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending predictions' });
    }
});

// @route   POST /api/predictions/batch
// @desc    Get predictions for multiple stocks
// @access  Private
router.post('/batch', auth, async (req, res) => {
    try {
        let { symbols, days = 7, assetType } = req.body;
        
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }

        // ✅ Auto-detect asset type for batch if not provided
        if (!assetType) {
            const firstSymbol = symbols[0].toUpperCase();
            assetType = CRYPTO_SYMBOLS.includes(firstSymbol) ? 'crypto' : 'stock';
            console.log(`[Predictions] Batch auto-detected as ${assetType}`);
        }

        console.log(`[Predictions] Batch prediction for ${symbols.length} symbols (${assetType})`);
        
        let predictionsData;
        
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for batch`);
            predictionsData = {
                predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
            };
        } else {
            try {
                const response = await axios.post(`${ML_SERVICE_URL}/predict/batch`, {
                    symbols: symbols.map(s => s.toUpperCase()),
                    days
                }, {
                    timeout: 60000
                });
                
                predictionsData = response.data;
                
            } catch (mlError) {
                console.log(`[Predictions] ML service failed for batch, using mock data`);
                
                predictionsData = {
                    predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
                };
            }
        }
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        const savedPredictions = [];
        
        for (const predData of predictionsData.predictions) {
            const prediction = new Prediction({
                user: req.user.id,
                symbol: predData.symbol,
                assetType,
                currentPrice: predData.current_price,
                targetPrice: predData.prediction.target_price,
                direction: predData.prediction.direction,
                priceChange: predData.prediction.price_change,
                priceChangePercent: predData.prediction.price_change_percent,
                confidence: predData.prediction.confidence,
                timeframe: days,
                analysis: predData.analysis,
                expiresAt
            });
            
            await prediction.save();
            savedPredictions.push(prediction._id);
        }
        
        console.log(`[Predictions] Saved ${savedPredictions.length} batch predictions`);
        
        // 🎮 GAMIFICATION: Award XP for batch prediction
        try {
            const xpAmount = symbols.length * 10;
            await GamificationService.awardXP(req.user.id, xpAmount, `Batch prediction for ${symbols.length} symbols`);
        } catch (error) {
            console.warn('Failed to award XP:', error.message);
        }
        
        res.json({
            ...predictionsData,
            predictionIds: savedPredictions
        });
        
    } catch (error) {
        console.error('[Predictions] Batch error:', error.message);
        return res.status(500).json({
            error: 'Batch prediction error',
            message: error.message
        });
    }
});

// @route   POST /api/predictions/:id/like
// @desc    Like a prediction
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
    try {
        const prediction = await Prediction.findById(req.params.id);
        
        if (!prediction) {
            return res.status(404).json({ error: 'Prediction not found' });
        }
        
        const alreadyLiked = prediction.likes.some(
            like => like.toString() === req.user.id
        );
        
        if (alreadyLiked) {
            prediction.likes = prediction.likes.filter(
                like => like.toString() !== req.user.id
            );
            prediction.likesCount = Math.max(0, prediction.likesCount - 1);
        } else {
            prediction.likes.push(req.user.id);
            prediction.likesCount += 1;
        }
        
        await prediction.save();
        
        res.json({ 
            liked: !alreadyLiked,
            likesCount: prediction.likesCount 
        });
        
    } catch (error) {
        console.error('[Predictions] Like error:', error.message);
        res.status(500).json({ error: 'Failed to like prediction' });
    }
});

// @route   POST /api/predictions/:id/comment
// @desc    Comment on a prediction
// @access  Private
router.post('/:id/comment', auth, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text is required' });
        }
        
        const prediction = await Prediction.findById(req.params.id);
        
        if (!prediction) {
            return res.status(404).json({ error: 'Prediction not found' });
        }
        
        const comment = {
            user: req.user.id,
            text: text.trim(),
            createdAt: Date.now()
        };
        
        prediction.comments.push(comment);
        await prediction.save();
        
        res.json(comment);
        
    } catch (error) {
        console.error('[Predictions] Comment error:', error.message);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// @route   GET /api/predictions/health
// @desc    Check ML service health
// @access  Private
router.get('/health', auth, async (req, res) => {
    try {
        const response = await axios.get(`${ML_SERVICE_URL}/health`, {
            timeout: 5000
        });
        
        res.json({
            ml_service: 'healthy',
            mock_mode: USE_MOCK_PREDICTIONS,
            ...response.data
        });
        
    } catch (error) {
        res.json({
            ml_service: 'unhealthy',
            mock_mode: USE_MOCK_PREDICTIONS,
            error: error.message,
            note: USE_MOCK_PREDICTIONS ? 'Using mock predictions as fallback' : 'ML service unavailable'
        });
    }
});

// 🧪 TEST ENDPOINT - Expire all pending predictions
router.post('/test/expire-all', auth, async (req, res) => {
    try {
        const predictions = await Prediction.find({ 
            user: req.user.id,
            status: 'pending' 
        });
        
        console.log(`[TEST] Found ${predictions.length} pending predictions`);
        
        const result = await Prediction.updateMany(
            { user: req.user.id, status: 'pending' },
            { 
                $set: { 
                    expiresAt: new Date()
                } 
            }
        );
        
        console.log(`[TEST] Set expiresAt to now for ${result.modifiedCount} predictions`);
        
        res.json({ 
            success: true, 
            found: predictions.length,
            expired: result.modifiedCount,
            message: 'Predictions set to expire now'
        });
    } catch (error) {
        console.error('[TEST] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;