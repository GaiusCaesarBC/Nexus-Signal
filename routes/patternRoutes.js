// server/routes/patternRoutes.js - FINAL VERSION: Uses chartService directly!

const express = require('express');
const router = express.Router();

// Import shared chart service (NO HTTP CALLS!)
const { getChartData } = require('../services/chartService');

// Temporary no-auth
const auth = (req, res, next) => next();

// Pattern Intelligence layer (ranking, stages, score, market insight)
const patternIntelligence = require('../services/patternIntelligence');

// Simple in-memory cache (90s TTL) — pattern scans are very expensive
const intelCache = new Map();
const INTEL_CACHE_TTL_MS = 90 * 1000;
function intelGet(key) {
    const hit = intelCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > INTEL_CACHE_TTL_MS) { intelCache.delete(key); return null; }
    return hit.v;
}
function intelSet(key, value) {
    if (intelCache.size > 30) {
        const firstKey = intelCache.keys().next().value;
        intelCache.delete(firstKey);
    }
    intelCache.set(key, { t: Date.now(), v: value });
}

function parseIntelFilters(req) {
    const { asset, bias, confMin, stage, patternTypes, minScore, preset, sortDir } = req.query;
    const filters = {
        assetType: asset || 'all',
        bias: bias || 'all',
        confidenceMin: confMin ? Number(confMin) : null,
        stages: stage ? String(stage).split(',').map(s => s.trim()).filter(Boolean) : [],
        patternTypes: patternTypes ? String(patternTypes).split(',').map(s => s.trim()).filter(Boolean) : [],
        minScore: minScore ? Number(minScore) : null,
        sortDir: sortDir || 'desc'
    };
    if (preset) {
        switch (preset) {
            case 'confirmed': filters.stages = ['confirmed']; break;
            case 'near_breakout': filters.stages = ['near_breakout']; break;
            case 'forming': filters.stages = ['forming']; break;
            case 'high_probability': filters.minScore = 80; break;
            case 'bullish_reversal':
                filters.bias = 'long';
                filters.patternTypes = ['DOUBLE_BOTTOM', 'HEAD_SHOULDERS_INVERSE', 'FALLING_WEDGE', 'CUP_HANDLE'];
                break;
            case 'bearish_reversal':
                filters.bias = 'short';
                filters.patternTypes = ['DOUBLE_TOP', 'HEAD_SHOULDERS', 'RISING_WEDGE'];
                break;
            case 'continuation':
                filters.patternTypes = ['BULL_FLAG', 'BEAR_FLAG', 'ASCENDING_TRIANGLE', 'DESCENDING_TRIANGLE'];
                break;
            case 'long': filters.bias = 'long'; break;
            case 'short': filters.bias = 'short'; break;
        }
    }
    return filters;
}

// ─────────────────────────────────────────────────────────
// PATTERN INTELLIGENCE ENDPOINTS — must come before /:symbol
// ─────────────────────────────────────────────────────────

// @route   GET /api/patterns/intelligence
// @desc    Ranked patterns across the active universe with filters
router.get('/intelligence', async (req, res) => {
    try {
        const filters = parseIntelFilters(req);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const offset = Math.max(0, Number(req.query.offset) || 0);

        const cacheKey = `intel:${JSON.stringify(filters)}`;
        let results = intelGet(cacheKey);
        if (!results) {
            results = await patternIntelligence.rankPatterns(filters);
            intelSet(cacheKey, results);
        }

        const sliced = results.slice(offset, offset + limit);
        res.json({
            success: true,
            count: results.length,
            returned: sliced.length,
            offset,
            limit,
            patterns: sliced
        });
    } catch (err) {
        console.error('[Pattern Intelligence] Rank error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to rank patterns' });
    }
});

// @route   GET /api/patterns/intelligence/featured
// @desc    Top N high-probability patterns for hero cards
router.get('/intelligence/featured', async (req, res) => {
    try {
        const limit = Math.min(10, Number(req.query.limit) || 5);
        const cacheKey = `featured:${limit}`;
        let featured = intelGet(cacheKey);
        if (!featured) {
            featured = await patternIntelligence.getFeaturedPatterns(limit);
            intelSet(cacheKey, featured);
        }
        res.json({ success: true, count: featured.length, patterns: featured });
    } catch (err) {
        console.error('[Pattern Intelligence] Featured error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch featured patterns' });
    }
});

// @route   GET /api/patterns/intelligence/presets
// @desc    Preset definitions + live counts for tabs
router.get('/intelligence/presets', async (req, res) => {
    try {
        const cacheKey = 'pat:presets';
        let counts = intelGet(cacheKey);
        if (!counts) {
            counts = await patternIntelligence.getPresetCounts();
            intelSet(cacheKey, counts);
        }
        const reliabilities = patternIntelligence.getPresetReliabilities() || {};
        const presets = [
            { id: 'all', label: 'All Patterns', count: counts.all },
            { id: 'high_probability', label: 'High Probability', count: counts.high_probability, reliability: reliabilities.high_probability },
            { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
            { id: 'near_breakout', label: 'Near Breakout', count: counts.near_breakout },
            { id: 'bullish_reversal', label: 'Bullish Reversals', count: counts.bullish_reversal, reliability: reliabilities.bullish_reversal },
            { id: 'bearish_reversal', label: 'Bearish Reversals', count: counts.bearish_reversal, reliability: reliabilities.bearish_reversal },
            { id: 'continuation', label: 'Continuation', count: counts.continuation, reliability: reliabilities.continuation },
            { id: 'forming', label: 'Forming', count: counts.forming },
            { id: 'long', label: 'Long Bias', count: counts.long },
            { id: 'short', label: 'Short Bias', count: counts.short }
        ];
        res.json({ success: true, presets, counts, reliabilities });
    } catch (err) {
        console.error('[Pattern Intelligence] Presets error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch presets' });
    }
});

// @route   GET /api/patterns/intelligence/insight
// @desc    AI Market Insight strip narrative
router.get('/intelligence/insight', async (req, res) => {
    try {
        const cacheKey = 'pat:insight';
        let insight = intelGet(cacheKey);
        if (!insight) {
            insight = await patternIntelligence.getMarketInsight();
            intelSet(cacheKey, insight);
        }
        res.json({ success: true, ...insight });
    } catch (err) {
        console.error('[Pattern Intelligence] Insight error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch market insight' });
    }
});

// @route   GET /api/patterns/intelligence/by-symbol/:symbol
// @desc    All patterns on a specific ticker, ranked
router.get('/intelligence/by-symbol/:symbol', async (req, res) => {
    try {
        const cacheKey = `bySym:${req.params.symbol.toUpperCase()}`;
        let patterns = intelGet(cacheKey);
        if (!patterns) {
            patterns = await patternIntelligence.getPatternsBySymbol(req.params.symbol);
            intelSet(cacheKey, patterns);
        }
        res.json({ success: true, count: patterns.length, patterns });
    } catch (err) {
        console.error('[Pattern Intelligence] By symbol error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch patterns by symbol' });
    }
});

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