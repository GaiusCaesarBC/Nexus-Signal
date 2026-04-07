// server/services/earningsIntelligence.js
// Earnings Intelligence — derivation layer over the existing Finnhub
// earnings calendar. Adds: high-impact ranking, pre/post-earnings
// setup interpretation, opportunity engine joining, week stats,
// volatility insight, and calendar day enrichment.

const axios = require('axios');
const opportunityEngine = require('./opportunityEngine');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// ═══════════════════════════════════════════════════════════
// SECTOR MAPPING — coarse, used for filters + summary
// ═══════════════════════════════════════════════════════════
const SECTOR_BY_TICKER = {
    NVDA: 'Tech', AMD: 'Tech', AVGO: 'Tech', INTC: 'Tech', TSM: 'Tech',
    AAPL: 'Tech', MSFT: 'Tech', GOOG: 'Tech', GOOGL: 'Tech', META: 'Tech',
    AMZN: 'Tech', NFLX: 'Tech', ORCL: 'Tech', CRM: 'Tech', ADBE: 'Tech',
    QCOM: 'Tech', AMAT: 'Tech', LRCX: 'Tech', MU: 'Tech', PANW: 'Tech',
    TSLA: 'Auto', RIVN: 'Auto', LCID: 'Auto', F: 'Auto', GM: 'Auto',
    JNJ: 'Healthcare', PFE: 'Healthcare', MRNA: 'Healthcare', LLY: 'Healthcare',
    UNH: 'Healthcare', ABBV: 'Healthcare', MRK: 'Healthcare', TMO: 'Healthcare',
    BMY: 'Healthcare', CVS: 'Healthcare',
    JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', GS: 'Financials',
    MS: 'Financials', C: 'Financials', V: 'Financials', MA: 'Financials',
    AXP: 'Financials', BLK: 'Financials',
    XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
    OXY: 'Energy',
    WMT: 'Consumer', HD: 'Consumer', NKE: 'Consumer', SBUX: 'Consumer',
    MCD: 'Consumer', COST: 'Consumer', TGT: 'Consumer', LOW: 'Consumer'
};
function getSector(t) { return SECTOR_BY_TICKER[String(t || '').toUpperCase()] || 'Other'; }

// Mega/large cap heuristic — symbols we consider high market cap
const MEGA_CAP = new Set([
    'NVDA','AAPL','MSFT','GOOG','GOOGL','META','AMZN','TSLA','BRK.B','BRK.A',
    'NFLX','AVGO','LLY','UNH','JPM','V','MA','XOM','JNJ','WMT','PG','HD',
    'CVX','ABBV','BAC','PFE','KO','TMO','ADBE','ORCL','CRM','PEP','COST',
    'AMD','TSM','QCOM'
]);
const LARGE_CAP_BUMP = new Set([
    'MU','LRCX','AMAT','PANW','SHOP','UBER','PYPL','DIS','NKE','SBUX','MCD',
    'INTC','IBM','GS','MS','C','WFC','BLK'
]);

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function getHourLabel(hour) {
    switch (hour) {
        case 'bmo': return 'Before Open';
        case 'amc': return 'After Close';
        case 'dmh': return 'During Hours';
        default: return 'TBD';
    }
}
function getMarketCapTier(symbol) {
    if (MEGA_CAP.has(symbol)) return 'mega';
    if (LARGE_CAP_BUMP.has(symbol)) return 'large';
    return 'mid';
}
// Expected move estimator — without IV data, use heuristics:
// - Mega caps: 4-7% baseline
// - Large: 5-8%
// - Mid/small: 7-12%
// - Tech and Auto sectors get a +1.5% volatility bump
function estimateExpectedMove(symbol) {
    const tier = getMarketCapTier(symbol);
    const sector = getSector(symbol);
    let base;
    if (tier === 'mega') base = 5.5;
    else if (tier === 'large') base = 6.5;
    else base = 8.5;
    if (sector === 'Tech' || sector === 'Auto') base += 1.5;
    // Small jitter so identical symbols don't all show identical numbers
    const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const jitter = ((hash % 10) - 5) / 10;
    return Math.round((base + jitter) * 10) / 10;
}

