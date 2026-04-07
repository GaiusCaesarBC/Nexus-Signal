// server/services/opportunityEngine.js
// Opportunity Engine — surfaces ranked trade opportunities from active predictions.
// Adds setup classification, AI score, and "why surfaced" rationale on top of
// existing prediction data. No new ML required — purely a derivation layer.

const Prediction = require('../models/Prediction');

// ═══════════════════════════════════════════════════════════
// SETUP CLASSIFIER — maps indicators to one of 7 setup types
// ═══════════════════════════════════════════════════════════
const SETUP_TYPES = {
    BREAKOUT: 'breakout',
    REVERSAL: 'reversal',
    CONTINUATION: 'continuation',
    UNUSUAL_VOLUME: 'unusual_volume',
    OVERSOLD_BOUNCE: 'oversold_bounce',
    MOMENTUM: 'momentum',
    SQUEEZE: 'squeeze'
};

const SETUP_LABELS = {
    breakout: 'Breakout',
    reversal: 'Reversal',
    continuation: 'Continuation',
    unusual_volume: 'Unusual Volume',
    oversold_bounce: 'Oversold Bounce',
    momentum: 'Momentum',
    squeeze: 'Squeeze'
};

function getIndicator(indicators, name) {
    if (!indicators) return null;
    const ind = indicators[name];
    if (!ind) return null;
    if (typeof ind === 'object') return { value: ind.value, signal: ind.signal };
    return { value: ind, signal: 'NEUTRAL' };
}

