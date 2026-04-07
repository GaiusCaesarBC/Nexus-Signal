// server/services/patternIntelligence.js
// Pattern Intelligence — derivation layer over existing pattern detection.
// Adds: stage classification, pattern score, why-matters templater, expected
// move ranges, and live-signal coupling. Scans patterns on the universe of
// symbols Nexus already tracks (active predictions) for fast responses.

const Prediction = require('../models/Prediction');
const { getChartData } = require('./chartService');
const opportunityEngine = require('./opportunityEngine');

let scanForPatterns = null;
let PATTERNS = null;
try {
    const pr = require('./patternRecognition');
    scanForPatterns = pr.scanForPatterns;
    PATTERNS = pr.PATTERNS;
} catch (e) {
    console.warn('[PatternIntelligence] patternRecognition not loaded — empty results');
}

// ═══════════════════════════════════════════════════════════
// PATTERN STAGE — forming / near_breakout / confirmed / failed
// ═══════════════════════════════════════════════════════════
const STAGE = {
    FORMING: 'forming',
    NEAR_BREAKOUT: 'near_breakout',
    CONFIRMED: 'confirmed',
    FAILED: 'failed'
};

function detectStage(p, currentPrice, isBullish) {
    if (!currentPrice) return STAGE.FORMING;
    const pts = p.points || {};

    // Trigger level — what price needs to break for confirmation
    const trigger = pts.neckline ?? p.target ?? null;

    // Existing detector exposes its own status hint
    const rawStatus = String(p.status || '').toLowerCase();
    if (rawStatus === 'confirmed') return STAGE.CONFIRMED;

    if (!trigger) {
        // No trigger means structure-only — leave it forming
        return STAGE.FORMING;
    }

    if (isBullish) {
        // Bullish: confirmed when price > trigger by 0.5%, failed when below structure low
        if (currentPrice >= trigger * 1.005) return STAGE.CONFIRMED;
        const distToTrigger = (trigger - currentPrice) / trigger;
        if (distToTrigger >= 0 && distToTrigger < 0.015) return STAGE.NEAR_BREAKOUT;

        // Invalidation — below pattern low
        const low = pts.first?.price || pts.leftShoulder?.price || pts.head?.price;
        if (low && currentPrice < low * 0.985) return STAGE.FAILED;
    } else {
        // Bearish: confirmed when price < trigger by 0.5%, failed when above structure high
        if (currentPrice <= trigger * 0.995) return STAGE.CONFIRMED;
        const distToTrigger = (currentPrice - trigger) / trigger;
        if (distToTrigger >= 0 && distToTrigger < 0.015) return STAGE.NEAR_BREAKOUT;

        const high = pts.first?.price || pts.leftShoulder?.price || pts.head?.price;
        if (high && currentPrice > high * 1.015) return STAGE.FAILED;
    }

    return STAGE.FORMING;
}

// ═══════════════════════════════════════════════════════════
// PATTERN SCORE — composite ranking metric
// ═══════════════════════════════════════════════════════════
function computePatternScore({ confidence, stage, hasLiveSignal, rr, volumeSpike }) {
    const stageMultiplier = {
        [STAGE.CONFIRMED]: 1.0,
        [STAGE.NEAR_BREAKOUT]: 0.75,
        [STAGE.FORMING]: 0.45,
        [STAGE.FAILED]: 0
    }[stage] || 0.4;

    const stageScore = stageMultiplier * 100;
    const volumeScore = volumeSpike ? Math.min(100, volumeSpike * 33) : 50;
    const rrScore = rr ? Math.min(100, rr * 25) : 50;
    const liveBonus = hasLiveSignal ? 100 : 0;

    const score = Math.round(
        confidence * 0.35 +
        stageScore * 0.25 +
        volumeScore * 0.15 +
        rrScore * 0.15 +
        liveBonus * 0.10
    );
    return Math.min(95, score);
}