// ═══════════════════════════════════════════════════════════
// FETCH EARNINGS — wraps the existing Finnhub call with caching
// ═══════════════════════════════════════════════════════════
const earningsCache = new Map();
const EARNINGS_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Parse Alpha Vantage CSV response (their EARNINGS_CALENDAR endpoint
// returns CSV, not JSON, even though every other endpoint is JSON)
function parseAlphaVantageCsv(csv) {
    if (!csv || typeof csv !== 'string' || csv.indexOf('\n') === -1) return [];
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < headers.length) continue;
        const row = {};
        headers.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

async function fetchFromAlphaVantage(fromDate, toDate) {
    if (!ALPHA_VANTAGE_API_KEY) return [];
    try {
        // AV's EARNINGS_CALENDAR supports `horizon=3month` (default), `6month`, `12month`
        const url = 'https://www.alphavantage.co/query';
        const response = await axios.get(url, {
            params: {
                function: 'EARNINGS_CALENDAR',
                horizon: '3month',
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 15000,
            responseType: 'text'
        });
        const rows = parseAlphaVantageCsv(response.data);
        // Map to the same shape as Finnhub
        const fromTs = new Date(fromDate).getTime();
        const toTs = new Date(toDate).getTime();
        const earnings = rows
            .filter(r => r.symbol && r.reportDate)
            .filter(r => {
                const ts = new Date(r.reportDate).getTime();
                return !isNaN(ts) && ts >= fromTs && ts <= toTs;
            })
            .map(r => ({
                symbol: r.symbol,
                date: r.reportDate,
                hour: '', // AV doesn't expose BMO/AMC
                epsEstimate: r.estimate ? parseFloat(r.estimate) : null,
                epsActual: null, // AV calendar is forward-only, no actuals
                revenueEstimate: null,
                revenueActual: null,
                year: new Date(r.reportDate).getFullYear(),
                quarter: Math.ceil((new Date(r.reportDate).getMonth() + 1) / 3),
                fiscalDateEnding: r.fiscalDateEnding
            }));
        console.log(`[EarningsIntel] AlphaVantage returned ${earnings.length} earnings (from ${rows.length} total rows)`);
        return earnings;
    } catch (e) {
        console.error('[EarningsIntel] AlphaVantage fetch failed:', e.message);
        return [];
    }
}

async function fetchFromFinnhub(fromDate, toDate) {
    if (!FINNHUB_API_KEY) return [];
    try {
        const response = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
            params: { from: fromDate, to: toDate, token: FINNHUB_API_KEY },
            timeout: 12000
        });
        const earnings = response.data?.earningsCalendar || [];
        console.log(`[EarningsIntel] Finnhub returned ${earnings.length} earnings`);
        return earnings;
    } catch (e) {
        console.error('[EarningsIntel] Finnhub fetch failed:', e.message);
        return [];
    }
}

async function fetchEarningsCalendar(fromDate, toDate) {
    const key = `${fromDate}-${toDate}`;
    const hit = earningsCache.get(key);
    if (hit && Date.now() - hit.t < EARNINGS_TTL_MS) return hit.v;

    // Try Alpha Vantage first (free tier supports earnings calendar)
    let earnings = await fetchFromAlphaVantage(fromDate, toDate);

    // Fallback to Finnhub if Alpha Vantage returned nothing
    if (!earnings || earnings.length === 0) {
        console.log('[EarningsIntel] AlphaVantage empty, trying Finnhub fallback');
        earnings = await fetchFromFinnhub(fromDate, toDate);
    }

    if (!earnings || earnings.length === 0) {
        console.warn(`[EarningsIntel] No earnings data from any source for ${fromDate} -> ${toDate}`);
    }

    earningsCache.set(key, { t: Date.now(), v: earnings || [] });
    return earnings || [];
}

// ═══════════════════════════════════════════════════════════
// ENRICHMENT — turn raw earnings into intel-grade items
// ═══════════════════════════════════════════════════════════
function enrichEarning(raw, oppMap) {
    const symbol = String(raw.symbol || '').toUpperCase();
    const opp = oppMap.get(symbol);
    const hasLiveSignal = !!opp;
    const expectedMove = estimateExpectedMove(symbol);
    const tier = getMarketCapTier(symbol);
    const sector = getSector(symbol);
    const hour = raw.hour || '';
    const surprise = raw.epsActual && raw.epsEstimate
        ? ((raw.epsActual - raw.epsEstimate) / Math.abs(raw.epsEstimate)) * 100
        : null;
    const hasBeat = raw.epsActual && raw.epsEstimate && raw.epsActual > raw.epsEstimate;
    const hasMissed = raw.epsActual && raw.epsEstimate && raw.epsActual < raw.epsEstimate;

    // Impact score
    let impactScore = 0;
    if (tier === 'mega') impactScore += 50;
    else if (tier === 'large') impactScore += 30;
    else impactScore += 10;
    impactScore += expectedMove * 3;
    if (hasLiveSignal) impactScore += 30;
    if (sector === 'Tech') impactScore += 5;

    return {
        symbol,
        date: raw.date,
        hour,
        hourLabel: getHourLabel(hour),
        epsEstimate: raw.epsEstimate ?? null,
        epsActual: raw.epsActual ?? null,
        revenueEstimate: raw.revenueEstimate ?? null,
        revenueActual: raw.revenueActual ?? null,
        quarter: raw.quarter,
        year: raw.year,
        surprise: surprise !== null ? Math.round(surprise * 10) / 10 : null,
        hasBeat,
        hasMissed,
        expectedMove,
        sector,
        marketCap: tier,
        impactScore: Math.round(impactScore),
        // Opportunity Engine enrichment
        hasLiveSignal,
        signalId: opp?.id || opp?.signalId || null,
        aiBias: opp?.bias || null,
        aiScore: opp?.aiScore || null,
        aiSetupLabel: opp?.setupLabel || null,
        aiWhy: opp?.whySurfaced || null,
        isCrypto: opp?.isCrypto || false
    };
}

