// server/utils/patternRecognition.js - Chart Pattern Recognition

/**
 * Find local peaks and troughs in price data
 */
function findPeaksAndTroughs(data, windowSize = 5) {
    const peaks = [];
    const troughs = [];

    for (let i = windowSize; i < data.length - windowSize; i++) {
        let isPeak = true;
        let isTrough = true;

        for (let j = 1; j <= windowSize; j++) {
            if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
                isPeak = false;
            }
            if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
                isTrough = false;
            }
        }

        if (isPeak) {
            peaks.push({ index: i, price: data[i].high, time: data[i].time });
        }
        if (isTrough) {
            troughs.push({ index: i, price: data[i].low, time: data[i].time });
        }
    }

    return { peaks, troughs };
}

/**
 * Calculate trend line slope and intercept
 */
function calculateTrendLine(points) {
    if (points.length < 2) return null;

    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += points[i].index;
        sumY += points[i].price;
        sumXY += points[i].index * points[i].price;
        sumX2 += points[i].index * points[i].index;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

/**
 * Check if values are approximately equal within tolerance
 */
function isApproximatelyEqual(a, b, tolerancePercent = 2) {
    const tolerance = Math.max(a, b) * (tolerancePercent / 100);
    return Math.abs(a - b) <= tolerance;
}

/**
 * Detect Head and Shoulders pattern
 * Bearish reversal pattern with three peaks, middle one highest
 */
function detectHeadShoulders(data, lookback = 50) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { peaks } = findPeaksAndTroughs(recentData, 3);

    if (peaks.length < 3) return null;

    // Check last 3-5 peaks for H&S pattern
    for (let i = peaks.length - 3; i >= Math.max(0, peaks.length - 5); i--) {
        const leftShoulder = peaks[i];
        const head = peaks[i + 1];
        const rightShoulder = peaks[i + 2];

        // Head must be highest
        if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) {
            continue;
        }

        // Shoulders should be approximately equal
        if (!isApproximatelyEqual(leftShoulder.price, rightShoulder.price, 5)) {
            continue;
        }

        // Calculate neckline
        const necklineSlope = (rightShoulder.price - leftShoulder.price) /
                              (rightShoulder.index - leftShoulder.index);

        // Calculate confidence based on symmetry and pattern clarity
        const shoulderSymmetry = 1 - Math.abs(leftShoulder.price - rightShoulder.price) / head.price;
        const headProminence = (head.price - Math.max(leftShoulder.price, rightShoulder.price)) / head.price;
        const confidence = Math.round((shoulderSymmetry * 50 + headProminence * 200) * 100) / 100;

        if (confidence >= 60) {
            const currentPrice = data[data.length - 1].close;
            const neckline = (leftShoulder.price + rightShoulder.price) / 2 * 0.95; // Approximate neckline
            const patternHeight = head.price - neckline;

            return {
                pattern: 'head_shoulders',
                confidence: Math.min(confidence, 95),
                direction: 'bearish',
                breakoutLevel: neckline,
                priceTarget: neckline - patternHeight,
                stopLoss: head.price * 1.02,
                leftShoulder: leftShoulder.price,
                head: head.price,
                rightShoulder: rightShoulder.price,
                currentPrice
            };
        }
    }

    return null;
}

/**
 * Detect Inverse Head and Shoulders pattern
 * Bullish reversal pattern with three troughs, middle one lowest
 */
function detectInverseHeadShoulders(data, lookback = 50) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { troughs } = findPeaksAndTroughs(recentData, 3);

    if (troughs.length < 3) return null;

    for (let i = troughs.length - 3; i >= Math.max(0, troughs.length - 5); i--) {
        const leftShoulder = troughs[i];
        const head = troughs[i + 1];
        const rightShoulder = troughs[i + 2];

        // Head must be lowest
        if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) {
            continue;
        }

        // Shoulders should be approximately equal
        if (!isApproximatelyEqual(leftShoulder.price, rightShoulder.price, 5)) {
            continue;
        }

        const shoulderSymmetry = 1 - Math.abs(leftShoulder.price - rightShoulder.price) / head.price;
        const headProminence = (Math.min(leftShoulder.price, rightShoulder.price) - head.price) / head.price;
        const confidence = Math.round((shoulderSymmetry * 50 + headProminence * 200) * 100) / 100;

        if (confidence >= 60) {
            const currentPrice = data[data.length - 1].close;
            const neckline = (leftShoulder.price + rightShoulder.price) / 2 * 1.05;
            const patternHeight = neckline - head.price;

            return {
                pattern: 'inverse_head_shoulders',
                confidence: Math.min(confidence, 95),
                direction: 'bullish',
                breakoutLevel: neckline,
                priceTarget: neckline + patternHeight,
                stopLoss: head.price * 0.98,
                leftShoulder: leftShoulder.price,
                head: head.price,
                rightShoulder: rightShoulder.price,
                currentPrice
            };
        }
    }

    return null;
}

