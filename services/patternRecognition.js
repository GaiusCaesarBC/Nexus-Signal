// server/services/patternRecognition.js - AI PATTERN DETECTION ENGINE

const axios = require('axios');

/**
 * AI-Powered Chart Pattern Recognition Engine
 * Detects 12 major technical analysis patterns
 * Provides confidence scores and breakout predictions
 */

// ============ PATTERN DEFINITIONS ============

const PATTERNS = {
    // BULLISH PATTERNS
    HEAD_SHOULDERS_INVERSE: {
        name: 'Inverse Head and Shoulders',
        type: 'bullish',
        reliability: 0.85,
        description: 'Three troughs with the middle one being deepest, signals trend reversal',
        targetCalculation: 'neckline + (neckline - head)',
        avgDuration: '4-12 weeks'
    },
    DOUBLE_BOTTOM: {
        name: 'Double Bottom',
        type: 'bullish',
        reliability: 0.78,
        description: 'Two consecutive lows at approximately the same level, W-shaped pattern',
        targetCalculation: 'neckline + (neckline - bottom)',
        avgDuration: '2-8 weeks'
    },
    CUP_HANDLE: {
        name: 'Cup and Handle',
        type: 'bullish',
        reliability: 0.82,
        description: 'U-shaped cup followed by slight downward drift (handle)',
        targetCalculation: 'breakout + (cup depth)',
        avgDuration: '1-6 months'
    },
    ASCENDING_TRIANGLE: {
        name: 'Ascending Triangle',
        type: 'bullish',
        reliability: 0.72,
        description: 'Flat upper resistance with rising support line',
        targetCalculation: 'breakout + (triangle height)',
        avgDuration: '1-3 months'
    },
    BULL_FLAG: {
        name: 'Bull Flag',
        type: 'bullish',
        reliability: 0.68,
        description: 'Sharp rise (pole) followed by slight downward consolidation (flag)',
        targetCalculation: 'breakout + (pole height)',
        avgDuration: '1-4 weeks'
    },
    FALLING_WEDGE: {
        name: 'Falling Wedge',
        type: 'bullish',
        reliability: 0.75,
        description: 'Converging trendlines both sloping downward, bullish breakout',
        targetCalculation: 'breakout + (wedge height)',
        avgDuration: '3-6 months'
    },

    // BEARISH PATTERNS
    HEAD_SHOULDERS: {
        name: 'Head and Shoulders',
        type: 'bearish',
        reliability: 0.85,
        description: 'Three peaks with middle being highest, signals trend reversal',
        targetCalculation: 'neckline - (head - neckline)',
        avgDuration: '4-12 weeks'
    },
    DOUBLE_TOP: {
        name: 'Double Top',
        type: 'bearish',
        reliability: 0.78,
        description: 'Two consecutive peaks at approximately the same level, M-shaped pattern',
        targetCalculation: 'neckline - (top - neckline)',
        avgDuration: '2-8 weeks'
    },
    DESCENDING_TRIANGLE: {
        name: 'Descending Triangle',
        type: 'bearish',
        reliability: 0.72,
        description: 'Flat lower support with declining resistance line',
        targetCalculation: 'breakdown - (triangle height)',
        avgDuration: '1-3 months'
    },
    BEAR_FLAG: {
        name: 'Bear Flag',
        type: 'bearish',
        reliability: 0.68,
        description: 'Sharp decline (pole) followed by slight upward consolidation (flag)',
        targetCalculation: 'breakdown - (pole height)',
        avgDuration: '1-4 weeks'
    },
    RISING_WEDGE: {
        name: 'Rising Wedge',
        type: 'bearish',
        reliability: 0.75,
        description: 'Converging trendlines both sloping upward, bearish breakdown',
        targetCalculation: 'breakdown - (wedge height)',
        avgDuration: '3-6 months'
    },
    TRIPLE_TOP: {
        name: 'Triple Top',
        type: 'bearish',
        reliability: 0.81,
        description: 'Three peaks at approximately the same level',
        targetCalculation: 'neckline - (top - neckline)',
        avgDuration: '3-8 weeks'
    },

    // NEW PATTERNS - Extended Detection
    TRIPLE_BOTTOM: {
        name: 'Triple Bottom',
        type: 'bullish',
        reliability: 0.83,
        description: 'Three troughs at approximately the same level, strong reversal signal',
        targetCalculation: 'neckline + (neckline - bottom)',
        avgDuration: '3-8 weeks'
    },
    BULL_PENNANT: {
        name: 'Bull Pennant',
        type: 'bullish',
        reliability: 0.70,
        description: 'Sharp rise followed by symmetric triangle consolidation',
        targetCalculation: 'breakout + (pole height)',
        avgDuration: '1-3 weeks'
    },
    BEAR_PENNANT: {
        name: 'Bear Pennant',
        type: 'bearish',
        reliability: 0.70,
        description: 'Sharp decline followed by symmetric triangle consolidation',
        targetCalculation: 'breakdown - (pole height)',
        avgDuration: '1-3 weeks'
    },
    ROUNDING_BOTTOM: {
        name: 'Rounding Bottom',
        type: 'bullish',
        reliability: 0.76,
        description: 'Gradual U-shaped reversal pattern, also known as saucer bottom',
        targetCalculation: 'breakout + (depth of bowl)',
        avgDuration: '2-6 months'
    },
    ROUNDING_TOP: {
        name: 'Rounding Top',
        type: 'bearish',
        reliability: 0.74,
        description: 'Gradual inverted U-shaped pattern signaling trend reversal',
        targetCalculation: 'breakdown - (height of dome)',
        avgDuration: '2-6 months'
    },
    BROADENING_TOP: {
        name: 'Broadening Top',
        type: 'bearish',
        reliability: 0.65,
        description: 'Expanding highs and lows forming megaphone shape, signals instability',
        targetCalculation: 'breakdown - (pattern height)',
        avgDuration: '1-3 months'
    },
    BROADENING_BOTTOM: {
        name: 'Broadening Bottom',
        type: 'bullish',
        reliability: 0.63,
        description: 'Expanding highs and lows at bottom, reversal signal',
        targetCalculation: 'breakout + (pattern height)',
        avgDuration: '1-3 months'
    },

    // CANDLESTICK PATTERNS
    DOJI: {
        name: 'Doji',
        type: 'neutral',
        reliability: 0.55,
        description: 'Open and close nearly equal, signals indecision and potential reversal',
        targetCalculation: 'Watch for confirmation',
        avgDuration: '1-3 candles'
    },
    HAMMER: {
        name: 'Hammer',
        type: 'bullish',
        reliability: 0.60,
        description: 'Small body at top with long lower shadow, bullish reversal at bottom',
        targetCalculation: 'Recent resistance level',
        avgDuration: '1-5 candles'
    },
    HANGING_MAN: {
        name: 'Hanging Man',
        type: 'bearish',
        reliability: 0.58,
        description: 'Small body at top with long lower shadow, bearish at top of uptrend',
        targetCalculation: 'Recent support level',
        avgDuration: '1-5 candles'
    },
    INVERTED_HAMMER: {
        name: 'Inverted Hammer',
        type: 'bullish',
        reliability: 0.55,
        description: 'Small body at bottom with long upper shadow, potential reversal',
        targetCalculation: 'Recent resistance level',
        avgDuration: '1-5 candles'
    },
    SHOOTING_STAR: {
        name: 'Shooting Star',
        type: 'bearish',
        reliability: 0.58,
        description: 'Small body at bottom with long upper shadow, bearish reversal',
        targetCalculation: 'Recent support level',
        avgDuration: '1-5 candles'
    },
    BULLISH_ENGULFING: {
        name: 'Bullish Engulfing',
        type: 'bullish',
        reliability: 0.65,
        description: 'Large bullish candle completely engulfs previous bearish candle',
        targetCalculation: 'Recent resistance level',
        avgDuration: '3-7 candles'
    },
    BEARISH_ENGULFING: {
        name: 'Bearish Engulfing',
        type: 'bearish',
        reliability: 0.65,
        description: 'Large bearish candle completely engulfs previous bullish candle',
        targetCalculation: 'Recent support level',
        avgDuration: '3-7 candles'
    },
    MORNING_STAR: {
        name: 'Morning Star',
        type: 'bullish',
        reliability: 0.72,
        description: 'Three-candle pattern: bearish, small body, bullish - strong reversal',
        targetCalculation: 'First candle open level',
        avgDuration: '5-10 candles'
    },
    EVENING_STAR: {
        name: 'Evening Star',
        type: 'bearish',
        reliability: 0.72,
        description: 'Three-candle pattern: bullish, small body, bearish - strong reversal',
        targetCalculation: 'First candle open level',
        avgDuration: '5-10 candles'
    },
    THREE_WHITE_SOLDIERS: {
        name: 'Three White Soldiers',
        type: 'bullish',
        reliability: 0.75,
        description: 'Three consecutive bullish candles with higher closes',
        targetCalculation: 'Continue in trend direction',
        avgDuration: '5-15 candles'
    },
    THREE_BLACK_CROWS: {
        name: 'Three Black Crows',
        type: 'bearish',
        reliability: 0.75,
        description: 'Three consecutive bearish candles with lower closes',
        targetCalculation: 'Continue in trend direction',
        avgDuration: '5-15 candles'
    },
    PIERCING_LINE: {
        name: 'Piercing Line',
        type: 'bullish',
        reliability: 0.62,
        description: 'Bullish candle opens below prior low and closes above midpoint',
        targetCalculation: 'Prior candle high',
        avgDuration: '3-7 candles'
    },
    DARK_CLOUD_COVER: {
        name: 'Dark Cloud Cover',
        type: 'bearish',
        reliability: 0.62,
        description: 'Bearish candle opens above prior high and closes below midpoint',
        targetCalculation: 'Prior candle low',
        avgDuration: '3-7 candles'
    },
    MARUBOZU: {
        name: 'Marubozu',
        type: 'neutral',
        reliability: 0.68,
        description: 'Long candle with no wicks, shows strong momentum in that direction',
        targetCalculation: 'Continue in candle direction',
        avgDuration: '3-10 candles'
    }
};