// ═══════════════════════════════════════════════════════════
// PRE-EARNINGS SETUP INTERPRETATION
// ═══════════════════════════════════════════════════════════
function buildPreEarningsInterpretation(e) {
    if (e.aiBias === 'long' && e.aiScore >= 75) {
        return `Bullish drift into print — ${e.aiSetupLabel || 'continuation'} forming, AI ${e.aiScore}`;
    }
    if (e.aiBias === 'short' && e.aiScore >= 70) {
        return `Bearish pressure ahead of print — ${e.aiSetupLabel || 'distribution'} setup, AI ${e.aiScore}`;
    }
    if (e.aiBias === 'long') {
        return `Bullish lean into earnings — moderate conviction, AI ${e.aiScore}`;
    }
    if (e.aiBias === 'short') {
        return `Bearish lean into earnings — fade rally, AI ${e.aiScore}`;
    }
    if (e.expectedMove >= 8) {
        return `High expected move (±${e.expectedMove}%) — straddle / volatility play`;
    }
    if (e.expectedMove >= 6) {
        return `Compression before earnings — breakout likely on print`;
    }
    return `Standard pre-earnings setup — wait for the print`;
}

// ═══════════════════════════════════════════════════════════
// POST-EARNINGS REACTION INTERPRETATION
// ═══════════════════════════════════════════════════════════
function buildPostEarningsInterpretation(e) {
    if (e.hasBeat && e.aiBias === 'long') {
        return 'Beat + active LONG signal — continuation forming';
    }
    if (e.hasBeat && e.aiBias === 'short') {
        return 'Beat but signal disagrees — fade candidate';
    }
    if (e.hasBeat) {
        return 'Beat — watch for follow-through';
    }
    if (e.hasMissed && e.aiBias === 'short') {
        return 'Miss + active SHORT signal — downside continuation';
    }
    if (e.hasMissed && e.aiBias === 'long') {
        return 'Miss but signal disagrees — bounce candidate';
    }
    if (e.hasMissed) {
        return 'Miss — watch for capitulation or reversal';
    }
    return 'Reaction pending';
}

