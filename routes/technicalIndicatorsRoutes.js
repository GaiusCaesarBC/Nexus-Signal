// server/routes/technicalIndicatorsRoutes.js - Technical Indicators API
const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const { sanitizeSymbol } = require('../utils/symbolValidation');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for indicator data
const indicatorCache = new Map();
const CACHE_DURATION = 60 * 1000; // 1 minute cache

// ============ INDICATOR CALCULATION FUNCTIONS ============

/**
 * Calculate Simple Moving Average (SMA)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - Number of periods
 * @returns {number[]} SMA values (null for periods without enough data)
 */
const calculateSMA = (prices, period) => {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
    }
    return sma;
};

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - Number of periods
 * @returns {number[]} EMA values
 */
const calculateEMA = (prices, period) => {
    const ema = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
        ema.push(null);
    }
    ema[period - 1] = sum / period;

    // Calculate EMA for remaining values
    for (let i = period; i < prices.length; i++) {
        ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }

    return ema;
};

/**
 * Calculate RSI (Relative Strength Index)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - RSI period (default 14)
 * @returns {number[]} RSI values (0-100)
 */
const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) {
        return new Array(prices.length).fill(null);
    }

    const rsi = new Array(prices.length).fill(null);
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate first average gain/loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // First RSI value
    if (avgLoss === 0) {
        rsi[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        rsi[period] = 100 - (100 / (1 + rs));
    }

    // Calculate subsequent RSI values using smoothed averages
    for (let i = period; i < gains.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

        if (avgLoss === 0) {
            rsi[i + 1] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[i + 1] = 100 - (100 / (1 + rs));
        }
    }

    return rsi;
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices - Array of closing prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object} { macdLine, signalLine, histogram }
 */
const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    // MACD Line = Fast EMA - Slow EMA
    const macdLine = fastEMA.map((fast, i) => {
        if (fast === null || slowEMA[i] === null) return null;
        return fast - slowEMA[i];
    });

    // Filter out nulls for signal line calculation
    const validMacdValues = macdLine.filter(v => v !== null);
    const signalEMA = calculateEMA(validMacdValues, signalPeriod);

    // Map signal EMA back to original array length
    const signalLine = new Array(macdLine.length).fill(null);
    let signalIndex = 0;
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] !== null) {
            signalLine[i] = signalEMA[signalIndex];
            signalIndex++;
        }
    }

    // Histogram = MACD Line - Signal Line
    const histogram = macdLine.map((macd, i) => {
        if (macd === null || signalLine[i] === null) return null;
        return macd - signalLine[i];
    });

    return { macdLine, signalLine, histogram };
};

/**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - SMA period (default 20)
 * @param {number} stdDev - Number of standard deviations (default 2)
 * @returns {Object} { upper, middle, lower }
 */
const calculateBollingerBands = (prices, period = 20, stdDev = 2) => {
    const middle = calculateSMA(prices, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            // Calculate standard deviation
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = middle[i];
            const squaredDiffs = slice.map(p => Math.pow(p - mean, 2));
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
            const sd = Math.sqrt(variance);

            upper.push(mean + (stdDev * sd));
            lower.push(mean - (stdDev * sd));
        }
    }

    return { upper, middle, lower };
};

/**
 * Calculate Stochastic Oscillator
 * @param {Object[]} candles - Array of {high, low, close}
 * @param {number} kPeriod - %K period (default 14)
 * @param {number} dPeriod - %D period (default 3)
 * @returns {Object} { k, d }
 */
const calculateStochastic = (candles, kPeriod = 14, dPeriod = 3) => {
    const k = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < kPeriod - 1) {
            k.push(null);
        } else {
            const slice = candles.slice(i - kPeriod + 1, i + 1);
            const highestHigh = Math.max(...slice.map(c => c.high));
            const lowestLow = Math.min(...slice.map(c => c.low));
            const currentClose = candles[i].close;

            if (highestHigh === lowestLow) {
                k.push(50); // Prevent division by zero
            } else {
                k.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
            }
        }
    }

    // %D is SMA of %K
    const d = calculateSMA(k.map(v => v === null ? 0 : v), dPeriod);

    return { k, d };
};

