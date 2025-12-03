// This file contains the logic for generating a stock prediction based on technical indicators.

/**
 * Calculates the Simple Moving Average (SMA).
 * @param {Array<number>} data - An array of closing prices or volumes.
 * @param {number} period - The number of days for the SMA.
 * @returns {number} The calculated SMA. Returns 0 if data is insufficient.
 */
const calculateSMA = (data, period) => {
    if (data.length < period) return 0;
    const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
};

/**
 * Calculates the Exponential Moving Average (EMA).
 * @param {Array<number>} data - Array of prices.
 * @param {number} period - The EMA period.
 * @returns {Array<number>} An array containing EMA values for each point. Returns empty if data is insufficient.
 */
const calculateEMA = (data, period) => {
    if (data.length < period) return []; // Not enough data to calculate EMA
    const k = 2 / (period + 1);
    const emaArray = [data[0]]; // Start with the first price as the initial EMA
    for (let i = 1; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
};

/**
 * Calculates the Relative Strength Index (RSI).
 * @param {Array<object>} data - An array of historical data objects with a 'close' property.
 * @param {number} period - The period for RSI calculation (usually 14).
 * @returns {number} The calculated RSI value. Returns 50 if data is insufficient.
 */
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return 50; // Neutral RSI if not enough data

    let gains = 0;
    let losses = 0;

    // Calculate initial average gains and losses using the first `period` changes
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            gains += change;
        } else {
            losses -= change; // Store losses as positive values
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smooth subsequent gains and losses
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        let currentGain = 0;
        let currentLoss = 0;
        if (change > 0) {
            currentGain = change;
        } else {
            currentLoss = -change;
        }
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }


    if (avgLoss === 0) return 100; // Prevent division by zero

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

/**
 * Calculates the Moving Average Convergence Divergence (MACD).
 * Uses proper EMA calculations.
 * @param {Array<number>} data - An array of closing prices.
 * @returns {object} An object containing the latest MACD line, signal line, and histogram. Returns zeros if insufficient data.
 */
const calculateMACD = (data) => {
    // Need enough data for EMA 26 + EMA 9 of MACD line. EMA 26 needs 26 points.
    // The MACD line series starts after 26 points. EMA 9 needs 9 points of MACD line.
    // So, 26 + 9 - 1 = 34 points minimum (adjusting for array indexing). Let's use 35 for safety.
    if (data.length < 35) {
        return { macdLine: 0, signalLine: 0, histogram: 0 };
    }

    const ema12Series = calculateEMA(data, 12);
    const ema26Series = calculateEMA(data, 26);

    // Align the series: ema12 will be longer. Start MACD calculation from where ema26 begins.
    const startIdx = ema12Series.length - ema26Series.length;
    const macdLineSeries = ema26Series.map((ema26Val, index) => ema12Series[startIdx + index] - ema26Val);

    // Ensure macdLineSeries has enough data points for the signal line EMA (9 periods)
    if (macdLineSeries.length < 9) {
        return { macdLine: 0, signalLine: 0, histogram: 0 }; // Should not happen with initial 35 check, but good safeguard
    }

    const signalLineSeries = calculateEMA(macdLineSeries, 9);

    // Get the latest values
    const latestMacdLine = macdLineSeries[macdLineSeries.length - 1];
    const latestSignalLine = signalLineSeries[signalLineSeries.length - 1];
    const histogram = latestMacdLine - latestSignalLine; // Histogram is MACD - Signal

    // Get the previous histogram value for crossover detection
    const previousHistogram = macdLineSeries[macdLineSeries.length - 2] - signalLineSeries[signalLineSeries.length - 2];

    return {
        macdLine: latestMacdLine,
        signalLine: latestSignalLine,
        histogram: histogram,
        previousHistogram: previousHistogram // Needed for crossover detection
    };
};

/**
 * Generates a stock prediction using a weighted score from SMA, RSI, MACD, and Volume.
 * @param {Array<object>} historicalData - Array of objects with 'date', 'close', and 'volume' properties.
 * @returns {object} An object containing the signal, confidence, and analysis of each indicator.
 */
