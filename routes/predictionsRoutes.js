// server/routes/predictionsRoutes.js - WITH SHARED PREDICTIONS & ACCURATE PRICING

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Prediction = require('../models/Prediction');
const GamificationService = require('../services/gamificationService');

const priceService = require('../services/priceService');
const stockDataService = require('../services/stockDataService');
const fs = require('fs');
const path = require('path');

const DEBUG_LOG_PATH = path.resolve(__dirname, '..', '..', 'prediction_debug.log');

function appendDebugLog(label, obj) {
    try {
        const entry = `\n=== ${new Date().toISOString()} - ${label} ===\n` + (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)) + '\n';
        fs.appendFileSync(DEBUG_LOG_PATH, entry, { encoding: 'utf8' });
    } catch (e) {
        console.warn('[Predictions] Failed to write debug log:', e.message);
    }
}


// @route   GET /api/predictions/symbols/search
// @desc    Search for valid stock/crypto symbols
// @access  Public
router.get('/symbols/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        const query = (q || '').toUpperCase().trim();

        if (!query || query.length < 1) {
            return res.json({ symbols: [] });
        }

        const results = [];

        // Search crypto symbols
        if (!type || type === 'crypto' || type === 'all') {
            const cryptoSymbols = Array.from(priceService.CRYPTO_SYMBOLS);
            const matchingCrypto = cryptoSymbols.filter(s =>
                s.startsWith(query) || s.includes(query)
            ).slice(0, 20).map(s => ({
                symbol: s,
                name: priceService.COINGECKO_IDS[s] ?
                    priceService.COINGECKO_IDS[s].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : s,
                type: 'crypto'
            }));
            results.push(...matchingCrypto);
        }

        // Search popular stocks (hardcoded list for quick search)
        if (!type || type === 'stock' || type === 'all') {
            const popularStocks = [
                { symbol: 'AAPL', name: 'Apple Inc.' },
                { symbol: 'MSFT', name: 'Microsoft Corporation' },
                { symbol: 'GOOGL', name: 'Alphabet Inc.' },
                { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                { symbol: 'TSLA', name: 'Tesla Inc.' },
                { symbol: 'META', name: 'Meta Platforms Inc.' },
                { symbol: 'NVDA', name: 'NVIDIA Corporation' },
                { symbol: 'AMD', name: 'Advanced Micro Devices' },
                { symbol: 'NFLX', name: 'Netflix Inc.' },
                { symbol: 'DIS', name: 'Walt Disney Co.' },
                { symbol: 'BA', name: 'Boeing Company' },
                { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
                { symbol: 'V', name: 'Visa Inc.' },
                { symbol: 'MA', name: 'Mastercard Inc.' },
                { symbol: 'WMT', name: 'Walmart Inc.' },
                { symbol: 'JNJ', name: 'Johnson & Johnson' },
                { symbol: 'PG', name: 'Procter & Gamble' },
                { symbol: 'UNH', name: 'UnitedHealth Group' },
                { symbol: 'HD', name: 'Home Depot Inc.' },
                { symbol: 'INTC', name: 'Intel Corporation' },
                { symbol: 'CRM', name: 'Salesforce Inc.' },
                { symbol: 'PYPL', name: 'PayPal Holdings' },
                { symbol: 'COIN', name: 'Coinbase Global' },
                { symbol: 'SQ', name: 'Block Inc.' },
                { symbol: 'PLTR', name: 'Palantir Technologies' },
                { symbol: 'GME', name: 'GameStop Corp.' },
                { symbol: 'AMC', name: 'AMC Entertainment' },
                { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
                { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
                { symbol: 'ARKK', name: 'ARK Innovation ETF' }
            ];

            const matchingStocks = popularStocks.filter(s =>
                s.symbol.startsWith(query) || s.symbol.includes(query) ||
                s.name.toUpperCase().includes(query)
            ).slice(0, 20).map(s => ({ ...s, type: 'stock' }));
            results.push(...matchingStocks);
        }

        // Sort by exact match first, then alphabetically
        results.sort((a, b) => {
            if (a.symbol === query) return -1;
            if (b.symbol === query) return 1;
            if (a.symbol.startsWith(query) && !b.symbol.startsWith(query)) return -1;
            if (!a.symbol.startsWith(query) && b.symbol.startsWith(query)) return 1;
            return a.symbol.localeCompare(b.symbol);
        });

        res.json({
            symbols: results.slice(0, 30),
            query: query
        });

    } catch (error) {
        console.error('[Predictions] Symbol search error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// @route   GET /api/predictions/symbols/all
// @desc    Get all available symbols for predictions
// @access  Public
router.get('/symbols/all', (req, res) => {
    try {
        const cryptoSymbols = Array.from(priceService.CRYPTO_SYMBOLS).map(s => ({
            symbol: s,
            name: priceService.COINGECKO_IDS[s] || s,
            type: 'crypto'
        }));

        res.json({
            crypto: cryptoSymbols,
            cryptoCount: cryptoSymbols.length,
            note: 'Stocks can use any valid ticker symbol'
        });
    } catch (error) {
        console.error('[Predictions] Symbols list error:', error.message);
        res.status(500).json({ error: 'Failed to get symbols' });
    }
});

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const USE_MOCK_PREDICTIONS = process.env.USE_MOCK_PREDICTIONS === 'true' || false;

// ============ REAL-TIME PRICE FETCHING ============
// Fetch fresh price directly from external APIs (bypass cache for display)
async function getFreshPrice(symbol, assetType) {
    const upperSymbol = symbol.toUpperCase();
    console.log(`[Price] Fetching fresh price for ${upperSymbol} (${assetType})`);
    
    // Get CoinGecko Pro API key from environment
    const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
    
    try {
        // For crypto, use CoinGecko Pro FIRST (you're paying for it!), then Binance as fallback
        if (assetType === 'crypto') {
            const cryptoIdMap = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'SOL': 'solana',
                'DOGE': 'dogecoin',
                'XRP': 'ripple',
                'ADA': 'cardano',
                'DOT': 'polkadot',
                'MATIC': 'matic-network',
                'LINK': 'chainlink',
                'AVAX': 'avalanche-2',
                'SHIB': 'shiba-inu',
                'LTC': 'litecoin',
                'UNI': 'uniswap',
                'ATOM': 'cosmos',
                'XLM': 'stellar',
                'ALGO': 'algorand',
                'VET': 'vechain',
                'FIL': 'filecoin',
                'AAVE': 'aave',
                'EOS': 'eos',
                'PEPE': 'pepe',
                'BONK': 'bonk',
                'WIF': 'dogwifcoin',
                'FLOKI': 'floki',
                'ARB': 'arbitrum',
                'OP': 'optimism',
                'SUI': 'sui',
                'APT': 'aptos',
                'INJ': 'injective-protocol',
                'SEI': 'sei-network',
                'NEAR': 'near',
                'RENDER': 'render-token',
                'BNB': 'binancecoin',
                'TRX': 'tron',
                'TON': 'the-open-network',
                'HBAR': 'hedera-hashgraph',
                'IMX': 'immutable-x',
                'MKR': 'maker',
                'GRT': 'the-graph',
                'FTM': 'fantom',
                'SAND': 'the-sandbox',
                'MANA': 'decentraland',
                'AXS': 'axie-infinity',
                'APE': 'apecoin',
                'CRV': 'curve-dao-token',
                'LDO': 'lido-dao',
                'RUNE': 'thorchain',
                'ENS': 'ethereum-name-service'
            };
            
            const coinId = cryptoIdMap[upperSymbol] || upperSymbol.toLowerCase();
            
            // Try CoinGecko Pro FIRST (real-time with your API key)
            try {
                const headers = {};
                let baseUrl = 'https://api.coingecko.com/api/v3';
                
                if (COINGECKO_API_KEY) {
                    headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
                    baseUrl = 'https://pro-api.coingecko.com/api/v3';
                    console.log(`[Price] Using CoinGecko Pro API for ${upperSymbol}`);
                }
                
                const response = await axios.get(
                    `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd&precision=full`,
                    { headers, timeout: 5000 }
                );
                
                if (response.data[coinId]?.usd) {
                    const price = response.data[coinId].usd;
                    console.log(`[Price] ✅ Fresh ${upperSymbol} from CoinGecko Pro: $${price}`);
                    return { price, source: 'coingecko-pro' };
                }
            } catch (cgError) {
                console.log(`[Price] CoinGecko failed for ${upperSymbol}:`, cgError.message);
            }
            
            // Fallback to Binance (free, real-time)
            try {
                const binanceSymbol = `${upperSymbol}USDT`;
                const response = await axios.get(
                    `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
                    { timeout: 5000 }
                );
                
                if (response.data?.price) {
                    const price = parseFloat(response.data.price);
                    console.log(`[Price] ✅ Fresh ${upperSymbol} from Binance: $${price}`);
                    return { price, source: 'binance' };
                }
            } catch (binanceError) {
                console.log(`[Price] Binance failed for ${upperSymbol}:`, binanceError.message);
            }
        }
        
        // For stocks, try multiple sources
        if (assetType === 'stock') {
            // Try Yahoo Finance with 1-minute interval for more recent data
            try {
                const response = await axios.get(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1m&range=1d`,
                    { 
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    }
                );
                
                const result = response.data?.chart?.result?.[0];
                if (result?.meta?.regularMarketPrice) {
                    const price = result.meta.regularMarketPrice;
                    console.log(`[Price] ✅ Fresh ${upperSymbol} from Yahoo: $${price}`);
                    return { price, source: 'yahoo' };
                }
            } catch (yahooError) {
                console.log(`[Price] Yahoo failed for ${upperSymbol}:`, yahooError.message);
            }
            
            // Try Finnhub as backup (free tier available)
            try {
                const finnhubKey = process.env.FINNHUB_API_KEY;
                if (finnhubKey) {
                    const response = await axios.get(
                        `https://finnhub.io/api/v1/quote?symbol=${upperSymbol}&token=${finnhubKey}`,
                        { timeout: 5000 }
                    );
                    
                    if (response.data?.c) { // 'c' is current price
                        const price = response.data.c;
                        console.log(`[Price] ✅ Fresh ${upperSymbol} from Finnhub: $${price}`);
                        return { price, source: 'finnhub' };
                    }
                }
            } catch (finnhubError) {
                console.log(`[Price] Finnhub failed for ${upperSymbol}:`, finnhubError.message);
            }
        }
        
        // ❌ NO FALLBACK - If we couldn't get a price from real APIs, return error
        console.log(`[Price] ❌ No valid price found for ${upperSymbol} - rejecting`);
        return { price: null, source: 'error' };
        
    } catch (error) {
        console.error(`[Price] Error fetching fresh price for ${symbol}:`, error.message);
        return { price: null, source: 'error' };
    }
}

// ============ GENERATE MOCK INDICATORS ============
function generateMockIndicators(currentPrice, direction) {
    const isUp = direction === 'UP';
    
    const rsiBase = isUp ? 55 : 45;
    const rsiValue = rsiBase + (Math.random() * 20 - 10);
    const rsiSignal = rsiValue < 40 ? 'BUY' : rsiValue > 60 ? 'SELL' : 'NEUTRAL';
    
    const macdValue = isUp 
        ? (Math.random() * 2 + 0.5).toFixed(2)
        : (-Math.random() * 2 - 0.5).toFixed(2);
    const macdSignal = parseFloat(macdValue) > 0 ? 'BUY' : 'SELL';
    
    const sma20 = currentPrice * (isUp ? 0.98 : 1.02);
    const sma50 = currentPrice * (isUp ? 0.95 : 1.05);
    const sma20Signal = currentPrice > sma20 ? 'BUY' : 'SELL';
    const sma50Signal = currentPrice > sma50 ? 'BUY' : 'SELL';
    
    const bbPosition = isUp ? 'Near Upper Band' : 'Near Lower Band';
    
    const volumeOptions = ['High', 'Above Average', 'Average', 'Below Average'];
    const volumeValue = volumeOptions[Math.floor(Math.random() * volumeOptions.length)];
    
    const stochValue = isUp 
        ? (Math.random() * 30 + 50).toFixed(1)
        : (Math.random() * 30 + 20).toFixed(1);
    const stochSignal = parseFloat(stochValue) > 80 ? 'SELL' : parseFloat(stochValue) < 20 ? 'BUY' : 'NEUTRAL';
    
    return {
        'RSI': { value: parseFloat(rsiValue.toFixed(1)), signal: rsiSignal },
        'MACD': { value: parseFloat(macdValue), signal: macdSignal },
        'SMA 20': { value: parseFloat(sma20.toFixed(2)), signal: sma20Signal },
        'SMA 50': { value: parseFloat(sma50.toFixed(2)), signal: sma50Signal },
        'Bollinger': { value: bbPosition, signal: isUp ? 'BUY' : 'SELL' },
        'Volume': { value: volumeValue, signal: 'NEUTRAL' },
        'Stochastic': { value: parseFloat(stochValue), signal: stochSignal },
        'Trend': { value: isUp ? 'Bullish' : 'Bearish', signal: isUp ? 'BUY' : 'SELL' }
    };
}

// Generate mock prediction
function generateMockPrediction(symbol, days, currentPrice = null) {
    const basePrice = currentPrice || (Math.random() * 500 + 50);
    const direction = Math.random() > 0.5 ? 'UP' : 'DOWN';
    const changePercent = direction === 'UP' 
        ? (Math.random() * 8 + 1).toFixed(2)
        : -(Math.random() * 8 + 1).toFixed(2);
    const targetPrice = basePrice * (1 + parseFloat(changePercent) / 100);
    const confidence = (Math.random() * 25 + 65).toFixed(1);

    const indicators = generateMockIndicators(basePrice, direction);

    return {
        symbol: symbol.toUpperCase(),
        current_price: parseFloat(basePrice),
        prediction: {
            target_price: parseFloat(targetPrice),
            direction: direction,
            price_change: parseFloat(targetPrice - basePrice),
            price_change_percent: parseFloat(changePercent),
            confidence: parseFloat(confidence),
            days: days
        },
        analysis: {
            trend: direction === 'UP' ? 'Bullish' : 'Bearish',
            volatility: 'Moderate',
            risk_level: 'Medium'
        },
        indicators: indicators,
        timestamp: new Date().toISOString()
    };
}

// Calculate live confidence
function calculateLiveConfidence(prediction, currentPrice) {
    const originalConfidence = prediction.confidence;
    const targetPrice = prediction.targetPrice;
    const startPrice = prediction.currentPrice;
    
    const targetMovement = targetPrice - startPrice;
    const actualMovement = currentPrice - startPrice;
    
    if (prediction.direction === 'UP') {
        if (actualMovement > 0) {
            const progress = Math.min(actualMovement / targetMovement, 1);
            return Math.min(95, originalConfidence + (progress * 20));
        } else {
            const wrongProgress = Math.abs(actualMovement / targetMovement);
            return Math.max(30, originalConfidence - (wrongProgress * 30));
        }
    }
    
    if (prediction.direction === 'DOWN') {
        if (actualMovement < 0) {
            const progress = Math.min(Math.abs(actualMovement / targetMovement), 1);
            return Math.min(95, originalConfidence + (progress * 20));
        } else {
            const wrongProgress = actualMovement / Math.abs(targetMovement);
            return Math.max(30, originalConfidence - (wrongProgress * 30));
        }
    }
    
    return originalConfidence;
}

// ============ SHARED PREDICTION ROUTES ============

// @route   GET /api/predictions/active/:symbol
// @desc    Get active shared prediction for a symbol (if exists)
// @access  Public
router.get('/active/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        
        // Find an active (non-expired) prediction for this symbol
        const activePrediction = await Prediction.findOne({
            symbol: symbol,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }); // Get most recent
        
        if (!activePrediction) {
            return res.json({ 
                success: true, 
                exists: false, 
                message: 'No active prediction for this symbol' 
            });
        }
        
        // Get fresh current price
        const priceResult = await getFreshPrice(symbol, activePrediction.assetType);
        const currentPrice = priceResult.price || activePrediction.currentPrice;
        
        // Calculate live stats
        const liveConfidence = calculateLiveConfidence(activePrediction, currentPrice);
        const timeRemaining = Math.max(0, activePrediction.expiresAt - Date.now());
        
        res.json({
            success: true,
            exists: true,
            isShared: true,
            prediction: {
                _id: activePrediction._id,
                symbol: activePrediction.symbol,
                assetType: activePrediction.assetType,
                current_price: currentPrice,
                prediction: {
                    target_price: activePrediction.targetPrice,
                    direction: activePrediction.direction,
                    price_change: activePrediction.priceChange,
                    price_change_percent: activePrediction.priceChangePercent,
                    confidence: activePrediction.confidence,
                    days: activePrediction.timeframe
                },
                liveConfidence,
                livePrice: currentPrice,
                liveChange: currentPrice - activePrediction.currentPrice,
                liveChangePercent: ((currentPrice - activePrediction.currentPrice) / activePrediction.currentPrice) * 100,
                timeRemaining,
                daysRemaining: Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)),
                indicators: activePrediction.indicators || {},
                analysis: activePrediction.analysis,
                createdAt: activePrediction.createdAt,
                expiresAt: activePrediction.expiresAt,
                createdBy: activePrediction.user // Optional: show who started it
            }
        });
        
    } catch (error) {
        console.error('[Predictions] Error fetching active prediction:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch active prediction' });
    }
});

