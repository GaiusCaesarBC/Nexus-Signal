// server/routes/economicCalendarRoutes.js - Economic Calendar API

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

// Cache for calendar data
const calendarCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Important recurring economic events with typical dates
const RECURRING_EVENTS = [
    { name: 'FOMC Meeting', category: 'central_bank', impact: 'high', country: 'US', frequency: '8x/year' },
    { name: 'CPI (Consumer Price Index)', category: 'inflation', impact: 'high', country: 'US', frequency: 'monthly' },
    { name: 'Non-Farm Payrolls', category: 'employment', impact: 'high', country: 'US', frequency: 'monthly' },
    { name: 'GDP Growth Rate', category: 'gdp', impact: 'high', country: 'US', frequency: 'quarterly' },
    { name: 'Retail Sales', category: 'consumer', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'ISM Manufacturing PMI', category: 'manufacturing', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'ISM Services PMI', category: 'services', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'Unemployment Rate', category: 'employment', impact: 'high', country: 'US', frequency: 'monthly' },
    { name: 'PPI (Producer Price Index)', category: 'inflation', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'Core PCE Price Index', category: 'inflation', impact: 'high', country: 'US', frequency: 'monthly' },
    { name: 'Initial Jobless Claims', category: 'employment', impact: 'medium', country: 'US', frequency: 'weekly' },
    { name: 'Consumer Confidence', category: 'consumer', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'Housing Starts', category: 'housing', impact: 'low', country: 'US', frequency: 'monthly' },
    { name: 'Existing Home Sales', category: 'housing', impact: 'low', country: 'US', frequency: 'monthly' },
    { name: 'Durable Goods Orders', category: 'manufacturing', impact: 'medium', country: 'US', frequency: 'monthly' },
    { name: 'Trade Balance', category: 'trade', impact: 'low', country: 'US', frequency: 'monthly' },
    { name: 'ECB Interest Rate Decision', category: 'central_bank', impact: 'high', country: 'EU', frequency: '8x/year' },
    { name: 'BOE Interest Rate Decision', category: 'central_bank', impact: 'high', country: 'UK', frequency: '8x/year' },
    { name: 'BOJ Interest Rate Decision', category: 'central_bank', impact: 'high', country: 'JP', frequency: '8x/year' }
];

// 2025 FOMC Meeting dates
const FOMC_DATES_2025 = [
    { start: '2025-01-28', end: '2025-01-29' },
    { start: '2025-03-18', end: '2025-03-19' },
    { start: '2025-05-06', end: '2025-05-07' },
    { start: '2025-06-17', end: '2025-06-18' },
    { start: '2025-07-29', end: '2025-07-30' },
    { start: '2025-09-16', end: '2025-09-17' },
    { start: '2025-11-04', end: '2025-11-05' },
    { start: '2025-12-16', end: '2025-12-17' }
];

/**
 * GET /api/economic-calendar/events
 * Get economic calendar events for a date range
 */
