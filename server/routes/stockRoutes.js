// server/routes/stockRoutes.js - COMPLETE FIXED VERSION

const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware');

// ✅ CORRECT instantiation
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

// Helper to determine the start date for historical data fetching
function getPeriod1Date(range) {
    const now = new Date();
    let period1Date;
    switch (range) {
        case '1D': period1Date = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case '5D': period1Date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); break;
        case '1M': period1Date = new Date(now.setMonth(now.getMonth() - 1)); break;
        case '3M': period1Date = new Date(now.setMonth(now.getMonth() - 3)); break;
        case '6M': period1Date = new Date(now.setMonth(now.getMonth() - 6)); break;
        case '1Y': period1Date = new Date(now.setFullYear(now.getFullYear() - 1)); break;
        case '5Y': period1Date = new Date(now.setFullYear(now.getFullYear() - 5)); break;
        case 'MAX': period1Date = new Date('1980-01-01'); break;
        default: period1Date = new Date(now.setMonth(now.getMonth() - 1)); break;
    }
    return period1Date;
}

// GET /api/stocks/historical/:symbol - Fetch historical stock data (NO AUTH REQUIRED)
router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M', interval = '1d' } = req.query;

        console.log(`Fetching historical data for ${symbol} - Range: ${range}, Interval: ${interval}`);

        const period1 = getPeriod1Date(range);
        const period2 = new Date();

        const result = await yahooFinance.chart(symbol, {
            period1,
            period2,
            interval,
        });

        if (!result || !result.quotes || result.quotes.length === 0) {
            return res.status(404).json({ 
                msg: `No historical data found for ${symbol}` 
            });
        }

        const historicalData = result.quotes.map(quote => ({
            time: new Date(quote.date).getTime(),
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            volume: quote.volume,
        }));

        res.json({
            symbol,
            historicalData,
            meta: result.meta,
        });

    } catch (error) {
        console.error('Error fetching historical stock data:', error.message);
        res.status(500).json({ 
            msg: 'Failed to fetch historical data', 
            error: error.message 
        });
    }
});

// GET /api/stocks/prediction/:symbol - Get AI prediction
router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M', interval = '1d' } = req.query;

        console.log(`Getting prediction for ${symbol} - Range: ${range}, Interval: ${interval}`);

        const period1 = getPeriod1Date(range);
        const period2 = new Date();

        const result = await yahooFinance.chart(symbol, {
            period1,
            period2,
            interval,
        });

        if (!result || !result.quotes || result.quotes.length === 0) {
            return res.status(404).json({ 
                msg: `No data available for ${symbol}` 
            });
        }

        const historicalData = result.quotes.map(quote => ({
            time: new Date(quote.date).getTime(),
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            volume: quote.volume,
        }));

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        
        // Calculate prediction
        const prediction = calculateStockPrediction(historicalData, lastClosePrice);

        res.json({
            symbol,
            currentPrice: lastClosePrice,
            historicalData, // ✅ Include for chart
            ...prediction,
        });

    } catch (error) {
        console.error('Error generating prediction:', error.message);
        res.status(500).json({ 
            msg: 'Failed to generate prediction', 
            error: error.message 
        });
    }
});

// ✅ FIXED calculateStockPrediction function
const calculateStockPrediction = (historicalData, lastClosePrice) => {
    console.log('=== PREDICTION DEBUG ===');
    console.log('Historical data points:', historicalData.length);
    console.log('Last close price:', lastClosePrice);
    
    const sortedData = [...historicalData].sort((a, b) => a.time - b.time);
    const closes = sortedData.map(d => d.close);
    const volumes = sortedData.map(d => d.volume || 0); // ✅ Fixed scope
    
    console.log('Closes array length:', closes.length);
    console.log('Volumes array length:', volumes.length);

    const hasEnoughData = (minLen) => closes.length >= minLen;

    // Calculate indicators
    const rsi = hasEnoughData(14) ? calculateRSI(closes) : null;
    const macdResult = hasEnoughData(26) ? calculateMACD(closes) : { macd: null, signal: null, histogram: null };
    const bbResult = hasEnoughData(20) ? calculateBollingerBands(closes) : { mid: lastClosePrice, upper: null, lower: null };
    const sma20 = hasEnoughData(20) ? calculateSMA(closes, 20) : null;
    const sma50 = hasEnoughData(50) ? calculateSMA(closes, 50) : null;
    const sma200 = hasEnoughData(200) ? calculateSMA(closes, 200) : null;
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

    console.log('Indicators calculated:', { rsi, sma50, sma200, macd: macdResult.macd });

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    // SMA Analysis
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
        } else if (lastClosePrice < sma50) {
            bearishScore += 2;
            signals.push("Price below 50-period SMA");
        }
    } else if (sma50 !== null && hasEnoughData(50)) {
        if (lastClosePrice > sma50) {
            bullishScore += 2.5;
            signals.push("Price above 50-period SMA");
        } else if (lastClosePrice < sma50) {
            bearishScore += 2.5;
            signals.push("Price below 50-period SMA");
        }
    }

    // RSI Analysis
    if (rsi !== null) {
        if (rsi < 30) {
            bullishScore += 3;
            signals.push(`RSI oversold (${rsi.toFixed(0)}) - potential bounce`);
        } else if (rsi > 70) {
            bearishScore += 3;
            signals.push(`RSI overbought (${rsi.toFixed(0)}) - potential pullback`);
        } else if (rsi > 50) {
            bullishScore += 0.5;
            signals.push(`RSI positive (${rsi.toFixed(0)})`);
        } else if (rsi < 50) {
            bearishScore += 0.5;
            signals.push(`RSI negative (${rsi.toFixed(0)})`);
        }
    }

    // MACD Analysis
    if (macdResult.macd !== null && macdResult.signal !== null && macdResult.histogram !== null) {
        if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
            bullishScore += 3.5;
            signals.push("MACD bullish crossover with positive momentum");
        } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
            bearishScore += 3.5;
            signals.push("MACD bearish crossover with negative momentum");
        } else if (macdResult.macd > macdResult.signal) {
            bullishScore += 1.5;
            signals.push("MACD bullish crossover");
        } else if (macdResult.macd < macdResult.signal) {
            bearishScore += 1.5;
            signals.push("MACD bearish crossover");
        }
    }

    // Bollinger Bands Analysis
    if (bbResult.upper !== null && bbResult.lower !== null && bbResult.mid !== null) {
        if (lastClosePrice >= bbResult.upper * 0.99) {
            bearishScore += 2;
            signals.push("Price near upper Bollinger Band (potential resistance)");
        } else if (lastClosePrice <= bbResult.lower * 1.01) {
            bullishScore += 2;
            signals.push("Price near lower Bollinger Band (potential support)");
        } else if (lastClosePrice > bbResult.mid) {
            bullishScore += 0.75;
            signals.push("Price above Bollinger Band middle line");
        } else if (lastClosePrice < bbResult.mid) {
            bearishScore += 0.75;
            signals.push("Price below Bollinger Band middle line");
        }
    }

    // Volume Analysis
    if (avgVolume !== null && volumes.length > 0) {
        const lastVolume = volumes[volumes.length - 1];
        if (lastVolume > avgVolume * 1.5) {
            signals.push("High volume spike detected");
        }
    }

    console.log('Scores:', { bullishScore, bearishScore });

    // Calculate final prediction
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
            sma20,
            sma50,
            sma200,
            avgVolume,
            lastVolume: volumes[volumes.length - 1],
        }
    };
};

module.exports = router;