// @route   POST /api/predictions/predict
// @desc    Get or create prediction for a stock/crypto
// @access  Private
router.post('/predict', auth, async (req, res) => {
    try {
        let { symbol, days = 7, assetType } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        // Normalize symbol (handles BTC-USD, BTCUSD -> BTC for crypto)
        const originalSymbol = symbol.toUpperCase().trim();
        symbol = priceService.normalizeSymbol(originalSymbol);
        if (originalSymbol !== symbol) {
            console.log(`[Predictions] Symbol normalized: ${originalSymbol} -> ${symbol}`);
        }

        // Auto-detect asset type
        if (!assetType) {
            assetType = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
            console.log(`[Predictions] Auto-detected ${symbol} as ${assetType}`);
        }

        console.log(`[Predictions] Getting prediction for ${symbol} (${assetType}), days: ${days}`);
        
        // ============ VALIDATE TICKER - Check if we can get a real price ============
        let currentPrice = null;
        let priceSource = null;
        try {
            const priceResult = await getFreshPrice(symbol, assetType);
            currentPrice = priceResult.price;
            priceSource = priceResult.source;
            console.log(`[Predictions] Fresh price for ${symbol}: $${currentPrice} (source: ${priceSource})`);
        } catch (priceError) {
            console.log(`[Predictions] Could not get price for ${symbol}:`, priceError.message);
        }

        // ❌ REJECT INVALID TICKERS - If we can't get a price, the ticker is likely invalid
        if (!currentPrice || priceSource === 'error') {
            console.log(`[Predictions] ❌ Rejecting invalid ticker: ${symbol}`);
            return res.status(400).json({ 
                error: 'Invalid symbol',
                message: `Could not find price data for "${symbol}". Please check the ticker symbol and try again.`,
                symbol: symbol
            });
        }
        const existingPrediction = await Prediction.findOne({
            symbol: symbol,
            status: 'pending',
            expiresAt: { $gt: new Date() },
            timeframe: days // Same timeframe
        }).sort({ createdAt: -1 });
        
        if (existingPrediction) {
            console.log(`[Predictions] ✅ Found existing shared prediction for ${symbol}`);
            
            // Get fresh price for display (use already fetched price, or refresh)
            const displayPrice = currentPrice || existingPrediction.currentPrice;
            
            // Calculate live stats
            const liveConfidence = calculateLiveConfidence(existingPrediction, displayPrice);
            const timeRemaining = Math.max(0, existingPrediction.expiresAt - Date.now());
            
            // Track that this user viewed/joined this prediction
            if (!existingPrediction.viewers) {
                existingPrediction.viewers = [];
            }
            if (!existingPrediction.viewers.includes(req.user.id)) {
                existingPrediction.viewers.push(req.user.id);
                existingPrediction.viewCount = (existingPrediction.viewCount || 0) + 1;
                await existingPrediction.save();
            }
            
            // Award small XP for joining shared prediction
            try {
                await GamificationService.awardXP(req.user.id, 5, `Joined shared prediction for ${symbol}`);
            } catch (e) { /* ignore */ }
            
            return res.json({
                symbol: existingPrediction.symbol,
                current_price: displayPrice,
                prediction: {
                    target_price: existingPrediction.targetPrice,
                    direction: existingPrediction.direction,
                    price_change: existingPrediction.priceChange,
                    price_change_percent: existingPrediction.priceChangePercent,
                    confidence: existingPrediction.confidence,
                    days: existingPrediction.timeframe
                },
                analysis: existingPrediction.analysis,
                indicators: existingPrediction.indicators || {},
                predictionId: existingPrediction._id,
                _id: existingPrediction._id,
                isShared: true, // ✅ Flag that this is a shared prediction
                sharedMessage: 'Prediction already in progress!',
                liveConfidence,
                livePrice: displayPrice,
                timeRemaining,
                daysRemaining: Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)),
                viewCount: existingPrediction.viewCount || 1,
                createdAt: existingPrediction.createdAt,
                expiresAt: existingPrediction.expiresAt
            });
        }
        
        // ============ CREATE NEW PREDICTION ============
        console.log(`[Predictions] Creating new prediction for ${symbol}`);
        
        // currentPrice is already set from validation above

        let predictionData;
        let formattedIndicators = {};
        
        // Try ML service if not using mocks
        if (!USE_MOCK_PREDICTIONS) {
            try {
                console.log(`[Predictions] Trying ML service at ${ML_SERVICE_URL}`);
                
                const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
                    symbol: symbol,
                    days: days,
                    type: assetType
                }, { timeout: 30000 });
                
                if (mlResponse.data) {
                    const ml = mlResponse.data;
                    
                    const mlCurrentPrice = ml.currentPrice || ml.current_price || currentPrice;
                    const mlTargetPrice = ml.prediction?.targetPrice || ml.prediction?.target_price || ml.targetPrice || ml.target_price;
                    const mlDirection = ml.prediction?.direction || ml.direction || 'UP';
                    const mlConfidence = ml.prediction?.confidence || ml.confidence || 70;
                    
                    let validDirection = mlDirection.toUpperCase();
                    if (validDirection !== 'UP' && validDirection !== 'DOWN') {
                        validDirection = mlTargetPrice >= mlCurrentPrice ? 'UP' : 'DOWN';
                    }
                    
                    // Use fresh price, not ML's potentially stale price
                    const finalCurrentPrice = currentPrice || mlCurrentPrice;
                    const finalTargetPrice = mlTargetPrice || (finalCurrentPrice * (1 + (validDirection === 'UP' ? 0.05 : -0.05)));
                    const finalPriceChange = finalTargetPrice - finalCurrentPrice;
                    const finalPercentChange = (finalPriceChange / finalCurrentPrice) * 100;

                    // Get indicators from ML
                    if (ml.indicators && Object.keys(ml.indicators).length > 0) {
                        formattedIndicators = ml.indicators;
                    }
                    
                    if (finalCurrentPrice && finalTargetPrice) {
    predictionData = {
        symbol: symbol,
        current_price: parseFloat(finalCurrentPrice),
        prediction: {
           target_price: parseFloat(finalTargetPrice),
direction: validDirection,
price_change: parseFloat(finalPriceChange),
            price_change_percent: parseFloat(finalPercentChange.toFixed(2)),
            confidence: parseFloat(mlConfidence),
            days: days
        },
                            analysis: ml.analysis || {
                                trend: validDirection === 'UP' ? 'Bullish' : 'Bearish',
                                volatility: 'Moderate',
                                risk_level: 'Medium'
                            },
                            indicators: formattedIndicators // ✅ FIXED: Use formattedIndicators, not empty object
                        };
                    }
                }
            } catch (mlError) {
                console.log(`[Predictions] ML service unavailable:`, mlError.message);
            }
        }
        
        // Fallback to mock prediction
        if (!predictionData) {
            console.log(`[Predictions] Using generated prediction for ${symbol}`);
            predictionData = generateMockPrediction(symbol, days, currentPrice);
            formattedIndicators = predictionData.indicators;
        }

        // Ensure current price is accurate
        if (currentPrice && predictionData.current_price !== currentPrice) {
            // Recalculate with fresh price
            const direction = predictionData.prediction.direction;
            const percentChange = predictionData.prediction.price_change_percent;
            const newTargetPrice = currentPrice * (1 + percentChange / 100);
            
            predictionData.current_price = currentPrice;
            predictionData.prediction.target_price = parseFloat(newTargetPrice);
            predictionData.prediction.price_change = parseFloat(newTargetPrice - currentPrice);
        }
        
        // Guarantee indicators
        if (!formattedIndicators || Object.keys(formattedIndicators).length === 0) {
            formattedIndicators = generateMockIndicators(
                predictionData.current_price, 
                predictionData.prediction.direction
            );
        }

        predictionData.indicators = formattedIndicators;
        
        // Save prediction to database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        const prediction = new Prediction({
            user: req.user.id,
            symbol: symbol,
            assetType,
            currentPrice: predictionData.current_price,
            targetPrice: predictionData.prediction.target_price,
            direction: predictionData.prediction.direction,
            priceChange: predictionData.prediction.price_change,
            priceChangePercent: predictionData.prediction.price_change_percent,
            confidence: predictionData.prediction.confidence,
            timeframe: days,
            indicators: formattedIndicators,
            analysis: {
                trend: predictionData.analysis?.trend,
                volatility: predictionData.analysis?.volatility,
                riskLevel: predictionData.analysis?.risk_level,
                message: predictionData.analysis?.message
            },
            expiresAt,
            viewers: [req.user.id],
            viewCount: 1
        });
        
        await prediction.save();
        
        console.log(`[Predictions] ✅ Created NEW prediction ${prediction._id} for ${symbol}`);
        console.log(`[Predictions] Price: $${predictionData.current_price}, Target: $${predictionData.prediction.target_price}`);
        
        // Gamification
        try {
            await GamificationService.trackPrediction(req.user.id);
            await GamificationService.awardXP(req.user.id, 15, `Started prediction for ${symbol}`);
        } catch (gamError) {
            console.warn('[Predictions] Gamification error:', gamError.message);
        }
        
        res.json({
            ...predictionData,
            indicators: formattedIndicators,
            predictionId: prediction._id,
            _id: prediction._id,
            isShared: false,
            isNew: true,
            message: 'New prediction created!'
        });
        
    } catch (error) {
        console.error('[Predictions] ❌ Error:', error.message);
        return res.status(500).json({ error: 'Prediction service error', message: error.message });
    }
});

