// server/routes/sectorRotationRoutes.js - Sector Rotation & Money Flow Analysis

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

// Sector ETF mapping
const SECTOR_ETFS = {
    technology: { symbol: 'XLK', name: 'Technology', color: '#00adef' },
    healthcare: { symbol: 'XLV', name: 'Healthcare', color: '#00ff88' },
    financials: { symbol: 'XLF', name: 'Financials', color: '#ffc107' },
    energy: { symbol: 'XLE', name: 'Energy', color: '#ff6b6b' },
    consumer_discretionary: { symbol: 'XLY', name: 'Consumer Discretionary', color: '#a855f7' },
    consumer_staples: { symbol: 'XLP', name: 'Consumer Staples', color: '#06b6d4' },
    industrials: { symbol: 'XLI', name: 'Industrials', color: '#f97316' },
    utilities: { symbol: 'XLU', name: 'Utilities', color: '#84cc16' },
    materials: { symbol: 'XLB', name: 'Materials', color: '#ec4899' },
    real_estate: { symbol: 'XLRE', name: 'Real Estate', color: '#8b5cf6' },
    communication: { symbol: 'XLC', name: 'Communication Services', color: '#14b8a6' }
};

// Cache
const sectorCache = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * GET /api/sector-rotation/overview
 * Get all sectors with current performance and money flow
 */
router.get('/overview', auth, async (req, res) => {
    try {
        const cacheKey = 'sector-overview';
        if (sectorCache[cacheKey] && Date.now() - sectorCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(sectorCache[cacheKey].data);
        }

        console.log('[Sector Rotation] Fetching sector overview...');

        const sectors = await fetchAllSectorData();
        const spyData = await fetchETFData('SPY', '1M');

        // Calculate relative strength vs SPY
        const spyPerformance = {
            day: calculateReturn(spyData, 1),
            week: calculateReturn(spyData, 5),
            month: calculateReturn(spyData, 21)
        };

        const sectorsWithRelativeStrength = sectors.map(sector => ({
            ...sector,
            relativeStrength: {
                day: sector.performance.day - spyPerformance.day,
                week: sector.performance.week - spyPerformance.week,
                month: sector.performance.month - spyPerformance.month
            }
        }));

        // Sort by different metrics
        const topPerformersWeek = [...sectorsWithRelativeStrength].sort((a, b) => b.performance.week - a.performance.week);
        const topPerformersMonth = [...sectorsWithRelativeStrength].sort((a, b) => b.performance.month - a.performance.month);
        const topMoneyFlow = [...sectorsWithRelativeStrength].sort((a, b) => b.moneyFlow.score - a.moneyFlow.score);

        // Calculate market breadth
        const positiveDay = sectors.filter(s => s.performance.day > 0).length;
        const positiveWeek = sectors.filter(s => s.performance.week > 0).length;

        const result = {
            success: true,
            sectors: sectorsWithRelativeStrength,
            benchmark: {
                symbol: 'SPY',
                performance: spyPerformance
            },
            rankings: {
                weeklyPerformance: topPerformersWeek.slice(0, 5).map(s => ({ sector: s.name, performance: s.performance.week })),
                monthlyPerformance: topPerformersMonth.slice(0, 5).map(s => ({ sector: s.name, performance: s.performance.month })),
                moneyFlow: topMoneyFlow.slice(0, 5).map(s => ({ sector: s.name, score: s.moneyFlow.score }))
            },
            marketBreadth: {
                positiveDay,
                negativeDay: sectors.length - positiveDay,
                positiveWeek,
                negativeWeek: sectors.length - positiveWeek,
                sentiment: positiveWeek >= 7 ? 'bullish' : positiveWeek <= 4 ? 'bearish' : 'neutral'
            },
            rotationPhase: determineRotationPhase(sectorsWithRelativeStrength),
            lastUpdated: new Date().toISOString()
        };

        sectorCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Sector Rotation] Overview error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch sector data', error: error.message });
    }
});

/**
 * GET /api/sector-rotation/heatmap
 * Get sector heatmap data for visualization
 */
