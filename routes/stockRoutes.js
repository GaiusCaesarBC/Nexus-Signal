// server/routes/stockRoutes.js - USING ALPHA VANTAGE

const express = require('express');
const router = express.Router();
const axios = require('axios');

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../../../Nexus-Signal-Client/src/utils/indicators');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const stockCache = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Map frontend ranges to Alpha Vantage time series functions
function getAlphaVantageFunction(range) {
    switch (range) {
        case '1D':
        case '5D':
            return 'TIME_SERIES_INTRADAY';
        case '1M':
        case '3M':
        case '6M':
        case '1Y':
            return 'TIME_SERIES_DAILY';
        case '5Y':
        case 'MAX':
            return 'TIME_SERIES_WEEKLY';
        default:
            return 'TIME_SERIES_DAILY';
    }
}

function getAlphaVantageInterval(range) {
    switch (range) {
        case '1D':
            return '5min';
        case '5D':
            return '60min';
        default:
            return null; // Daily/Weekly don't need interval
    }
}

function getOutputSize(range) {
    // For intraday, we need 'full' to get enough data
    if (range === '1D' || range === '5D') return 'full';
    // For daily/weekly, 'compact' gives 100 data points, 'full' gives all
    return 'full';
}

async function fetchAlphaVantageData(symbol, range) {
    const func = getAlphaVantageFunction(range);
    const interval = getAlphaVantageInterval(range);
    const outputsize = getOutputSize(range);

    let url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=${outputsize}`;
    
    if (interval) {
        url += `&interval=${interval}`;
    }

    console.log(`Fetching from Alpha Vantage: ${symbol}, Function: ${func}`);

    const response = await axios.get(url);
    const data = response.data;

    // Check for API errors
    if (data['Error Message']) {
        throw new Error(`Invalid symbol: ${symbol}`);
    }
    if (data['Note']) {
        throw new Error('API rate limit reached. Please try again in a minute.');
    }

    // Parse data based on function type
    let timeSeriesKey;
    if (func === 'TIME_SERIES_INTRADAY') {
        timeSeriesKey = `Time Series (${interval})`;
    } else if (func === 'TIME_SERIES_DAILY') {
        timeSeriesKey = 'Time Series (Daily)';
    } else if (func === 'TIME_SERIES_WEEKLY') {
        timeSeriesKey = 'Weekly Time Series';
    }

    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
        throw new Error('No data returned from Alpha Vantage');
    }

    // Convert to our format
    const historicalData = Object.entries(timeSeries).map(([dateStr, values]) => ({
        time: new Date(dateStr).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume'] || 0),
    })).sort((a, b) => a.time - b.time); // Sort ascending by time

    // Filter by range
    const now = Date.now();
    let cutoffTime;
    switch (range) {
        case '1D':
            cutoffTime = now - 24 * 60 * 60 * 1000;
            break;
        case '5D':
            cutoffTime = now - 5 * 24 * 60 * 60 * 1000;
            break;
        case '1M':
            cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
        case '3M':
            cutoffTime = now - 90 * 24 * 60 * 60 * 1000;
            break;
        case '6M':
            cutoffTime = now - 180 * 24 * 60 * 60 * 1000;
            break;
        case '1Y':
            cutoffTime = now - 365 * 24 * 60 * 60 * 1000;
            break;
        case '5Y':
            cutoffTime = now - 5 * 365 * 24 * 60 * 60 * 1000;
            break;
        default:
            cutoffTime = 0; // MAX - include all
    }

    return historicalData.filter(d => d.time >= cutoffTime);
}

router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `hist-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Historical data for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Fetching historical data for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No historical data found for ${symbol}` 
            });
        }

        const responseData = {
            symbol,
            historicalData,
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error fetching historical stock data:', error.message);
        res.status(500).json({ 
            msg: 'Failed to fetch historical data', 
            error: error.message 
        });
    }
});

router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `pred-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Prediction for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Getting prediction for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No data available for ${symbol}` 
            });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        const prediction = calculateStockPrediction(historicalData, lastClosePrice);

        const responseData = {
            symbol,
            currentPrice: lastClosePrice,
            historicalData,
            ...prediction,
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error generating prediction:', error.message);
        res.status(500).json({ 
            msg: 'Failed to generate prediction', 
            error: error.message 
        });
    }
});

const calculateStockPrediction = (historicalData, lastClosePrice) => {
    console.log('=== PREDICTION DEBUG ===');
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
    const sma20 = hasEnoughData(20) ? calculateSMA(closes, 20) : null;
    const sma50 = hasEnoughData(50) ? calculateSMA(closes, 50) : null;
    const sma200 = hasEnoughData(200) ? calculateSMA(closes, 200) : null;
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

    console.log('Indicators:', { rsi, sma50, sma200 });

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    if (sma50 !== null && sma200 !== null && hasEnoughData(200)) {
        if (sma50 > sma200 && lastClosePrice > sma50) {
            bullishScore += 4;
            signals.push("Strong long-term uptrend (Golden Cross)");
        } else if (sma50 < sma200 && lastClosePrice < sma50) {
            bearishScore += 4;
            signals.push("Strong long-term downtrend (Death Cross)");
        } else if (lastClosePrice > sma50) {
            bullishScore += 2;
            signals.push("Price above 50-period SMA");
        } else {
            bearishScore += 2;
            signals.push("Price below 50-period SMA");
        }
    } else if (sma50 !== null && hasEnoughData(50)) {
        if (lastClosePrice > sma50) {
            bullishScore += 2.5;
            signals.push("Price above 50-period SMA");
        } else {
            bearishScore += 2.5;
            signals.push("Price below 50-period SMA");
        }
    }

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

    if (macdResult.macd !== null && macdResult.signal !== null) {
        if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
            bullishScore += 3.5;
            signals.push("MACD bullish crossover");
        } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
            bearishScore += 3.5;
            signals.push("MACD bearish crossover");
        }
    }

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
            sma20,
            sma50,
            sma200,
            avgVolume,
            lastVolume: volumes[volumes.length - 1],
        }
    };
};

module.exports = router;