// ═══════════════════════════════════════════════════════════
// MAIN — getEarningsSnapshot
// ═══════════════════════════════════════════════════════════
async function getEarningsSnapshot({ from, to, filters = {} } = {}) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const fromDate = from || monthAgo; // include past for post-earnings panel
    const toDate = to || monthFromNow;

    const [rawEarnings, opportunities] = await Promise.all([
        fetchEarningsCalendar(fromDate, toDate),
        opportunityEngine.getOpportunities({}).catch(() => [])
    ]);

    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    // Enrich every earning
    let enriched = rawEarnings
        .filter(e => e && e.symbol)
        .map(e => enrichEarning(e, oppMap));

    // Apply filters (only to high-impact strip + pre/post panels, not full calendar)
    let filtered = enriched;
    if (filters.sector && filters.sector !== 'all') {
        filtered = filtered.filter(e => e.sector.toLowerCase() === filters.sector.toLowerCase());
    }
    if (filters.marketCap && filters.marketCap !== 'all') {
        if (filters.marketCap === 'large') {
            filtered = filtered.filter(e => e.marketCap === 'mega' || e.marketCap === 'large');
        } else {
            filtered = filtered.filter(e => e.marketCap === filters.marketCap);
        }
    }
    if (filters.minMove) {
        const m = Number(filters.minMove);
        filtered = filtered.filter(e => e.expectedMove >= m);
    }
    if (filters.highImpactOnly) {
        filtered = filtered.filter(e => e.impactScore >= 70);
    }
    if (filters.hasLiveSetup) {
        filtered = filtered.filter(e => e.hasLiveSignal);
    }

    // ─── This week's earnings (today through +7 days) ───
    const weekEarnings = filtered.filter(e => e.date >= todayStr && e.date <= weekFromNow);
    weekEarnings.sort((a, b) => b.impactScore - a.impactScore);

    // High-impact this week — top 6 hero cards
    const highImpact = weekEarnings.slice(0, 6);

    // ─── Pre-earnings setups — upcoming with bullish/bearish lean or compression ───
    const preEarnings = weekEarnings
        .filter(e => e.hasLiveSignal || e.expectedMove >= 6)
        .slice(0, 8)
        .map(e => ({
            ...e,
            interpretation: buildPreEarningsInterpretation(e)
        }));

    // ─── Post-earnings reactions — past 14 days with beat/miss data ───
    const recent = enriched
        .filter(e => e.date < todayStr && (e.hasBeat || e.hasMissed))
        .filter(e => {
            const daysAgo = (Date.now() - new Date(e.date).getTime()) / 86400000;
            return daysAgo <= 14;
        });
    recent.sort((a, b) => new Date(b.date) - new Date(a.date));
    const postEarnings = recent.slice(0, 8).map(e => ({
        ...e,
        interpretation: buildPostEarningsInterpretation(e)
    }));

    // ─── Week stats ───
    const weekStats = {
        total: weekEarnings.length,
        highImpact: weekEarnings.filter(e => e.impactScore >= 70).length,
        tradeable: weekEarnings.filter(e => e.hasLiveSignal).length,
        biggestMovers: [...weekEarnings]
            .sort((a, b) => b.expectedMove - a.expectedMove)
            .slice(0, 3)
            .map(e => e.symbol)
    };

    // ─── Month summary ───
    const monthEarnings = enriched.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    const monthSummary = {
        total: monthEarnings.length,
        highImpact: monthEarnings.filter(e => e.impactScore >= 70).length,
        biggestMovers: [...monthEarnings]
            .sort((a, b) => b.expectedMove - a.expectedMove)
            .slice(0, 3)
            .map(e => e.symbol),
        tradeableToday: enriched.filter(e => e.date === todayStr && e.hasLiveSignal).length
    };

    // ─── Next 7 days breakdown ───
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        const ds = d.toISOString().split('T')[0];
        const dayEarnings = enriched.filter(e => e.date === ds);
        const tradeable = dayEarnings.filter(e => e.hasLiveSignal).length;
        next7Days.push({
            date: ds,
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            count: dayEarnings.length,
            tradeable,
            isHighImpact: dayEarnings.length >= 5 || dayEarnings.some(e => e.marketCap === 'mega'),
            topTickers: dayEarnings
                .sort((a, b) => b.impactScore - a.impactScore)
                .slice(0, 3)
                .map(e => e.symbol)
        });
    }

    // ─── Volatility insight — top expected moves this week ───
    const volatilityInsight = [...weekEarnings]
        .sort((a, b) => b.expectedMove - a.expectedMove)
        .slice(0, 5)
        .map(e => ({
            symbol: e.symbol,
            expectedMove: e.expectedMove,
            aiScore: e.aiScore,
            hasLiveSignal: e.hasLiveSignal,
            signalId: e.signalId,
            isCrypto: e.isCrypto,
            date: e.date,
            hourLabel: e.hourLabel
        }));

    // ─── Calendar days — full enriched list grouped by date ───
    const dayMap = new Map();
    enriched.forEach(e => {
        if (!dayMap.has(e.date)) {
            dayMap.set(e.date, {
                date: e.date,
                isToday: e.date === todayStr,
                isPast: e.date < todayStr,
                count: 0,
                tradeable: 0,
                hasMegaCap: false,
                topTickers: [],
                earnings: []
            });
        }
        const day = dayMap.get(e.date);
        day.count++;
        if (e.hasLiveSignal) day.tradeable++;
        if (e.marketCap === 'mega') day.hasMegaCap = true;
        day.earnings.push(e);
    });
    // Compute high-impact flag + top tickers per day
    for (const day of dayMap.values()) {
        day.isHighImpact = day.count >= 5 || day.hasMegaCap;
        day.topTickers = day.earnings
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 4)
            .map(e => e.symbol);
    }
    const calendarDays = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
        success: true,
        refreshedAt: new Date().toISOString(),
        dateRange: { from: fromDate, to: toDate },
        weekStats,
        monthSummary,
        highImpact,
        preEarnings,
        postEarnings,
        next7Days,
        volatilityInsight,
        calendarDays
    };
}

module.exports = {
    getEarningsSnapshot
};
