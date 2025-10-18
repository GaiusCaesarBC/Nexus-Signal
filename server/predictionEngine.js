// This file contains the logic for generating a stock prediction based on technical indicators.

/**
 * Calculates the Simple Moving Average (SMA) for a given set of data.
 * @param {Array<number>} data - An array of closing prices.
 * @param {number} period - The number of days for the SMA.
 * @returns {number} The calculated SMA.
 */
const calculateSMA = (data, period) => {
    const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
};

/**
 * Calculates the Relative Strength Index (RSI).
 * @param {Array<object>} data - An array of historical data objects with a 'close' property.
 * @param {number} period - The period for RSI calculation (usually 14).
 * @returns {number} The calculated RSI value.
 */
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return 50; // Neutral RSI if not enough data

    let gains = 0;
    let losses = 0;

    // Calculate initial average gains and losses
    for (let i = data.length - period; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100; // Prevent division by zero

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

/**
 * Calculates the Moving Average Convergence Divergence (MACD).
 * @param {Array<number>} data - An array of closing prices.
 * @returns {object} An object containing the MACD line and the signal line.
 */
const calculateMACD = (data) => {
    if (data.length < 26) return { macdLine: 0, signalLine: 0 };

    const calculateEMA = (prices, period) => {
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * k) + (ema * (1 - k));
        }
        return ema;
    };

    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    const macdLine = ema12 - ema26;

    // For simplicity, we'll approximate the signal line. A full implementation is more complex.
    // In a real scenario, you'd calculate the EMA of the MACD line itself.
    const signalLine = calculateEMA([macdLine], 9); 

    return { macdLine, signalLine };
};


/**
 * Generates a stock prediction based on a combination of technical indicators.
 * A signal is only generated if all indicators agree.
 * @param {Array<object>} historicalData - Array of objects with 'date' and 'close' properties.
 * @returns {object} An object containing the signal, confidence, and analysis of each indicator.
 */
const generatePrediction = (historicalData) => {
    if (historicalData.length < 50) {
        return { 
            signal: 'Hold', 
            confidence: 50,
            analysis: {
                sma: 'Not enough data',
                rsi: 'Not enough data',
                macd: 'Not enough data',
            }
        };
    }

    const closePrices = historicalData.map(d => d.close);

    // 1. SMA Analysis
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    let smaSignal = sma20 > sma50 ? 'Buy' : 'Sell';
    if (Math.abs(sma20 - sma50) < sma50 * 0.01) smaSignal = 'Hold'; // Neutral if very close

    // 2. RSI Analysis
    const rsi = calculateRSI(historicalData, 14);
    let rsiSignal = 'Hold';
    if (rsi > 70) rsiSignal = 'Sell'; // Overbought
    if (rsi < 30) rsiSignal = 'Buy'; // Oversold

    // 3. MACD Analysis
    const { macdLine, signalLine } = calculateMACD(closePrices);
    let macdSignal = 'Hold';
    if (macdLine > signalLine) macdSignal = 'Buy'; // Bullish crossover
    if (macdLine < signalLine) macdSignal = 'Sell'; // Bearish crossover

    // --- Final Decision Logic ---
    // All indicators must agree for a strong signal.
    if (smaSignal === 'Buy' && rsiSignal === 'Buy' && macdSignal === 'Buy') {
        return { 
            signal: 'Buy', 
            confidence: 85,
            analysis: { sma: 'Bullish Crossover', rsi: 'Oversold', macd: 'Bullish Crossover' }
        };
    }

    if (smaSignal === 'Sell' && rsiSignal === 'Sell' && macdSignal === 'Sell') {
        return { 
            signal: 'Sell', 
            confidence: 85,
            analysis: { sma: 'Bearish Crossover', rsi: 'Overbought', macd: 'Bearish Crossover' }
        };
    }

    // Default to Hold if indicators disagree or are neutral
    return { 
        signal: 'Hold', 
        confidence: 65,
        analysis: { 
            sma: smaSignal === 'Buy' ? 'Weak Bullish' : smaSignal === 'Sell' ? 'Weak Bearish' : 'Neutral',
            rsi: rsi > 55 ? 'Slightly Overbought' : rsi < 45 ? 'Slightly Oversold' : 'Neutral',
            macd: macdSignal === 'Buy' ? 'Weak Bullish' : macdSignal === 'Sell' ? 'Weak Bearish' : 'Neutral',
        }
    };
};

module.exports = { generatePrediction };