/**
 * Detect Double Top pattern
 * Bearish reversal with two peaks at similar levels
 */
function detectDoubleTop(data, lookback = 40) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { peaks, troughs } = findPeaksAndTroughs(recentData, 3);

    if (peaks.length < 2 || troughs.length < 1) return null;

    const lastTwoPeaks = peaks.slice(-2);
    const peak1 = lastTwoPeaks[0];
    const peak2 = lastTwoPeaks[1];

    // Peaks should be at similar levels
    if (!isApproximatelyEqual(peak1.price, peak2.price, 3)) {
        return null;
    }

    // Find trough between peaks
    const troughBetween = troughs.find(t => t.index > peak1.index && t.index < peak2.index);
    if (!troughBetween) return null;

    const peakAvg = (peak1.price + peak2.price) / 2;
    const patternHeight = peakAvg - troughBetween.price;
    const confidence = Math.round((1 - Math.abs(peak1.price - peak2.price) / peakAvg) * 90);

    if (confidence >= 65) {
        const currentPrice = data[data.length - 1].close;

        return {
            pattern: 'double_top',
            confidence: Math.min(confidence, 95),
            direction: 'bearish',
            breakoutLevel: troughBetween.price,
            priceTarget: troughBetween.price - patternHeight,
            stopLoss: peakAvg * 1.02,
            peak1: peak1.price,
            peak2: peak2.price,
            trough: troughBetween.price,
            currentPrice
        };
    }

    return null;
}

/**
 * Detect Double Bottom pattern
 * Bullish reversal with two troughs at similar levels
 */
function detectDoubleBottom(data, lookback = 40) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { peaks, troughs } = findPeaksAndTroughs(recentData, 3);

    if (troughs.length < 2 || peaks.length < 1) return null;

    const lastTwoTroughs = troughs.slice(-2);
    const trough1 = lastTwoTroughs[0];
    const trough2 = lastTwoTroughs[1];

    // Troughs should be at similar levels
    if (!isApproximatelyEqual(trough1.price, trough2.price, 3)) {
        return null;
    }

    // Find peak between troughs
    const peakBetween = peaks.find(p => p.index > trough1.index && p.index < trough2.index);
    if (!peakBetween) return null;

    const troughAvg = (trough1.price + trough2.price) / 2;
    const patternHeight = peakBetween.price - troughAvg;
    const confidence = Math.round((1 - Math.abs(trough1.price - trough2.price) / troughAvg) * 90);

    if (confidence >= 65) {
        const currentPrice = data[data.length - 1].close;

        return {
            pattern: 'double_bottom',
            confidence: Math.min(confidence, 95),
            direction: 'bullish',
            breakoutLevel: peakBetween.price,
            priceTarget: peakBetween.price + patternHeight,
            stopLoss: troughAvg * 0.98,
            trough1: trough1.price,
            trough2: trough2.price,
            peak: peakBetween.price,
            currentPrice
        };
    }

    return null;
}

/**
 * Detect Triangle patterns (Ascending, Descending, Symmetrical)
 */
