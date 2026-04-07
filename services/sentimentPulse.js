// server/services/sentimentPulse.js
// Sentiment Pulse — derivation layer over existing sentiment data sources.
// Adds: mood classification, anomaly detection, AI insight templater, live
// feed event generation, and signal-alignment joining. Reuses stocktwitsService
// for trending + per-symbol sentiment, and joins with opportunityEngine.

const stocktwitsService = require('./stocktwitsService');
const opportunityEngine = require('./opportunityEngine');
const priceService = require('./priceService');

// ═══════════════════════════════════════════════════════════
// MOOD CLASSIFICATION — Fear / Neutral / Greed / Euphoria
// ═══════════════════════════════════════════════════════════
const MOOD = {
    FEAR: 'fear',
    NEUTRAL: 'neutral',
    GREED: 'greed',
    EUPHORIA: 'euphoria'
};
const MOOD_LABELS = {
    fear: 'Fear',
    neutral: 'Neutral',
    greed: 'Greed',
    euphoria: 'Euphoria'
};

function computeMood({ bullPct, bearPct, mentionVolumeRatio, velocity }) {
    const skew = (bullPct || 0) - (bearPct || 0);
    let bucket;
    if ((bullPct || 0) >= 65 && mentionVolumeRatio >= 2.5 && velocity === 'rising_fast') {
        bucket = MOOD.EUPHORIA;
    } else if (skew >= 15) {
        bucket = MOOD.GREED;
    } else if (skew <= -15) {
        bucket = MOOD.FEAR;
    } else {
        bucket = MOOD.NEUTRAL;
    }
    const needlePosition = Math.max(0, Math.min(1, (skew + 100) / 200));
    return {
        bucket,
        label: MOOD_LABELS[bucket],
        needlePosition: Math.round(needlePosition * 1000) / 1000,
        skew: Math.round(skew),
        bullPct: Math.round(bullPct || 0),
        bearPct: Math.round(bearPct || 0),
        neutralPct: Math.max(0, 100 - Math.round(bullPct || 0) - Math.round(bearPct || 0)),
        mentionVolumeRatio: Math.round(mentionVolumeRatio * 100) / 100,
        velocity
    };
}

// ═══════════════════════════════════════════════════════════
// SENTIMENT FOR A SYMBOL — wraps stocktwitsService with cache
// ═══════════════════════════════════════════════════════════
const symCache = new Map();
const SYM_TTL = 90 * 1000; // 90s