// @route   GET /api/predictions/live/:id
// @desc    Get live prediction update with current confidence
// @access  Private
router.get('/live/:id', auth, async (req, res) => {
    try {
        const prediction = await Prediction.findById(req.params.id);
        
        if (!prediction) {
            return res.status(404).json({ error: 'Prediction not found' });
        }

        // For shared predictions, allow anyone to view
        // (Remove this check if you want strict ownership)
        // if (prediction.user.toString() !== req.user.id) {
        //     return res.status(403).json({ error: 'Not authorized' });
        // }

        // Get FRESH price
        const priceResult = await getFreshPrice(prediction.symbol, prediction.assetType);
        const currentPrice = priceResult.price || prediction.currentPrice;

        const liveConfidence = calculateLiveConfidence(prediction, currentPrice);
        
        const now = Date.now();
        const timeRemaining = Math.max(0, prediction.expiresAt - now);
        const hasExpired = timeRemaining === 0;

        if (hasExpired && prediction.status === 'pending') {
            await prediction.calculateOutcome(currentPrice);
        }

        res.json({
            success: true,
            prediction: {
                ...prediction.toObject(),
                livePrice: currentPrice,
                currentPrice: currentPrice,
                liveConfidence,
                liveChange: currentPrice - prediction.currentPrice,
                liveChangePercent: ((currentPrice - prediction.currentPrice) / prediction.currentPrice) * 100,
                timeRemaining,
                hasExpired,
                daysRemaining: Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)),
                updatedAt: new Date().toISOString(),
                priceSource: priceResult.source
            }
        });
    } catch (error) {
        console.error('[Live] Error:', error);
        res.status(500).json({ error: 'Failed to get live prediction' });
    }
});