function asNumber(v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

function classifySetup(prediction) {
    const ind = prediction.indicators || {};
    const long = prediction.direction === 'UP';
    const rsi = getIndicator(ind, 'RSI');
    const macd = getIndicator(ind, 'MACD');
    const trend = getIndicator(ind, 'Trend');
    const vol = getIndicator(ind, 'Volume');
    const boll = getIndicator(ind, 'Bollinger');

    const rsiVal = rsi ? asNumber(rsi.value) : null;
    const volStr = vol ? String(vol.value || '').toLowerCase() : '';
    const trendSig = trend ? String(trend.signal || '').toUpperCase() : '';
    const macdSig = macd ? String(macd.signal || '').toUpperCase() : '';
    const bollStr = boll ? String(boll.value || '').toLowerCase() : '';

    // Oversold bounce — RSI extreme + direction matches reversal
    if (long && rsiVal !== null && rsiVal < 32) return SETUP_TYPES.OVERSOLD_BOUNCE;
    if (!long && rsiVal !== null && rsiVal > 68) return SETUP_TYPES.OVERSOLD_BOUNCE;

    // Unusual volume — high volume is the dominant feature
    if (volStr === 'high' || volStr === 'very high') {
        // If trend opposes direction → reversal, if aligned → unusual volume
        if (trendSig && trendSig !== (long ? 'BUY' : 'SELL')) return SETUP_TYPES.UNUSUAL_VOLUME;
        return SETUP_TYPES.UNUSUAL_VOLUME;
    }

    // Squeeze — Bollinger compression
    if (bollStr.includes('squeeze') || bollStr.includes('narrow') || bollStr.includes('tight')) {
        return SETUP_TYPES.SQUEEZE;
    }

    // Breakout — Bollinger breakout signal + trend aligned
    if (bollStr.includes('break') || bollStr.includes('upper') || bollStr.includes('lower')) {
        return SETUP_TYPES.BREAKOUT;
    }

    // Reversal — trend opposes direction (counter-trend setup)
    if (trendSig && trendSig !== (long ? 'BUY' : 'SELL') && trendSig !== 'NEUTRAL') {
        return SETUP_TYPES.REVERSAL;
    }

    // Momentum — MACD aligned strongly
    if (macdSig === (long ? 'BUY' : 'SELL')) return SETUP_TYPES.MOMENTUM;

    // Default — continuation
    return SETUP_TYPES.CONTINUATION;
}

// ═══════════════════════════════════════════════════════════
// "WHY SURFACED" — picks top 1-2 contributing factors
// ═══════════════════════════════════════════════════════════
function buildWhySurfaced(prediction, setupType) {
    const ind = prediction.indicators || {};
    const long = prediction.direction === 'UP';
    const rsi = getIndicator(ind, 'RSI');
    const macd = getIndicator(ind, 'MACD');
    const trend = getIndicator(ind, 'Trend');
    const vol = getIndicator(ind, 'Volume');
    const boll = getIndicator(ind, 'Bollinger');

    const rsiVal = rsi ? asNumber(rsi.value) : null;
    const volStr = vol ? String(vol.value || '').toLowerCase() : '';

    switch (setupType) {
        case SETUP_TYPES.OVERSOLD_BOUNCE:
            if (rsiVal !== null) {
                return long
                    ? `RSI oversold at ${rsiVal.toFixed(0)}, reversal conditions forming`
                    : `RSI overbought at ${rsiVal.toFixed(0)}, exhaustion signals appearing`;
            }
            return long ? 'Oversold conditions with reversal setup' : 'Overbought with reversal setup';

        case SETUP_TYPES.UNUSUAL_VOLUME:
            return long
                ? `${vol?.value || 'Elevated'} volume confirms ${trend?.value || 'bullish'} bias`
                : `${vol?.value || 'Elevated'} volume confirms ${trend?.value || 'bearish'} bias`;

        case SETUP_TYPES.BREAKOUT:
            return long
                ? `Breaking resistance${volStr === 'high' ? ' on heavy volume' : ''}`
                : `Breaking support${volStr === 'high' ? ' on heavy volume' : ''}`;

        case SETUP_TYPES.SQUEEZE:
            return 'Volatility compression — expansion expected';

        case SETUP_TYPES.REVERSAL:
            return long
                ? 'Trend reversal forming, momentum shifting bullish'
                : 'Trend reversal forming, momentum shifting bearish';

        case SETUP_TYPES.MOMENTUM:
            return macd
                ? `MACD ${long ? 'bullish' : 'bearish'} crossover, momentum accelerating`
                : `Strong ${long ? 'upside' : 'downside'} momentum building`;

        case SETUP_TYPES.CONTINUATION:
        default:
            if (trend && rsi) {
                return long
                    ? `${trend.value || 'Bullish'} trend with RSI at ${rsiVal?.toFixed(0) || '--'}`
                    : `${trend.value || 'Bearish'} trend with RSI at ${rsiVal?.toFixed(0) || '--'}`;
            }
            return long ? 'Bullish continuation pattern' : 'Bearish continuation pattern';
    }
}

// ═══════════════════════════════════════════════════════════
// AI SCORE — composite of confidence × alignment × R/R
// ═══════════════════════════════════════════════════════════
function computeAiScore(prediction) {
    const ind = prediction.indicators || {};
    const long = prediction.direction === 'UP';
    const conf = Math.min(95, Math.round(prediction.confidence || 50));

    // Indicator alignment ratio
    let aligned = 0;
    let opposed = 0;
    let total = 0;
    Object.values(ind).forEach(v => {
        const sig = (typeof v === 'object' ? v.signal : null);
        if (!sig) return;
        total++;
        const upper = String(sig).toUpperCase();
        if (upper === (long ? 'BUY' : 'SELL')) aligned++;
        else if (upper === (long ? 'SELL' : 'BUY')) opposed++;
    });
    const alignmentRatio = total > 0 ? aligned / total : 0.5;
    const alignmentScore = Math.round(alignmentRatio * 100);

    // R/R score (capped at 100 for ratio >= 4)
    const entry = prediction.entryPrice || prediction.currentPrice;
    const sl = prediction.stopLoss;
    const tp = prediction.takeProfit3 || prediction.takeProfit2 || prediction.targetPrice;
    let rrScore = 50;
    let rr = null;
    if (entry && sl && tp && Math.abs(entry - sl) > 0) {
        rr = Math.abs(tp - entry) / Math.abs(entry - sl);
        rrScore = Math.min(100, Math.round(rr * 25));
    }

    // Sentiment bonus — opposed indicators penalize
    const sentimentScore = Math.max(0, 100 - opposed * 25);

    const aiScore = Math.round(
        conf * 0.40 +
        alignmentScore * 0.25 +
        sentimentScore * 0.15 +
        rrScore * 0.20
    );

    return {
        aiScore: Math.min(95, aiScore),
        rr: rr ? Math.round(rr * 10) / 10 : null,
        alignmentRatio,
        alignedCount: aligned,
        opposedCount: opposed,
        totalIndicators: total
    };
}

// ═══════════════════════════════════════════════════════════
// MAIN — fetch, enrich, filter, sort
// ═══════════════════════════════════════════════════════════
async function getOpportunities(filters = {}) {
    const now = new Date();

    // Base query — active, non-expired predictions
    const query = {
        status: 'pending',
        expiresAt: { $gt: now },
        isPublic: true
    };

    if (filters.assetType && filters.assetType !== 'all') {
        if (filters.assetType === 'stocks') query.assetType = 'stock';
        else if (filters.assetType === 'crypto') query.assetType = { $in: ['crypto', 'dex'] };
    }

    if (filters.bias === 'long') query.direction = 'UP';
    else if (filters.bias === 'short') query.direction = 'DOWN';

    if (filters.confidenceMin) {
        query.confidence = { $gte: Number(filters.confidenceMin) };
    }

    // Fetch up to 200 candidates, then enrich
    const predictions = await Prediction.find(query)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    // Deduplicate by symbol — keep most recent per symbol
    const bySymbol = new Map();
    for (const p of predictions) {
        const key = `${p.symbol}-${p.assetType}`;
        if (!bySymbol.has(key)) bySymbol.set(key, p);
    }

    let opportunities = Array.from(bySymbol.values()).map(p => {
        const setupType = classifySetup(p);
        const setupLabel = SETUP_LABELS[setupType];
        const whySurfaced = buildWhySurfaced(p, setupType);
        const scoring = computeAiScore(p);
        const long = p.direction === 'UP';
        const symbolClean = (p.symbol || '').split(':')[0].replace(/USDT|USD/i, '');
        const conf = Math.min(95, Math.round(p.confidence || 50));

        const entry = p.entryPrice || p.currentPrice;
        const livePrice = p.livePrice || p.currentPrice;
        const changePct = entry && livePrice ? ((livePrice - entry) / entry) * 100 : 0;

        return {
            id: String(p._id),
            signalId: String(p._id),
            symbol: symbolClean,
            fullSymbol: p.symbol,
            assetType: p.assetType,
            isCrypto: p.assetType === 'crypto' || p.assetType === 'dex',
            bias: long ? 'long' : 'short',
            direction: p.direction,
            aiScore: scoring.aiScore,
            confidence: conf,
            setupType,
            setupLabel,
            whySurfaced,
            price: livePrice,
            entry,
            sl: p.stopLoss,
            tp1: p.takeProfit1,
            tp2: p.takeProfit2,
            tp3: p.takeProfit3,
            rr: scoring.rr,
            changePct,
            timeframe: p.timeframe,
            hasLiveSignal: true,
            createdAt: p.createdAt,
            expiresAt: p.expiresAt,
            indicators: p.indicators || {},
            analysis: p.analysis || {},
            alignedCount: scoring.alignedCount,
            opposedCount: scoring.opposedCount,
            totalIndicators: scoring.totalIndicators
        };
    });

    // Apply post-fetch filters that need enriched fields
    if (filters.setupTypes && filters.setupTypes.length > 0) {
        const set = new Set(filters.setupTypes);
        opportunities = opportunities.filter(o => set.has(o.setupType));
    }

    if (filters.minRR) {
        const minRR = Number(filters.minRR);
        opportunities = opportunities.filter(o => o.rr !== null && o.rr >= minRR);
    }

    if (filters.minAiScore) {
        const min = Number(filters.minAiScore);
        opportunities = opportunities.filter(o => o.aiScore >= min);
    }

    // Sort
    const sortBy = filters.sortBy || 'ai_score';
    const sortDir = filters.sortDir === 'asc' ? 1 : -1;
    opportunities.sort((a, b) => {
        let av, bv;
        switch (sortBy) {
            case 'confidence': av = a.confidence; bv = b.confidence; break;
            case 'rr': av = a.rr || 0; bv = b.rr || 0; break;
            case 'change': av = a.changePct; bv = b.changePct; break;
            case 'created': av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
            case 'ai_score':
            default: av = a.aiScore; bv = b.aiScore; break;
        }
        return (bv - av) * sortDir;
    });

    return opportunities;
}

// ═══════════════════════════════════════════════════════════
// FEATURED — top N opportunities ranked strictly by AI score
// ═══════════════════════════════════════════════════════════
async function getFeaturedOpportunities(limit = 5) {
    const all = await getOpportunities({ confidenceMin: 65 });
    return all.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
// BY SYMBOL — fetch active opportunity for a specific ticker
// Returns null if no active setup detected
// ═══════════════════════════════════════════════════════════
async function getOpportunityBySymbol(symbol) {
    if (!symbol) return null;
    const sym = String(symbol).toUpperCase();
    const all = await getOpportunities({});
    return all.find(o => o.symbol === sym || o.fullSymbol?.toUpperCase() === sym) || null;
}

// ═══════════════════════════════════════════════════════════
// RELATED — opportunities similar to a source symbol
// Same setup type, similar AI Score band, exclude self
// ═══════════════════════════════════════════════════════════
async function getRelatedOpportunities(symbol, limit = 4) {
    const source = await getOpportunityBySymbol(symbol);
    const all = await getOpportunities({});
    if (!source) {
        // No source — return top opportunities
        return all.filter(o => o.symbol !== String(symbol).toUpperCase()).slice(0, limit);
    }

    const symUpper = String(symbol).toUpperCase();
    // Score each candidate by similarity
    const scored = all
        .filter(o => o.symbol !== symUpper)
        .map(o => {
            let sim = 0;
            if (o.setupType === source.setupType) sim += 50;
            if (o.bias === source.bias) sim += 20;
            if (o.assetType === source.assetType) sim += 15;
            sim += Math.max(0, 15 - Math.abs(o.aiScore - source.aiScore));
            return { ...o, _similarity: sim };
        })
        .sort((a, b) => b._similarity - a._similarity);

    return scored.slice(0, limit).map(o => {
        const { _similarity, ...rest } = o;
        return rest;
    });
}

// ═══════════════════════════════════════════════════════════
// PRESET COUNTS — for tab badges
// ═══════════════════════════════════════════════════════════
async function getPresetCounts() {
    const all = await getOpportunities({});
    const counts = {
        all: all.length,
        breakouts: all.filter(o => o.setupType === 'breakout').length,
        reversals: all.filter(o => o.setupType === 'reversal').length,
        unusual_volume: all.filter(o => o.setupType === 'unusual_volume').length,
        oversold_bounce: all.filter(o => o.setupType === 'oversold_bounce').length,
        momentum: all.filter(o => o.setupType === 'momentum').length,
        high_conviction: all.filter(o => o.aiScore >= 80).length,
        long: all.filter(o => o.bias === 'long').length,
        short: all.filter(o => o.bias === 'short').length
    };
    return counts;
}

// ═══════════════════════════════════════════════════════════
// ENGINE STATUS — meta info for header pill
// ═══════════════════════════════════════════════════════════
async function getEngineStatus() {
    const all = await getOpportunities({});
    const longCount = all.filter(o => o.bias === 'long').length;
    const shortCount = all.filter(o => o.bias === 'short').length;
    const total = all.length || 1;
    const longPct = Math.round((longCount / total) * 100);

    let bias = 'Neutral';
    if (longPct >= 60) bias = 'Net Long';
    else if (longPct <= 40) bias = 'Net Short';

    // Most recent prediction = "last scan"
    const lastScan = all.length > 0
        ? all.reduce((latest, o) => new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest).createdAt
        : null;

    return {
        active: true,
        total: all.length,
        longCount,
        shortCount,
        longPct,
        bias,
        lastScanAt: lastScan,
        scannedAt: new Date()
    };
}

// ═══════════════════════════════════════════════════════════
// SETUP STATS — historical performance grouped by setup type
// Powers the "Track Record" trust strip on the asset detail page
// ═══════════════════════════════════════════════════════════
async function getSetupStats(setupType, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const closed = await Prediction.find({
        status: { $in: ['correct', 'incorrect'] },
        createdAt: { $gte: since }
    }).lean();

    // Classify each closed prediction and filter by setupType
    const matching = closed.filter(p => {
        try {
            return classifySetup(p) === setupType;
        } catch {
            return false;
        }
    });

    if (matching.length === 0) {
        return { setupType, count: 0, winRate: null, avgReturn: null, days };
    }

    let wins = 0;
    let totalReturnPct = 0;
    matching.forEach(p => {
        const long = p.direction === 'UP';
        const entry = p.entryPrice || p.currentPrice;
        const exit = p.resultPrice || p.outcome?.actualPrice || entry;
        const isWin = p.status === 'correct' || p.result === 'win';
        if (isWin) wins++;
        if (entry && exit) {
            const rawPct = ((exit - entry) / entry) * 100;
            totalReturnPct += long ? rawPct : -rawPct;
        }
    });

    return {
        setupType,
        count: matching.length,
        winRate: Math.round((wins / matching.length) * 100),
        avgReturn: Math.round((totalReturnPct / matching.length) * 10) / 10,
        days
    };
}

module.exports = {
    getOpportunities,
    getFeaturedOpportunities,
    getOpportunityBySymbol,
    getRelatedOpportunities,
    getPresetCounts,
    getEngineStatus,
    getSetupStats,
    classifySetup,
    computeAiScore,
    SETUP_TYPES,
    SETUP_LABELS
};