function detectTriangle(data, lookback = 30) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { peaks, troughs } = findPeaksAndTroughs(recentData, 2);

    if (peaks.length < 2 || troughs.length < 2) return null;

    // Calculate trend lines for peaks and troughs
    const peakTrend = calculateTrendLine(peaks.slice(-3));
    const troughTrend = calculateTrendLine(troughs.slice(-3));

    if (!peakTrend || !troughTrend) return null;

    const currentPrice = data[data.length - 1].close;

    // Ascending Triangle: flat resistance, rising support
    if (Math.abs(peakTrend.slope) < 0.001 && troughTrend.slope > 0.001) {
        const resistance = peaks[peaks.length - 1].price;
        const confidence = Math.round(70 + (troughTrend.slope * 1000));

        return {
            pattern: 'ascending_triangle',
            confidence: Math.min(Math.max(confidence, 65), 90),
            direction: 'bullish',
            breakoutLevel: resistance,
            priceTarget: resistance * 1.05,
            stopLoss: troughs[troughs.length - 1].price * 0.98,
            resistance,
            supportSlope: troughTrend.slope,
            currentPrice
        };
    }

    // Descending Triangle: flat support, falling resistance
    if (Math.abs(troughTrend.slope) < 0.001 && peakTrend.slope < -0.001) {
        const support = troughs[troughs.length - 1].price;
        const confidence = Math.round(70 + Math.abs(peakTrend.slope * 1000));

        return {
            pattern: 'descending_triangle',
            confidence: Math.min(Math.max(confidence, 65), 90),
            direction: 'bearish',
            breakoutLevel: support,
            priceTarget: support * 0.95,
            stopLoss: peaks[peaks.length - 1].price * 1.02,
            support,
            resistanceSlope: peakTrend.slope,
            currentPrice
        };
    }

    // Symmetrical Triangle: converging trend lines
    if (peakTrend.slope < -0.0005 && troughTrend.slope > 0.0005) {
        const avgPrice = (peaks[peaks.length - 1].price + troughs[troughs.length - 1].price) / 2;
        const confidence = Math.round(65 + Math.abs(peakTrend.slope - troughTrend.slope) * 500);

        return {
            pattern: 'symmetrical_triangle',
            confidence: Math.min(Math.max(confidence, 60), 85),
            direction: 'neutral',
            breakoutLevel: avgPrice,
            priceTarget: null, // Direction unknown
            stopLoss: null,
            resistanceSlope: peakTrend.slope,
            supportSlope: troughTrend.slope,
            currentPrice
        };
    }

    return null;
}

/**
 * Detect Flag patterns (Bull Flag, Bear Flag)
 */
function detectFlag(data, lookback = 25) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);

    // Look for strong move (pole) followed by consolidation (flag)
    const poleEnd = Math.floor(lookback * 0.4);
    const poleData = recentData.slice(0, poleEnd);
    const flagData = recentData.slice(poleEnd);

    // Calculate pole move
    const poleStart = poleData[0].close;
    const poleEndPrice = poleData[poleData.length - 1].close;
    const poleMove = (poleEndPrice - poleStart) / poleStart;

    // Need significant pole move (> 5%)
    if (Math.abs(poleMove) < 0.05) return null;

    // Calculate flag consolidation
    const flagHigh = Math.max(...flagData.map(d => d.high));
    const flagLow = Math.min(...flagData.map(d => d.low));
    const flagRange = (flagHigh - flagLow) / flagLow;

    // Flag should be tighter than pole
    if (flagRange > Math.abs(poleMove) * 0.5) return null;

    const currentPrice = data[data.length - 1].close;
    const poleHeight = Math.abs(poleEndPrice - poleStart);

    if (poleMove > 0) {
        // Bull Flag
        const confidence = Math.round(70 + poleMove * 100);

        return {
            pattern: 'bull_flag',
            confidence: Math.min(Math.max(confidence, 65), 90),
            direction: 'bullish',
            breakoutLevel: flagHigh,
            priceTarget: flagHigh + poleHeight,
            stopLoss: flagLow * 0.98,
            poleHeight,
            flagRange,
            currentPrice
        };
    } else {
        // Bear Flag
        const confidence = Math.round(70 + Math.abs(poleMove) * 100);

        return {
            pattern: 'bear_flag',
            confidence: Math.min(Math.max(confidence, 65), 90),
            direction: 'bearish',
            breakoutLevel: flagLow,
            priceTarget: flagLow - poleHeight,
            stopLoss: flagHigh * 1.02,
            poleHeight,
            flagRange,
            currentPrice
        };
    }
}

/**
 * Detect Wedge patterns (Rising Wedge, Falling Wedge)
 */
