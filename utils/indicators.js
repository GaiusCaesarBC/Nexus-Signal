// server/utils/indicators.js - FIXED to work with number arrays

// Function to calculate Simple Moving Average (SMA)
const calculateSMA = (data, period) => {
    if (!Array.isArray(data) || data.length < period) return null;
    const slicedData = data.slice(-period);
    const sum = slicedData.reduce((acc, val) => acc + val, 0);
    return sum / period;
};

// Function to calculate Relative Strength Index (RSI)
const calculateRSI = (data, period = 14) => {
    if (!Array.isArray(data) || data.length <= period) return null;
    
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate smoothed average gain/loss for remaining data
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Function to calculate Exponential Moving Average (EMA)
const calculateEMA = (data, period) => {
    if (!Array.isArray(data) || data.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((acc, val) => acc + val, 0) / period; // Initial SMA
    
    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * k + ema;
    }
    
    return ema;
};

// Function to calculate full EMA array (needed for MACD signal line)
const calculateEMAArray = (data, period) => {
    if (!Array.isArray(data) || data.length < period) return [];
    
    const k = 2 / (period + 1);
    const emaArray = [];
    
    // Initial SMA for first EMA value
    let ema = data.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
    emaArray.push(ema);
    
    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * k + ema;
        emaArray.push(ema);
    }
    
    return emaArray;
};

// Function to calculate MACD (properly with signal line)
const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (!Array.isArray(data) || data.length < slowPeriod + signalPeriod) {
        return { macd: null, signal: null, histogram: null };
    }
    
    // Calculate fast and slow EMA arrays
    const fastEMA = calculateEMAArray(data, fastPeriod);
    const slowEMA = calculateEMAArray(data, slowPeriod);
    
    // Calculate MACD line (difference between fast and slow EMA)
    const macdLine = [];
    const startIndex = slowPeriod - fastPeriod;
    for (let i = startIndex; i < fastEMA.length; i++) {
        macdLine.push(fastEMA[i] - slowEMA[i - startIndex]);
    }
    
    if (macdLine.length < signalPeriod) {
        return { macd: null, signal: null, histogram: null };
    }
    
    // Calculate signal line (EMA of MACD line)
    const k = 2 / (signalPeriod + 1);
    let signalEMA = macdLine.slice(0, signalPeriod).reduce((acc, val) => acc + val, 0) / signalPeriod;
    
    for (let i = signalPeriod; i < macdLine.length; i++) {
        signalEMA = (macdLine[i] - signalEMA) * k + signalEMA;
    }
    
    const currentMacd = macdLine[macdLine.length - 1];
    const histogram = currentMacd - signalEMA;
    
    return {
        macd: currentMacd,
        signal: signalEMA,
        histogram: histogram
    };
};

// Function to calculate Bollinger Bands
const calculateBollingerBands = (data, period = 20, numStdDev = 2) => {
    if (!Array.isArray(data) || data.length < period) {
        return { upper: null, mid: null, lower: null };
    }
    
    const sma = calculateSMA(data, period);
    const slicedData = data.slice(-period);
    
    const variance = slicedData.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
        upper: sma + numStdDev * stdDev,
        mid: sma,
        lower: sma - numStdDev * stdDev
    };
};

// Function to calculate VWAP (Volume Weighted Average Price)
// This one still needs objects with high, low, close, volume
const calculateVWAP = (data) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    
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
    calculateEMA,
};