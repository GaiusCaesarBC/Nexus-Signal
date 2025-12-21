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

// ============ MAIN PATTERN SCANNER ============

/**
 * Scan for all patterns on given candle data
 */
function scanForPatterns(candles) {
    const detectedPatterns = [];

    console.log(`[Pattern Recognition] Scanning ${candles.length} candles...`);

    // Find peaks and troughs first for debugging
    const peaks = findPeaks(candles, 3);
    const troughs = findTroughs(candles, 3);
    console.log(`[Pattern Recognition] Found ${peaks.length} peaks, ${troughs.length} troughs`);

    // Classic patterns (more strict)
    const invHS = detectHeadShoulders(candles, 'bullish');
    if (invHS) {
        console.log(`[Pattern Recognition] ✅ Found Inverse Head & Shoulders`);
        detectedPatterns.push(invHS);
    }

    const doubleBottom = detectDoubleTopBottom(candles, 'bottom');
    if (doubleBottom) {
        console.log(`[Pattern Recognition] ✅ Found Double Bottom`);
        detectedPatterns.push(doubleBottom);
    }

    const cupHandle = detectCupHandle(candles);
    if (cupHandle) {
        console.log(`[Pattern Recognition] ✅ Found Cup and Handle`);
        detectedPatterns.push(cupHandle);
    }

    const ascTriangle = detectTriangle(candles, 'ascending');
    if (ascTriangle) {
        console.log(`[Pattern Recognition] ✅ Found Ascending Triangle`);
        detectedPatterns.push(ascTriangle);
    }

    const bullFlag = detectFlag(candles, 'bull');
    if (bullFlag) {
        console.log(`[Pattern Recognition] ✅ Found Bull Flag`);
        detectedPatterns.push(bullFlag);
    }

    // Bearish patterns
    const hs = detectHeadShoulders(candles, 'bearish');
    if (hs) {
        console.log(`[Pattern Recognition] ✅ Found Head & Shoulders`);
        detectedPatterns.push(hs);
    }

    const doubleTop = detectDoubleTopBottom(candles, 'top');
    if (doubleTop) {
        console.log(`[Pattern Recognition] ✅ Found Double Top`);
        detectedPatterns.push(doubleTop);
    }

    const descTriangle = detectTriangle(candles, 'descending');
    if (descTriangle) {
        console.log(`[Pattern Recognition] ✅ Found Descending Triangle`);
        detectedPatterns.push(descTriangle);
    }

    const bearFlag = detectFlag(candles, 'bear');
    if (bearFlag) {
        console.log(`[Pattern Recognition] ✅ Found Bear Flag`);
        detectedPatterns.push(bearFlag);
    }

    // If no classic patterns found, try simpler detection
    if (detectedPatterns.length === 0) {
        console.log(`[Pattern Recognition] No classic patterns, trying trend/S&R detection...`);

        const trend = detectTrend(candles);
        if (trend) {
            console.log(`[Pattern Recognition] ✅ Found ${trend.pattern}`);
            detectedPatterns.push(trend);
        }

        const sr = detectSupportResistance(candles);
        if (sr) {
            console.log(`[Pattern Recognition] ✅ Found Support/Resistance levels`);
            detectedPatterns.push(sr);
        }
    }

    console.log(`[Pattern Recognition] Total patterns found: ${detectedPatterns.length}`);

    // Enrich patterns with metadata
    return detectedPatterns.map(pattern => ({
        ...pattern,
        ...(PATTERNS[pattern.pattern] || {}),
        detectedAt: pattern.detectedAt || new Date().toISOString(),
        risk: calculateRisk(pattern),
        reward: calculateReward(pattern)
    }));
}

/**
 * Calculate risk percentage
 */
function calculateRisk(pattern) {
    const currentPrice = pattern.currentPrice;
    let stopLoss;
    
    // Set stop loss based on pattern type
    if (PATTERNS[pattern.pattern].type === 'bullish') {
        // For bullish, stop below support
        stopLoss = pattern.points.neckline || pattern.points.support || (currentPrice * 0.95);
    } else {
        // For bearish, stop above resistance
        stopLoss = pattern.points.neckline || pattern.points.resistance || (currentPrice * 1.05);
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
    PATTERNS
};