const generatePrediction = (historicalData) => {
    // Increased minimum length due to refined MACD calculation needing more data (35)
    if (historicalData.length < 50) { // Keep 50 for SMA50
        return {
            signal: 'Hold',
            confidence: 50,
            analysis: {
                sma: 'Not enough data',
                rsi: 'Not enough data',
                macd: 'Not enough data',
                volume: 'Not enough data'
            }
        };
    }

    const closePrices = historicalData.map(d => d.close);
    const volumes = historicalData.map(d => d.volume);

    // --- Indicator Calculations ---

    // 1. SMA Analysis
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    let smaSignal = 'Hold';
    if (sma20 > sma50 * 1.005) smaSignal = 'Buy'; // Add small threshold to avoid noise
    if (sma20 < sma50 * 0.995) smaSignal = 'Sell';

    // 2. RSI Analysis
    const rsi = calculateRSI(historicalData, 14);

    // 3. MACD Analysis (Refined)
    const { macdLine, signalLine, histogram, previousHistogram } = calculateMACD(closePrices);
    let macdSignal = 'Hold';
    if (histogram > 0 && previousHistogram <= 0) {
        macdSignal = 'Buy'; // Histogram crossed above zero
    } else if (histogram < 0 && previousHistogram >= 0) {
        macdSignal = 'Sell'; // Histogram crossed below zero
    } else if (histogram > 0 && macdLine > signalLine) { // Check both histogram and line position
        macdSignal = 'Weak Buy'; // MACD line is above signal line (bullish trend)
    } else if (histogram < 0 && macdLine < signalLine) { // Check both histogram and line position
        macdSignal = 'Weak Sell'; // MACD line is below signal line (bearish trend)
    }

    // 4. Volume Analysis
    const vma20 = calculateSMA(volumes, 20);
    const latestVolume = volumes[volumes.length - 1];
    let volumeAnalysis = 'Normal';
    let volumeScore = 0;
    if (vma20 > 0) { // Avoid division by zero if VMA is somehow 0
        if (latestVolume > vma20 * 1.5) { // Volume 50% above average
            volumeAnalysis = 'High';
            volumeScore = 1; // Add weight if volume confirms trend
        } else if (latestVolume < vma20 * 0.7) { // Volume 30% below average
            volumeAnalysis = 'Low';
            volumeScore = -0.5; // Slightly decrease weight if volume contradicts
        }
    }


    // --- Weighted Scoring ---
    let score = 0;
    let analysis = {};

    // SMA Score (+1 / -1 / 0)
    if (smaSignal === 'Buy') {
        score += 1;
        analysis.sma = 'Bullish Crossover (SMA20 > SMA50)';
    } else if (smaSignal === 'Sell') {
        score -= 1;
        analysis.sma = 'Bearish Crossover (SMA20 < SMA50)';
    } else {
        analysis.sma = 'Neutral (SMAs Close)';
    }

    // RSI Score (+2 / +1 / -1 / -2 / 0)
    if (rsi < 30) {
        score += 2; // Strong Buy signal
        analysis.rsi = `Oversold (${rsi.toFixed(1)})`;
    } else if (rsi < 40) {
        score += 1; // Weak Buy signal
        analysis.rsi = `Approaching Oversold (${rsi.toFixed(1)})`;
    } else if (rsi > 70) {
        score -= 2; // Strong Sell signal
        analysis.rsi = `Overbought (${rsi.toFixed(1)})`;
    } else if (rsi > 60) {
        score -= 1; // Weak Sell signal
        analysis.rsi = `Approaching Overbought (${rsi.toFixed(1)})`;
    } else {
        analysis.rsi = `Neutral (${rsi.toFixed(1)})`;
    }

    // MACD Score (+2 / +1 / -1 / -2 / 0)
    if (macdSignal === 'Buy') {
        score += 2; // Strong Buy on crossover
        analysis.macd = 'Bullish Crossover (Histogram crossed Zero)';
    } else if (macdSignal === 'Weak Buy') {
        score += 1;
        analysis.macd = 'Bullish (MACD > Signal Line)';
    } else if (macdSignal === 'Sell') {
        score -= 2; // Strong Sell on crossover
        analysis.macd = 'Bearish Crossover (Histogram crossed Zero)';
    } else if (macdSignal === 'Weak Sell') {
        score -= 1;
        analysis.macd = 'Bearish (MACD < Signal Line)';
    } else {
         analysis.macd = 'Neutral';
    }

    // Add Volume Analysis to the report
    analysis.volume = volumeAnalysis;

    // Apply Volume Score to modify the trend score
    if (score > 0) { // Potential Buy trend
        score += volumeScore; // High volume increases score, Low volume decreases it
    } else if (score < 0) { // Potential Sell trend
        score -= volumeScore; // High volume makes score more negative, Low volume makes it less negative
    }

    // --- Final Decision Logic based on Score ---
    let finalSignal = 'Hold';
    let confidence = 50; // Base confidence

    // Define thresholds and max possible score (adjust based on indicator weights)
    const buyThreshold = 3;  // Example threshold for a Buy signal
    const sellThreshold = -3; // Example threshold for a Sell signal
    const maxScore = 6; // Example: 1 (SMA) + 2 (RSI) + 2 (MACD) + 1 (Volume) = 6

    if (score >= buyThreshold) {
        finalSignal = 'Buy';
        // Confidence scales from 75% at threshold up to 100% at maxScore
        confidence = 75 + ( (score - buyThreshold) / (maxScore - buyThreshold) ) * 25;
    } else if (score <= sellThreshold) {
        finalSignal = 'Sell';
        // Confidence scales from 75% at threshold up to 100% at maxScore (absolute values)
        confidence = 75 + ( (Math.abs(score) - Math.abs(sellThreshold)) / (maxScore - Math.abs(sellThreshold)) ) * 25;
    } else {
        finalSignal = 'Hold';
        // Confidence is higher closer to 0, lower closer to thresholds
        confidence = 70 - (Math.abs(score) / Math.max(buyThreshold, Math.abs(sellThreshold))) * 20; // Scales 50-70
    }

    // Clamp confidence between 0 and 100 and format
    confidence = Math.min(Math.max(confidence, 0), 100);

    return {
        signal: finalSignal,
        confidence: confidence, // Keep as number for potential future use, format in frontend if needed
        analysis: analysis
    };
};

module.exports = { generatePrediction };