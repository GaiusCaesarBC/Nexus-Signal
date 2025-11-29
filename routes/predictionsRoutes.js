// server/routes/predictionsRoutes.js - REFACTORED TO USE CENTRALIZED PRICE SERVICE

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Prediction = require('../models/Prediction');
const GamificationService = require('../services/gamificationService');

// ✅ USE CENTRALIZED PRICE SERVICE
const priceService = require('../services/priceService');

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

// ============ LIVE PREDICTION HELPERS ============

// Helper function to calculate live confidence based on actual movement
function calculateLiveConfidence(prediction, currentPrice) {
    const originalConfidence = prediction.confidence;
    const targetPrice = prediction.targetPrice;
    const startPrice = prediction.currentPrice;
    
    // How far have we moved toward the target?
    const targetMovement = targetPrice - startPrice;
    const actualMovement = currentPrice - startPrice;
    
    // If prediction was UP
    if (prediction.direction === 'UP') {
        if (actualMovement > 0) {
            // Moving in right direction - confidence increases
            const progress = Math.min(actualMovement / targetMovement, 1);
            return Math.min(95, originalConfidence + (progress * 20));
        } else {
            // Moving wrong direction - confidence decreases
            const wrongProgress = Math.abs(actualMovement / targetMovement);
            return Math.max(30, originalConfidence - (wrongProgress * 30));
        }
    }
    
    // If prediction was DOWN
    if (prediction.direction === 'DOWN') {
        if (actualMovement < 0) {
            // Moving in right direction - confidence increases
            const progress = Math.min(Math.abs(actualMovement / targetMovement), 1);
            return Math.min(95, originalConfidence + (progress * 20));
        } else {
            // Moving wrong direction - confidence decreases
            const wrongProgress = actualMovement / Math.abs(targetMovement);
            return Math.max(30, originalConfidence - (wrongProgress * 30));
        }
    }
    
    return originalConfidence;
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

        // ✅ AUTO-DETECT using centralized service
        if (!assetType) {
            assetType = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
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
                
                // Use correct endpoint based on asset type
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
            predictionId: prediction._id,
            _id: prediction._id
        });
        
    } catch (error) {
        console.error('[Predictions] Error:', error.message);
        return res.status(500).json({
            error: 'Prediction service error',
            message: error.message
        });
    }
});

