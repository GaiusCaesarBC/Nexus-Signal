// server/routes/patternRoutes.js - FINAL VERSION: Uses chartService directly!

const express = require('express');
const router = express.Router();

// Import shared chart service (NO HTTP CALLS!)
const { getChartData } = require('../services/chartService');

// Temporary no-auth
const auth = (req, res, next) => next();

// Import pattern detection service
let scanForPatterns, PATTERNS;
try {
    const patternService = require('../services/patternRecognition');
    scanForPatterns = patternService.scanForPatterns;
    PATTERNS = patternService.PATTERNS;
    console.log('✅ Pattern recognition service loaded');
} catch (error) {
    console.warn('⚠️  Pattern recognition service not found');
    scanForPatterns = null;
    PATTERNS = null;
}

/**
 * @route   GET /api/patterns/:symbol
 * @desc    Detect patterns on a specific symbol
 * @access  Private
 */
router.get('/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { interval = '1D' } = req.query;

        console.log(`[Pattern Recognition] Scanning ${symbol} for patterns...`);

        // Fetch chart data using shared service (NO HTTP CALL!)
        let chartData;
        try {
            chartData = await getChartData(symbol, interval);
            console.log(`[Pattern Recognition] Got ${chartData.data?.length || 0} candles`);
        } catch (error) {
            console.error('[Pattern Recognition] Chart data error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch chart data',
                message: error.message
            });
        }
        
        if (!chartData.success || !chartData.data || chartData.data.length < 30) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient data for pattern detection',
                message: `Need at least 30 candles, got ${chartData.data?.length || 0}`
            });
        }

        const candles = chartData.data;

        // Run REAL AI pattern detection with timeframe-aware analysis!
        let patterns;

        if (scanForPatterns) {
            patterns = scanForPatterns(candles, interval);
            console.log(`[Pattern Recognition] ✅ REAL detection (${interval}): Found ${patterns.length} patterns`);
        } else {
            // Fallback mock if service not available
            patterns = [];
            console.log(`[Pattern Recognition] ⚠️  No detection service, returning empty`);
        }

        res.json({
            success: true,
            symbol,
            interval,
            patternsFound: patterns.length,
            patterns: patterns.sort((a, b) => b.confidence - a.confidence),
            scannedAt: new Date().toISOString(),
            candlesAnalyzed: candles.length,
            usingRealDetection: !!scanForPatterns
        });

    } catch (error) {
        console.error('[Pattern Recognition] Error:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to detect patterns',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/patterns/scan/watchlist
 * @desc    Scan multiple symbols for patterns
 * @access  Private
 */
router.post('/scan/watchlist', auth, async (req, res) => {
    try {
        const { symbols, interval = '1D' } = req.body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of symbols'
            });
        }

        console.log(`[Pattern Scanner] Scanning ${symbols.length} symbols...`);

        const results = [];

        for (const symbol of symbols) {
            try {
                const chartData = await getChartData(symbol, interval);
                
                if (chartData.success && chartData.data && chartData.data.length >= 30 && scanForPatterns) {
                    const patterns = scanForPatterns(chartData.data, interval);

                    if (patterns.length > 0) {
                        results.push({
                            symbol,
                            patternsFound: patterns.length,
                            patterns: patterns.sort((a, b) => b.confidence - a.confidence)
                        });
                    }
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`[Pattern Scanner] Error scanning ${symbol}:`, error.message);
            }
        }

        console.log(`[Pattern Scanner] Found patterns in ${results.length}/${symbols.length} symbols`);

        res.json({
            success: true,
            scannedSymbols: symbols.length,
            symbolsWithPatterns: results.length,
            results: results,
            scannedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Pattern Scanner] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scan watchlist',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/patterns/info/all
 * @desc    Get information about all supported patterns
 * @access  Public
 */
router.get('/info/all', (req, res) => {
    if (PATTERNS) {
        const patternInfo = Object.entries(PATTERNS).map(([key, pattern]) => ({
            id: key,
            name: pattern.name,
            type: pattern.type,
            reliability: pattern.reliability,
            description: pattern.description,
            avgDuration: pattern.avgDuration,
            targetCalculation: pattern.targetCalculation
        }));
        
        res.json({
            success: true,
            totalPatterns: patternInfo.length,
            bullishPatterns: patternInfo.filter(p => p.type === 'bullish').length,
            bearishPatterns: patternInfo.filter(p => p.type === 'bearish').length,
            patterns: patternInfo
        });
    } else {
        res.json({
            success: true,
            totalPatterns: 12,
            patterns: [
                { id: 'HEAD_SHOULDERS', name: 'Head and Shoulders', type: 'bearish', reliability: 0.85 },
                { id: 'DOUBLE_TOP', name: 'Double Top', type: 'bearish', reliability: 0.78 },
                { id: 'ASCENDING_TRIANGLE', name: 'Ascending Triangle', type: 'bullish', reliability: 0.72 }
            ],
            note: 'Limited info - add patternRecognition.js for full details'
        });
    }
});

/**
 * @route   POST /api/patterns/analyze/specific
 * @desc    Analyze for specific pattern type only
 * @access  Private
 */
router.post('/analyze/specific', auth, async (req, res) => {
    try {
        const { symbol, patternType, interval = '1D' } = req.body;

        if (!symbol || !patternType) {
            return res.status(400).json({
                success: false,
                error: 'Symbol and pattern type are required'
            });
        }

        if (!PATTERNS || !PATTERNS[patternType]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pattern type'
            });
        }

        const chartData = await getChartData(symbol, interval);
        
        if (!chartData.success || !chartData.data || chartData.data.length < 30) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient data for pattern detection'
            });
        }

        const candles = chartData.data;
        const allPatterns = scanForPatterns ? scanForPatterns(candles, interval) : [];
        const specificPattern = allPatterns.find(p => p.pattern === patternType);

        res.json({
            success: true,
            symbol,
            patternType,
            found: !!specificPattern,
            pattern: specificPattern || null,
            patternInfo: PATTERNS[patternType]
        });

    } catch (error) {
        console.error('[Pattern Analysis] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze for pattern',
            message: error.message
        });
    }
});

module.exports = router;