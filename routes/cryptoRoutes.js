// server/routes/cryptoRoutes.js - FIXED WITH PREDICTION ENDPOINT

const express = require('express');
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../../../Nexus-Signal-Client/src/utils/indicators');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cryptoCache = {};

const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin', 
    ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot', 
    BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap', 
    MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron', 
    AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
};

function getCoinGeckoDays(range) {
    switch (range) {
        case '1D': return 1;
        case '5D': return 7;
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        case '5Y': return 1825;
        case 'MAX': return 'max';
        default: return 30;
    }
}

// Helper function to fetch crypto data from CoinGecko
async function fetchCryptoData(symbol, range) {
    const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
    
    const cacheKey = `crypto-${coinGeckoId}-${range}`;
    if (cryptoCache[cacheKey] && (Date.now() - cryptoCache[cacheKey].timestamp < CACHE_DURATION)) {
        console.log(`[Crypto] Serving cached data for ${coinGeckoId}`);
        return cryptoCache[cacheKey].data;
    }

    const days = getCoinGeckoDays(range || '6M');
    const params = {
        vs_currency: 'usd',
        days: days,
    };

    if (days > 90) {
        params.interval = 'daily';
    }

    if (COINGECKO_API_KEY) {
        params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
    }

    const url = `${COINGECKO_BASE_URL}/coins/${coinGeckoId}/market_chart`;
    console.log(`[Crypto] Fetching ${symbol} (${coinGeckoId}) for ${range}`);

    const response = await axios.get(url, { params });
    const prices = response.data.prices || [];
    const volumes = response.data.total_volumes || [];

    if (prices.length === 0) {
        throw new Error(`No price data found for ${symbol}`);
    }

    // Build historical data
    const historicalDataMap = new Map();
    
    prices.forEach(([timestamp, price]) => {
        historicalDataMap.set(timestamp, {
            time: timestamp,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0
        });
    });

    volumes.forEach(([timestamp, volume]) => {
        if (historicalDataMap.has(timestamp)) {
            historicalDataMap.get(timestamp).volume = volume;
        }
    });

    let historicalData = Array.from(historicalDataMap.values()).sort((a, b) => a.time - b.time);

    // Fill OHLC data with simulated variation for better candlestick visualization
    for (let i = 1; i < historicalData.length; i++) {
        const prevClose = historicalData[i-1].close;
        const currentClose = historicalData[i].close;
        
        // Open is previous close
        historicalData[i].open = prevClose;
        
        // Create realistic high/low based on price movement
        const priceChange = Math.abs(currentClose - prevClose);
        const volatility = priceChange * 0.5; // Add some volatility
        
        historicalData[i].high = Math.max(prevClose, currentClose) + volatility;
        historicalData[i].low = Math.min(prevClose, currentClose) - volatility;
    }

    if (historicalData.length > 0) {
        historicalData[0].open = historicalData[0].close;
        const initialVolatility = historicalData[0].close * 0.002; // 0.2% variation
        historicalData[0].high = historicalData[0].close + initialVolatility;
        historicalData[0].low = historicalData[0].close - initialVolatility;
    }

    cryptoCache[cacheKey] = { timestamp: Date.now(), data: historicalData };
    return historicalData;
}

