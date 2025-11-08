// server/utils/indicators.js

// Function to calculate Simple Moving Average (SMA)
const calculateSMA = (data, period, property = 'close') => {
    if (data.length < period) return null;
    const slicedData = data.slice(-period);
    const sum = slicedData.reduce((acc, curr) => acc + curr[property], 0);
    return sum / period;
};

// Function to calculate Exponential Moving Average (EMA)
const calculateEMA = (data, period, property = 'close') => {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = data[0][property]; // Initialize with first value, or SMA of first 'period' values

    // If there's enough data for a full period, start EMA calculation after the first period
    if (data.length >= period) {
        // Option 1: Start with SMA of the first 'period' values
        const initialSMA = calculateSMA(data.slice(0, period), period, property);
        if (initialSMA !== null) {
            ema = initialSMA;
            for (let i = period; i < data.length; i++) {
                ema = (data[i][property] - ema) * k + ema;
            }
        } else {
            // Fallback if not enough initial data for SMA, use first point
            ema = data[0][property];
            for (let i = 1; i < data.length; i++) {
                ema = (data[i][property] - ema) * k + ema;
            }
        }
    } else {
        // Not enough data for a full period, calculate EMA from start
        ema = data[0][property];
        for (let i = 1; i < data.length; i++) {
            ema = (data[i][property] - ema) * k + ema;
        }
    }

    return ema;
};

// Function to calculate Relative Strength Index (RSI)
// Default period is 14, needs enough data points (at least period + 1)
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return null;

    let gains = [];
    let losses = [];

    // Calculate initial gains and losses
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff > 0) {
            gains.push(diff);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(diff));
        }
    }

    let avgGain = gains.reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    // Calculate subsequent averages
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        let currentGain = 0;
        let currentLoss = 0;
        if (diff > 0) {
            currentGain = diff;
        } else {
            currentLoss = Math.abs(diff);
        }

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100; // No losses, RSI is 100
    if (avgGain === 0) return 0;   // No gains, RSI is 0

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Function to calculate Moving Average Convergence Divergence (MACD)
// Default periods are 12 (fast), 26 (slow), 9 (signal)
const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod + signalPeriod) return { macd: null, signal: null, histogram: null };

    const emaFastData = [];
    const emaSlowData = [];
    const macdLine = [];

    // Calculate EMA values for the entire dataset
    for (let i = 0; i < data.length; i++) {
        const currentDataSlice = data.slice(0, i + 1);
        emaFastData.push(calculateEMA(currentDataSlice, fastPeriod));
        emaSlowData.push(calculateEMA(currentDataSlice, slowPeriod));
    }

    // Calculate MACD line
    for (let i = 0; i < data.length; i++) {
        if (emaFastData[i] !== null && emaSlowData[i] !== null) {
            macdLine.push(emaFastData[i] - emaSlowData[i]);
        } else {
            macdLine.push(null);
        }
    }

    // Filter out nulls for signal line calculation
    const validMacdLine = macdLine.filter(val => val !== null);
    if (validMacdLine.length < signalPeriod) return { macd: null, signal: null, histogram: null };

    // Calculate Signal line using EMA of the MACD line
    const signalLine = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] === null || i < slowPeriod - 1) { // MACD line values start after slowPeriod-1
            signalLine.push(null);
        } else {
            const macdSlice = macdLine.slice(0, i + 1).filter(val => val !== null);
            if (macdSlice.length >= signalPeriod) {
                 const currentSignal = calculateEMA(
                    macdSlice.map(val => ({ close: val })), // Wrap MACD values in a {close: val} object
                    signalPeriod
                 );
                 signalLine.push(currentSignal);
            } else {
                signalLine.push(null);
            }
        }
    }

    // Calculate Histogram
    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] !== null && signalLine[i] !== null) {
            histogram.push(macdLine[i] - signalLine[i]);
        } else {
            histogram.push(null);
        }
    }

    // Return the last valid values
    const lastMacd = macdLine[macdLine.length - 1];
    const lastSignal = signalLine[signalLine.length - 1];
    const lastHistogram = histogram[histogram.length - 1];

    return { macd: lastMacd, signal: lastSignal, histogram: lastHistogram };
};

// Function to calculate Bollinger Bands
// Default period is 20, numStdDev is 2
const calculateBollingerBands = (data, period = 20, numStdDev = 2) => {
    if (data.length < period) return { upper: null, mid: null, lower: null };

    const closes = data.slice(-period).map(d => d.close);
    const midBand = calculateSMA(data, period);

    if (midBand === null) return { upper: null, mid: null, lower: null };

    // Calculate Standard Deviation
    const sumOfSquares = closes.reduce((acc, val) => acc + Math.pow(val - midBand, 2), 0);
    const standardDeviation = Math.sqrt(sumOfSquares / period);

    const upperBand = midBand + (standardDeviation * numStdDev);
    const lowerBand = midBand - (standardDeviation * numStdDev);

    return { upper: upperBand, mid: midBand, lower: lowerBand };
};

// Function to calculate Volume-Weighted Average Price (VWAP)
// VWAP should ideally be calculated over intraday data, but we'll adapt for daily.
const calculateVWAP = (data) => {
    if (data.length === 0) return null;

    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;

    for (const d of data) {
        if (d.high !== undefined && d.low !== undefined && d.close !== undefined && d.volume !== undefined) {
            const typicalPrice = (d.high + d.low + d.close) / 3;
            cumulativePriceVolume += typicalPrice * d.volume;
            cumulativeVolume += d.volume;
        } else {
            // Handle cases where OHLCV data might be incomplete
            console.warn("Incomplete OHLCV data for VWAP calculation:", d);
        }
    }

    return cumulativeVolume !== 0 ? cumulativePriceVolume / cumulativeVolume : null;
};

module.exports = {
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVWAP,
};