function detectWedge(data, lookback = 35) {
    if (data.length < lookback) return null;

    const recentData = data.slice(-lookback);
    const { peaks, troughs } = findPeaksAndTroughs(recentData, 2);

    if (peaks.length < 3 || troughs.length < 3) return null;

    const peakTrend = calculateTrendLine(peaks.slice(-3));
    const troughTrend = calculateTrendLine(troughs.slice(-3));

    if (!peakTrend || !troughTrend) return null;

    const currentPrice = data[data.length - 1].close;

    // Rising Wedge: Both lines rising, but converging (bearish)
    if (peakTrend.slope > 0 && troughTrend.slope > 0 && peakTrend.slope < troughTrend.slope) {
        const support = troughs[troughs.length - 1].price;
        const confidence = Math.round(65 + (troughTrend.slope - peakTrend.slope) * 1000);

        return {
            pattern: 'rising_wedge',
            confidence: Math.min(Math.max(confidence, 60), 85),
            direction: 'bearish',
            breakoutLevel: support,
            priceTarget: support * 0.92,
            stopLoss: peaks[peaks.length - 1].price * 1.02,
            resistanceSlope: peakTrend.slope,
            supportSlope: troughTrend.slope,
            currentPrice
        };
    }

    // Falling Wedge: Both lines falling, but converging (bullish)
    if (peakTrend.slope < 0 && troughTrend.slope < 0 && peakTrend.slope < troughTrend.slope) {
        const resistance = peaks[peaks.length - 1].price;
        const confidence = Math.round(65 + Math.abs(troughTrend.slope - peakTrend.slope) * 1000);

        return {
            pattern: 'falling_wedge',
            confidence: Math.min(Math.max(confidence, 60), 85),
            direction: 'bullish',
            breakoutLevel: resistance,
            priceTarget: resistance * 1.08,
            stopLoss: troughs[troughs.length - 1].price * 0.98,
            resistanceSlope: peakTrend.slope,
            supportSlope: troughTrend.slope,
            currentPrice
        };
    }

    return null;
}

/**
 * Run all pattern detection on price data
 * Returns array of detected patterns sorted by confidence
 */
function detectAllPatterns(data, options = {}) {
    const { lookback = 50, minConfidence = 60 } = options;

    if (!data || data.length < 20) {
        return [];
    }

    const patterns = [];

    // Run all detection functions
    const detectors = [
        { fn: detectHeadShoulders, lookback },
        { fn: detectInverseHeadShoulders, lookback },
        { fn: detectDoubleTop, lookback: Math.round(lookback * 0.8) },
        { fn: detectDoubleBottom, lookback: Math.round(lookback * 0.8) },
        { fn: detectTriangle, lookback: Math.round(lookback * 0.6) },
        { fn: detectFlag, lookback: Math.round(lookback * 0.5) },
        { fn: detectWedge, lookback: Math.round(lookback * 0.7) }
    ];

    for (const { fn, lookback: lb } of detectors) {
        try {
            const result = fn(data, lb);
            if (result && result.confidence >= minConfidence) {
                patterns.push(result);
            }
        } catch (error) {
            // Log error for debugging but continue
            console.error(`Pattern detection error in ${fn.name}:`, error.message);
        }
    }

    // Sort by confidence descending
    return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a specific pattern type is detected
 */
function detectSpecificPattern(data, patternType, options = {}) {
    const { lookback = 50 } = options;

    const patternDetectors = {
        'head_shoulders': () => detectHeadShoulders(data, lookback),
        'inverse_head_shoulders': () => detectInverseHeadShoulders(data, lookback),
        'double_top': () => detectDoubleTop(data, lookback * 0.8),
        'double_bottom': () => detectDoubleBottom(data, lookback * 0.8),
        'ascending_triangle': () => {
            const result = detectTriangle(data, lookback * 0.6);
            return result && result.pattern === 'ascending_triangle' ? result : null;
        },
        'descending_triangle': () => {
            const result = detectTriangle(data, lookback * 0.6);
            return result && result.pattern === 'descending_triangle' ? result : null;
        },
        'symmetrical_triangle': () => {
            const result = detectTriangle(data, lookback * 0.6);
            return result && result.pattern === 'symmetrical_triangle' ? result : null;
        },
        'bull_flag': () => {
            const result = detectFlag(data, lookback * 0.5);
            return result && result.pattern === 'bull_flag' ? result : null;
        },
        'bear_flag': () => {
            const result = detectFlag(data, lookback * 0.5);
            return result && result.pattern === 'bear_flag' ? result : null;
        },
        'rising_wedge': () => {
            const result = detectWedge(data, lookback * 0.7);
            return result && result.pattern === 'rising_wedge' ? result : null;
        },
        'falling_wedge': () => {
            const result = detectWedge(data, lookback * 0.7);
            return result && result.pattern === 'falling_wedge' ? result : null;
        }
    };

    const detector = patternDetectors[patternType];
    if (!detector) return null;

    try {
        return detector();
    } catch (error) {
        return null;
    }
}

module.exports = {
    findPeaksAndTroughs,
    calculateTrendLine,
    detectHeadShoulders,
    detectInverseHeadShoulders,
    detectDoubleTop,
    detectDoubleBottom,
    detectTriangle,
    detectFlag,
    detectWedge,
    detectAllPatterns,
    detectSpecificPattern
};