// Prediction calculation (same as stocks)
const calculateCryptoPrediction = (historicalData, lastClosePrice) => {
    console.log('=== CRYPTO PREDICTION DEBUG ===');
    console.log('Historical data points:', historicalData.length);
    console.log('Last close price:', lastClosePrice);
    
    const sortedData = [...historicalData].sort((a, b) => a.time - b.time);
    const closes = sortedData.map(d => d.close);
    const volumes = sortedData.map(d => d.volume || 0);
    
    console.log('Closes array length:', closes.length);

    const hasEnoughData = (minLen) => closes.length >= minLen;

    const rsi = hasEnoughData(14) ? calculateRSI(closes) : null;
    const macdResult = hasEnoughData(26) ? calculateMACD(closes) : { macd: null, signal: null, histogram: null };
    const bbResult = hasEnoughData(20) ? calculateBollingerBands(closes) : { mid: lastClosePrice, upper: null, lower: null };
    const sma50 = hasEnoughData(50) ? calculateSMA(closes, 50) : null;
    const sma200 = hasEnoughData(200) ? calculateSMA(closes, 200) : null;
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

    console.log('Indicators:', { rsi, sma50, sma200 });

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    // SMA Analysis
    if (sma50 !== null && sma200 !== null && hasEnoughData(200)) {
        if (sma50 > sma200 && lastClosePrice > sma50) {
            bullishScore += 4;
            signals.push("Strong uptrend (Golden Cross)");
        } else if (sma50 < sma200 && lastClosePrice < sma50) {
            bearishScore += 4;
            signals.push("Strong downtrend (Death Cross)");
        } else if (lastClosePrice > sma50) {
            bullishScore += 2;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 2;
            signals.push("Price below 50-SMA");
        }
    } else if (sma50 !== null) {
        if (lastClosePrice > sma50) {
            bullishScore += 2.5;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 2.5;
            signals.push("Price below 50-SMA");
        }
    }

    // RSI
    if (rsi !== null) {
        if (rsi < 30) {
            bullishScore += 3;
            signals.push(`RSI oversold (${rsi.toFixed(0)})`);
        } else if (rsi > 70) {
            bearishScore += 3;
            signals.push(`RSI overbought (${rsi.toFixed(0)})`);
        } else if (rsi > 50) {
            bullishScore += 0.5;
        } else {
            bearishScore += 0.5;
        }
    }

    // MACD
    if (macdResult.macd !== null && macdResult.signal !== null) {
        if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
            bullishScore += 3.5;
            signals.push("MACD bullish crossover");
        } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
            bearishScore += 3.5;
            signals.push("MACD bearish crossover");
        }
    }

    // Bollinger Bands
    if (bbResult.upper !== null && bbResult.lower !== null) {
        if (lastClosePrice >= bbResult.upper * 0.99) {
            bearishScore += 2;
            signals.push("Near upper Bollinger Band");
        } else if (lastClosePrice <= bbResult.lower * 1.01) {
            bullishScore += 2;
            signals.push("Near lower Bollinger Band");
        }
    }

    console.log('Scores:', { bullishScore, bearishScore });

    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 
        ? Math.min(95, Math.round((Math.max(bullishScore, bearishScore) / totalScore) * 100)) 
        : 50;
    
    const predictedDirection = bullishScore > bearishScore ? 'Up' : 'Down';
    const percentageChange = predictedDirection === 'Up' 
        ? (bullishScore / 10) * 2 
        : -(bearishScore / 10) * 2;
    
    const predictedPrice = lastClosePrice * (1 + percentageChange / 100);

    console.log('Final prediction:', { predictedPrice, predictedDirection, percentageChange, confidence });

    return {
        predictedPrice,
        predictedDirection,
        percentageChange,
        confidence,
        message: signals.length > 0 ? signals.join('. ') : 'Neutral market conditions',
        indicators: {
            rsi,
            macd: macdResult,
            bollingerBands: bbResult,
            sma50,
            sma200,
            avgVolume,
            lastVolume: volumes[volumes.length - 1],
        }
    };
};

// GET /api/crypto/prediction/:symbol - Main prediction endpoint
router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M', interval = '1d' } = req.query;

        console.log(`Getting crypto prediction for ${symbol} - Range: ${range}`);

        const historicalData = await fetchCryptoData(symbol, range);

        if (historicalData.length < 50) {
            return res.status(400).json({ 
                msg: `Not enough data (${historicalData.length} points). Try a longer range.` 
            });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        const prediction = calculateCryptoPrediction(historicalData, lastClosePrice);

        res.json({
            symbol: symbol.toUpperCase(),
            currentPrice: lastClosePrice,
            historicalData, // Include for chart
            ...prediction,
        });

    } catch (error) {
        console.error('Error generating crypto prediction:', error.message);
        
        if (error.response?.status === 429) {
            return res.status(429).json({ msg: 'Rate limit exceeded. Please wait.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ msg: `Crypto symbol "${req.params.symbol}" not found.` });
        }
        
        res.status(500).json({ 
            msg: 'Failed to generate crypto prediction', 
            error: error.message 
        });
    }
});

// GET /api/crypto/historical/:symbol - Historical data only
router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        console.log(`Fetching crypto historical data for ${symbol} - Range: ${range}`);

        const historicalData = await fetchCryptoData(symbol, range);

        res.json({
            symbol: symbol.toUpperCase(),
            historicalData,
        });

    } catch (error) {
        console.error('Error fetching crypto data:', error.message);
        res.status(500).json({ 
            msg: 'Failed to fetch crypto data', 
            error: error.message 
        });
    }
});

module.exports = router;