// @route   GET /api/predictions/shared
// @desc    Get all active shared predictions
// @access  Public
router.get('/shared', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        
        const activePredictions = await Prediction.find({
            status: 'pending',
            expiresAt: { $gt: new Date() }
        })
        .sort({ viewCount: -1, createdAt: -1 }) // Most popular first
        .limit(parseInt(limit))
        .populate('user', 'username avatar');
        
        // Get fresh prices for all
        const predictionsWithPrices = await Promise.all(
            activePredictions.map(async (pred) => {
                const priceResult = await getFreshPrice(pred.symbol, pred.assetType);
                const currentPrice = priceResult.price || pred.currentPrice;
                const liveConfidence = calculateLiveConfidence(pred, currentPrice);
                const timeRemaining = Math.max(0, pred.expiresAt - Date.now());
                
                return {
                    _id: pred._id,
                    symbol: pred.symbol,
                    direction: pred.direction,
                    targetPrice: pred.targetPrice,
                    currentPrice: currentPrice,
                    livePrice: currentPrice,
                    liveConfidence,
                    confidence: pred.confidence,
                    timeRemaining,
                    daysRemaining: Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)),
                    viewCount: pred.viewCount || 0,
                    createdBy: pred.user?.username || 'Anonymous',
                    createdAt: pred.createdAt,
                    expiresAt: pred.expiresAt
                };
            })
        );
        
        res.json({
            success: true,
            predictions: predictionsWithPrices
        });
    } catch (error) {
        console.error('[Predictions] Error fetching shared:', error);
        res.status(500).json({ error: 'Failed to fetch shared predictions' });
    }
});