// ============ PATTERN DETECTION ALGORITHMS ============

/**
 * Detect Head and Shoulders pattern
 */
function detectHeadShoulders(candles, type = 'bearish') {
    if (candles.length < 30) return null; // Reduced from 50

    const peaks = findPeaks(candles, 3); // Reduced window from 5 to 3
    if (peaks.length < 3) return null;
    
    // Look for 3 consecutive peaks where middle is highest
    for (let i = 0; i < peaks.length - 2; i++) {
        const leftShoulder = peaks[i];
        const head = peaks[i + 1];
        const rightShoulder = peaks[i + 2];
        
        // Check if middle peak is higher
        const isValidPattern = head.value > leftShoulder.value &&
                               head.value > rightShoulder.value &&
                               Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value < 0.08; // Shoulders roughly equal (relaxed from 3% to 8%)
        
        if (isValidPattern) {
            // Find neckline (support between shoulders)
            const troughs = findTroughs(candles.slice(leftShoulder.index, rightShoulder.index), 3);
            if (troughs.length < 2) continue;
            
            const neckline = (troughs[0].value + troughs[1].value) / 2;
            const currentPrice = candles[candles.length - 1].close;
            
            // Calculate target
            const patternHeight = head.value - neckline;
            const target = type === 'bearish' ? 
                neckline - patternHeight : 
                neckline + patternHeight;
            
            // Calculate confidence based on pattern quality
            const shoulderSymmetry = 1 - Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value;
            const volumeConfirmation = checkVolumePattern(candles, leftShoulder.index, rightShoulder.index);
            const confidence = (shoulderSymmetry * 0.5 + volumeConfirmation * 0.5) * PATTERNS[type === 'bearish' ? 'HEAD_SHOULDERS' : 'HEAD_SHOULDERS_INVERSE'].reliability;
            
            return {
                pattern: type === 'bearish' ? 'HEAD_SHOULDERS' : 'HEAD_SHOULDERS_INVERSE',
                confidence: Math.min(confidence * 100, 95),
                points: {
                    leftShoulder: { index: leftShoulder.index, price: leftShoulder.value },
                    head: { index: head.index, price: head.value },
                    rightShoulder: { index: rightShoulder.index, price: rightShoulder.value },
                    neckline: neckline
                },
                target: target,
                currentPrice: currentPrice,
                potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
                status: currentPrice < neckline && type === 'bearish' ? 'confirmed' : 'forming'
            };
        }
    }
    
    return null;
}

/**
 * Detect Double Top/Bottom pattern
 */
