// server/routes/earningsRoutes.js - Earnings Calendar API

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for earnings data
const earningsCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * GET /api/earnings/calendar
 * Get upcoming earnings for a date range
 * Query params: from, to (YYYY-MM-DD format)
 */
router.get('/calendar', auth, async (req, res) => {
    try {
        const { from, to } = req.query;

        // Default to next 7 days if not specified
        const fromDate = from || new Date().toISOString().split('T')[0];
        const toDate = to || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const cacheKey = `calendar-${fromDate}-${toDate}`;

        // Check cache
        if (earningsCache[cacheKey] && Date.now() - earningsCache[cacheKey].timestamp < CACHE_DURATION) {
            console.log('[Earnings] Returning cached calendar data');
            return res.json(earningsCache[cacheKey].data);
        }

        if (!FINNHUB_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Finnhub API key not configured'
            });
        }

        console.log(`[Earnings] Fetching calendar from ${fromDate} to ${toDate}`);

        const response = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
            params: {
                from: fromDate,
                to: toDate,
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const earnings = response.data.earningsCalendar || [];

        // Group by date and add metadata
        const groupedByDate = {};
        const today = new Date().toISOString().split('T')[0];

        for (const earning of earnings) {
            const date = earning.date;
            if (!groupedByDate[date]) {
                groupedByDate[date] = {
                    date,
                    isToday: date === today,
                    isPast: date < today,
                    earnings: []
                };
            }

            // Calculate expected move based on historical data
            const expectedMove = calculateExpectedMove(earning);

            groupedByDate[date].earnings.push({
                symbol: earning.symbol,
                date: earning.date,
                hour: earning.hour, // 'bmo' (before market open), 'amc' (after market close), 'dmh' (during market hours)
                epsEstimate: earning.epsEstimate,
                epsActual: earning.epsActual,
                revenueEstimate: earning.revenueEstimate,
                revenueActual: earning.revenueActual,
                year: earning.year,
                quarter: earning.quarter,
                surprise: earning.epsActual && earning.epsEstimate
                    ? ((earning.epsActual - earning.epsEstimate) / Math.abs(earning.epsEstimate) * 100).toFixed(2)
                    : null,
                expectedMove,
                hourLabel: getHourLabel(earning.hour)
            });
        }

        // Sort dates and convert to array
        const sortedDates = Object.keys(groupedByDate).sort();
        const calendarData = sortedDates.map(date => groupedByDate[date]);

        // Calculate summary stats
        const summary = {
            totalEarnings: earnings.length,
            upcomingCount: earnings.filter(e => e.date >= today).length,
            pastCount: earnings.filter(e => e.date < today).length,
            todayCount: earnings.filter(e => e.date === today).length,
            beatCount: earnings.filter(e => e.epsActual > e.epsEstimate).length,
            missCount: earnings.filter(e => e.epsActual && e.epsActual < e.epsEstimate).length
        };

        const result = {
            success: true,
            calendar: calendarData,
            summary,
            dateRange: { from: fromDate, to: toDate }
        };

        // Cache the result
        earningsCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
        };

        res.json(result);

    } catch (error) {
        console.error('[Earnings] Calendar error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch earnings calendar',
            error: error.message
        });
    }
});

/**
 * GET /api/earnings/symbol/:symbol
 * Get earnings history and upcoming for a specific symbol
 */
router.get('/symbol/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();

        const cacheKey = `symbol-${upperSymbol}`;

        // Check cache
        if (earningsCache[cacheKey] && Date.now() - earningsCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(earningsCache[cacheKey].data);
        }

        if (!FINNHUB_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Finnhub API key not configured'
            });
        }

        // Fetch earnings surprises (historical)
        const surprisesResponse = await axios.get('https://finnhub.io/api/v1/stock/earnings', {
            params: {
                symbol: upperSymbol,
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const earnings = surprisesResponse.data || [];

        // Calculate stats
        const beats = earnings.filter(e => e.actual > e.estimate).length;
        const misses = earnings.filter(e => e.actual < e.estimate).length;
        const meets = earnings.filter(e => e.actual === e.estimate).length;

        const avgSurprise = earnings.length > 0
            ? earnings.reduce((sum, e) => {
                if (e.actual && e.estimate) {
                    return sum + ((e.actual - e.estimate) / Math.abs(e.estimate) * 100);
                }
                return sum;
            }, 0) / earnings.length
            : 0;

        // Try to get company profile for additional context
        let companyInfo = null;
        try {
            const profileResponse = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
                params: {
                    symbol: upperSymbol,
                    token: FINNHUB_API_KEY
                },
                timeout: 5000
            });
            companyInfo = profileResponse.data;
        } catch (profileError) {
            console.log('[Earnings] Could not fetch company profile:', profileError.message);
        }

        const result = {
            success: true,
            symbol: upperSymbol,
            company: companyInfo ? {
                name: companyInfo.name,
                logo: companyInfo.logo,
                industry: companyInfo.finnhubIndustry,
                marketCap: companyInfo.marketCapitalization
            } : null,
            earnings: earnings.map(e => ({
                period: e.period,
                actual: e.actual,
                estimate: e.estimate,
                surprise: e.actual && e.estimate
                    ? ((e.actual - e.estimate) / Math.abs(e.estimate) * 100).toFixed(2)
                    : null,
                surprisePercent: e.surprisePercent,
                symbol: e.symbol
            })),
            stats: {
                totalQuarters: earnings.length,
                beats,
                misses,
                meets,
                beatRate: earnings.length > 0 ? ((beats / earnings.length) * 100).toFixed(1) : 0,
                avgSurprise: avgSurprise.toFixed(2)
            }
        };

        // Cache the result
        earningsCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
        };

        res.json(result);

    } catch (error) {
        console.error('[Earnings] Symbol error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch earnings data',
            error: error.message
        });
    }
});