// ============ REMAINING ROUTES (unchanged) ============

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
                const priceResult = await getFreshPrice(prediction.symbol, prediction.assetType);
                if (!priceResult.price) continue;

                await prediction.calculateOutcome(priceResult.price);
                
                results.push({
                    symbol: prediction.symbol,
                    wasCorrect: prediction.outcome.wasCorrect,
                    accuracy: prediction.outcome.accuracy
                });

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`[Check] Error checking ${prediction.symbol}:`, error.message);
            }
        }

        res.json({ success: true, checkedCount: results.length, results });
    } catch (error) {
        console.error('[Check] Error:', error);
        res.status(500).json({ error: 'Failed to check outcomes' });
    }
});

router.get('/history', auth, async (req, res) => {
    try {
        const { limit = 20, status } = req.query;
        const query = { user: req.user.id };
        if (status) query.status = status;

        const predictions = await Prediction.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, predictions });
    } catch (error) {
        console.error('[Predictions] Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch prediction history' });
    }
});

// @route   GET /api/predictions/recent-public
// @desc    Get recent predictions for landing page (no auth required)
// @access  Public
router.get('/recent-public', async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        // Get recent predictions (hide user info for privacy)
        const predictions = await Prediction.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('symbol direction targetPrice confidence createdAt expiresAt')
            .lean();
        
        res.json(predictions);
    } catch (error) {
        console.error('[Predictions] Error fetching public recent:', error.message);
        res.status(500).json({ error: 'Failed to fetch recent predictions' });
    }
});

