// server/routes/predictionsRoutes.js - REAL DATA VERSION - NO MOCK BULLSHIT

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const stockDataService = require('../services/stockDataService');
const cryptoDataService = require('../services/cryptoDataService');
const predictionEngine = require('../services/predictionEngine');

/**
 * Detect if symbol is crypto or stock
 */
function isCrypto(symbol) {
    const cryptoSymbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 
                          'AVAX', 'DOGE', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 
                          'LTC', 'SHIB', 'TRX', 'APT', 'ARB'];
    return cryptoSymbols.includes(symbol.toUpperCase());
}

/**
 * @route   POST /api/predictions/predict
 * @desc    Generate REAL stock/crypto prediction
 * @access  Private
 */
router.post('/predict', auth, async (req, res) => {
    try {
        const { symbol, days = 7 } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ 
                success: false,
                error: 'Symbol is required' 
            });
        }

        const upperSymbol = symbol.toUpperCase();
        console.log(`\n🔮 Generating REAL prediction for ${upperSymbol} (${days} days)`);
        
        const isCryptoAsset = isCrypto(upperSymbol);
        
        try {
            let currentData, historicalData, indicators;
            
            if (isCryptoAsset) {
                console.log('💰 Fetching crypto data from CoinGecko...');
                
                // Get current crypto price
                currentData = await cryptoDataService.getCurrentPrice(upperSymbol);
                
                // Get historical data (need at least 60 days for good predictions)
                historicalData = await cryptoDataService.getHistoricalData(upperSymbol, Math.max(60, days * 3));
                
                // Calculate indicators
                indicators = cryptoDataService.calculateIndicators(historicalData);
                
                console.log(`✅ Crypto data fetched: $${currentData.price.toFixed(2)}`);
                
            } else {
                console.log('📈 Fetching stock data from Alpha Vantage...');
                
                // Get current stock price
                currentData = await stockDataService.getCurrentPrice(upperSymbol);
                
                // Get historical data (need at least 60 days for good predictions)
                historicalData = await stockDataService.getHistoricalData(upperSymbol, Math.max(60, days * 3));
                
                // Calculate indicators
                indicators = stockDataService.calculateIndicators(historicalData);
                
                console.log(`✅ Stock data fetched: $${currentData.price.toFixed(2)}`);
            }

            // Generate ML prediction
            console.log('🤖 Running ML prediction engine...');
            const prediction = predictionEngine.predictPrice(historicalData, parseInt(days));
            
            // Analyze trend
            const trendAnalysis = predictionEngine.analyzeTrend(historicalData, indicators);
            
            // Calculate risk
            const riskLevel = predictionEngine.calculateRiskLevel(prediction.volatility, parseInt(days));
            
            // Support/Resistance levels
            const levels = predictionEngine.calculateSupportResistance(historicalData);
            
            console.log(`✅ Prediction complete: ${prediction.direction} to $${prediction.target_price.toFixed(2)}`);
            console.log(`   Confidence: ${prediction.confidence.toFixed(1)}%`);
            console.log(`   Change: ${prediction.price_change_percent >= 0 ? '+' : ''}${prediction.price_change_percent.toFixed(2)}%\n`);
            
            // Build response
            const response = {
                success: true,
                symbol: upperSymbol,
                asset_type: isCryptoAsset ? 'crypto' : 'stock',
                current_price: currentData.price,
                prediction: {
                    target_price: parseFloat(prediction.target_price.toFixed(2)),
                    direction: prediction.direction,
                    price_change: parseFloat(prediction.price_change.toFixed(2)),
                    price_change_percent: parseFloat(prediction.price_change_percent.toFixed(2)),
                    confidence: parseFloat(prediction.confidence.toFixed(1)),
                    days: parseInt(days)
                },
                analysis: {
                    trend: trendAnalysis.sentiment,
                    strength: trendAnalysis.strength,
                    risk_level: riskLevel,
                    volatility: (prediction.volatility * 100).toFixed(2) + '%',
                    r_squared: (prediction.r_squared * 100).toFixed(1) + '%'
                },
                indicators: indicators,
                levels: {
                    resistance: [levels.resistance1, levels.resistance2].map(v => parseFloat(v.toFixed(2))),
                    support: [levels.support1, levels.support2].map(v => parseFloat(v.toFixed(2)))
                },
                chart_data: prediction.prediction_path,
                timestamp: new Date().toISOString(),
                data_source: isCryptoAsset ? 'CoinGecko Pro' : 'Alpha Vantage'
            };

            res.json(response);
            
        } catch (dataError) {
            console.error(`❌ Data fetch error for ${upperSymbol}:`, dataError.message);
            
            // Return helpful error message
            return res.status(500).json({
                success: false,
                error: `Failed to fetch data for ${upperSymbol}`,
                message: dataError.message,
                suggestion: 'Please check if the symbol is correct and try again'
            });
        }
        
    } catch (error) {
        console.error('❌ Prediction error:', error);
        res.status(500).json({
            success: false,
            error: 'Prediction service error',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/predictions/batch
 * @desc    Get predictions for multiple stocks/cryptos
 * @access  Private
 */
router.post('/batch', auth, async (req, res) => {
    try {
        const { symbols, days = 7 } = req.body;
        
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Symbols array is required' 
            });
        }

        if (symbols.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 symbols per batch'
            });
        }

        console.log(`\n🔮 Batch prediction for ${symbols.length} symbols`);

        const predictions = [];
        const errors = [];

        // Process each symbol
        for (const symbol of symbols) {
            try {
                const upperSymbol = symbol.toUpperCase();
                const isCryptoAsset = isCrypto(upperSymbol);
                
                let currentData, historicalData, indicators;
                
                if (isCryptoAsset) {
                    currentData = await cryptoDataService.getCurrentPrice(upperSymbol);
                    historicalData = await cryptoDataService.getHistoricalData(upperSymbol, 60);
                    indicators = cryptoDataService.calculateIndicators(historicalData);
                } else {
                    currentData = await stockDataService.getCurrentPrice(upperSymbol);
                    historicalData = await stockDataService.getHistoricalData(upperSymbol, 60);
                    indicators = stockDataService.calculateIndicators(historicalData);
                }

                const prediction = predictionEngine.predictPrice(historicalData, parseInt(days));
                const trendAnalysis = predictionEngine.analyzeTrend(historicalData, indicators);
                
                predictions.push({
                    symbol: upperSymbol,
                    asset_type: isCryptoAsset ? 'crypto' : 'stock',
                    current_price: currentData.price,
                    target_price: parseFloat(prediction.target_price.toFixed(2)),
                    direction: prediction.direction,
                    change_percent: parseFloat(prediction.price_change_percent.toFixed(2)),
                    confidence: parseFloat(prediction.confidence.toFixed(1)),
                    trend: trendAnalysis.sentiment
                });
                
                console.log(`✅ ${upperSymbol}: ${prediction.direction} ${prediction.price_change_percent >= 0 ? '+' : ''}${prediction.price_change_percent.toFixed(2)}%`);
                
            } catch (error) {
                console.error(`❌ Error with ${symbol}:`, error.message);
                errors.push({
                    symbol: symbol.toUpperCase(),
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            predictions,
            errors: errors.length > 0 ? errors : undefined,
            total: predictions.length,
            failed: errors.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Batch error:', error);
        res.status(500).json({
            success: false,
            error: 'Batch prediction error',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/predictions/history
 * @desc    Get prediction history (placeholder for now)
 * @access  Private
 */
router.get('/history', auth, async (req, res) => {
    try {
        // TODO: Store predictions in database and return user's history
        res.json({
            success: true,
            history: [],
            message: 'History feature coming soon'
        });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history'
        });
    }
});

/**
 * @route   GET /api/predictions/health
 * @desc    Check service health
 * @access  Private
 */
router.get('/health', auth, async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {}
    };

    // Test Alpha Vantage
    try {
        await stockDataService.getCurrentPrice('AAPL');
        health.services.alpha_vantage = 'operational';
    } catch (error) {
        health.services.alpha_vantage = 'error: ' + error.message;
        health.status = 'degraded';
    }

    // Test CoinGecko
    try {
        await cryptoDataService.getCurrentPrice('BTC');
        health.services.coingecko = 'operational';
    } catch (error) {
        health.services.coingecko = 'error: ' + error.message;
        health.status = 'degraded';
    }

    res.json(health);
});

/**
 * @route   GET /api/predictions/limits
 * @desc    Get prediction limits
 * @access  Private
 */
router.get('/limits', auth, async (req, res) => {
    res.json({
        success: true,
        data: {
            plan: 'unlimited',
            predictionsPerMonth: -1,
            used: 0,
            remaining: -1,
            unlimited: true,
            note: 'All limits removed for testing'
        }
    });
});

module.exports = router;