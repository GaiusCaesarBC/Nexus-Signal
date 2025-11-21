// server/routes/predictionsRoutes.js - WITH MOCK FALLBACK

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

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

// @route   GET /api/predictions/recent
// @desc    Get recent predictions for user
// @access  Private
router.get('/recent', auth, async (req, res) => {
    try {
        // For now, return empty array or mock data
        // Later you can store predictions in DB
        res.json([]);
    } catch (error) {
        console.error('[Predictions] Error fetching recent:', error.message);
        res.status(500).json({ error: 'Failed to fetch recent predictions' });
    }
});

// @route   POST /api/predictions/predict
// @desc    Get prediction for a single stock
// @access  Private
router.post('/predict', auth, async (req, res) => {
    try {
        const { symbol, days = 7 } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        console.log(`[Predictions] Getting prediction for ${symbol}`);
        
        // If mock mode is enabled, return mock data immediately
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for ${symbol}`);
            const mockData = generateMockPrediction(symbol, days);
            return res.json(mockData);
        }
        
        try {
            // Try to call ML service
            const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
                symbol: symbol.toUpperCase(),
                days
            }, {
                timeout: 30000 // 30 second timeout
            });
            
            res.json(response.data);
            
        } catch (mlError) {
            // If ML service fails, fall back to mock data
            console.log(`[Predictions] ML service failed for ${symbol}, using mock data`);
            console.log(`[Predictions] ML Error: ${mlError.message}`);
            
            const mockData = generateMockPrediction(symbol, days);
            return res.json(mockData);
        }
        
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
        const { symbols, days = 7 } = req.body;
        
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }

        console.log(`[Predictions] Batch prediction for ${symbols.length} symbols`);
        
        // If mock mode is enabled, return mock data immediately
        if (USE_MOCK_PREDICTIONS) {
            console.log(`[Predictions] Using mock data for batch`);
            const mockData = {
                predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
            };
            return res.json(mockData);
        }
        
        try {
            // Try to call ML service batch endpoint
            const response = await axios.post(`${ML_SERVICE_URL}/predict/batch`, {
                symbols: symbols.map(s => s.toUpperCase()),
                days
            }, {
                timeout: 60000 // 60 second timeout for batch
            });
            
            res.json(response.data);
            
        } catch (mlError) {
            // If ML service fails, fall back to mock data
            console.log(`[Predictions] ML service failed for batch, using mock data`);
            
            const mockData = {
                predictions: symbols.map(symbol => generateMockPrediction(symbol, days))
            };
            return res.json(mockData);
        }
        
    } catch (error) {
        console.error('[Predictions] Batch error:', error.message);
        return res.status(500).json({
            error: 'Batch prediction error',
            message: error.message
        });
    }
});

// @route   POST /api/predictions/analyze
// @desc    Get deep analysis with AI insights
// @access  Private
router.post('/analyze', auth, async (req, res) => {
    try {
        const { symbol } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        console.log(`[Predictions] Deep analysis for ${symbol}`);
        
        // If mock mode is enabled, return mock data immediately
        if (USE_MOCK_PREDICTIONS) {
            const mockData = {
                ...generateMockPrediction(symbol, 7),
                detailed_analysis: {
                    technical_indicators: {
                        rsi: (Math.random() * 40 + 30).toFixed(2),
                        macd: 'Positive',
                        moving_average: 'Above 50-day MA'
                    },
                    fundamentals: {
                        pe_ratio: (Math.random() * 30 + 10).toFixed(2),
                        market_cap: `${(Math.random() * 1000 + 100).toFixed(2)}B`
                    }
                }
            };
            return res.json(mockData);
        }
        
        try {
            // Call ML service analyze endpoint
            const response = await axios.post(`${ML_SERVICE_URL}/analyze`, {
                symbol: symbol.toUpperCase()
            }, {
                timeout: 45000 // 45 second timeout (AI takes time)
            });
            
            res.json(response.data);
            
        } catch (mlError) {
            // Fall back to basic prediction with analysis
            console.log(`[Predictions] ML analysis failed for ${symbol}, using mock data`);
            
            const mockData = {
                ...generateMockPrediction(symbol, 7),
                detailed_analysis: {
                    technical_indicators: {
                        rsi: (Math.random() * 40 + 30).toFixed(2),
                        macd: 'Positive',
                        moving_average: 'Above 50-day MA'
                    },
                    fundamentals: {
                        pe_ratio: (Math.random() * 30 + 10).toFixed(2),
                        market_cap: `${(Math.random() * 1000 + 100).toFixed(2)}B`
                    }
                }
            };
            return res.json(mockData);
        }
        
    } catch (error) {
        console.error('[Predictions] Analysis error:', error.message);
        return res.status(500).json({
            error: 'Analysis service error',
            message: error.message
        });
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

module.exports = router;