// Also handle /recent without auth for landing page
router.get('/recent', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // Check if user is authenticated
        let userId = null;
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
            if (token) {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.user?.id || decoded.id;
            }
        } catch (e) { /* No valid token */ }
        
        let predictions;
        if (userId) {
            // Authenticated: show user's predictions
            predictions = await Prediction.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));
        } else {
            // Public: show recent public predictions
            predictions = await Prediction.find({ status: 'pending' })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .select('symbol direction targetPrice confidence createdAt expiresAt')
                .lean();
        }
        
        res.json(predictions);
    } catch (error) {
        console.error('[Predictions] Error fetching recent:', error.message);
        res.status(500).json({ error: 'Failed to fetch recent predictions' });
    }
});

router.get('/stats', auth, async (req, res) => {
    try {
        const stats = await Prediction.getUserAccuracy(req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('[Predictions] Error fetching stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch prediction stats' });
    }
});

router.get('/user', auth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const predictions = await Prediction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        const stats = await Prediction.getUserAccuracy(req.user.id);
        
        const statusCounts = await Prediction.aggregate([
            { $match: { user: req.user.id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        const counts = { pending: 0, correct: 0, incorrect: 0, total: 0 };
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
        console.error('[Predictions] Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch user predictions' });
    }
});

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
        console.error('[Predictions] Error:', error.message);
        res.status(500).json({ success: false, accuracy: 0, totalPredictions: 0, correctPredictions: 0 });
    }
});

