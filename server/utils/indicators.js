// server/utils/indicators.js

// Function to calculate Simple Moving Average (SMA)
const calculateSMA = (data, period, property = 'close') => {
    if (data.length < period) return null;
    const slicedData = data.slice(-period);
    const sum = slicedData.reduce((acc, curr) => acc + curr[property], 0);
    return sum / period;
};

// Function to calculate Relative Strength Index (RSI)
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Function to calculate Exponential Moving Average (EMA) - Helper for MACD
const calculateEMA = (data, period, property = 'close') => {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((acc, curr) => acc + curr[property], 0) / period; // Initial SMA
    for (let i = period; i < data.length; i++) {
        ema = (data[i][property] - ema) * k + ema;
    }
    return ema;
};

// Function to calculate MACD
const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod + signalPeriod) return { macd: null, signal: null, histogram: null };
    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);
    const macdLine = emaFast - emaSlow; // Simplified for single point, ideally needs full series for signal line
    // NOTE: True MACD signal line requires EMA of the MACD line itself over time.
    // For this simplified version, we might just return the components if full series isn't available.
    // A full implementation would generate arrays of EMAs.
    return { macd: macdLine, signal: null, histogram: null }; // Placeholder if full series not calculated
};

// Function to calculate Bollinger Bands
const calculateBollingerBands = (data, period = 20, numStdDev = 2) => {
    if (data.length < period) return { upper: null, mid: null, lower: null };
    const sma = calculateSMA(data, period);
    const slicedData = data.slice(-period);
    const variance = slicedData.reduce((acc, curr) => acc + Math.pow(curr.close - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return { upper: sma + numStdDev * stdDev, mid: sma, lower: sma - numStdDev * stdDev };
};

// Function to calculate VWAP (Volume Weighted Average Price)
const calculateVWAP = (data) => {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    for (const candle of data) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
    }
    return cumulativeVolume === 0 ? null : cumulativeTPV / cumulativeVolume;
};

module.exports = {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVWAP,
};