// ═══════════════════════════════════════════════════════════
// WHY THIS MATTERS — templated explanations
// ═══════════════════════════════════════════════════════════
function buildWhyMatters({ patternKey, isBullish, stage, volumeSpike }) {
    const pattern = PATTERNS?.[patternKey];
    const name = pattern?.name || patternKey;

    const volPhrase = volumeSpike >= 2 ? ' on heavy volume'
        : volumeSpike >= 1.5 ? ' with above-average volume'
        : '';

    if (stage === STAGE.FAILED) {
        return isBullish
            ? `${name} invalidated — structure broken to the downside`
            : `${name} invalidated — bullish recovery overrode bearish structure`;
    }

    if (stage === STAGE.CONFIRMED) {
        if (isBullish) {
            if (patternKey.includes('TRIANGLE') || patternKey.includes('FLAG')) {
                return `Bullish breakout confirmed${volPhrase}`;
            }
            if (patternKey.includes('DOUBLE') || patternKey.includes('HEAD')) {
                return `Reversal confirmed — bullish structure validated${volPhrase}`;
            }
            return `Bullish breakout above resistance${volPhrase}`;
        } else {
            if (patternKey.includes('TRIANGLE') || patternKey.includes('FLAG')) {
                return `Bearish breakdown confirmed${volPhrase}`;
            }
            return `Bearish reversal confirmed — structure broken${volPhrase}`;
        }
    }

    if (stage === STAGE.NEAR_BREAKOUT) {
        return isBullish
            ? `Near breakout — price coiling under resistance${volPhrase}`
            : `Near breakdown — price testing support${volPhrase}`;
    }

    // forming
    if (isBullish) {
        if (patternKey.includes('CUP')) return 'Bullish continuation forming — handle complete';
        if (patternKey.includes('WEDGE')) return 'Falling wedge forming — bullish reversal setup';
        if (patternKey.includes('DOUBLE_BOTTOM')) return 'Double bottom forming — potential bullish reversal';
        return `Bullish ${name.toLowerCase()} forming${volPhrase}`;
    } else {
        if (patternKey.includes('HEAD')) return 'Head and shoulders forming — distribution setup';
        if (patternKey.includes('DOUBLE_TOP')) return 'Double top forming — potential bearish reversal';
        return `Bearish ${name.toLowerCase()} forming${volPhrase}`;
    }
}

// ═══════════════════════════════════════════════════════════
// EXPECTED MOVE — measured-move target as a range
// ═══════════════════════════════════════════════════════════
function buildExpectedMove(p, currentPrice, isBullish) {
    if (!p.target || !currentPrice) return null;
    const movePct = ((p.target - currentPrice) / currentPrice) * 100;
    const directional = isBullish ? movePct : -movePct;
    if (directional <= 0) return null;
    // ±25% range around the textbook target
    const min = Math.round(directional * 0.75 * 10) / 10;
    const max = Math.round(directional * 1.25 * 10) / 10;
    return { min, max };
}