router.get('/events', auth, async (req, res) => {
    try {
        const { startDate, endDate, country, impact } = req.query;

        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

        const cacheKey = `events-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}-${country || 'all'}-${impact || 'all'}`;

        if (calendarCache[cacheKey] && Date.now() - calendarCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(calendarCache[cacheKey].data);
        }

        console.log(`[Economic Calendar] Fetching events from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

        // Try to fetch from Finnhub (free tier)
        let events = [];

        try {
            const finnhubKey = process.env.FINNHUB_API_KEY;
            if (finnhubKey) {
                const response = await axios.get('https://finnhub.io/api/v1/calendar/economic', {
                    params: {
                        from: start.toISOString().split('T')[0],
                        to: end.toISOString().split('T')[0],
                        token: finnhubKey
                    },
                    timeout: 10000
                });

                if (response.data?.economicCalendar) {
                    events = response.data.economicCalendar.map(event => ({
                        id: `finnhub-${event.event}-${event.time}`,
                        name: event.event,
                        date: event.time?.split(' ')[0] || new Date().toISOString().split('T')[0],
                        time: event.time?.split(' ')[1] || null,
                        country: event.country || 'US',
                        impact: categorizeImpact(event.event, event.impact),
                        category: categorizeEvent(event.event),
                        actual: event.actual,
                        forecast: event.estimate,
                        previous: event.prev,
                        unit: event.unit || '',
                        source: 'finnhub'
                    }));
                }
            }
        } catch (finnhubError) {
            console.log('[Economic Calendar] Finnhub API error:', finnhubError.message);
        }

        // If no events from API, generate from known schedule
        if (events.length === 0) {
            events = generateScheduledEvents(start, end);
        }

        // Add FOMC meetings
        const fomcEvents = FOMC_DATES_2025
            .filter(fomc => {
                const fomcDate = new Date(fomc.end);
                return fomcDate >= start && fomcDate <= end;
            })
            .map(fomc => ({
                id: `fomc-${fomc.end}`,
                name: 'FOMC Interest Rate Decision',
                date: fomc.end,
                time: '14:00',
                country: 'US',
                impact: 'high',
                category: 'central_bank',
                actual: null,
                forecast: null,
                previous: null,
                unit: '%',
                source: 'schedule',
                description: 'Federal Reserve interest rate decision and policy statement'
            }));

        // Merge and deduplicate
        const allEvents = [...events, ...fomcEvents];
        const uniqueEvents = allEvents.reduce((acc, event) => {
            const key = `${event.name}-${event.date}`;
            if (!acc.find(e => `${e.name}-${e.date}` === key)) {
                acc.push(event);
            }
            return acc;
        }, []);

        // Filter by country and impact if specified
        let filteredEvents = uniqueEvents;

        if (country && country !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.country === country);
        }

        if (impact && impact !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.impact === impact);
        }

        // Sort by date
        filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        const result = {
            success: true,
            events: filteredEvents,
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            },
            totalEvents: filteredEvents.length,
            lastUpdated: new Date().toISOString()
        };

        calendarCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Economic Calendar] Events error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch economic calendar', error: error.message });
    }
});

/**
 * GET /api/economic-calendar/upcoming
 * Get upcoming high-impact events
 */
router.get('/upcoming', auth, async (req, res) => {
    try {
        const cacheKey = 'upcoming-events';
        if (calendarCache[cacheKey] && Date.now() - calendarCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(calendarCache[cacheKey].data);
        }

        const today = new Date();
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Generate upcoming events
        let events = generateScheduledEvents(today, nextWeek);

        // Add FOMC if in range
        FOMC_DATES_2025.forEach(fomc => {
            const fomcDate = new Date(fomc.end);
            if (fomcDate >= today && fomcDate <= nextWeek) {
                events.push({
                    id: `fomc-${fomc.end}`,
                    name: 'FOMC Interest Rate Decision',
                    date: fomc.end,
                    time: '14:00',
                    country: 'US',
                    impact: 'high',
                    category: 'central_bank',
                    description: 'Federal Reserve interest rate decision'
                });
            }
        });

        // Filter high impact only and sort
        const highImpactEvents = events
            .filter(e => e.impact === 'high')
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 10);

        const result = {
            success: true,
            events: highImpactEvents,
            nextMajorEvent: highImpactEvents[0] || null,
            lastUpdated: new Date().toISOString()
        };

        calendarCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Economic Calendar] Upcoming error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch upcoming events', error: error.message });
    }
});

/**
 * GET /api/economic-calendar/today
 * Get today's economic events
 */
router.get('/today', auth, async (req, res) => {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const cacheKey = `today-${todayStr}`;
        if (calendarCache[cacheKey] && Date.now() - calendarCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(calendarCache[cacheKey].data);
        }

        // Check for FOMC today
        const fomcToday = FOMC_DATES_2025.find(f => f.end === todayStr || f.start === todayStr);

        let events = [];

        // Try Finnhub for today's events
        try {
            const finnhubKey = process.env.FINNHUB_API_KEY;
            if (finnhubKey) {
                const response = await axios.get('https://finnhub.io/api/v1/calendar/economic', {
                    params: {
                        from: todayStr,
                        to: todayStr,
                        token: finnhubKey
                    },
                    timeout: 10000
                });

                if (response.data?.economicCalendar) {
                    events = response.data.economicCalendar.map(event => ({
                        id: `finnhub-${event.event}-${event.time}`,
                        name: event.event,
                        date: todayStr,
                        time: event.time?.split(' ')[1] || null,
                        country: event.country || 'US',
                        impact: categorizeImpact(event.event, event.impact),
                        category: categorizeEvent(event.event),
                        actual: event.actual,
                        forecast: event.estimate,
                        previous: event.prev,
                        unit: event.unit || ''
                    }));
                }
            }
        } catch (err) {
            console.log('[Economic Calendar] Finnhub error for today:', err.message);
        }

        if (fomcToday) {
            events.push({
                id: `fomc-${todayStr}`,
                name: fomcToday.end === todayStr ? 'FOMC Interest Rate Decision' : 'FOMC Meeting Day 1',
                date: todayStr,
                time: fomcToday.end === todayStr ? '14:00' : null,
                country: 'US',
                impact: 'high',
                category: 'central_bank',
                description: 'Federal Reserve policy meeting'
            });
        }

        // Sort by time
        events.sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });

        const result = {
            success: true,
            date: todayStr,
            events,
            hasHighImpact: events.some(e => e.impact === 'high'),
            totalEvents: events.length,
            lastUpdated: new Date().toISOString()
        };

        calendarCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Economic Calendar] Today error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch today\'s events', error: error.message });
    }
});

/**
 * GET /api/economic-calendar/week
 * Get this week's economic events
 */
router.get('/week', auth, async (req, res) => {
    try {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

        const cacheKey = `week-${startOfWeek.toISOString().split('T')[0]}`;
        if (calendarCache[cacheKey] && Date.now() - calendarCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(calendarCache[cacheKey].data);
        }

        let events = generateScheduledEvents(startOfWeek, endOfWeek);

        // Add FOMC if in this week
        FOMC_DATES_2025.forEach(fomc => {
            const fomcDate = new Date(fomc.end);
            if (fomcDate >= startOfWeek && fomcDate <= endOfWeek) {
                events.push({
                    id: `fomc-${fomc.end}`,
                    name: 'FOMC Interest Rate Decision',
                    date: fomc.end,
                    time: '14:00',
                    country: 'US',
                    impact: 'high',
                    category: 'central_bank'
                });
            }
        });

        // Group by day
        const eventsByDay = {};
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            eventsByDay[dayNames[i]] = {
                date: dateStr,
                events: events.filter(e => e.date === dateStr).sort((a, b) => {
                    if (!a.time) return 1;
                    if (!b.time) return -1;
                    return a.time.localeCompare(b.time);
                })
            };
        }

        const result = {
            success: true,
            weekOf: startOfWeek.toISOString().split('T')[0],
            eventsByDay,
            totalEvents: events.length,
            highImpactCount: events.filter(e => e.impact === 'high').length,
            lastUpdated: new Date().toISOString()
        };

        calendarCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Economic Calendar] Week error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch week events', error: error.message });
    }
});

// ============ HELPER FUNCTIONS ============

function generateScheduledEvents(startDate, endDate) {
    const events = [];
    const current = new Date(startDate);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        const dayOfMonth = current.getDate();
        const weekOfMonth = Math.ceil(dayOfMonth / 7);

        // Non-Farm Payrolls - First Friday of each month
        if (dayOfWeek === 5 && weekOfMonth === 1) {
            events.push({
                id: `nfp-${dateStr}`,
                name: 'Non-Farm Payrolls',
                date: dateStr,
                time: '08:30',
                country: 'US',
                impact: 'high',
                category: 'employment',
                description: 'Monthly employment report - highly market-moving'
            });
            events.push({
                id: `unemployment-${dateStr}`,
                name: 'Unemployment Rate',
                date: dateStr,
                time: '08:30',
                country: 'US',
                impact: 'high',
                category: 'employment',
                description: 'Monthly unemployment rate'
            });
        }

        // CPI - Usually around 10th-13th of month
        if (dayOfMonth >= 10 && dayOfMonth <= 13 && dayOfWeek !== 0 && dayOfWeek !== 6) {
            const existingCPI = events.find(e => e.name === 'CPI (Consumer Price Index)' && e.date.startsWith(dateStr.slice(0, 7)));
            if (!existingCPI && dayOfMonth === 12) {
                events.push({
                    id: `cpi-${dateStr}`,
                    name: 'CPI (Consumer Price Index)',
                    date: dateStr,
                    time: '08:30',
                    country: 'US',
                    impact: 'high',
                    category: 'inflation',
                    description: 'Monthly inflation report - major market mover'
                });
            }
        }

        // Initial Jobless Claims - Every Thursday
        if (dayOfWeek === 4) {
            events.push({
                id: `jobless-${dateStr}`,
                name: 'Initial Jobless Claims',
                date: dateStr,
                time: '08:30',
                country: 'US',
                impact: 'medium',
                category: 'employment',
                description: 'Weekly unemployment claims'
            });
        }

        // ISM Manufacturing PMI - First business day of month
        if (dayOfMonth <= 3 && dayOfWeek >= 1 && dayOfWeek <= 5) {
            const existingISM = events.find(e => e.name === 'ISM Manufacturing PMI' && e.date.startsWith(dateStr.slice(0, 7)));
            if (!existingISM) {
                events.push({
                    id: `ism-mfg-${dateStr}`,
                    name: 'ISM Manufacturing PMI',
                    date: dateStr,
                    time: '10:00',
                    country: 'US',
                    impact: 'medium',
                    category: 'manufacturing',
                    description: 'Manufacturing sector activity index'
                });
            }
        }

        // ISM Services PMI - Third business day of month
        if (dayOfMonth >= 3 && dayOfMonth <= 5 && dayOfWeek >= 1 && dayOfWeek <= 5) {
            const existingISM = events.find(e => e.name === 'ISM Services PMI' && e.date.startsWith(dateStr.slice(0, 7)));
            if (!existingISM && dayOfMonth === 3) {
                events.push({
                    id: `ism-svc-${dateStr}`,
                    name: 'ISM Services PMI',
                    date: dateStr,
                    time: '10:00',
                    country: 'US',
                    impact: 'medium',
                    category: 'services',
                    description: 'Services sector activity index'
                });
            }
        }

        // Retail Sales - Mid-month
        if (dayOfMonth >= 13 && dayOfMonth <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
            const existingRetail = events.find(e => e.name === 'Retail Sales' && e.date.startsWith(dateStr.slice(0, 7)));
            if (!existingRetail && dayOfMonth === 15) {
                events.push({
                    id: `retail-${dateStr}`,
                    name: 'Retail Sales',
                    date: dateStr,
                    time: '08:30',
                    country: 'US',
                    impact: 'medium',
                    category: 'consumer',
                    description: 'Monthly retail sales data'
                });
            }
        }

        current.setDate(current.getDate() + 1);
    }

    return events;
}

function categorizeImpact(eventName, apiImpact) {
    const highImpactKeywords = ['FOMC', 'Interest Rate', 'CPI', 'Non-Farm', 'NFP', 'GDP', 'PCE', 'Inflation'];
    const mediumImpactKeywords = ['PMI', 'Retail', 'Jobless', 'Employment', 'Consumer', 'Durable'];

    const upperName = (eventName || '').toUpperCase();

    if (highImpactKeywords.some(k => upperName.includes(k.toUpperCase()))) return 'high';
    if (mediumImpactKeywords.some(k => upperName.includes(k.toUpperCase()))) return 'medium';
    if (apiImpact === 3 || apiImpact === 'high') return 'high';
    if (apiImpact === 2 || apiImpact === 'medium') return 'medium';
    return 'low';
}

function categorizeEvent(eventName) {
    const upperName = (eventName || '').toUpperCase();

    if (upperName.includes('CPI') || upperName.includes('PPI') || upperName.includes('INFLATION') || upperName.includes('PCE')) return 'inflation';
    if (upperName.includes('EMPLOYMENT') || upperName.includes('PAYROLL') || upperName.includes('JOBLESS') || upperName.includes('UNEMPLOYMENT')) return 'employment';
    if (upperName.includes('GDP') || upperName.includes('GROWTH')) return 'gdp';
    if (upperName.includes('FOMC') || upperName.includes('INTEREST RATE') || upperName.includes('FED') || upperName.includes('CENTRAL BANK')) return 'central_bank';
    if (upperName.includes('PMI') || upperName.includes('MANUFACTURING') || upperName.includes('INDUSTRIAL')) return 'manufacturing';
    if (upperName.includes('RETAIL') || upperName.includes('CONSUMER') || upperName.includes('CONFIDENCE')) return 'consumer';
    if (upperName.includes('HOUSING') || upperName.includes('HOME')) return 'housing';
    if (upperName.includes('TRADE') || upperName.includes('EXPORT') || upperName.includes('IMPORT')) return 'trade';

    return 'other';
}

module.exports = router;