/**
 * GET /api/earnings/watchlist
 * Get upcoming earnings for stocks in user's watchlist
 */
router.get('/watchlist', auth, async (req, res) => {
    try {
        const Watchlist = require('../models/Watchlist');

        // Get user's watchlist
        const watchlist = await Watchlist.findOne({ user: req.user._id });

        if (!watchlist || watchlist.stocks.length === 0) {
            return res.json({
                success: true,
                earnings: [],
                message: 'No stocks in watchlist'
            });
        }

        const symbols = watchlist.stocks.map(s => s.symbol);

        // Get earnings calendar for next 30 days
        const fromDate = new Date().toISOString().split('T')[0];
        const toDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
            params: {
                from: fromDate,
                to: toDate,
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const allEarnings = response.data.earningsCalendar || [];

        // Filter to only watchlist symbols
        const watchlistEarnings = allEarnings.filter(e =>
            symbols.includes(e.symbol.toUpperCase())
        );

        // Sort by date
        watchlistEarnings.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({
            success: true,
            earnings: watchlistEarnings.map(e => ({
                symbol: e.symbol,
                date: e.date,
                hour: e.hour,
                hourLabel: getHourLabel(e.hour),
                epsEstimate: e.epsEstimate,
                revenueEstimate: e.revenueEstimate,
                quarter: e.quarter,
                year: e.year
            })),
            watchlistCount: symbols.length,
            upcomingCount: watchlistEarnings.length
        });

    } catch (error) {
        console.error('[Earnings] Watchlist error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch watchlist earnings',
            error: error.message
        });
    }
});

/**
 * GET /api/earnings/today
 * Get today's earnings with real-time updates
 */
router.get('/today', auth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const cacheKey = `today-${today}`;

        // Short cache for today's data (5 minutes)
        if (earningsCache[cacheKey] && Date.now() - earningsCache[cacheKey].timestamp < 5 * 60 * 1000) {
            return res.json(earningsCache[cacheKey].data);
        }

        const response = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
            params: {
                from: today,
                to: today,
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const earnings = response.data.earningsCalendar || [];

        // Separate by timing
        const beforeOpen = earnings.filter(e => e.hour === 'bmo');
        const afterClose = earnings.filter(e => e.hour === 'amc');
        const duringHours = earnings.filter(e => e.hour === 'dmh' || !e.hour);

        // Get current market status
        const now = new Date();
        const hour = now.getUTCHours() - 5; // EST
        const isMarketOpen = hour >= 9.5 && hour < 16 && now.getDay() >= 1 && now.getDay() <= 5;

        const result = {
            success: true,
            date: today,
            isMarketOpen,
            sections: {
                beforeOpen: {
                    label: 'Before Market Open',
                    count: beforeOpen.length,
                    earnings: beforeOpen.map(formatEarning)
                },
                duringHours: {
                    label: 'During Market Hours',
                    count: duringHours.length,
                    earnings: duringHours.map(formatEarning)
                },
                afterClose: {
                    label: 'After Market Close',
                    count: afterClose.length,
                    earnings: afterClose.map(formatEarning)
                }
            },
            total: earnings.length
        };

        earningsCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
        };

        res.json(result);

    } catch (error) {
        console.error('[Earnings] Today error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch today\'s earnings',
            error: error.message
        });
    }
});

// Helper functions
function getHourLabel(hour) {
    switch (hour) {
        case 'bmo': return 'Before Open';
        case 'amc': return 'After Close';
        case 'dmh': return 'During Hours';
        default: return 'TBD';
    }
}

function formatEarning(e) {
    return {
        symbol: e.symbol,
        date: e.date,
        hour: e.hour,
        hourLabel: getHourLabel(e.hour),
        epsEstimate: e.epsEstimate,
        epsActual: e.epsActual,
        revenueEstimate: e.revenueEstimate,
        revenueActual: e.revenueActual,
        quarter: e.quarter,
        year: e.year,
        surprise: e.epsActual && e.epsEstimate
            ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate) * 100).toFixed(2)
            : null,
        hasBeat: e.epsActual > e.epsEstimate,
        hasMissed: e.epsActual && e.epsActual < e.epsEstimate
    };
}

function calculateExpectedMove(earning) {
    // Simple expected move calculation based on typical earnings volatility
    // In a real implementation, this would use options implied volatility
    // For now, we'll use a simple estimate
    if (earning.epsEstimate && Math.abs(earning.epsEstimate) > 0) {
        // Higher EPS typically means more stable, lower expected move
        const baseMove = 5; // 5% base expected move
        return baseMove;
    }
    return null;
}

module.exports = router;