// ═══════════════════════════════════════════════════════════
// VOLUME SPIKE — last 5 candles vs 20-day average
// ═══════════════════════════════════════════════════════════
function computeVolumeSpike(candles) {
    if (!candles || candles.length < 25) return null;
    const recent = candles.slice(-5);
    const baseline = candles.slice(-25, -5);
    const recentAvg = recent.reduce((s, c) => s + (c.volume || 0), 0) / recent.length;
    const baselineAvg = baseline.reduce((s, c) => s + (c.volume || 0), 0) / baseline.length;
    if (!baselineAvg) return null;
    return Math.round((recentAvg / baselineAvg) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════
// RANK PATTERNS — main entry point
// Scans the active opportunity universe and returns enriched patterns
// ═══════════════════════════════════════════════════════════
async function rankPatterns(filters = {}) {
    if (!scanForPatterns) return [];

    // Universe = active opportunities (already-tracked symbols)
    const opportunities = await opportunityEngine.getOpportunities({});
    const universe = opportunities.slice(0, 60); // cap for scan time

    const enriched = [];

    for (const opp of universe) {
        try {
            const chart = await getChartData(opp.symbol, '1D').catch(() => null);
            if (!chart?.success || !chart.data || chart.data.length < 30) continue;

            const candles = chart.data;
            const currentPrice = candles[candles.length - 1].close;
            const volumeSpike = computeVolumeSpike(candles);

            const detected = scanForPatterns(candles, '1D') || [];
            for (const p of detected) {
                const meta = PATTERNS?.[p.pattern];
                if (!meta) continue;
                const isBullish = meta.type === 'bullish';
                const bias = isBullish ? 'long' : 'short';
                const stage = detectStage(p, currentPrice, isBullish);

                if (stage === STAGE.FAILED && Math.random() > 0.3) continue; // sample failures

                const expectedMove = buildExpectedMove(p, currentPrice, isBullish);
                const rr = expectedMove ? Math.round((expectedMove.max / 3) * 10) / 10 : null;
                const hasLiveSignal = true; // every universe symbol has an opportunity

                const patternScore = computePatternScore({
                    confidence: p.confidence,
                    stage,
                    hasLiveSignal,
                    rr,
                    volumeSpike
                });

                const strength = patternScore >= 80 ? 'strong'
                    : patternScore >= 65 ? 'moderate' : 'weak';

                enriched.push({
                    id: `${opp.symbol}-${p.pattern}`,
                    symbol: opp.symbol,
                    fullSymbol: opp.fullSymbol,
                    name: opp.name || opp.symbol,
                    assetType: opp.assetType,
                    isCrypto: opp.isCrypto,
                    patternType: p.pattern,
                    patternLabel: meta.name,
                    bias,
                    direction: isBullish ? 'UP' : 'DOWN',
                    stage,
                    confidence: Math.round(p.confidence),
                    patternScore,
                    strength,
                    whyMatters: buildWhyMatters({
                        patternKey: p.pattern,
                        isBullish,
                        stage,
                        volumeSpike
                    }),
                    expectedMove,
                    rr,
                    volumeSpike,
                    currentPrice,
                    target: p.target,
                    points: p.points || null,
                    hasLiveSignal,
                    signalId: opp.signalId || opp.id,
                    detectedAt: new Date(),
                    sparkline: candles.slice(-30).map(c => c.close)
                });
            }
        } catch (e) {
            // skip symbol on error
        }
    }

    // Apply filters
    let results = enriched;
    if (filters.assetType && filters.assetType !== 'all') {
        if (filters.assetType === 'stocks') results = results.filter(r => r.assetType === 'stock');
        else if (filters.assetType === 'crypto') results = results.filter(r => r.assetType === 'crypto' || r.assetType === 'dex');
    }
    if (filters.bias === 'long') results = results.filter(r => r.bias === 'long');
    else if (filters.bias === 'short') results = results.filter(r => r.bias === 'short');

    if (filters.confidenceMin) {
        const min = Number(filters.confidenceMin);
        results = results.filter(r => r.confidence >= min);
    }
    if (filters.minScore) {
        const min = Number(filters.minScore);
        results = results.filter(r => r.patternScore >= min);
    }
    if (filters.stages && filters.stages.length > 0) {
        const set = new Set(filters.stages);
        results = results.filter(r => set.has(r.stage));
    }
    if (filters.patternTypes && filters.patternTypes.length > 0) {
        const set = new Set(filters.patternTypes);
        results = results.filter(r => set.has(r.patternType));
    }

    // Sort by pattern score
    // Descending by default (highest pattern score first)
    const ascending = filters.sortDir === 'asc';
    results.sort((a, b) => ascending
        ? (a.patternScore - b.patternScore)
        : (b.patternScore - a.patternScore));

    return results;
}

// ═══════════════════════════════════════════════════════════
// FEATURED — top N hero cards
// ═══════════════════════════════════════════════════════════
async function getFeaturedPatterns(limit = 5) {
    const all = await rankPatterns({});
    // Only feature confirmed or near_breakout
    const eligible = all.filter(p => p.stage === STAGE.CONFIRMED || p.stage === STAGE.NEAR_BREAKOUT);
    return eligible.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
// PRESET COUNTS
// ═══════════════════════════════════════════════════════════
async function getPresetCounts() {
    const all = await rankPatterns({});
    return {
        all: all.length,
        confirmed: all.filter(p => p.stage === STAGE.CONFIRMED).length,
        near_breakout: all.filter(p => p.stage === STAGE.NEAR_BREAKOUT).length,
        forming: all.filter(p => p.stage === STAGE.FORMING).length,
        failed: all.filter(p => p.stage === STAGE.FAILED).length,
        high_probability: all.filter(p => p.patternScore >= 80).length,
        bullish_reversal: all.filter(p =>
            p.bias === 'long' &&
            ['DOUBLE_BOTTOM', 'HEAD_SHOULDERS_INVERSE', 'FALLING_WEDGE', 'CUP_HANDLE'].includes(p.patternType)
        ).length,
        bearish_reversal: all.filter(p =>
            p.bias === 'short' &&
            ['DOUBLE_TOP', 'HEAD_SHOULDERS', 'RISING_WEDGE'].includes(p.patternType)
        ).length,
        continuation: all.filter(p =>
            ['BULL_FLAG', 'BEAR_FLAG', 'ASCENDING_TRIANGLE', 'DESCENDING_TRIANGLE'].includes(p.patternType)
        ).length,
        long: all.filter(p => p.bias === 'long').length,
        short: all.filter(p => p.bias === 'short').length
    };
}

// ═══════════════════════════════════════════════════════════
// PRESET RELIABILITIES — historical reliability per preset
// Pulled from PATTERNS reliability scores (literature-derived)
// ═══════════════════════════════════════════════════════════
const PRESET_PATTERN_MAP = {
    bullish_reversal: ['DOUBLE_BOTTOM', 'HEAD_SHOULDERS_INVERSE', 'FALLING_WEDGE', 'CUP_HANDLE', 'TRIPLE_BOTTOM', 'ROUNDING_BOTTOM', 'BROADENING_BOTTOM'],
    bearish_reversal: ['DOUBLE_TOP', 'HEAD_SHOULDERS', 'RISING_WEDGE', 'TRIPLE_TOP', 'ROUNDING_TOP', 'BROADENING_TOP'],
    continuation: ['BULL_FLAG', 'BEAR_FLAG', 'ASCENDING_TRIANGLE', 'DESCENDING_TRIANGLE', 'BULL_PENNANT', 'BEAR_PENNANT'],
    high_probability: ['HEAD_SHOULDERS', 'HEAD_SHOULDERS_INVERSE', 'TRIPLE_BOTTOM', 'TRIPLE_TOP', 'CUP_HANDLE', 'DOUBLE_BOTTOM', 'DOUBLE_TOP']
};

function getPresetReliabilities() {
    if (!PATTERNS) return {};
    const out = {};
    for (const [presetId, patternKeys] of Object.entries(PRESET_PATTERN_MAP)) {
        const reliabilities = patternKeys
            .map(k => PATTERNS[k]?.reliability)
            .filter(r => typeof r === 'number');
        if (reliabilities.length === 0) {
            out[presetId] = null;
            continue;
        }
        const avg = reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length;
        out[presetId] = Math.round(avg * 100);
    }
    return out;
}

// ═══════════════════════════════════════════════════════════
// MARKET INSIGHT — narrative strip
// ═══════════════════════════════════════════════════════════
async function getMarketInsight() {
    const all = await rankPatterns({});
    if (all.length === 0) {
        return {
            text: 'Quiet market — the Engine is scanning for new pattern formations.',
            bias: 'neutral',
            count: 0
        };
    }

    const long = all.filter(p => p.bias === 'long').length;
    const short = all.filter(p => p.bias === 'short').length;
    const total = all.length;
    const longPct = Math.round((long / total) * 100);
    const confirmedCount = all.filter(p => p.stage === STAGE.CONFIRMED).length;
    const nearCount = all.filter(p => p.stage === STAGE.NEAR_BREAKOUT).length;

    let bias = 'neutral';
    if (longPct >= 60) bias = 'long';
    else if (longPct <= 40) bias = 'short';

    let text;
    if (longPct >= 65) {
        text = `Bullish pattern activity dominating — ${long} long-bias formations across the universe with ${confirmedCount} already confirmed.`;
    } else if (longPct <= 35) {
        text = `Bearish pattern environment — ${short} short-bias formations forming, ${confirmedCount} confirmed breakdowns.`;
    } else if (confirmedCount >= 5) {
        text = `Active breakout environment — ${confirmedCount} patterns confirmed in the last scan, mixed bias.`;
    } else if (nearCount >= 5) {
        text = `${nearCount} patterns near breakout — watch for confirmation in the next session.`;
    } else {
        text = `Mixed pattern environment — ${total} active formations, neither side dominating.`;
    }

    return { text, bias, count: total, longPct };
}

// ═══════════════════════════════════════════════════════════
// BY SYMBOL — all patterns on one ticker, ranked
// ═══════════════════════════════════════════════════════════
async function getPatternsBySymbol(symbol) {
    const all = await rankPatterns({});
    const sym = String(symbol).toUpperCase();
    return all.filter(p => p.symbol === sym);
}

module.exports = {
    rankPatterns,
    getFeaturedPatterns,
    getPresetCounts,
    getMarketInsight,
    getPatternsBySymbol,
    getPresetReliabilities,
    detectStage,
    computePatternScore,
    STAGE
};