router.get('/heatmap', auth, async (req, res) => {
    try {
        const { timeframe = 'week' } = req.query;

        const cacheKey = `heatmap-${timeframe}`;
        if (sectorCache[cacheKey] && Date.now() - sectorCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(sectorCache[cacheKey].data);
        }

        const sectors = await fetchAllSectorData();

        // Build heatmap data
        const heatmapData = sectors.map(sector => ({
            id: sector.id,
            name: sector.name,
            symbol: sector.symbol,
            value: timeframe === 'day' ? sector.performance.day :
                   timeframe === 'month' ? sector.performance.month :
                   sector.performance.week,
            volume: sector.volume,
            color: sector.color
        }));

        const result = {
            success: true,
            timeframe,
            heatmap: heatmapData.sort((a, b) => b.value - a.value),
            lastUpdated: new Date().toISOString()
        };

        sectorCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Sector Rotation] Heatmap error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch heatmap data', error: error.message });
    }
});

/**
 * GET /api/sector-rotation/flow
 * Get money flow analysis between sectors
 */
router.get('/flow', auth, async (req, res) => {
    try {
        const cacheKey = 'sector-flow';
        if (sectorCache[cacheKey] && Date.now() - sectorCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(sectorCache[cacheKey].data);
        }

        const sectors = await fetchAllSectorData();

        // Analyze money flow patterns
        const inflows = sectors.filter(s => s.moneyFlow.direction === 'inflow')
            .sort((a, b) => b.moneyFlow.score - a.moneyFlow.score);
        const outflows = sectors.filter(s => s.moneyFlow.direction === 'outflow')
            .sort((a, b) => a.moneyFlow.score - b.moneyFlow.score);

        // Create flow visualization data
        const flowData = {
            inflows: inflows.map(s => ({
                sector: s.name,
                symbol: s.symbol,
                score: s.moneyFlow.score,
                volumeChange: s.moneyFlow.volumeChange,
                priceChange: s.performance.week
            })),
            outflows: outflows.map(s => ({
                sector: s.name,
                symbol: s.symbol,
                score: Math.abs(s.moneyFlow.score),
                volumeChange: s.moneyFlow.volumeChange,
                priceChange: s.performance.week
            })),
            summary: {
                strongestInflow: inflows[0]?.name || 'N/A',
                strongestOutflow: outflows[0]?.name || 'N/A',
                netDirection: inflows.length > outflows.length ? 'Risk-On' : 'Risk-Off'
            }
        };

        const result = {
            success: true,
            flow: flowData,
            interpretation: interpretMoneyFlow(inflows, outflows),
            lastUpdated: new Date().toISOString()
        };

        sectorCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Sector Rotation] Flow error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch money flow data', error: error.message });
    }
});

/**
 * GET /api/sector-rotation/sector/:sectorId
 * Get detailed data for a specific sector
 */
router.get('/sector/:sectorId', auth, async (req, res) => {
    try {
        const { sectorId } = req.params;
        const sectorInfo = SECTOR_ETFS[sectorId];

        if (!sectorInfo) {
            return res.status(404).json({ success: false, message: 'Sector not found' });
        }

        const cacheKey = `sector-detail-${sectorId}`;
        if (sectorCache[cacheKey] && Date.now() - sectorCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(sectorCache[cacheKey].data);
        }

        const data = await fetchETFData(sectorInfo.symbol, '3M');
        const spyData = await fetchETFData('SPY', '3M');

        // Calculate various metrics
        const performance = {
            day: calculateReturn(data, 1),
            week: calculateReturn(data, 5),
            month: calculateReturn(data, 21),
            threeMonth: calculateReturn(data, 63)
        };

        const spyPerformance = {
            day: calculateReturn(spyData, 1),
            week: calculateReturn(spyData, 5),
            month: calculateReturn(spyData, 21),
            threeMonth: calculateReturn(spyData, 63)
        };

        // Calculate relative performance chart data
        const relativeData = data.slice(-60).map((d, i) => {
            const spyClose = spyData[spyData.length - 60 + i]?.close || 1;
            return {
                date: d.date,
                sectorPrice: d.close,
                relativeStrength: ((d.close / data[data.length - 60].close) / (spyClose / spyData[spyData.length - 60].close) - 1) * 100
            };
        });

        const result = {
            success: true,
            sector: {
                id: sectorId,
                name: sectorInfo.name,
                symbol: sectorInfo.symbol,
                color: sectorInfo.color,
                price: data[data.length - 1]?.close,
                performance,
                relativeStrength: {
                    day: performance.day - spyPerformance.day,
                    week: performance.week - spyPerformance.week,
                    month: performance.month - spyPerformance.month,
                    threeMonth: performance.threeMonth - spyPerformance.threeMonth
                },
                chartData: data.slice(-60),
                relativeData,
                trend: performance.week > 0 && performance.month > 0 ? 'uptrend' :
                       performance.week < 0 && performance.month < 0 ? 'downtrend' : 'sideways'
            },
            lastUpdated: new Date().toISOString()
        };

        sectorCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Sector Rotation] Sector detail error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch sector data', error: error.message });
    }
});