// ============ API ROUTES ============

// @route   GET /api/indicators/:symbol/all
// @desc    Get all technical indicators for a symbol
// @access  Private
router.get('/:symbol/all', auth, async (req, res) => {
    try {
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({ error: 'Invalid symbol', message: validationError.message });
        }

        const { range = '3M' } = req.query;
        const cacheKey = `${symbol}-${range}-all`;

        // Check cache
        const cached = indicatorCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[Indicators] Cache HIT for ${symbol}`);
            return res.json(cached.data);
        }

        console.log(`[Indicators] Calculating all indicators for ${symbol}`);

        // Fetch historical data from stocks or crypto endpoint
        const isCrypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'MATIC', 'LINK', 'AVAX', 'DOT']
            .includes(symbol.toUpperCase());

        let apiFunction, dataKey;
        if (isCrypto) {
            apiFunction = 'DIGITAL_CURRENCY_DAILY';
            dataKey = 'Time Series (Digital Currency Daily)';
        } else {
            apiFunction = 'TIME_SERIES_DAILY';
            dataKey = 'Time Series (Daily)';
        }

        const apiUrl = isCrypto
            ? `https://www.alphavantage.co/query?function=${apiFunction}&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`
            : `https://www.alphavantage.co/query?function=${apiFunction}&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const response = await axios.get(apiUrl);

        if (response.data['Error Message']) {
            return res.status(404).json({ error: 'Symbol not found' });
        }

        if (response.data['Note']) {
            return res.status(429).json({ error: 'API rate limit reached. Try again in a minute.' });
        }

        const timeSeries = response.data[dataKey];
        if (!timeSeries) {
            return res.status(404).json({ error: 'No data found for this symbol' });
        }

        // Transform data
        const entries = Object.entries(timeSeries).reverse(); // Oldest first

        // Limit data based on range
        const rangeLimit = {
            '1M': 30,
            '3M': 90,
            '6M': 180,
            '1Y': 365,
            '5Y': 1825,
            'MAX': entries.length
        }[range] || 90;

        const limitedEntries = entries.slice(-rangeLimit);

        const candles = limitedEntries.map(([time, values]) => {
            const closeKey = isCrypto ? '4a. close (USD)' : '4. close';
            const highKey = isCrypto ? '2a. high (USD)' : '2. high';
            const lowKey = isCrypto ? '3a. low (USD)' : '3. low';

            return {
                time: new Date(time).getTime(),
                close: parseFloat(values[closeKey] || values['4. close']),
                high: parseFloat(values[highKey] || values['2. high']),
                low: parseFloat(values[lowKey] || values['3. low']),
            };
        });

        const closePrices = candles.map(c => c.close);

        // Calculate all indicators
        const rsi = calculateRSI(closePrices, 14);
        const macd = calculateMACD(closePrices, 12, 26, 9);
        const bollinger = calculateBollingerBands(closePrices, 20, 2);
        const stochastic = calculateStochastic(candles, 14, 3);
        const sma20 = calculateSMA(closePrices, 20);
        const sma50 = calculateSMA(closePrices, 50);
        const ema12 = calculateEMA(closePrices, 12);
        const ema26 = calculateEMA(closePrices, 26);

        // Combine into response
        const result = {
            symbol: symbol.toUpperCase(),
            range,
            dataPoints: candles.length,
            data: candles.map((candle, i) => ({
                time: candle.time,
                close: candle.close,
                high: candle.high,
                low: candle.low,
                rsi: rsi[i] !== null ? Math.round(rsi[i] * 100) / 100 : null,
                macdLine: macd.macdLine[i] !== null ? Math.round(macd.macdLine[i] * 1000) / 1000 : null,
                macdSignal: macd.signalLine[i] !== null ? Math.round(macd.signalLine[i] * 1000) / 1000 : null,
                macdHistogram: macd.histogram[i] !== null ? Math.round(macd.histogram[i] * 1000) / 1000 : null,
                bollingerUpper: bollinger.upper[i] !== null ? Math.round(bollinger.upper[i] * 100) / 100 : null,
                bollingerMiddle: bollinger.middle[i] !== null ? Math.round(bollinger.middle[i] * 100) / 100 : null,
                bollingerLower: bollinger.lower[i] !== null ? Math.round(bollinger.lower[i] * 100) / 100 : null,
                stochasticK: stochastic.k[i] !== null ? Math.round(stochastic.k[i] * 100) / 100 : null,
                stochasticD: stochastic.d[i] !== null ? Math.round(stochastic.d[i] * 100) / 100 : null,
                sma20: sma20[i] !== null ? Math.round(sma20[i] * 100) / 100 : null,
                sma50: sma50[i] !== null ? Math.round(sma50[i] * 100) / 100 : null,
                ema12: ema12[i] !== null ? Math.round(ema12[i] * 100) / 100 : null,
                ema26: ema26[i] !== null ? Math.round(ema26[i] * 100) / 100 : null,
            })),
            // Current indicator values (latest)
            current: {
                rsi: rsi[rsi.length - 1] !== null ? Math.round(rsi[rsi.length - 1] * 100) / 100 : null,
                macd: {
                    line: macd.macdLine[macd.macdLine.length - 1],
                    signal: macd.signalLine[macd.signalLine.length - 1],
                    histogram: macd.histogram[macd.histogram.length - 1]
                },
                bollinger: {
                    upper: bollinger.upper[bollinger.upper.length - 1],
                    middle: bollinger.middle[bollinger.middle.length - 1],
                    lower: bollinger.lower[bollinger.lower.length - 1]
                },
                stochastic: {
                    k: stochastic.k[stochastic.k.length - 1],
                    d: stochastic.d[stochastic.d.length - 1]
                }
            },
            // Trading signals based on indicators
            signals: {
                rsi: getRSISignal(rsi[rsi.length - 1]),
                macd: getMACDSignal(macd),
                bollinger: getBollingerSignal(closePrices[closePrices.length - 1], bollinger),
                stochastic: getStochasticSignal(stochastic)
            }
        };

        // Cache the result
        indicatorCache.set(cacheKey, { data: result, timestamp: Date.now() });

        console.log(`[Indicators] Calculated ${result.dataPoints} data points for ${symbol}`);
        res.json(result);

    } catch (error) {
        console.error('[Indicators] Error:', error.message);
        res.status(500).json({ error: 'Failed to calculate indicators', message: error.message });
    }
});

// @route   GET /api/indicators/:symbol/rsi
// @desc    Get RSI for a symbol
// @access  Private
router.get('/:symbol/rsi', auth, async (req, res) => {
    try {
        const symbol = sanitizeSymbol(req.params.symbol);
        const { period = 14, range = '3M' } = req.query;

        // Reuse the all indicators endpoint and filter
        const allData = await fetchIndicatorData(symbol, range);
        if (allData.error) {
            return res.status(allData.status || 500).json({ error: allData.error });
        }

        const rsi = calculateRSI(allData.closePrices, parseInt(period));

        res.json({
            symbol: symbol.toUpperCase(),
            period: parseInt(period),
            data: allData.candles.map((c, i) => ({
                time: c.time,
                rsi: rsi[i] !== null ? Math.round(rsi[i] * 100) / 100 : null
            })),
            current: rsi[rsi.length - 1] !== null ? Math.round(rsi[rsi.length - 1] * 100) / 100 : null,
            signal: getRSISignal(rsi[rsi.length - 1])
        });
    } catch (error) {
        console.error('[RSI] Error:', error.message);
        res.status(500).json({ error: 'Failed to calculate RSI' });
    }
});

// @route   GET /api/indicators/:symbol/macd
// @desc    Get MACD for a symbol
// @access  Private
router.get('/:symbol/macd', auth, async (req, res) => {
    try {
        const symbol = sanitizeSymbol(req.params.symbol);
        const { fast = 12, slow = 26, signal = 9, range = '3M' } = req.query;

        const allData = await fetchIndicatorData(symbol, range);
        if (allData.error) {
            return res.status(allData.status || 500).json({ error: allData.error });
        }

        const macd = calculateMACD(allData.closePrices, parseInt(fast), parseInt(slow), parseInt(signal));

        res.json({
            symbol: symbol.toUpperCase(),
            settings: { fast: parseInt(fast), slow: parseInt(slow), signal: parseInt(signal) },
            data: allData.candles.map((c, i) => ({
                time: c.time,
                macdLine: macd.macdLine[i],
                signalLine: macd.signalLine[i],
                histogram: macd.histogram[i]
            })),
            current: {
                line: macd.macdLine[macd.macdLine.length - 1],
                signal: macd.signalLine[macd.signalLine.length - 1],
                histogram: macd.histogram[macd.histogram.length - 1]
            },
            signal: getMACDSignal(macd)
        });
    } catch (error) {
        console.error('[MACD] Error:', error.message);
        res.status(500).json({ error: 'Failed to calculate MACD' });
    }
});

// @route   GET /api/indicators/:symbol/bollinger
// @desc    Get Bollinger Bands for a symbol
// @access  Private
router.get('/:symbol/bollinger', auth, async (req, res) => {
    try {
        const symbol = sanitizeSymbol(req.params.symbol);
        const { period = 20, stdDev = 2, range = '3M' } = req.query;

        const allData = await fetchIndicatorData(symbol, range);
        if (allData.error) {
            return res.status(allData.status || 500).json({ error: allData.error });
        }

        const bollinger = calculateBollingerBands(allData.closePrices, parseInt(period), parseFloat(stdDev));

        res.json({
            symbol: symbol.toUpperCase(),
            settings: { period: parseInt(period), stdDev: parseFloat(stdDev) },
            data: allData.candles.map((c, i) => ({
                time: c.time,
                close: c.close,
                upper: bollinger.upper[i],
                middle: bollinger.middle[i],
                lower: bollinger.lower[i]
            })),
            current: {
                price: allData.closePrices[allData.closePrices.length - 1],
                upper: bollinger.upper[bollinger.upper.length - 1],
                middle: bollinger.middle[bollinger.middle.length - 1],
                lower: bollinger.lower[bollinger.lower.length - 1]
            },
            signal: getBollingerSignal(allData.closePrices[allData.closePrices.length - 1], bollinger)
        });
    } catch (error) {
        console.error('[Bollinger] Error:', error.message);
        res.status(500).json({ error: 'Failed to calculate Bollinger Bands' });
    }
});

// ============ HELPER FUNCTIONS FOR API ============

async function fetchIndicatorData(symbol, range) {
    const isCrypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'MATIC', 'LINK', 'AVAX', 'DOT']
        .includes(symbol.toUpperCase());

    let apiFunction, dataKey;
    if (isCrypto) {
        apiFunction = 'DIGITAL_CURRENCY_DAILY';
        dataKey = 'Time Series (Digital Currency Daily)';
    } else {
        apiFunction = 'TIME_SERIES_DAILY';
        dataKey = 'Time Series (Daily)';
    }

    const apiUrl = isCrypto
        ? `https://www.alphavantage.co/query?function=${apiFunction}&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`
        : `https://www.alphavantage.co/query?function=${apiFunction}&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;

    const response = await axios.get(apiUrl);

    if (response.data['Error Message']) {
        return { error: 'Symbol not found', status: 404 };
    }

    if (response.data['Note']) {
        return { error: 'API rate limit reached', status: 429 };
    }

    const timeSeries = response.data[dataKey];
    if (!timeSeries) {
        return { error: 'No data found', status: 404 };
    }

    const entries = Object.entries(timeSeries).reverse();
    const rangeLimit = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825, 'MAX': entries.length }[range] || 90;
    const limitedEntries = entries.slice(-rangeLimit);

    const candles = limitedEntries.map(([time, values]) => {
        const closeKey = isCrypto ? '4a. close (USD)' : '4. close';
        const highKey = isCrypto ? '2a. high (USD)' : '2. high';
        const lowKey = isCrypto ? '3a. low (USD)' : '3. low';

        return {
            time: new Date(time).getTime(),
            close: parseFloat(values[closeKey] || values['4. close']),
            high: parseFloat(values[highKey] || values['2. high']),
            low: parseFloat(values[lowKey] || values['3. low']),
        };
    });

    return {
        candles,
        closePrices: candles.map(c => c.close)
    };
}

// Trading signal generators
function getRSISignal(rsi) {
    if (rsi === null) return { signal: 'neutral', description: 'Insufficient data' };
    if (rsi < 30) return { signal: 'oversold', description: 'RSI below 30 - Potential buy signal', strength: 'strong' };
    if (rsi < 40) return { signal: 'approaching_oversold', description: 'RSI approaching oversold', strength: 'moderate' };
    if (rsi > 70) return { signal: 'overbought', description: 'RSI above 70 - Potential sell signal', strength: 'strong' };
    if (rsi > 60) return { signal: 'approaching_overbought', description: 'RSI approaching overbought', strength: 'moderate' };
    return { signal: 'neutral', description: 'RSI in neutral zone (30-70)', strength: 'neutral' };
}

function getMACDSignal(macd) {
    const line = macd.macdLine[macd.macdLine.length - 1];
    const signal = macd.signalLine[macd.signalLine.length - 1];
    const histogram = macd.histogram[macd.histogram.length - 1];
    const prevHistogram = macd.histogram[macd.histogram.length - 2];

    if (line === null || signal === null) {
        return { signal: 'neutral', description: 'Insufficient data' };
    }

    // Crossover detection
    if (prevHistogram !== null && histogram !== null) {
        if (prevHistogram < 0 && histogram > 0) {
            return { signal: 'bullish_crossover', description: 'MACD crossed above signal - Buy signal', strength: 'strong' };
        }
        if (prevHistogram > 0 && histogram < 0) {
            return { signal: 'bearish_crossover', description: 'MACD crossed below signal - Sell signal', strength: 'strong' };
        }
    }

    if (line > signal && line > 0) {
        return { signal: 'bullish', description: 'MACD above signal in positive territory', strength: 'moderate' };
    }
    if (line < signal && line < 0) {
        return { signal: 'bearish', description: 'MACD below signal in negative territory', strength: 'moderate' };
    }

    return { signal: 'neutral', description: 'MACD showing no clear direction', strength: 'neutral' };
}

function getBollingerSignal(price, bollinger) {
    const upper = bollinger.upper[bollinger.upper.length - 1];
    const middle = bollinger.middle[bollinger.middle.length - 1];
    const lower = bollinger.lower[bollinger.lower.length - 1];

    if (upper === null || lower === null) {
        return { signal: 'neutral', description: 'Insufficient data' };
    }

    const bandWidth = upper - lower;
    const percentB = (price - lower) / bandWidth;

    if (price >= upper) {
        return { signal: 'overbought', description: 'Price at or above upper band - Potential reversal', strength: 'strong', percentB };
    }
    if (price <= lower) {
        return { signal: 'oversold', description: 'Price at or below lower band - Potential bounce', strength: 'strong', percentB };
    }
    if (price > middle) {
        return { signal: 'bullish', description: 'Price above middle band', strength: 'moderate', percentB };
    }
    return { signal: 'bearish', description: 'Price below middle band', strength: 'moderate', percentB };
}

function getStochasticSignal(stochastic) {
    const k = stochastic.k[stochastic.k.length - 1];
    const d = stochastic.d[stochastic.d.length - 1];

    if (k === null || d === null) {
        return { signal: 'neutral', description: 'Insufficient data' };
    }

    if (k < 20 && d < 20) {
        return { signal: 'oversold', description: 'Stochastic oversold - Potential buy', strength: 'strong' };
    }
    if (k > 80 && d > 80) {
        return { signal: 'overbought', description: 'Stochastic overbought - Potential sell', strength: 'strong' };
    }
    if (k > d && k < 50) {
        return { signal: 'bullish_crossover', description: '%K crossed above %D in oversold zone', strength: 'moderate' };
    }
    if (k < d && k > 50) {
        return { signal: 'bearish_crossover', description: '%K crossed below %D in overbought zone', strength: 'moderate' };
    }

    return { signal: 'neutral', description: 'Stochastic in neutral zone', strength: 'neutral' };
}

module.exports = router;
