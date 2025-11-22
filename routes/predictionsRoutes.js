// server/routes/predictionsRoutes.js - WITH DATABASE STORAGE

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Prediction = require('../models/Prediction');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const USE_MOCK_PREDICTIONS = process.env.USE_MOCK_PREDICTIONS === 'true' || false;

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
// @desc    Get prediction for a single stock and save it
// @access  Private
router.post('/predict', auth, async (req, res) => {
    try {
        const { symbol, days = 7, assetType = 'stock' } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        console.log(`[Predictions] Getting prediction for ${symbol}`);
        
        let predictionData;
        
        // If mock mode is enabled, use mock data
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for ${symbol}`);
            predictionData = generateMockPrediction(symbol, days);
        } else {
            try {
                // Try to call stock/crypto prediction endpoint
                const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
                const endpoint = assetType === 'crypto' 
                    ? `/api/crypto/prediction/${symbol}?range=6M`
                    : `/api/stocks/prediction/${symbol}?range=6M`;
                
                console.log(`[Predictions] Calling: ${baseUrl}${endpoint}`);
                const response = await axios.get(`${baseUrl}${endpoint}`);
                
                // Transform the response to match our expected format
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
                // If API fails, fall back to mock data
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
            priceChange: predictionData.prediction.price_change, // ✅ FIXED - Now included
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
        
        console.log(`[Predictions] Saved prediction ${prediction._id} for ${symbol}`);
        
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
            // Return defaults on error
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

// @route   POST /api/predictions/predict
// @desc    Get prediction for a single stock and save it
// @access  Private
router.post('/predict', auth, async (req, res) => {
    try {
        const { symbol, days = 7, assetType = 'stock', indicators = {} } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        console.log(`[Predictions] Getting prediction for ${symbol}`);
        
        let predictionData;
        
        // If mock mode is enabled, return mock data immediately
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for ${symbol}`);
            predictionData = generateMockPrediction(symbol, days);
        } else {
            try {
                // Try to call ML service
                const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
                    symbol: symbol.toUpperCase(),
                    days
                }, {
                    timeout: 30000 // 30 second timeout
                });
                
                predictionData = response.data;
                
            } catch (mlError) {
                // If ML service fails, fall back to mock data
                console.log(`[Predictions] ML service failed for ${symbol}, using mock data`);
                console.log(`[Predictions] ML Error: ${mlError.message}`);
                
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
            indicators: indicators,
            analysis: predictionData.analysis,
            expiresAt
        });
        
        await prediction.save();
        
        console.log(`[Predictions] Saved prediction ${prediction._id} for ${symbol}`);
        
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

// @route   POST /api/predictions/batch
// @desc    Get predictions for multiple stocks
// @access  Private
router.post('/batch', auth, async (req, res) => {
    try {
        const { symbols, days = 7, assetType = 'stock' } = req.body;
        
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }

        console.log(`[Predictions] Batch prediction for ${symbols.length} symbols`);
        
        let predictionsData;
        
        // If mock mode is enabled, return mock data immediately
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for batch`);
            predictionsData = {
                predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
            };
        } else {
            try {
                // Try to call ML service batch endpoint
                const response = await axios.post(`${ML_SERVICE_URL}/predict/batch`, {
                    symbols: symbols.map(s => s.toUpperCase()),
                    days
                }, {
                    timeout: 60000 // 60 second timeout for batch
                });
                
                predictionsData = response.data;
                
            } catch (mlError) {
                // If ML service fails, fall back to mock data
                console.log(`[Predictions] ML service failed for batch, using mock data`);
                
                predictionsData = {
                    predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
                };
            }
        }
        
        // Save all predictions to database
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
        
        // Check if already liked
        const alreadyLiked = prediction.likes.some(
            like => like.toString() === req.user.id
        );
        
        if (alreadyLiked) {
            // Unlike
            prediction.likes = prediction.likes.filter(
                like => like.toString() !== req.user.id
            );
            prediction.likesCount = Math.max(0, prediction.likesCount - 1);
        } else {
            // Like
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
            userId: req.user.id, 
            status: 'pending' 
        });
        
        console.log(`[TEST] Found ${predictions.length} pending predictions`);
        
        // Expire them all
        const result = await Prediction.updateMany(
            { userId: req.user.id, status: 'pending' },
            { 
                $set: { 
                    expiresAt: new Date(),
                    status: 'expired'
                } 
            }
        );
        
        console.log(`[TEST] Expired ${result.modifiedCount} predictions`);
        
        res.json({ 
            success: true, 
            found: predictions.length,
            expired: result.modifiedCount,
            message: 'Predictions expired for testing'
        });
    } catch (error) {
        console.error('[TEST] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;