/**
 * GET /api/sector-rotation/comparison
 * Compare multiple sectors
 */
router.get('/comparison', auth, async (req, res) => {
    try {
        const { sectors: sectorIds } = req.query;

        if (!sectorIds) {
            return res.status(400).json({ success: false, message: 'Sectors parameter required' });
        }

        const sectorList = sectorIds.split(',').slice(0, 5); // Max 5 sectors
        const comparisonData = [];

        for (const sectorId of sectorList) {
            const sectorInfo = SECTOR_ETFS[sectorId];
            if (!sectorInfo) continue;

            const data = await fetchETFData(sectorInfo.symbol, '3M');

            // Normalize to 100 at start
            const startPrice = data[0]?.close || 1;
            const normalizedData = data.slice(-60).map(d => ({
                date: d.date,
                value: (d.close / startPrice) * 100
            }));

            comparisonData.push({
                id: sectorId,
                name: sectorInfo.name,
                symbol: sectorInfo.symbol,
                color: sectorInfo.color,
                data: normalizedData,
                currentValue: normalizedData[normalizedData.length - 1]?.value,
                totalReturn: calculateReturn(data, 60)
            });
        }

        res.json({
            success: true,
            comparison: comparisonData.sort((a, b) => b.totalReturn - a.totalReturn),
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Sector Rotation] Comparison error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to compare sectors', error: error.message });
    }
});

// ============ HELPER FUNCTIONS ============

// Delay helper to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAllSectorData() {
    const sectors = [];

    for (const [id, info] of Object.entries(SECTOR_ETFS)) {
        try {
            const data = await fetchETFData(info.symbol, '1M');

            // Small delay between requests to avoid rate limiting
            await delay(100);

            if (data.length > 0) {
                const latestVolume = data[data.length - 1]?.volume || 0;
                const avgVolume = data.slice(-20).reduce((sum, d) => sum + (d.volume || 0), 0) / 20;
                const volumeChange = avgVolume > 0 ? ((latestVolume - avgVolume) / avgVolume) * 100 : 0;

                sectors.push({
                    id,
                    name: info.name,
                    symbol: info.symbol,
                    color: info.color,
                    price: data[data.length - 1]?.close,
                    performance: {
                        day: calculateReturn(data, 1),
                        week: calculateReturn(data, 5),
                        month: calculateReturn(data, 21)
                    },
                    volume: latestVolume,
                    avgVolume,
                    moneyFlow: calculateMoneyFlow(data, volumeChange)
                });
            }
        } catch (error) {
            console.log(`Failed to fetch ${info.symbol}:`, error.message);
        }
    }

    // If no sectors loaded (API down), return fallback data
    if (sectors.length === 0) {
        console.log('[Sector Rotation] Using fallback data - Yahoo Finance unavailable');
        return Object.entries(SECTOR_ETFS).map(([id, info]) => ({
            id,
            name: info.name,
            symbol: info.symbol,
            color: info.color,
            price: 0,
            performance: {
                day: (Math.random() * 4 - 2),
                week: (Math.random() * 8 - 4),
                month: (Math.random() * 12 - 6)
            },
            volume: 0,
            avgVolume: 0,
            moneyFlow: {
                score: (Math.random() * 10 - 5),
                direction: Math.random() > 0.5 ? 'inflow' : 'outflow',
                volumeChange: 0
            },
            _isFallback: true
        }));
    }

    return sectors;
}