// @route   GET /api/predictions/live/:id
// @desc    Get live prediction update with current confidence
// @access  Private
router.get('/live/:id', auth, async (req, res) => {
    try {
        console.log(`[Live] Request for prediction ${req.params.id}`);
        
        const prediction = await Prediction.findById(req.params.id);
        
        if (!prediction) {
            console.log(`[Live] Prediction not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Prediction not found' });
        }

        // Check if user owns this prediction
        if (prediction.user.toString() !== req.user.id) {
            console.log(`[Live] Unauthorized access attempt`);
            return res.status(403).json({ error: 'Not authorized' });
        }

        console.log(`[Live] Found prediction for ${prediction.symbol} (${prediction.assetType})`);

        // ✅ USE CENTRALIZED PRICE SERVICE
        let currentPrice;
        try {
            const priceResult = await priceService.getCurrentPrice(prediction.symbol, prediction.assetType);
            currentPrice = priceResult.price;
            console.log(`[Live] Current price for ${prediction.symbol}: $${currentPrice} (source: ${priceResult.source})`);
        } catch (priceError) {
            console.error('[Live] Error fetching price:', priceError);
            currentPrice = null;
        }

        // If we couldn't get current price, use original price as fallback
        if (!currentPrice) {
            console.log(`[Live] Using fallback price for ${prediction.symbol}`);
            currentPrice = prediction.currentPrice;
        }

        // Calculate live confidence based on movement
        const liveConfidence = calculateLiveConfidence(prediction, currentPrice);
        
        // Calculate time remaining
        const now = Date.now();
        const timeRemaining = Math.max(0, prediction.expiresAt - now);
        const hasExpired = timeRemaining === 0;

        console.log(`[Live] Time remaining: ${timeRemaining}ms (${Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))} days)`);

        // If expired and not checked yet, calculate outcome
        if (hasExpired && prediction.status === 'pending') {
            console.log(`[Live] Prediction expired, calculating outcome...`);
            await prediction.calculateOutcome(currentPrice);
        }

        const response = {
            success: true,
            prediction: {
                ...prediction.toObject(),
                livePrice: currentPrice,
                liveConfidence,
                liveChange: currentPrice - prediction.currentPrice,
                liveChangePercent: ((currentPrice - prediction.currentPrice) / prediction.currentPrice) * 100,
                timeRemaining,
                hasExpired,
                daysRemaining: Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))
            }
        };

        console.log(`[Live] ✅ Returning live data with confidence: ${liveConfidence.toFixed(1)}%`);
        
        res.json(response);
    } catch (error) {
        console.error('[Live] Error getting live prediction:', error);
        res.status(500).json({ error: 'Failed to get live prediction' });
    }
});

// @route   POST /api/predictions/check-outcomes
// @desc    Check all user's pending predictions and update expired ones
// @access  Private
router.post('/check-outcomes', auth, async (req, res) => {
    try {
        const predictions = await Prediction.find({
            user: req.user.id,
            status: 'pending',
            expiresAt: { $lt: Date.now() }
        });

        const results = [];

        for (const prediction of predictions) {
            try {
                // ✅ USE CENTRALIZED PRICE SERVICE
                const currentPrice = await priceService.getPrice(prediction.symbol, prediction.assetType);

                if (!currentPrice) {
                    console.log(`[Check] Skipping ${prediction.symbol} - no price available`);
                    continue;
                }

                // Calculate outcome
                await prediction.calculateOutcome(currentPrice);
                
                results.push({
                    symbol: prediction.symbol,
                    wasCorrect: prediction.outcome.wasCorrect,
                    accuracy: prediction.outcome.accuracy
                });

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`[Check] Error checking ${prediction.symbol}:`, error);
            }
        }

        res.json({
            success: true,
            checkedCount: results.length,
            results
        });
    } catch (error) {
        console.error('[Check] Error checking outcomes:', error);
        res.status(500).json({ error: 'Failed to check outcomes' });
    }
});

// @route   GET /api/predictions/history
// @desc    Get user's prediction history with outcomes
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const { limit = 20, status } = req.query;
        
        const query = { user: req.user.id };
        if (status) {
            query.status = status;
        }

        const predictions = await Prediction.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            predictions
        });
    } catch (error) {
        console.error('[Predictions] Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch prediction history' });
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


// @route   GET /api/predictions/user
// @desc    Get current user's predictions summary (for profile/dashboard)
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        // Get user's recent predictions
        const predictions = await Prediction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        // Get user's stats
        const stats = await Prediction.getUserAccuracy(req.user.id);
        
        // Count by status
        const statusCounts = await Prediction.aggregate([
            { $match: { user: req.user.id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        const counts = {
            pending: 0,
            correct: 0,
            incorrect: 0,
            total: 0
        };
        
        statusCounts.forEach(item => {
            counts[item._id] = item.count;
            counts.total += item.count;
        });
        
        res.json({
            success: true,
            predictions,
            stats: {
                accuracy: stats.accuracy || 0,
                totalPredictions: stats.totalPredictions || counts.total,
                correctPredictions: stats.correctPredictions || counts.correct,
                pendingPredictions: counts.pending
            }
        });
    } catch (error) {
        console.error('[Predictions] Error fetching user predictions:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch user predictions',
            predictions: [],
            stats: {
                accuracy: 0,
                totalPredictions: 0,
                correctPredictions: 0,
                pendingPredictions: 0
            }
        });
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

        // ✅ Auto-detect asset type using centralized service
        if (!assetType) {
            const firstSymbol = symbols[0].toUpperCase();
            assetType = priceService.isCryptoSymbol(firstSymbol) ? 'crypto' : 'stock';
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
        
        // ✅ Include price service cache stats
        const cacheStats = priceService.getCacheStats();
        
        res.json({
            ml_service: 'healthy',
            mock_mode: USE_MOCK_PREDICTIONS,
            price_cache: cacheStats,
            ...response.data
        });
        
    } catch (error) {
        const cacheStats = priceService.getCacheStats();
        
        res.json({
            ml_service: 'unhealthy',
            mock_mode: USE_MOCK_PREDICTIONS,
            price_cache: cacheStats,
            error: error.message,
            note: USE_MOCK_PREDICTIONS ? 'Using mock predictions as fallback' : 'ML service unavailable'
        });
    }
});

// ✅ MANUAL PREDICTION CHECK - Check expired predictions on demand
router.post('/check-expired', auth, async (req, res) => {
    try {
        console.log(`[API] 🔧 Manual prediction check requested by user ${req.user.id}`);
        
        const { manualCheck, getCheckerStats } = require('../services/predictionChecker');
        
        // Run the check
        await manualCheck();
        
        // Get updated stats
        const stats = getCheckerStats();
        
        // Refresh user's stats
        const userStats = await Prediction.getUserAccuracy(req.user.id);
        
        console.log(`[API] ✅ Manual check complete. User accuracy: ${userStats.accuracy.toFixed(1)}%`);
        
        res.json({
            success: true,
            message: 'Manual prediction check completed successfully',
            checkerStats: stats,
            yourStats: userStats
        });
    } catch (error) {
        console.error('[API] ❌ Error in manual prediction check:', error);
        res.status(500).json({
            success: false,
            error: error.message
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

// ✅ NEW: Get current price for any symbol (utility endpoint)
router.get('/price/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { type } = req.query;
        
        const result = await priceService.getCurrentPrice(symbol, type);
        
        if (result.price === null) {
            return res.status(404).json({ 
                success: false, 
                error: `Could not fetch price for ${symbol}` 
            });
        }
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            price: result.price,
            source: result.source,
            cached: result.cached,
            isCrypto: priceService.isCryptoSymbol(symbol)
        });
    } catch (error) {
        console.error('[Predictions] Price fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// ADD THIS to server/routes/predictionsRoutes.js
// GET /api/predictions/stats - Get prediction statistics (public, no auth)
router.get('/stats', async (req, res) => {
    try {
        // Count all predictions
        const totalPredictions = await Prediction.countDocuments();
        
        // Count resolved predictions (correct + incorrect)
        const resolvedPredictions = await Prediction.countDocuments({
            status: { $in: ['correct', 'incorrect'] }
        });
        
        // Count correct predictions
        const correctPredictions = await Prediction.countDocuments({
            status: 'correct'
        });
        
        // Calculate accuracy
        const accuracy = resolvedPredictions > 0 
            ? Math.round((correctPredictions / resolvedPredictions) * 1000) / 10 
            : 0;
        
        res.json({
            success: true,
            totalPredictions,
            resolvedPredictions,
            correctPredictions,
            accuracy
        });
        
    } catch (error) {
        console.error('[Predictions] Stats error:', error.message);
        res.status(500).json({ success: false, totalPredictions: 0, resolvedPredictions: 0, correctPredictions: 0, accuracy: 0 });
    }
});

// ADD THIS to server/routes/predictionsRoutes.js
// GET /api/predictions/stats - Get prediction statistics (public, no auth)
router.get('/stats', async (req, res) => {
    try {
        // Count all predictions
        const totalPredictions = await Prediction.countDocuments();
        
        // Count resolved predictions (correct + incorrect)
        const resolvedPredictions = await Prediction.countDocuments({
            status: { $in: ['correct', 'incorrect'] }
        });
        
        // Count correct predictions
        const correctPredictions = await Prediction.countDocuments({
            status: 'correct'
        });
        
        // Calculate accuracy
        const accuracy = resolvedPredictions > 0 
            ? Math.round((correctPredictions / resolvedPredictions) * 1000) / 10 
            : 0;
        
        res.json({
            success: true,
            totalPredictions,
            resolvedPredictions,
            correctPredictions,
            accuracy
        });
        
    } catch (error) {
        console.error('[Predictions] Stats error:', error.message);
        res.status(500).json({ success: false, totalPredictions: 0, resolvedPredictions: 0, correctPredictions: 0, accuracy: 0 });
    }
});

module.exports = router;