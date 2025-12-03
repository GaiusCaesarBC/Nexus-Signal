// server/utils/indicators.js - Technical Indicators for Server

function calculateSMA(data, period) {
    if (!data || data.length < period) return [];
    
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push({
            time: data[i].time,
            value: sum / period
        });
    }
    return result;
}

function calculateRSI(closes, period = 14) {
    if (closes.length < period) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        
        if (change >= 0) {
            avgGain = ((avgGain * (period - 1)) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = ((avgLoss * (period - 1)) - change) / period;
        }
    }
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
}

function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (closes.length < slowPeriod + signalPeriod) {
        return { macd: null, signal: null, histogram: null };
    }
    
    // Calculate EMA arrays for the entire series
    const emaFastArray = [];
    const emaSlowArray = [];
    
    let emaFast = closes[0];
    let emaSlow = closes[0];
    const fastMultiplier = 2 / (fastPeriod + 1);
    const slowMultiplier = 2 / (slowPeriod + 1);
    
    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            emaFast = closes[i];
            emaSlow = closes[i];
        } else {
            emaFast = (closes[i] - emaFast) * fastMultiplier + emaFast;
            emaSlow = (closes[i] - emaSlow) * slowMultiplier + emaSlow;
        }
        emaFastArray.push(emaFast);
        emaSlowArray.push(emaSlow);
    }
    
    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        macdLine.push(emaFastArray[i] - emaSlowArray[i]);
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalMultiplier = 2 / (signalPeriod + 1);
    let signalEma = macdLine[0];
    
    for (let i = 1; i < macdLine.length; i++) {
        signalEma = (macdLine[i] - signalEma) * signalMultiplier + signalEma;
    }
    
    const macd = macdLine[macdLine.length - 1];
    const signal = signalEma;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
}

function calculateEMA(values, period) {
    if (values.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
        ema = (values[i] - ema) * multiplier + ema;
    }
    
    return ema;
}

function calculateBollingerBands(data, period = 20, stdDev = 2) {
    if (!data || data.length < period) {
        return { upper: null, mid: null, lower: null };
    }
    
    // Handle both arrays of numbers and arrays of objects
    const closes = Array.isArray(data) && typeof data[0] === 'number' 
        ? data 
        : data.map(d => d.close);
    
    if (closes.length < period) {
        return { upper: null, mid: null, lower: null };
    }
    
    let sum = 0;
    
    for (let i = 0; i < period; i++) {
        sum += closes[closes.length - period + i];
    }
    
    const sma = sum / period;
    
    let variance = 0;
    for (let i = 0; i < period; i++) {
        const diff = closes[closes.length - period + i] - sma;
        variance += diff * diff;
    }
    
    const standardDeviation = Math.sqrt(variance / period);
    
    return {
        upper: sma + (stdDev * standardDeviation),
        mid: sma,
        lower: sma - (stdDev * standardDeviation)
    };
}

module.exports = {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateEMA,
    calculateBollingerBands
};