async function fetchETFData(symbol, range) {
    try {
        // Determine Yahoo Finance range
        let yahooRange = '1mo';
        if (range === '3M') yahooRange = '3mo';
        if (range === '6M') yahooRange = '6mo';
        if (range === '1Y') yahooRange = '1y';

        const response = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${yahooRange}`,
            {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        const result = response.data?.chart?.result?.[0];
        if (!result?.timestamp) return [];

        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        return timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            open: quotes.open?.[i],
            high: quotes.high?.[i],
            low: quotes.low?.[i],
            close: quotes.close?.[i],
            volume: quotes.volume?.[i]
        })).filter(d => d.close !== null);

    } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
        return [];
    }
}

function calculateReturn(data, days) {
    if (!data || data.length < days + 1) return 0;
    const currentPrice = data[data.length - 1]?.close;
    const pastPrice = data[data.length - 1 - days]?.close;
    if (!currentPrice || !pastPrice) return 0;
    return ((currentPrice - pastPrice) / pastPrice) * 100;
}

function calculateMoneyFlow(data, volumeChange) {
    if (data.length < 5) return { score: 0, direction: 'neutral', volumeChange: 0 };

    // Calculate price momentum + volume trend
    const priceChange = calculateReturn(data, 5);
    const volumeFactor = volumeChange / 100;

    // Money flow score combines price and volume
    let score = priceChange + (priceChange * volumeFactor * 0.5);

    return {
        score: Math.round(score * 100) / 100,
        direction: score > 2 ? 'inflow' : score < -2 ? 'outflow' : 'neutral',
        volumeChange: Math.round(volumeChange * 100) / 100
    };
}

function determineRotationPhase(sectors) {
    // Analyze which sectors are leading to determine market cycle phase
    const topSectors = [...sectors].sort((a, b) => b.performance.week - a.performance.week).slice(0, 3);
    const bottomSectors = [...sectors].sort((a, b) => a.performance.week - b.performance.week).slice(0, 3);

    const topNames = topSectors.map(s => s.name.toLowerCase());
    const bottomNames = bottomSectors.map(s => s.name.toLowerCase());

    // Early cycle: Financials, Consumer Discretionary, Industrials lead
    if (topNames.some(n => n.includes('financial') || n.includes('discretionary') || n.includes('industrial'))) {
        if (bottomNames.some(n => n.includes('utility') || n.includes('staple'))) {
            return { phase: 'Early Cycle', description: 'Economic expansion beginning, cyclicals leading' };
        }
    }

    // Mid cycle: Technology, Communication lead
    if (topNames.some(n => n.includes('tech') || n.includes('communication'))) {
        return { phase: 'Mid Cycle', description: 'Growth sectors leading, expansion continues' };
    }

    // Late cycle: Energy, Materials lead
    if (topNames.some(n => n.includes('energy') || n.includes('material'))) {
        return { phase: 'Late Cycle', description: 'Commodities leading, inflation pressures' };
    }

    // Recession/Defensive: Utilities, Healthcare, Consumer Staples lead
    if (topNames.some(n => n.includes('utility') || n.includes('health') || n.includes('staple'))) {
        return { phase: 'Defensive', description: 'Defensive sectors leading, risk-off environment' };
    }

    return { phase: 'Transitional', description: 'Mixed sector leadership, market in transition' };
}

function interpretMoneyFlow(inflows, outflows) {
    if (inflows.length === 0 && outflows.length === 0) {
        return 'Market showing balanced sector flows';
    }

    const topInflow = inflows[0]?.name || 'N/A';
    const topOutflow = outflows[0]?.name || 'N/A';

    // Interpret the rotation pattern
    if (inflows.some(s => s.name.includes('Technology') || s.name.includes('Consumer Discretionary'))) {
        if (outflows.some(s => s.name.includes('Utilities') || s.name.includes('Staples'))) {
            return 'Risk-on rotation: Money flowing from defensive to growth sectors. Bullish market sentiment.';
        }
    }

    if (inflows.some(s => s.name.includes('Utilities') || s.name.includes('Healthcare'))) {
        if (outflows.some(s => s.name.includes('Technology') || s.name.includes('Discretionary'))) {
            return 'Risk-off rotation: Money flowing from growth to defensive sectors. Cautious market sentiment.';
        }
    }

    if (inflows.some(s => s.name.includes('Energy') || s.name.includes('Materials'))) {
        return 'Commodity rotation: Money flowing into inflation-sensitive sectors.';
    }

    return `Current rotation: Inflows to ${topInflow}, outflows from ${topOutflow}.`;
}

module.exports = router;