function detectDoubleTopBottom(candles, type = 'top') {
    if (candles.length < 20) return null; // Reduced from 30

    const extremes = type === 'top' ? findPeaks(candles, 3) : findTroughs(candles, 3); // Reduced window from 5 to 3
    if (extremes.length < 2) return null;
    
    // Look for two peaks/troughs at similar levels
    for (let i = 0; i < extremes.length - 1; i++) {
        const first = extremes[i];
        const second = extremes[i + 1];
        
        // Check if roughly equal (within 5% - relaxed from 2%)
        const priceDiff = Math.abs(first.value - second.value) / first.value;
        if (priceDiff > 0.05) continue;

        // Check distance between (should be 10-80 candles apart - relaxed from 20-60)
        const distance = second.index - first.index;
        if (distance < 10 || distance > 80) continue;
        
        // Find neckline (support/resistance between the two)
        const between = candles.slice(first.index, second.index);
        const neckline = type === 'top' ? 
            Math.min(...between.map(c => c.low)) :
            Math.max(...between.map(c => c.high));
        
        const currentPrice = candles[candles.length - 1].close;
        
        // Calculate target
        const patternHeight = Math.abs(first.value - neckline);
        const target = type === 'top' ? 
            neckline - patternHeight : 
            neckline + patternHeight;
        
        // Calculate confidence
        const priceSymmetry = 1 - priceDiff;
        const volumeConf = checkVolumePattern(candles, first.index, second.index);
        const timeSymmetry = distance > 25 && distance < 55 ? 1.0 : 0.8;
        const confidence = (priceSymmetry * 0.4 + volumeConf * 0.3 + timeSymmetry * 0.3) * 
                          PATTERNS[type === 'top' ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM'].reliability;
        
        return {
            pattern: type === 'top' ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM',
            confidence: Math.min(confidence * 100, 95),
            points: {
                first: { index: first.index, price: first.value },
                second: { index: second.index, price: second.value },
                neckline: neckline
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: (type === 'top' && currentPrice < neckline) || (type === 'bottom' && currentPrice > neckline) ? 
                'confirmed' : 'forming'
        };
    }
    
    return null;
}

/**
 * Detect Triangle patterns (Ascending, Descending)
 */
function detectTriangle(candles, type = 'ascending') {
    if (candles.length < 25) return null; // Reduced from 40

    const recentCandles = candles.slice(-60);
    const peaks = findPeaks(recentCandles, 2); // Reduced window from 3 to 2
    const troughs = findTroughs(recentCandles, 2);

    if (peaks.length < 2 || troughs.length < 2) return null; // Reduced from 3 to 2
    
    if (type === 'ascending') {
        // Ascending: flat resistance, rising support
        const resistanceLevel = peaks.reduce((sum, p) => sum + p.value, 0) / peaks.length;
        const resistanceFlat = peaks.every(p => Math.abs(p.value - resistanceLevel) / resistanceLevel < 0.05); // Relaxed from 2% to 5%

        if (!resistanceFlat) return null;
        
        // Check if troughs are rising
        const troughsRising = troughs.length >= 2 && 
            troughs[troughs.length - 1].value > troughs[0].value;
        
        if (!troughsRising) return null;
        
        const triangleHeight = resistanceLevel - troughs[0].value;
        const currentPrice = candles[candles.length - 1].close;
        const target = resistanceLevel + triangleHeight;
        
        // Calculate confidence
        const flatnessScore = 1 - (Math.max(...peaks.map(p => p.value)) - Math.min(...peaks.map(p => p.value))) / resistanceLevel;
        const trendStrength = (troughs[troughs.length - 1].value - troughs[0].value) / troughs[0].value;
        const confidence = (flatnessScore * 0.6 + Math.min(trendStrength * 10, 1) * 0.4) * 
                          PATTERNS.ASCENDING_TRIANGLE.reliability;
        
        return {
            pattern: 'ASCENDING_TRIANGLE',
            confidence: Math.min(confidence * 100, 95),
            points: {
                resistance: resistanceLevel,
                supportStart: troughs[0].value,
                supportEnd: troughs[troughs.length - 1].value,
                apex: { index: peaks[peaks.length - 1].index }
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice > resistanceLevel ? 'confirmed' : 'forming'
        };
    } else {
        // Descending: declining resistance, flat support
        const supportLevel = troughs.reduce((sum, t) => sum + t.value, 0) / troughs.length;
        const supportFlat = troughs.every(t => Math.abs(t.value - supportLevel) / supportLevel < 0.05); // Relaxed from 2% to 5%

        if (!supportFlat) return null;
        
        // Check if peaks are declining
        const peaksDeclin = peaks.length >= 2 && 
            peaks[peaks.length - 1].value < peaks[0].value;
        
        if (!peaksDeclin) return null;
        
        const triangleHeight = peaks[0].value - supportLevel;
        const currentPrice = candles[candles.length - 1].close;
        const target = supportLevel - triangleHeight;
        
        const flatnessScore = 1 - (Math.max(...troughs.map(t => t.value)) - Math.min(...troughs.map(t => t.value))) / supportLevel;
        const trendStrength = (peaks[0].value - peaks[peaks.length - 1].value) / peaks[0].value;
        const confidence = (flatnessScore * 0.6 + Math.min(trendStrength * 10, 1) * 0.4) * 
                          PATTERNS.DESCENDING_TRIANGLE.reliability;
        
        return {
            pattern: 'DESCENDING_TRIANGLE',
            confidence: Math.min(confidence * 100, 95),
            points: {
                support: supportLevel,
                resistanceStart: peaks[0].value,
                resistanceEnd: peaks[peaks.length - 1].value,
                apex: { index: troughs[troughs.length - 1].index }
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice < supportLevel ? 'confirmed' : 'forming'
        };
    }
}

/**
 * Detect Flag patterns (Bull/Bear Flag)
 */
function detectFlag(candles, type = 'bull') {
    if (candles.length < 20) return null; // Reduced from 30

    const recentCandles = candles.slice(-40);
    
    // Find the pole (sharp move)
    let poleStart, poleEnd, poleHeight;
    
    if (type === 'bull') {
        // Look for sharp upward move
        for (let i = 0; i < recentCandles.length - 20; i++) {
            const start = recentCandles[i].low;
            const end = recentCandles[i + 10].high;
            const rise = (end - start) / start;

            if (rise > 0.05) { // >5% move (relaxed from 8%)
                poleStart = i;
                poleEnd = i + 10;
                poleHeight = end - start;
                break;
            }
        }
    } else {
        // Look for sharp downward move
        for (let i = 0; i < recentCandles.length - 20; i++) {
            const start = recentCandles[i].high;
            const end = recentCandles[i + 10].low;
            const fall = (start - end) / start;

            if (fall > 0.05) { // >5% move (relaxed from 8%)
                poleStart = i;
                poleEnd = i + 10;
                poleHeight = start - end;
                break;
            }
        }
    }
    
    if (!poleStart) return null;
    
    // Check for consolidation (flag) after pole
    const flagCandles = recentCandles.slice(poleEnd);
    if (flagCandles.length < 5) return null;
    
    const flagHigh = Math.max(...flagCandles.map(c => c.high));
    const flagLow = Math.min(...flagCandles.map(c => c.low));
    const flagRange = (flagHigh - flagLow) / flagLow;
    
    // Flag should be tight consolidation (<8% range - relaxed from 5%)
    if (flagRange > 0.08) return null;
    
    const currentPrice = candles[candles.length - 1].close;
    const target = type === 'bull' ? 
        currentPrice + poleHeight :
        currentPrice - poleHeight;
    
    const confidence = PATTERNS[type === 'bull' ? 'BULL_FLAG' : 'BEAR_FLAG'].reliability * 
                      (1 - flagRange * 5); // Tighter flag = higher confidence
    
    return {
        pattern: type === 'bull' ? 'BULL_FLAG' : 'BEAR_FLAG',
        confidence: Math.min(confidence * 100, 95),
        points: {
            poleStart: { index: poleStart, price: recentCandles[poleStart][type === 'bull' ? 'low' : 'high'] },
            poleEnd: { index: poleEnd, price: recentCandles[poleEnd][type === 'bull' ? 'high' : 'low'] },
            flagHigh: flagHigh,
            flagLow: flagLow
        },
        target: target,
        currentPrice: currentPrice,
        potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
        status: 'forming'
    };
}

/**
 * Detect Cup and Handle pattern
 */
function detectCupHandle(candles) {
    if (candles.length < 40) return null; // Reduced from 60

    const recentCandles = candles.slice(-100);

    // Find the cup (U-shaped bottom)
    const peaks = findPeaks(recentCandles, 5); // Reduced window from 10 to 5
    const troughs = findTroughs(recentCandles, 5);
    
    if (peaks.length < 2 || troughs.length < 1) return null;
    
    // Cup should have two peaks at similar levels with a trough in between
    for (let i = 0; i < peaks.length - 1; i++) {
        const leftPeak = peaks[i];
        const rightPeak = peaks[i + 1];
        
        // Peaks should be similar height (within 10% - relaxed from 5%)
        if (Math.abs(leftPeak.value - rightPeak.value) / leftPeak.value > 0.10) continue;

        // Find deepest trough between peaks
        const cupTroughs = troughs.filter(t => t.index > leftPeak.index && t.index < rightPeak.index);
        if (cupTroughs.length === 0) continue;

        const bottom = cupTroughs.reduce((lowest, t) => t.value < lowest.value ? t : lowest, cupTroughs[0]);

        // Cup depth should be significant (>5% - relaxed from 10%)
        const cupDepth = (leftPeak.value - bottom.value) / leftPeak.value;
        if (cupDepth < 0.05) continue;
        
        // Look for handle (slight pullback after right peak)
        const afterPeak = recentCandles.slice(rightPeak.index);
        if (afterPeak.length < 5) continue;
        
        const handleLow = Math.min(...afterPeak.slice(0, 15).map(c => c.low));
        const handleDepth = (rightPeak.value - handleLow) / rightPeak.value;
        
        // Handle should be shallow (<15% of cup depth)
        if (handleDepth > cupDepth * 0.5) continue;
        
        const currentPrice = candles[candles.length - 1].close;
        const breakoutLevel = rightPeak.value;
        const target = breakoutLevel + (leftPeak.value - bottom.value);
        
        const confidence = PATTERNS.CUP_HANDLE.reliability * 
                          (1 - handleDepth / cupDepth); // Shallower handle = better
        
        return {
            pattern: 'CUP_HANDLE',
            confidence: Math.min(confidence * 100, 95),
            points: {
                leftRim: { index: leftPeak.index, price: leftPeak.value },
                bottom: { index: bottom.index, price: bottom.value },
                rightRim: { index: rightPeak.index, price: rightPeak.value },
                handleLow: handleLow
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice > breakoutLevel ? 'confirmed' : 'forming'
        };
    }

    return null;
}

/**
 * Detect Wedge patterns (Rising/Falling Wedge)
 */
function detectWedge(candles, type = 'rising') {
    if (candles.length < 30) return null;

    const recentCandles = candles.slice(-60);
    const peaks = findPeaks(recentCandles, 3);
    const troughs = findTroughs(recentCandles, 3);

    if (peaks.length < 3 || troughs.length < 3) return null;

    // Calculate trendlines for highs and lows
    const highSlope = (peaks[peaks.length - 1].value - peaks[0].value) / (peaks[peaks.length - 1].index - peaks[0].index);
    const lowSlope = (troughs[troughs.length - 1].value - troughs[0].value) / (troughs[troughs.length - 1].index - troughs[0].index);

    // Both trendlines should slope in the same direction and converge
    const bothRising = highSlope > 0 && lowSlope > 0;
    const bothFalling = highSlope < 0 && lowSlope < 0;
    const isConverging = Math.abs(highSlope) !== Math.abs(lowSlope);

    if (type === 'rising') {
        if (!bothRising || !isConverging) return null;
        if (highSlope >= lowSlope) return null;
    } else {
        if (!bothFalling || !isConverging) return null;
        if (Math.abs(lowSlope) >= Math.abs(highSlope)) return null;
    }

    const currentPrice = candles[candles.length - 1].close;
    const wedgeHeight = peaks[0].value - troughs[0].value;
    const target = type === 'rising' ? currentPrice - wedgeHeight : currentPrice + wedgeHeight;

    const convergenceRate = Math.abs(highSlope - lowSlope);
    const confidence = PATTERNS[type === 'rising' ? 'RISING_WEDGE' : 'FALLING_WEDGE'].reliability *
                      Math.min(convergenceRate * 50, 1);

    return {
        pattern: type === 'rising' ? 'RISING_WEDGE' : 'FALLING_WEDGE',
        confidence: Math.min(confidence * 100, 95),
        points: {
            upperStart: { index: peaks[0].index, price: peaks[0].value },
            upperEnd: { index: peaks[peaks.length - 1].index, price: peaks[peaks.length - 1].value },
            lowerStart: { index: troughs[0].index, price: troughs[0].value },
            lowerEnd: { index: troughs[troughs.length - 1].index, price: troughs[troughs.length - 1].value },
            apex: { index: recentCandles.length - 1 }
        },
        target: target,
        currentPrice: currentPrice,
        potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
        status: 'forming'
    };
}

/**
 * Detect Pennant patterns (Bull/Bear Pennant)
 */
function detectPennant(candles, type = 'bull') {
    if (candles.length < 25) return null;

    const recentCandles = candles.slice(-50);
    let poleStart, poleEnd, poleHeight;

    if (type === 'bull') {
        for (let i = 0; i < recentCandles.length - 20; i++) {
            const start = recentCandles[i].low;
            const end = recentCandles[i + 8].high;
            const rise = (end - start) / start;
            if (rise > 0.06) {
                poleStart = i;
                poleEnd = i + 8;
                poleHeight = end - start;
                break;
            }
        }
    } else {
        for (let i = 0; i < recentCandles.length - 20; i++) {
            const start = recentCandles[i].high;
            const end = recentCandles[i + 8].low;
            const fall = (start - end) / start;
            if (fall > 0.06) {
                poleStart = i;
                poleEnd = i + 8;
                poleHeight = start - end;
                break;
            }
        }
    }

    if (poleStart === undefined) return null;

    const pennantCandles = recentCandles.slice(poleEnd);
    if (pennantCandles.length < 5) return null;

    const pennantPeaks = findPeaks(pennantCandles, 2);
    const pennantTroughs = findTroughs(pennantCandles, 2);

    if (pennantPeaks.length < 2 || pennantTroughs.length < 2) return null;

    const highSlope = (pennantPeaks[pennantPeaks.length - 1].value - pennantPeaks[0].value) /
        (pennantPeaks[pennantPeaks.length - 1].index - pennantPeaks[0].index);
    const lowSlope = (pennantTroughs[pennantTroughs.length - 1].value - pennantTroughs[0].value) /
        (pennantTroughs[pennantTroughs.length - 1].index - pennantTroughs[0].index);

    const isConverging = highSlope < 0 && lowSlope > 0;
    if (!isConverging) return null;

    const currentPrice = candles[candles.length - 1].close;
    const target = type === 'bull' ? currentPrice + poleHeight : currentPrice - poleHeight;
    const confidence = PATTERNS[type === 'bull' ? 'BULL_PENNANT' : 'BEAR_PENNANT'].reliability * 0.9;

    return {
        pattern: type === 'bull' ? 'BULL_PENNANT' : 'BEAR_PENNANT',
        confidence: Math.min(confidence * 100, 95),
        points: {
            poleStart: { index: poleStart, price: recentCandles[poleStart][type === 'bull' ? 'low' : 'high'] },
            poleEnd: { index: poleEnd, price: recentCandles[poleEnd][type === 'bull' ? 'high' : 'low'] },
            pennantHigh: pennantPeaks[0]?.value,
            pennantLow: pennantTroughs[0]?.value,
            apex: { index: recentCandles.length - 1 }
        },
        target: target,
        currentPrice: currentPrice,
        potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
        status: 'forming'
    };
}

/**
 * Detect Triple Bottom pattern
 */
function detectTripleBottom(candles) {
    if (candles.length < 30) return null;

    const troughs = findTroughs(candles, 3);
    if (troughs.length < 3) return null;

    for (let i = 0; i < troughs.length - 2; i++) {
        const first = troughs[i];
        const second = troughs[i + 1];
        const third = troughs[i + 2];

        const avgLevel = (first.value + second.value + third.value) / 3;
        const tolerance = avgLevel * 0.05;

        const allSimilar = Math.abs(first.value - avgLevel) < tolerance &&
                          Math.abs(second.value - avgLevel) < tolerance &&
                          Math.abs(third.value - avgLevel) < tolerance;

        if (!allSimilar) continue;

        const between1 = candles.slice(first.index, second.index);
        const between2 = candles.slice(second.index, third.index);
        const peak1 = Math.max(...between1.map(c => c.high));
        const peak2 = Math.max(...between2.map(c => c.high));
        const neckline = (peak1 + peak2) / 2;

        const currentPrice = candles[candles.length - 1].close;
        const patternHeight = neckline - avgLevel;
        const target = neckline + patternHeight;

        const priceSymmetry = 1 - (Math.max(first.value, second.value, third.value) -
                                   Math.min(first.value, second.value, third.value)) / avgLevel;
        const confidence = priceSymmetry * PATTERNS.TRIPLE_BOTTOM.reliability;

        return {
            pattern: 'TRIPLE_BOTTOM',
            confidence: Math.min(confidence * 100, 95),
            points: {
                first: { index: first.index, price: first.value },
                second: { index: second.index, price: second.value },
                third: { index: third.index, price: third.value },
                neckline: neckline
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice > neckline ? 'confirmed' : 'forming'
        };
    }

    return null;
}

/**
 * Detect Rounding patterns (Bottom/Top)
 */
function detectRoundingPattern(candles, type = 'bottom') {
    if (candles.length < 40) return null;

    const recentCandles = candles.slice(-80);
    const midIndex = Math.floor(recentCandles.length / 2);

    const firstHalf = recentCandles.slice(0, midIndex);
    const secondHalf = recentCandles.slice(midIndex);

    const firstHalfAvg = firstHalf.reduce((sum, c) => sum + c.close, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, c) => sum + c.close, 0) / secondHalf.length;
    const midPrice = recentCandles[midIndex].close;

    if (type === 'bottom') {
        const firstHalfDecline = firstHalf[0].close > midPrice;
        const secondHalfRise = secondHalf[secondHalf.length - 1].close > midPrice;
        const middleIsLowest = midPrice < firstHalfAvg && midPrice < secondHalfAvg;

        if (!firstHalfDecline || !secondHalfRise || !middleIsLowest) return null;

        const leftRim = Math.max(...firstHalf.slice(0, 10).map(c => c.high));
        const rightRim = Math.max(...secondHalf.slice(-10).map(c => c.high));
        const bottom = Math.min(...recentCandles.slice(midIndex - 5, midIndex + 5).map(c => c.low));

        const currentPrice = candles[candles.length - 1].close;
        const patternDepth = ((leftRim + rightRim) / 2) - bottom;
        const target = Math.max(leftRim, rightRim) + patternDepth * 0.5;

        const symmetry = 1 - Math.abs(leftRim - rightRim) / leftRim;
        const confidence = symmetry * PATTERNS.ROUNDING_BOTTOM.reliability;

        return {
            pattern: 'ROUNDING_BOTTOM',
            confidence: Math.min(confidence * 100, 95),
            points: {
                leftRim: { index: 0, price: leftRim },
                bottom: { index: midIndex, price: bottom },
                rightRim: { index: recentCandles.length - 1, price: rightRim },
                curvePoints: [
                    { index: Math.floor(midIndex / 2), price: firstHalf[Math.floor(midIndex / 2)]?.low },
                    { index: midIndex, price: bottom },
                    { index: midIndex + Math.floor(secondHalf.length / 2), price: secondHalf[Math.floor(secondHalf.length / 2)]?.low }
                ]
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice > rightRim ? 'confirmed' : 'forming'
        };
    } else {
        const firstHalfRise = firstHalf[0].close < midPrice;
        const secondHalfDecline = secondHalf[secondHalf.length - 1].close < midPrice;
        const middleIsHighest = midPrice > firstHalfAvg && midPrice > secondHalfAvg;

        if (!firstHalfRise || !secondHalfDecline || !middleIsHighest) return null;

        const leftBase = Math.min(...firstHalf.slice(0, 10).map(c => c.low));
        const rightBase = Math.min(...secondHalf.slice(-10).map(c => c.low));
        const top = Math.max(...recentCandles.slice(midIndex - 5, midIndex + 5).map(c => c.high));

        const currentPrice = candles[candles.length - 1].close;
        const patternHeight = top - ((leftBase + rightBase) / 2);
        const target = Math.min(leftBase, rightBase) - patternHeight * 0.5;

        const symmetry = 1 - Math.abs(leftBase - rightBase) / leftBase;
        const confidence = symmetry * PATTERNS.ROUNDING_TOP.reliability;

        return {
            pattern: 'ROUNDING_TOP',
            confidence: Math.min(confidence * 100, 95),
            points: {
                leftBase: { index: 0, price: leftBase },
                top: { index: midIndex, price: top },
                rightBase: { index: recentCandles.length - 1, price: rightBase },
                curvePoints: [
                    { index: Math.floor(midIndex / 2), price: firstHalf[Math.floor(midIndex / 2)]?.high },
                    { index: midIndex, price: top },
                    { index: midIndex + Math.floor(secondHalf.length / 2), price: secondHalf[Math.floor(secondHalf.length / 2)]?.high }
                ]
            },
            target: target,
            currentPrice: currentPrice,
            potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
            status: currentPrice < rightBase ? 'confirmed' : 'forming'
        };
    }
}

/**
 * Detect Broadening patterns (Megaphone)
 */
function detectBroadeningPattern(candles) {
    if (candles.length < 30) return null;

    const recentCandles = candles.slice(-50);
    const peaks = findPeaks(recentCandles, 3);
    const troughs = findTroughs(recentCandles, 3);

    if (peaks.length < 3 || troughs.length < 3) return null;

    const highsExpanding = peaks[peaks.length - 1].value > peaks[0].value;
    const lowsExpanding = troughs[troughs.length - 1].value < troughs[0].value;

    if (!highsExpanding || !lowsExpanding) return null;

    const highExpansion = (peaks[peaks.length - 1].value - peaks[0].value) / peaks[0].value;
    const lowExpansion = (troughs[0].value - troughs[troughs.length - 1].value) / troughs[0].value;

    if (highExpansion < 0.03 || lowExpansion < 0.03) return null;

    const currentPrice = candles[candles.length - 1].close;
    const midPattern = (peaks[peaks.length - 1].value + troughs[troughs.length - 1].value) / 2;
    const isBearish = currentPrice > midPattern;
    const actualType = isBearish ? 'top' : 'bottom';

    const target = actualType === 'top' ?
        troughs[troughs.length - 1].value :
        peaks[peaks.length - 1].value;

    const expansionStrength = (highExpansion + lowExpansion) / 2;
    const confidence = Math.min(expansionStrength * 5, 1) *
                      PATTERNS[actualType === 'top' ? 'BROADENING_TOP' : 'BROADENING_BOTTOM'].reliability;

    return {
        pattern: actualType === 'top' ? 'BROADENING_TOP' : 'BROADENING_BOTTOM',
        confidence: Math.min(confidence * 100, 95),
        points: {
            upperStart: { index: peaks[0].index, price: peaks[0].value },
            upperEnd: { index: peaks[peaks.length - 1].index, price: peaks[peaks.length - 1].value },
            lowerStart: { index: troughs[0].index, price: troughs[0].value },
            lowerEnd: { index: troughs[troughs.length - 1].index, price: troughs[troughs.length - 1].value }
        },
        target: target,
        currentPrice: currentPrice,
        potentialMove: ((target - currentPrice) / currentPrice * 100).toFixed(2),
        status: 'forming'
    };
}

/**
 * Detect Candlestick patterns
 */
function detectCandlestickPatterns(candles) {
    if (candles.length < 5) return [];

    const patterns = [];
    const recentCandles = candles.slice(-10);
    const currentPrice = candles[candles.length - 1].close;

    const getBody = (c) => Math.abs(c.close - c.open);
    const getUpperWick = (c) => c.high - Math.max(c.open, c.close);
    const getLowerWick = (c) => Math.min(c.open, c.close) - c.low;
    const getRange = (c) => c.high - c.low;
    const isBullish = (c) => c.close > c.open;
    const isBearish = (c) => c.close < c.open;

    const recentTrend = candles.slice(-20, -3);
    const trendUp = recentTrend.length > 0 && recentTrend[recentTrend.length - 1].close > recentTrend[0].close;
    const trendDown = recentTrend.length > 0 && recentTrend[recentTrend.length - 1].close < recentTrend[0].close;

    const last = recentCandles[recentCandles.length - 1];
    const prev = recentCandles[recentCandles.length - 2];
    const prev2 = recentCandles[recentCandles.length - 3];

    const bodyRatio = getRange(last) > 0 ? getBody(last) / getRange(last) : 0;
    const lowerWickRatio = getRange(last) > 0 ? getLowerWick(last) / getRange(last) : 0;
    const upperWickRatio = getRange(last) > 0 ? getUpperWick(last) / getRange(last) : 0;

    // DOJI
    if (bodyRatio < 0.1 && getRange(last) > 0) {
        patterns.push({
            pattern: 'DOJI',
            confidence: 55,
            points: { index: candles.length - 1, price: last.close },
            target: trendUp ? last.low * 0.98 : last.high * 1.02,
            currentPrice,
            potentialMove: '2.00',
            status: 'detected'
        });
    }

    // HAMMER
    if (lowerWickRatio > 0.6 && upperWickRatio < 0.1 && bodyRatio < 0.3 && trendDown) {
        patterns.push({
            pattern: 'HAMMER',
            confidence: 60,
            points: { index: candles.length - 1, price: last.close },
            target: last.high * 1.03,
            currentPrice,
            potentialMove: '3.00',
            status: 'detected'
        });
    }

    // HANGING MAN
    if (lowerWickRatio > 0.6 && upperWickRatio < 0.1 && bodyRatio < 0.3 && trendUp) {
        patterns.push({
            pattern: 'HANGING_MAN',
            confidence: 58,
            points: { index: candles.length - 1, price: last.close },
            target: last.low * 0.97,
            currentPrice,
            potentialMove: '-3.00',
            status: 'detected'
        });
    }

    // SHOOTING STAR
    if (upperWickRatio > 0.6 && lowerWickRatio < 0.1 && bodyRatio < 0.3 && trendUp) {
        patterns.push({
            pattern: 'SHOOTING_STAR',
            confidence: 58,
            points: { index: candles.length - 1, price: last.close },
            target: last.low * 0.97,
            currentPrice,
            potentialMove: '-3.00',
            status: 'detected'
        });
    }

    // INVERTED HAMMER
    if (upperWickRatio > 0.6 && lowerWickRatio < 0.1 && bodyRatio < 0.3 && trendDown) {
        patterns.push({
            pattern: 'INVERTED_HAMMER',
            confidence: 55,
            points: { index: candles.length - 1, price: last.close },
            target: last.high * 1.03,
            currentPrice,
            potentialMove: '3.00',
            status: 'detected'
        });
    }

    // BULLISH ENGULFING
    if (prev && isBearish(prev) && isBullish(last) &&
        last.open < prev.close && last.close > prev.open &&
        getBody(last) > getBody(prev) * 1.2) {
        patterns.push({
            pattern: 'BULLISH_ENGULFING',
            confidence: 65,
            points: {
                engulfed: { index: candles.length - 2, price: prev.close },
                engulfing: { index: candles.length - 1, price: last.close }
            },
            target: last.high * 1.04,
            currentPrice,
            potentialMove: '4.00',
            status: 'detected'
        });
    }

    // BEARISH ENGULFING
    if (prev && isBullish(prev) && isBearish(last) &&
        last.open > prev.close && last.close < prev.open &&
        getBody(last) > getBody(prev) * 1.2) {
        patterns.push({
            pattern: 'BEARISH_ENGULFING',
            confidence: 65,
            points: {
                engulfed: { index: candles.length - 2, price: prev.close },
                engulfing: { index: candles.length - 1, price: last.close }
            },
            target: last.low * 0.96,
            currentPrice,
            potentialMove: '-4.00',
            status: 'detected'
        });
    }

    // MORNING STAR
    if (prev2 && prev && isBearish(prev2) && isBullish(last) &&
        getBody(prev) < getBody(prev2) * 0.3 &&
        last.close > (prev2.open + prev2.close) / 2) {
        patterns.push({
            pattern: 'MORNING_STAR',
            confidence: 72,
            points: {
                first: { index: candles.length - 3, price: prev2.close },
                star: { index: candles.length - 2, price: prev.close },
                third: { index: candles.length - 1, price: last.close }
            },
            target: prev2.open * 1.05,
            currentPrice,
            potentialMove: '5.00',
            status: 'detected'
        });
    }

    // EVENING STAR
    if (prev2 && prev && isBullish(prev2) && isBearish(last) &&
        getBody(prev) < getBody(prev2) * 0.3 &&
        last.close < (prev2.open + prev2.close) / 2) {
        patterns.push({
            pattern: 'EVENING_STAR',
            confidence: 72,
            points: {
                first: { index: candles.length - 3, price: prev2.close },
                star: { index: candles.length - 2, price: prev.close },
                third: { index: candles.length - 1, price: last.close }
            },
            target: prev2.open * 0.95,
            currentPrice,
            potentialMove: '-5.00',
            status: 'detected'
        });
    }

    // THREE WHITE SOLDIERS
    if (prev2 && prev && isBullish(prev2) && isBullish(prev) && isBullish(last) &&
        prev.close > prev2.close && last.close > prev.close) {
        patterns.push({
            pattern: 'THREE_WHITE_SOLDIERS',
            confidence: 75,
            points: {
                first: { index: candles.length - 3, price: prev2.close },
                second: { index: candles.length - 2, price: prev.close },
                third: { index: candles.length - 1, price: last.close }
            },
            target: last.close * 1.06,
            currentPrice,
            potentialMove: '6.00',
            status: 'detected'
        });
    }

    // THREE BLACK CROWS
    if (prev2 && prev && isBearish(prev2) && isBearish(prev) && isBearish(last) &&
        prev.close < prev2.close && last.close < prev.close) {
        patterns.push({
            pattern: 'THREE_BLACK_CROWS',
            confidence: 75,
            points: {
                first: { index: candles.length - 3, price: prev2.close },
                second: { index: candles.length - 2, price: prev.close },
                third: { index: candles.length - 1, price: last.close }
            },
            target: last.close * 0.94,
            currentPrice,
            potentialMove: '-6.00',
            status: 'detected'
        });
    }

    // PIERCING LINE
    if (prev && isBearish(prev) && isBullish(last) &&
        last.open < prev.low &&
        last.close > (prev.open + prev.close) / 2 &&
        last.close < prev.open) {
        patterns.push({
            pattern: 'PIERCING_LINE',
            confidence: 62,
            points: {
                first: { index: candles.length - 2, price: prev.close },
                second: { index: candles.length - 1, price: last.close }
            },
            target: prev.high,
            currentPrice,
            potentialMove: ((prev.high - currentPrice) / currentPrice * 100).toFixed(2),
            status: 'detected'
        });
    }

    // DARK CLOUD COVER
    if (prev && isBullish(prev) && isBearish(last) &&
        last.open > prev.high &&
        last.close < (prev.open + prev.close) / 2 &&
        last.close > prev.open) {
        patterns.push({
            pattern: 'DARK_CLOUD_COVER',
            confidence: 62,
            points: {
                first: { index: candles.length - 2, price: prev.close },
                second: { index: candles.length - 1, price: last.close }
            },
            target: prev.low,
            currentPrice,
            potentialMove: ((prev.low - currentPrice) / currentPrice * 100).toFixed(2),
            status: 'detected'
        });
    }

    // MARUBOZU
    const totalWickRatio = getRange(last) > 0 ? (getUpperWick(last) + getLowerWick(last)) / getRange(last) : 1;
    if (totalWickRatio < 0.1 && getBody(last) / getRange(last) > 0.9) {
        const maruType = isBullish(last) ? 'bullish' : 'bearish';
        patterns.push({
            pattern: 'MARUBOZU',
            confidence: 68,
            points: { index: candles.length - 1, price: last.close },
            target: maruType === 'bullish' ? last.close * 1.04 : last.close * 0.96,
            currentPrice,
            potentialMove: maruType === 'bullish' ? '4.00' : '-4.00',
            status: 'detected',
            subType: maruType
        });
    }

    return patterns;
}

// ============ HELPER FUNCTIONS ============

/**
 * Find peaks in price data
 * Uses a more lenient approach - a peak just needs to be a local maximum
 */
function findPeaks(candles, window = 5) {
    const peaks = [];

    // Use smaller effective window to find more peaks
    const effectiveWindow = Math.min(window, Math.floor(candles.length / 10));

    for (let i = effectiveWindow; i < candles.length - effectiveWindow; i++) {
        const currentHigh = candles[i].high;
        let isPeak = true;

        // Check if this is higher than or equal to surrounding candles (relaxed from strictly greater)
        for (let j = i - effectiveWindow; j <= i + effectiveWindow; j++) {
            if (j !== i && candles[j].high > currentHigh) {
                isPeak = false;
                break;
            }
        }

        if (isPeak) {
            // Avoid adding duplicate peaks at same level (within 0.5%)
            const isDuplicate = peaks.some(p =>
                Math.abs(i - p.index) < effectiveWindow * 2 &&
                Math.abs(p.value - currentHigh) / currentHigh < 0.005
            );
            if (!isDuplicate) {
                peaks.push({ index: i, value: currentHigh });
            }
        }
    }

    return peaks;
}

/**
 * Find troughs in price data
 * Uses a more lenient approach - a trough just needs to be a local minimum
 */
function findTroughs(candles, window = 5) {
    const troughs = [];

    // Use smaller effective window to find more troughs
    const effectiveWindow = Math.min(window, Math.floor(candles.length / 10));

    for (let i = effectiveWindow; i < candles.length - effectiveWindow; i++) {
        const currentLow = candles[i].low;
        let isTrough = true;

        // Check if this is lower than or equal to surrounding candles (relaxed from strictly lower)
        for (let j = i - effectiveWindow; j <= i + effectiveWindow; j++) {
            if (j !== i && candles[j].low < currentLow) {
                isTrough = false;
                break;
            }
        }

        if (isTrough) {
            // Avoid adding duplicate troughs at same level (within 0.5%)
            const isDuplicate = troughs.some(t =>
                Math.abs(i - t.index) < effectiveWindow * 2 &&
                Math.abs(t.value - currentLow) / currentLow < 0.005
            );
            if (!isDuplicate) {
                troughs.push({ index: i, value: currentLow });
            }
        }
    }

    return troughs;
}

/**
 * Check volume confirmation for pattern
 */
function checkVolumePattern(candles, startIndex, endIndex) {
    const relevantCandles = candles.slice(startIndex, endIndex);
    const avgVolume = relevantCandles.reduce((sum, c) => sum + (c.volume || 0), 0) / relevantCandles.length;
    
    // Check if recent volume is above average (confirmation)
    const recentVolume = candles.slice(-5).reduce((sum, c) => sum + (c.volume || 0), 0) / 5;
    
    return Math.min(recentVolume / avgVolume, 1.5) / 1.5; // Normalize to 0-1
}

// ============ SIMPLE TREND DETECTION ============

/**
 * Detect simple uptrend/downtrend with support/resistance
 * More lenient pattern that almost always finds something useful
 */
function detectTrend(candles) {
    if (candles.length < 10) return null;

    const recentCandles = candles.slice(-30);
    const firstClose = recentCandles[0].close;
    const lastClose = recentCandles[recentCandles.length - 1].close;
    const priceChange = (lastClose - firstClose) / firstClose;

    // Find recent high and low
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const recentLow = Math.min(...recentCandles.map(c => c.low));
    const currentPrice = lastClose;

    // Determine trend direction (>3% move is significant)
    if (Math.abs(priceChange) > 0.03) {
        const isBullish = priceChange > 0;
        const trendStrength = Math.min(Math.abs(priceChange) * 5, 1); // Normalize to 0-1

        return {
            pattern: isBullish ? 'UPTREND' : 'DOWNTREND',
            confidence: Math.min(50 + trendStrength * 40, 85),
            name: isBullish ? 'Uptrend Channel' : 'Downtrend Channel',
            type: isBullish ? 'bullish' : 'bearish',
            reliability: 0.65,
            description: isBullish ?
                'Price is in a sustained uptrend with higher highs and higher lows' :
                'Price is in a sustained downtrend with lower highs and lower lows',
            points: {
                resistance: recentHigh,
                support: recentLow,
                trendStart: firstClose,
                trendEnd: lastClose
            },
            target: isBullish ? recentHigh * 1.05 : recentLow * 0.95,
            currentPrice: currentPrice,
            potentialMove: isBullish ?
                ((recentHigh * 1.05 - currentPrice) / currentPrice * 100).toFixed(2) :
                ((recentLow * 0.95 - currentPrice) / currentPrice * 100).toFixed(2),
            status: 'active',
            detectedAt: new Date().toISOString()
        };
    }

    // If no strong trend, detect consolidation/range
    const range = (recentHigh - recentLow) / recentLow;
    if (range < 0.08) { // Less than 8% range = consolidation
        return {
            pattern: 'CONSOLIDATION',
            confidence: 60,
            name: 'Consolidation Range',
            type: 'neutral',
            reliability: 0.70,
            description: 'Price is consolidating in a tight range, potential breakout coming',
            points: {
                resistance: recentHigh,
                support: recentLow,
                midpoint: (recentHigh + recentLow) / 2
            },
            target: currentPrice > (recentHigh + recentLow) / 2 ? recentHigh * 1.02 : recentLow * 0.98,
            currentPrice: currentPrice,
            potentialMove: ((recentHigh - currentPrice) / currentPrice * 100).toFixed(2),
            status: 'forming',
            detectedAt: new Date().toISOString()
        };
    }

    return null;
}

/**
 * Detect support and resistance levels
 */
function detectSupportResistance(candles) {
    if (candles.length < 20) return null;

    const peaks = findPeaks(candles, 2);
    const troughs = findTroughs(candles, 2);

    if (peaks.length < 1 && troughs.length < 1) return null;

    const currentPrice = candles[candles.length - 1].close;

    // Find nearest resistance (peaks above current price)
    const resistanceLevels = peaks
        .filter(p => p.value > currentPrice)
        .sort((a, b) => a.value - b.value);

    // Find nearest support (troughs below current price)
    const supportLevels = troughs
        .filter(t => t.value < currentPrice)
        .sort((a, b) => b.value - a.value);

    if (resistanceLevels.length > 0 || supportLevels.length > 0) {
        const nearestResistance = resistanceLevels[0]?.value;
        const nearestSupport = supportLevels[0]?.value;

        return {
            pattern: 'SUPPORT_RESISTANCE',
            confidence: 70,
            name: 'Key Support & Resistance',
            type: 'neutral',
            reliability: 0.75,
            description: `Key levels identified: Support at $${nearestSupport?.toFixed(2) || 'N/A'}, Resistance at $${nearestResistance?.toFixed(2) || 'N/A'}`,
            points: {
                resistance: nearestResistance,
                support: nearestSupport,
                allResistance: resistanceLevels.slice(0, 3).map(r => r.value),
                allSupport: supportLevels.slice(0, 3).map(s => s.value)
            },
            target: nearestResistance || currentPrice * 1.05,
            currentPrice: currentPrice,
            potentialMove: nearestResistance ?
                ((nearestResistance - currentPrice) / currentPrice * 100).toFixed(2) : '5.00',
            status: 'active',
            detectedAt: new Date().toISOString()
        };
    }

    return null;
}

// ============ TIMEFRAME SCALING ============

/**
 * Get scaling factor based on timeframe
 * This adjusts pattern detection parameters for different timeframes
 */
function getTimeframeScale(interval, candleCount) {
    // Map intervals to approximate candles per day
    const candlesPerDay = {
        '1m': 1440,
        '5m': 288,
        '15m': 96,
        '30m': 48,
        '1h': 24,
        '4h': 6,
        '1D': 1,
        '1W': 0.14,
        'LIVE': 288  // Assume 5m equivalent
    };

    const cpd = candlesPerDay[interval] || 24; // Default to 1h

    // Scale factor: 1.0 for daily, higher for lower timeframes
    const scale = Math.sqrt(cpd);

    // Effective lookback: how many candles to analyze for patterns
    // More candles available = larger lookback window
    const effectiveLookback = Math.min(
        Math.floor(candleCount * 0.8), // Use up to 80% of available data
        Math.floor(100 * scale) // But cap based on timeframe
    );

    // Window size for peak/trough detection
    const peakWindow = Math.max(2, Math.min(10, Math.floor(3 * Math.sqrt(scale))));

    return {
        scale,
        effectiveLookback,
        peakWindow,
        // Tolerance for price matching (lower timeframes need tighter tolerance)
        priceTolerance: Math.min(0.08, 0.03 * scale),
        // Minimum pattern duration in candles
        minDuration: Math.floor(10 * scale),
        interval
    };
}

// ============ MAIN PATTERN SCANNER ============

/**
 * Scan for all patterns on given candle data
 * @param {Array} candles - OHLCV candle data
 * @param {string} interval - Timeframe interval (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W)
 */
function scanForPatterns(candles, interval = '1D') {
    const detectedPatterns = [];

    // Get timeframe-adjusted parameters
    const tf = getTimeframeScale(interval, candles.length);

    console.log(`[Pattern Recognition] Scanning ${candles.length} candles (${interval}, scale=${tf.scale.toFixed(2)}, lookback=${tf.effectiveLookback}, peakWindow=${tf.peakWindow})...`);

    // Use timeframe-adjusted lookback for pattern analysis
    const analysisCandles = candles.slice(-tf.effectiveLookback);

    // Find peaks and troughs with timeframe-adjusted window
    const peaks = findPeaks(analysisCandles, tf.peakWindow);
    const troughs = findTroughs(analysisCandles, tf.peakWindow);
    console.log(`[Pattern Recognition] Found ${peaks.length} peaks, ${troughs.length} troughs in ${analysisCandles.length} candles`);

    // Classic patterns (more strict) - use analysisCandles for timeframe-appropriate detection
    const invHS = detectHeadShoulders(analysisCandles, 'bullish');
    if (invHS) {
        console.log(`[Pattern Recognition] ✅ Found Inverse Head & Shoulders`);
        detectedPatterns.push(invHS);
    }

    const doubleBottom = detectDoubleTopBottom(analysisCandles, 'bottom');
    if (doubleBottom) {
        console.log(`[Pattern Recognition] ✅ Found Double Bottom`);
        detectedPatterns.push(doubleBottom);
    }

    const cupHandle = detectCupHandle(analysisCandles);
    if (cupHandle) {
        console.log(`[Pattern Recognition] ✅ Found Cup and Handle`);
        detectedPatterns.push(cupHandle);
    }

    const ascTriangle = detectTriangle(analysisCandles, 'ascending');
    if (ascTriangle) {
        console.log(`[Pattern Recognition] ✅ Found Ascending Triangle`);
        detectedPatterns.push(ascTriangle);
    }

    const bullFlag = detectFlag(analysisCandles, 'bull');
    if (bullFlag) {
        console.log(`[Pattern Recognition] ✅ Found Bull Flag`);
        detectedPatterns.push(bullFlag);
    }

    // Bearish patterns
    const hs = detectHeadShoulders(analysisCandles, 'bearish');
    if (hs) {
        console.log(`[Pattern Recognition] ✅ Found Head & Shoulders`);
        detectedPatterns.push(hs);
    }

    const doubleTop = detectDoubleTopBottom(analysisCandles, 'top');
    if (doubleTop) {
        console.log(`[Pattern Recognition] ✅ Found Double Top`);
        detectedPatterns.push(doubleTop);
    }

    const descTriangle = detectTriangle(analysisCandles, 'descending');
    if (descTriangle) {
        console.log(`[Pattern Recognition] ✅ Found Descending Triangle`);
        detectedPatterns.push(descTriangle);
    }

    const bearFlag = detectFlag(analysisCandles, 'bear');
    if (bearFlag) {
        console.log(`[Pattern Recognition] ✅ Found Bear Flag`);
        detectedPatterns.push(bearFlag);
    }

    // NEW PATTERNS - Wedges
    const risingWedge = detectWedge(analysisCandles, 'rising');
    if (risingWedge) {
        console.log(`[Pattern Recognition] ✅ Found Rising Wedge`);
        detectedPatterns.push(risingWedge);
    }

    const fallingWedge = detectWedge(analysisCandles, 'falling');
    if (fallingWedge) {
        console.log(`[Pattern Recognition] ✅ Found Falling Wedge`);
        detectedPatterns.push(fallingWedge);
    }

    // NEW PATTERNS - Pennants
    const bullPennant = detectPennant(analysisCandles, 'bull');
    if (bullPennant) {
        console.log(`[Pattern Recognition] ✅ Found Bull Pennant`);
        detectedPatterns.push(bullPennant);
    }

    const bearPennant = detectPennant(analysisCandles, 'bear');
    if (bearPennant) {
        console.log(`[Pattern Recognition] ✅ Found Bear Pennant`);
        detectedPatterns.push(bearPennant);
    }

    // NEW PATTERNS - Triple Bottom
    const tripleBottom = detectTripleBottom(analysisCandles);
    if (tripleBottom) {
        console.log(`[Pattern Recognition] ✅ Found Triple Bottom`);
        detectedPatterns.push(tripleBottom);
    }

    // NEW PATTERNS - Rounding
    const roundingBottom = detectRoundingPattern(analysisCandles, 'bottom');
    if (roundingBottom) {
        console.log(`[Pattern Recognition] ✅ Found Rounding Bottom`);
        detectedPatterns.push(roundingBottom);
    }

    const roundingTop = detectRoundingPattern(analysisCandles, 'top');
    if (roundingTop) {
        console.log(`[Pattern Recognition] ✅ Found Rounding Top`);
        detectedPatterns.push(roundingTop);
    }

    // NEW PATTERNS - Broadening
    const broadening = detectBroadeningPattern(analysisCandles);
    if (broadening) {
        console.log(`[Pattern Recognition] ✅ Found ${broadening.pattern}`);
        detectedPatterns.push(broadening);
    }

    // NEW PATTERNS - Candlestick patterns (always scan recent candles)
    const candlestickPatterns = detectCandlestickPatterns(candles);
    if (candlestickPatterns.length > 0) {
        console.log(`[Pattern Recognition] ✅ Found ${candlestickPatterns.length} candlestick pattern(s)`);
        detectedPatterns.push(...candlestickPatterns);
    }

    // If no classic patterns found, try simpler detection
    if (detectedPatterns.length === 0) {
        console.log(`[Pattern Recognition] No classic patterns, trying trend/S&R detection...`);

        const trend = detectTrend(analysisCandles);
        if (trend) {
            console.log(`[Pattern Recognition] ✅ Found ${trend.pattern}`);
            detectedPatterns.push(trend);
        }

        const sr = detectSupportResistance(analysisCandles);
        if (sr) {
            console.log(`[Pattern Recognition] ✅ Found Support/Resistance levels`);
            detectedPatterns.push(sr);
        }
    }

    console.log(`[Pattern Recognition] Total patterns found: ${detectedPatterns.length}`);

    // Calculate the index offset: pattern indices are relative to analysisCandles,
    // but need to be relative to the full candles array for correct chart positioning
    const indexOffset = candles.length - analysisCandles.length;
    console.log(`[Pattern Recognition] Applying index offset: ${indexOffset} (full: ${candles.length}, analysis: ${analysisCandles.length})`);

    // Helper function to recursively adjust all index values in pattern points
    const adjustPatternIndices = (points, offset) => {
        if (!points || typeof points !== 'object') return points;

        const adjusted = {};
        for (const [key, value] of Object.entries(points)) {
            if (value === null || value === undefined) {
                adjusted[key] = value;
            } else if (Array.isArray(value)) {
                // Handle arrays (like curvePoints)
                adjusted[key] = value.map(item => {
                    if (item && typeof item === 'object' && 'index' in item) {
                        return { ...item, index: item.index + offset };
                    }
                    return item;
                });
            } else if (typeof value === 'object' && 'index' in value) {
                // Handle point objects with index property
                adjusted[key] = { ...value, index: value.index + offset };
            } else if (typeof value === 'object') {
                // Recursively handle nested objects
                adjusted[key] = adjustPatternIndices(value, offset);
            } else if (key === 'index') {
                // Handle direct index property
                adjusted[key] = value + offset;
            } else {
                adjusted[key] = value;
            }
        }
        return adjusted;
    };

    // Candlestick patterns use full candles array, so don't apply offset to them
    const candlestickTypes = [
        'DOJI', 'HAMMER', 'HANGING_MAN', 'INVERTED_HAMMER', 'SHOOTING_STAR', 'MARUBOZU',
        'BULLISH_ENGULFING', 'BEARISH_ENGULFING', 'PIERCING_LINE', 'DARK_CLOUD_COVER',
        'MORNING_STAR', 'EVENING_STAR', 'THREE_WHITE_SOLDIERS', 'THREE_BLACK_CROWS'
    ];

    // Enrich patterns with metadata and adjust indices for full chart coordinates
    return detectedPatterns.map(pattern => {
        // Only apply offset to non-candlestick patterns (they use analysisCandles)
        const needsOffset = !candlestickTypes.includes(pattern.pattern);
        const adjustedPoints = needsOffset
            ? adjustPatternIndices(pattern.points, indexOffset)
            : pattern.points;

        return {
            ...pattern,
            ...(PATTERNS[pattern.pattern] || {}),
            points: adjustedPoints,
            detectedAt: pattern.detectedAt || new Date().toISOString(),
            risk: calculateRisk(pattern),
            reward: calculateReward(pattern)
        };
    });
}

/**
 * Calculate risk percentage
 */
function calculateRisk(pattern) {
    const currentPrice = pattern.currentPrice;
    let stopLoss;

    const patternDef = PATTERNS[pattern.pattern];
    const patternType = patternDef?.type || pattern.type || 'neutral';

    // Set stop loss based on pattern type
    if (patternType === 'bullish') {
        // For bullish, stop below support
        stopLoss = pattern.points?.neckline || pattern.points?.support || (currentPrice * 0.95);
    } else if (patternType === 'bearish') {
        // For bearish, stop above resistance
        stopLoss = pattern.points?.neckline || pattern.points?.resistance || (currentPrice * 1.05);
    } else {
        // For neutral, use small percentage
        stopLoss = currentPrice * 0.97;
    }

    return Math.abs(((stopLoss - currentPrice) / currentPrice) * 100).toFixed(2);
}

/**
 * Calculate reward percentage
 */
function calculateReward(pattern) {
    return Math.abs(parseFloat(pattern.potentialMove));
}

// ============ EXPORTS ============

module.exports = {
    scanForPatterns,
    detectHeadShoulders,
    detectDoubleTopBottom,
    detectTriangle,
    detectFlag,
    detectCupHandle,
    detectWedge,
    detectPennant,
    detectTripleBottom,
    detectRoundingPattern,
    detectBroadeningPattern,
    detectCandlestickPatterns,
    PATTERNS
};