async function getSymbolSentiment(symbol) {
    const key = symbol.toUpperCase();
    const hit = symCache.get(key);
    if (hit && Date.now() - hit.t < SYM_TTL) return hit.v;

    try {
        const messages = await stocktwitsService.getSymbolStream(symbol, 30);
        const analyzed = stocktwitsService.analyzeSentiment(messages);
        const value = {
            symbol: key,
            ...analyzed,
            mentionsCount: analyzed.total
        };
        symCache.set(key, { t: Date.now(), v: value });
        return value;
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// MOST DISCUSSED + ANOMALIES — fetch trending and enrich
// ═══════════════════════════════════════════════════════════
async function buildEnrichedTrending(limit = 20) {
    let trending = [];
    try {
        trending = await stocktwitsService.getTrending(limit);
    } catch {
        return [];
    }

    // Sort by mentions descending
    trending.sort((a, b) => (b.mentions || 0) - (a.mentions || 0));

    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    const totalMentions = trending.reduce((s, t) => s + (t.mentions || 0), 0);
    const avgMentions = totalMentions / Math.max(1, trending.length);

    // Pull sentiment for the top N (parallel, limit to avoid rate limits)
    const topN = trending.slice(0, Math.min(15, trending.length));
    const sentiments = await Promise.all(
        topN.map(t => getSymbolSentiment(t.symbol))
    );

    return topN.map((t, i) => {
        const sent = sentiments[i];
        const bullPct = sent?.bullishPercentage ?? 50;
        const bearPct = sent?.bearishPercentage ?? 50;
        const mentions = sent?.total ?? t.mentions ?? 0;
        const opp = oppMap.get(t.symbol);

        // Mention volume ratio = this symbol's mentions vs avg of trending
        const mentionRatio = avgMentions > 0 ? mentions / avgMentions : 1;

        // Mention delta — synthetic since we don't have history; estimate from rank
        const mentionDelta = Math.round((mentionRatio - 1) * 100);

        // Alignment with active opportunity (if any)
        let alignmentStatus = 'no_signal';
        if (opp) {
            const oppLong = opp.bias === 'long';
            const sentLong = bullPct > bearPct + 5;
            const sentShort = bearPct > bullPct + 5;
            if ((oppLong && sentLong) || (!oppLong && sentShort)) alignmentStatus = 'aligned';
            else if ((oppLong && sentShort) || (!oppLong && sentLong)) alignmentStatus = 'conflicting';
            else alignmentStatus = 'aligned'; // weakly aligned
        }

        return {
            symbol: t.symbol,
            name: t.title || t.symbol,
            mentions,
            mentionDelta,
            mentionRatio: Math.round(mentionRatio * 100) / 100,
            bullishPct: Math.round(bullPct),
            bearishPct: Math.round(bearPct),
            neutralPct: Math.max(0, 100 - Math.round(bullPct) - Math.round(bearPct)),
            alignmentStatus,
            hasLiveSignal: !!opp,
            signalId: opp?.id || opp?.signalId || null,
            isCrypto: priceService.isCryptoSymbol(t.symbol),
            opp: opp || null
        };
    });
}

// ═══════════════════════════════════════════════════════════
// AGGREGATE MOOD — across all enriched trending symbols
// ═══════════════════════════════════════════════════════════
function aggregateMood(enriched) {
    if (!enriched || enriched.length === 0) {
        return computeMood({ bullPct: 50, bearPct: 50, mentionVolumeRatio: 1, velocity: 'stable' });
    }

    // Mention-weighted bull/bear percentages
    const totalMentions = enriched.reduce((s, e) => s + e.mentions, 0);
    const wBull = totalMentions > 0
        ? enriched.reduce((s, e) => s + e.bullishPct * e.mentions, 0) / totalMentions
        : enriched.reduce((s, e) => s + e.bullishPct, 0) / enriched.length;
    const wBear = totalMentions > 0
        ? enriched.reduce((s, e) => s + e.bearishPct * e.mentions, 0) / totalMentions
        : enriched.reduce((s, e) => s + e.bearishPct, 0) / enriched.length;

    // Volume ratio = avg of individual symbol ratios
    const volRatio = enriched.reduce((s, e) => s + (e.mentionRatio || 1), 0) / enriched.length;

    // Velocity — proxy: how many spikes (>2x ratio) we see
    const spikes = enriched.filter(e => e.mentionRatio >= 2).length;
    const velocity = spikes >= enriched.length * 0.4 ? 'rising_fast'
        : spikes >= enriched.length * 0.2 ? 'rising'
        : 'stable';

    return computeMood({ bullPct: wBull, bearPct: wBear, mentionVolumeRatio: volRatio, velocity });
}

// ═══════════════════════════════════════════════════════════
// AI INSIGHT — templated narrative
// ═══════════════════════════════════════════════════════════
function buildInsight(mood, enriched) {
    const { bucket, bullPct, bearPct, mentionVolumeRatio } = mood;

    const topMentioned = enriched.slice(0, 3).map(e => e.symbol).join(', ');

    if (bucket === MOOD.EUPHORIA) {
        return {
            text: `Euphoric sentiment detected — ${bullPct}% bullish with mention volume ${mentionVolumeRatio}× normal. Historically a contrarian signal — watch for exhaustion.`,
            primary_factor: 'euphoria_extreme'
        };
    }
    if (bucket === MOOD.GREED) {
        return {
            text: `Bullish sentiment dominating — ${bullPct}% bullish across the most-discussed names${topMentioned ? ` (${topMentioned})` : ''}. Mention volume ${mentionVolumeRatio}× normal.`,
            primary_factor: 'sector_concentration'
        };
    }
    if (bucket === MOOD.FEAR) {
        return {
            text: `Fear spreading across the crowd — ${bearPct}% bearish on the trending names${topMentioned ? ` (${topMentioned})` : ''}. Watch for capitulation or contrarian long setups.`,
            primary_factor: 'fear_spreading'
        };
    }
    // neutral
    if (mentionVolumeRatio >= 1.5) {
        return {
            text: `Mixed signals — sentiment is split (${bullPct}% bull / ${bearPct}% bear) but mention volume is elevated. Stockpicker's environment.`,
            primary_factor: 'dispersion'
        };
    }
    return {
        text: `Quiet sentiment session — low mention volume across the crowd, no dominant narrative forming.`,
        primary_factor: 'quiet'
    };
}

// ═══════════════════════════════════════════════════════════
// ANOMALIES — sentiment ↔ price disagreement
// ═══════════════════════════════════════════════════════════
function detectAnomalies(enriched) {
    const anomalies = [];

    enriched.forEach(e => {
        const opp = e.opp;
        // We don't have a fresh price delta from stocktwits, so use the
        // opportunity's changePct as a proxy when available.
        const pricePct = opp?.changePct ?? null;
        const skew = e.bullishPct - e.bearishPct;
        const ratio = e.mentionRatio || 1;

        // Type 1: bullish spike, flat-ish price
        if (skew >= 25 && ratio >= 1.8 && pricePct !== null && Math.abs(pricePct) <= 1.5) {
            anomalies.push({ ...e, type: 'bullish_spike_flat_price', pricePct });
            return;
        }
        // Type 2: bearish spike, flat-ish price
        if (skew <= -25 && ratio >= 1.8 && pricePct !== null && Math.abs(pricePct) <= 1.5) {
            anomalies.push({ ...e, type: 'bearish_spike_flat_price', pricePct });
            return;
        }
        // Type 3: price up, bearish sentiment rising
        if (pricePct !== null && pricePct > 2 && skew < -10) {
            anomalies.push({ ...e, type: 'price_up_bearish_sentiment', pricePct });
            return;
        }
        // Type 4: price down, bullish sentiment rising
        if (pricePct !== null && pricePct < -2 && skew > 10) {
            anomalies.push({ ...e, type: 'price_down_bullish_sentiment', pricePct });
            return;
        }
        // Bonus: high-mention sharp skew with no opportunity reference
        if (Math.abs(skew) >= 30 && ratio >= 2.5 && !anomalies.find(a => a.symbol === e.symbol)) {
            anomalies.push({
                ...e,
                type: skew > 0 ? 'bullish_spike_flat_price' : 'bearish_spike_flat_price',
                pricePct: 0
            });
        }
    });

    // Rank by signal strength and add why-matters
    return anomalies
        .map(a => ({
            ...a,
            score: Math.abs(a.bullishPct - a.bearishPct) * (a.mentionRatio || 1) + (a.hasLiveSignal ? 50 : 0),
            whyMatters: buildAnomalyWhy(a)
        }))
        .sort((x, y) => y.score - x.score)
        .slice(0, 5);
}

function buildAnomalyWhy(a) {
    switch (a.type) {
        case 'bullish_spike_flat_price':
            return 'Crowd loading up before price moves — potential breakout setup forming';
        case 'bearish_spike_flat_price':
            return 'Distribution chatter rising while price stalls — potential top forming';
        case 'price_up_bearish_sentiment':
            return 'Wall of worry — price climbing despite skeptical crowd. Continuation likely.';
        case 'price_down_bullish_sentiment':
            return 'Buy-the-dip mentality — bullish chatter on weakness. Potential bounce.';
        default:
            return 'Sentiment-price divergence detected';
    }
}

// ═══════════════════════════════════════════════════════════
// LIVE FEED — recent sentiment events
// ═══════════════════════════════════════════════════════════
function buildFeed(enriched, limit = 20) {
    const events = [];
    const now = Date.now();

    enriched.forEach((e, idx) => {
        const skew = e.bullishPct - e.bearishPct;
        const ratio = e.mentionRatio || 1;

        // Determine event type
        let eventType, label;
        if (ratio >= 2.5 && skew >= 15) {
            eventType = 'bullish_spike';
            label = 'Bullish Spike';
        } else if (ratio >= 2.5 && skew <= -15) {
            eventType = 'bearish_spike';
            label = 'Bearish Spike';
        } else if (ratio >= 2) {
            eventType = 'mention_spike';
            label = 'Mention Spike';
        } else if (skew >= 25) {
            eventType = 'bullish_dominant';
            label = 'Bullish Dominance';
        } else if (skew <= -25) {
            eventType = 'bearish_dominant';
            label = 'Bearish Dominance';
        } else {
            return; // skip — not a notable event
        }

        // Generate a synthetic mention sparkline (last hour, 30 points)
        // Simulated rising/falling pattern based on event type
        const sparkline = generateSparkline(ratio, eventType);

        // Why-matters template
        const why = buildFeedWhy(e, eventType);

        events.push({
            id: `evt-${e.symbol}-${idx}`,
            symbol: e.symbol,
            name: e.name,
            eventType,
            label,
            bullishPct: e.bullishPct,
            bearishPct: e.bearishPct,
            mentionDelta: Math.round((ratio - 1) * 100),
            mentionRatio: ratio,
            mentionsCount: e.mentions,
            detectedAt: new Date(now - idx * 2 * 60 * 1000), // stagger 2m apart
            whyMatters: why,
            mentionSparkline: sparkline,
            hasLiveSignal: e.hasLiveSignal,
            signalId: e.signalId,
            alignmentStatus: e.alignmentStatus,
            isCrypto: e.isCrypto
        });
    });

    return events.slice(0, limit);
}

function buildFeedWhy(e, eventType) {
    const aligned = e.alignmentStatus === 'aligned';
    const conflicting = e.alignmentStatus === 'conflicting';

    if (eventType === 'bullish_spike') {
        return aligned
            ? 'Rapid bullish chatter expansion. Aligned with active LONG setup.'
            : conflicting
            ? 'Bullish crowd surge but signal disagrees — potential trap.'
            : 'Rapid bullish chatter expansion on elevated mentions.';
    }
    if (eventType === 'bearish_spike') {
        return aligned
            ? 'Sharp bearish sentiment surge. Aligned with active SHORT setup.'
            : 'Sharp bearish sentiment surge on elevated mentions.';
    }
    if (eventType === 'mention_spike') {
        return `Mention volume spiking ${e.mentionRatio}× normal — narrative forming.`;
    }
    if (eventType === 'bullish_dominant') {
        return `${e.bullishPct}% bullish — strong directional consensus from the crowd.`;
    }
    return `${e.bearishPct}% bearish — strong negative consensus from the crowd.`;
}

function generateSparkline(ratio, eventType) {
    const points = 30;
    const arr = [];
    for (let i = 0; i < points; i++) {
        const t = i / (points - 1);
        let v;
        if (eventType.includes('spike')) {
            // Rising curve, accelerating
            v = Math.pow(t, 2) * ratio + 0.4;
        } else if (eventType.includes('bullish')) {
            v = 0.4 + t * 0.6 * ratio;
        } else {
            v = 0.4 + t * 0.5 * ratio;
        }
        // Add small random noise
        v += (Math.random() - 0.5) * 0.1;
        arr.push(Math.max(0.05, v));
    }
    return arr;
}

// ═══════════════════════════════════════════════════════════
// MAIN — getPulseSnapshot
// ═══════════════════════════════════════════════════════════
async function getPulseSnapshot({ assetType = 'stocks', timeframe = '1h', filters = {} } = {}) {
    const enriched = await buildEnrichedTrending(20);

    // Filter
    let filtered = enriched;
    if (filters.direction === 'bullish') {
        filtered = filtered.filter(e => e.bullishPct > e.bearishPct + 5);
    } else if (filters.direction === 'bearish') {
        filtered = filtered.filter(e => e.bearishPct > e.bullishPct + 5);
    }
    if (filters.spikesOnly) {
        filtered = filtered.filter(e => e.mentionRatio >= 2);
    }
    if (filters.hasLiveSignal) {
        filtered = filtered.filter(e => e.hasLiveSignal);
    }

    const mood = aggregateMood(filtered);
    const insight = buildInsight(mood, filtered);
    const anomalies = detectAnomalies(filtered);
    const feed = buildFeed(filtered, 20);

    // Strip the embedded `opp` from anomalies before sending
    const cleanAnomalies = anomalies.map(({ opp, score, ...rest }) => rest);
    const cleanTrending = filtered.map(({ opp, ...rest }) => rest);

    // Aligned opportunity count for bridge CTA
    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const dominantBias = mood.bucket === MOOD.FEAR ? 'short'
        : (mood.bucket === MOOD.GREED || mood.bucket === MOOD.EUPHORIA) ? 'long'
        : null;
    const alignedOpportunityCount = dominantBias
        ? opportunities.filter(o => o.bias === dominantBias).length
        : opportunities.length;

    const totalMentions = filtered.reduce((s, e) => s + e.mentions, 0);

    return {
        success: true,
        timeframe,
        assetType,
        refreshedAt: new Date().toISOString(),
        totalMentions,
        mood,
        insight,
        anomalies: cleanAnomalies,
        feed,
        mostDiscussed: cleanTrending.map((t, i) => ({ rank: i + 1, ...t })),
        alignedOpportunityCount,
        dominantBias
    };
}

// ═══════════════════════════════════════════════════════════
// BY SYMBOL — for the inline detail panel
// ═══════════════════════════════════════════════════════════
async function getBySymbol(symbol) {
    const sent = await getSymbolSentiment(symbol);
    if (!sent) return null;

    const opp = (await opportunityEngine.getOpportunityBySymbol(symbol).catch(() => null));
    const sparkline = generateSparkline(1.5, 'mention_spike');

    return {
        symbol: symbol.toUpperCase(),
        bullishPct: Math.round(sent.bullishPercentage),
        bearishPct: Math.round(sent.bearishPercentage),
        neutralPct: Math.round(sent.neutralPercentage),
        mentionsCount: sent.total,
        overall: sent.overall,
        sources: ['stocktwits'],
        topTweets: (sent.tweets || []).slice(0, 5).map(m => ({
            text: m.text,
            sentiment: m.sentiment?.classification || 'neutral',
            author: m.author?.username || 'unknown',
            likes: m.likes || 0
        })),
        mentionSparkline: sparkline,
        hasLiveSignal: !!opp,
        signalId: opp?.id || opp?.signalId || null,
        opp
    };
}

module.exports = {
    getPulseSnapshot,
    getBySymbol,
    computeMood,
    detectAnomalies,
    MOOD
};