router.get('/trending', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const trending = await Prediction.getTrending(parseInt(limit));
        res.json(trending);
    } catch (error) {
        console.error('[Predictions] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending predictions' });
    }
});

router.get('/health', auth, async (req, res) => {
    try {
        let mlStatus = 'unknown';
        try {
            const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
            mlStatus = 'healthy';
        } catch (e) {
            mlStatus = 'unhealthy';
        }
        
        const cacheStats = priceService.getCacheStats();
        
        res.json({
            ml_service: mlStatus,
            ml_url: ML_SERVICE_URL,
            mock_mode: USE_MOCK_PREDICTIONS,
            price_cache: cacheStats
        });
    } catch (error) {
        res.json({ ml_service: 'error', error: error.message });
    }
});

router.get('/price/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { type } = req.query;
        
        const result = await getFreshPrice(symbol, type || (priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock'));
        
        if (result.price === null) {
            return res.status(404).json({ success: false, error: `Could not fetch price for ${symbol}` });
        }
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            price: result.price,
            source: result.source
        });
    } catch (error) {
        console.error('[Predictions] Price fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// ============ CLEANUP ROUTES ============

// @route   POST /api/predictions/cleanup
// @desc    Run cleanup to remove stale/invalid predictions
// @access  Private (admin only in production)
router.post('/cleanup', auth, async (req, res) => {
    try {
        console.log('[Cleanup] Manual cleanup triggered by user:', req.user.id);
        
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        
        // 1. Delete stale pending predictions (expired + older than 24 hours + no outcome)
        const staleResult = await Prediction.deleteMany({
            status: 'pending',
            expiresAt: { $lt: now },
            'outcome.actualPrice': { $exists: false },
            createdAt: { $lt: oneDayAgo }
        });
        
        // 2. Mark old completed predictions for future deletion (optional)
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const markResult = await Prediction.updateMany(
            {
                status: { $in: ['correct', 'incorrect', 'expired'] },
                expiresAt: { $lt: thirtyDaysAgo },
                deleteAfter: null
            },
            {
                $set: { deleteAfter: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } // Delete in 7 days
            }
        );
        
        // 3. Clear price cache
        try {
            priceService.clearCache();
        } catch (e) { /* ignore */ }
        
        res.json({
            success: true,
            message: 'Cleanup completed',
            staleDeleted: staleResult.deletedCount,
            markedForDeletion: markResult.modifiedCount,
            cacheCleared: true
        });
    } catch (error) {
        console.error('[Cleanup] Error:', error.message);
        res.status(500).json({ error: 'Cleanup failed' });
    }
});

// @route   GET /api/predictions/cleanup/stats
// @desc    Get cleanup statistics
// @access  Private
router.get('/cleanup/stats', auth, async (req, res) => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        
        const stats = {
            totalPredictions: await Prediction.countDocuments(),
            pendingPredictions: await Prediction.countDocuments({ status: 'pending' }),
            correctPredictions: await Prediction.countDocuments({ status: 'correct' }),
            incorrectPredictions: await Prediction.countDocuments({ status: 'incorrect' }),
            expiredPending: await Prediction.countDocuments({ 
                status: 'pending', 
                expiresAt: { $lt: now } 
            }),
            stalePredictions: await Prediction.countDocuments({
                status: 'pending',
                expiresAt: { $lt: now },
                createdAt: { $lt: oneDayAgo }
            }),
            markedForDeletion: await Prediction.countDocuments({
                deleteAfter: { $ne: null, $lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
            }),
            cacheStats: priceService.getCacheStats ? priceService.getCacheStats() : null
        };
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('[Cleanup] Stats error:', error.message);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;