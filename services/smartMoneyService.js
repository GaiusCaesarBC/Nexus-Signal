// server/services/smartMoneyService.js
// Smart Money — derivation layer over the existing whaleService.
// Adds: bias gauge, AI insight templater, ranked smart money signals,
// cluster detection, unusual activity flags, and alert interpretation.
// Joins with opportunityEngine so every CTA goes somewhere real.

const whaleService = require('./whaleService');
const opportunityEngine = require('./opportunityEngine');

// ═══════════════════════════════════════════════════════════
// NORMALIZE — turn each alertType's raw shape into one canonical event
// ═══════════════════════════════════════════════════════════
function normalizeEvent(raw) {
    if (!raw || !raw.alertType) return null;
    const t = raw.alertType;

    let symbol, dollarAmount, direction, actor, sourceType, sourceLabel, timestamp, name;

    if (t === 'insider') {
        symbol = raw.symbol;
        dollarAmount = raw.totalValue || 0;
        direction = raw.transactionType === 'BUY' ? 'buy' : 'sell';
        actor = raw.insiderTitle || raw.insiderName || 'Insider';
        sourceType = 'insider';
        sourceLabel = 'Insider';
        timestamp = raw.filingDate || raw.transactionDate || new Date();
        name = raw.companyName || raw.symbol;
    } else if (t === 'crypto') {
        symbol = raw.symbol;
        dollarAmount = raw.amountUsd || 0;
        // Outflow = accumulation = bullish; inflow = distribution = bearish
        direction = raw.type === 'exchange_outflow' ? 'buy' : 'sell';
        actor = raw.fromOwner || raw.toOwner || 'Whale';
        sourceType = 'whale';
        sourceLabel = 'Whale';
        timestamp = raw.timestamp || new Date();
        name = raw.symbol;
    } else if (t === 'options') {
        symbol = raw.symbol;
        dollarAmount = raw.premium || 0;
        direction = raw.sentiment === 'BULLISH' ? 'buy' : 'sell';
        actor = `${raw.optionType || 'Options'} ${raw.orderType || ''}`.trim();
        sourceType = 'options';
        sourceLabel = 'Options Flow';
        timestamp = raw.timestamp || new Date();
        name = raw.symbol;
    } else if (t === 'congress') {
        symbol = raw.symbol;
        dollarAmount = raw.amount || raw.totalValue || 0;
        direction = raw.transactionType === 'BUY' ? 'buy' : 'sell';
        actor = raw.representative || raw.senator || 'Member of Congress';
        sourceType = 'congress';
        sourceLabel = 'Congress';
        timestamp = raw.transactionDate || new Date();
        name = raw.symbol;
    } else {
        return null;
    }

    if (!symbol || dollarAmount <= 0) return null;

    return {
        id: `${sourceType}-${symbol}-${new Date(timestamp).getTime()}-${Math.round(dollarAmount)}`,
        symbol: String(symbol).toUpperCase(),
        name,
        sourceType,
        sourceLabel,
        direction, // 'buy' | 'sell'
        actor,
        dollarAmount,
        timestamp: new Date(timestamp),
        raw // keep the raw event for the feed
    };
}

// ═══════════════════════════════════════════════════════════
// BIAS COMPUTATION — bull/bear by source + overall
// ═══════════════════════════════════════════════════════════
function computeBias(events) {
    const total = events.length;
    if (total === 0) {
        return {
            bucket: 'mixed',
            label: 'Mixed',
            needlePosition: 0.5,
            buys: 0,
            sells: 0,
            netDollarFlow: 0,
            sources: { insider: 'mixed', whale: 'mixed', options: 'mixed', congress: 'mixed' }
        };
    }

    const buys = events.filter(e => e.direction === 'buy');
    const sells = events.filter(e => e.direction === 'sell');
    const buyDollars = buys.reduce((s, e) => s + e.dollarAmount, 0);
    const sellDollars = sells.reduce((s, e) => s + e.dollarAmount, 0);
    const netFlow = buyDollars - sellDollars;

    // Composite score from count + dollar weight
    const countSkew = buys.length - sells.length;
    const dollarSkew = buyDollars + sellDollars > 0
        ? ((buyDollars - sellDollars) / (buyDollars + sellDollars)) * 50
        : 0;
    const composite = (countSkew / total) * 50 + dollarSkew;

    let bucket, label;
    if (composite > 25) { bucket = 'strong_bullish'; label = 'Strong Bullish'; }
    else if (composite > 8) { bucket = 'bullish'; label = 'Mildly Bullish'; }
    else if (composite > -8) { bucket = 'mixed'; label = 'Mixed'; }
    else if (composite > -25) { bucket = 'bearish'; label = 'Mildly Bearish'; }
    else { bucket = 'strong_bearish'; label = 'Strong Bearish'; }

    const needlePosition = Math.max(0, Math.min(1, (composite + 100) / 200));

    // Per-source bias
    const sourceBias = (st) => {
        const sub = events.filter(e => e.sourceType === st);
        if (sub.length === 0) return 'none';
        const sb = sub.filter(e => e.direction === 'buy').length;
        const ss = sub.length - sb;
        if (sb >= ss * 1.4) return 'bullish';
        if (ss >= sb * 1.4) return 'bearish';
        return 'mixed';
    };

    return {
        bucket,
        label,
        needlePosition: Math.round(needlePosition * 1000) / 1000,
        buys: buys.length,
        sells: sells.length,
        buyDollars,
        sellDollars,
        netDollarFlow: netFlow,
        composite: Math.round(composite),
        sources: {
            insider: sourceBias('insider'),
            whale: sourceBias('whale'),
            options: sourceBias('options'),
            congress: sourceBias('congress')
        }
    };
}

// ═══════════════════════════════════════════════════════════
// CLUSTER DETECTION — group same-symbol events with aligned direction
// ═══════════════════════════════════════════════════════════
function detectClusters(events) {
    const bySymbol = new Map();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    events.forEach(e => {
        if (new Date(e.timestamp).getTime() < cutoff) return;
        if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);
        bySymbol.get(e.symbol).push(e);
    });

    const clusters = [];
    for (const [symbol, list] of bySymbol.entries()) {
        if (list.length < 2) continue;

        const buys = list.filter(e => e.direction === 'buy').length;
        const dominantDir = buys >= list.length / 2 ? 'buy' : 'sell';
        const aligned = list.filter(e => e.direction === dominantDir);
        if (aligned.length / list.length < 0.7) continue;

        const sourceTypes = new Set(list.map(e => e.sourceType));
        const totalDollars = list.reduce((s, e) => s + e.dollarAmount, 0);

        clusters.push({
            symbol,
            direction: dominantDir,
            eventCount: list.length,
            alignedCount: aligned.length,
            totalDollars,
            sourceTypes: Array.from(sourceTypes),
            crossSource: sourceTypes.size > 1,
            events: aligned.sort((a, b) => b.dollarAmount - a.dollarAmount)
        });
    }

    return clusters.sort((a, b) => b.totalDollars - a.totalDollars);
}

// ═══════════════════════════════════════════════════════════
// SIGNAL SCORING + SMART MONEY SIGNALS (hero cards)
// ═══════════════════════════════════════════════════════════
function scoreEvent(event, clusterMap, hasLiveSignal) {
    const dollarLog = Math.log10(Math.max(1, event.dollarAmount)) * 20;
    const cluster = clusterMap.get(event.symbol);
    const clusterPoints = cluster ? cluster.eventCount * 25 : 0;
    const crossSourcePoints = cluster?.crossSource ? 30 : 0;
    const ageHours = (Date.now() - new Date(event.timestamp).getTime()) / 3600000;
    const recencyBoost = Math.max(0, 30 - ageHours);
    const liveBonus = hasLiveSignal ? 40 : 0;
    return Math.round(dollarLog + clusterPoints + crossSourcePoints + recencyBoost + liveBonus);
}

function strengthFromScore(score) {
    if (score >= 120) return 'strong';
    if (score >= 70) return 'moderate';
    return 'weak';
}

async function buildSmartMoneySignals(events, clusters) {
    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    const clusterMap = new Map();
    clusters.forEach(c => clusterMap.set(c.symbol, c));

    // For each cluster, build ONE signal (cluster collapses noise)
    // For each top non-clustered event, also add one signal
    const signals = [];

    clusters.forEach(c => {
        const top = c.events[0];
        const opp = oppMap.get(c.symbol);
        const score = scoreEvent(top, clusterMap, !!opp);
        signals.push({
            id: `cluster-${c.symbol}`,
            kind: 'cluster',
            symbol: c.symbol,
            name: top.name,
            sourceType: c.sourceTypes[0],
            sourceTypes: c.sourceTypes,
            sourceLabel: top.sourceLabel,
            direction: c.direction,
            bias: c.direction === 'buy' ? 'long' : 'short',
            dollarAmount: c.totalDollars,
            eventCount: c.eventCount,
            crossSource: c.crossSource,
            timestamp: top.timestamp,
            actor: top.actor,
            score,
            strength: strengthFromScore(score),
            interpretation: buildInterpretation({
                ...top,
                eventCount: c.eventCount,
                isCluster: true,
                crossSource: c.crossSource,
                aligned: !!opp
            }),
            whyMatters: getWhyMatters(c.sourceTypes[0], c.direction),
            hasLiveSignal: !!opp,
            signalId: opp?.id || opp?.signalId || null,
            isCrypto: c.sourceTypes.includes('whale'),
            clusterEvents: c.events.slice(0, 3).map(e => ({
                actor: e.actor,
                dollarAmount: e.dollarAmount,
                direction: e.direction,
                sourceType: e.sourceType
            }))
        });
    });

    // Add top non-clustered events
    const clusterSymbols = new Set(clusters.map(c => c.symbol));
    const remaining = events
        .filter(e => !clusterSymbols.has(e.symbol))
        .map(e => {
            const opp = oppMap.get(e.symbol);
            const score = scoreEvent(e, clusterMap, !!opp);
            return {
                id: `single-${e.id}`,
                kind: 'single',
                symbol: e.symbol,
                name: e.name,
                sourceType: e.sourceType,
                sourceTypes: [e.sourceType],
                sourceLabel: e.sourceLabel,
                direction: e.direction,
                bias: e.direction === 'buy' ? 'long' : 'short',
                dollarAmount: e.dollarAmount,
                eventCount: 1,
                crossSource: false,
                timestamp: e.timestamp,
                actor: e.actor,
                score,
                strength: strengthFromScore(score),
                interpretation: buildInterpretation({
                    ...e,
                    isCluster: false,
                    aligned: !!opp
                }),
                whyMatters: getWhyMatters(e.sourceType, e.direction),
                hasLiveSignal: !!opp,
                signalId: opp?.id || opp?.signalId || null,
                isCrypto: e.sourceType === 'whale'
            };
        });

    return [...signals, ...remaining]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
}

// ═══════════════════════════════════════════════════════════
// INTERPRETATION + WHY MATTERS templates
// ═══════════════════════════════════════════════════════════
function fmtMoney(n) {
    if (!n) return '$0';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${Math.round(n)}`;
}

function buildInterpretation({ sourceType, direction, dollarAmount, isCluster, eventCount, crossSource, aligned }) {
    const sizeWord = dollarAmount >= 10e6 ? 'massive'
        : dollarAmount >= 1e6 ? 'large'
        : dollarAmount >= 100e3 ? 'moderate'
        : 'small';

    const alignedSuffix = aligned
        ? ' Aligned with active trade setup.'
        : '';

    if (isCluster) {
        if (crossSource) {
            return direction === 'buy'
                ? `Cross-source bullish confluence — ${eventCount} events from multiple sources agreeing.${alignedSuffix}`
                : `Cross-source bearish confluence — ${eventCount} events suggesting distribution.${alignedSuffix}`;
        }
        if (sourceType === 'insider') {
            return direction === 'buy'
                ? `${eventCount} insider buys in 24h — strong accumulation signal.${alignedSuffix}`
                : `${eventCount} insider sells in 24h — possible distribution or profit-taking.${alignedSuffix}`;
        }
        if (sourceType === 'whale') {
            return direction === 'buy'
                ? `Multiple whale accumulation events — wallets building positions.${alignedSuffix}`
                : `Whale distribution detected — large wallets moving to exchanges.${alignedSuffix}`;
        }
        if (sourceType === 'options') {
            return direction === 'buy'
                ? `Repeated bullish options flow — institutional positioning.${alignedSuffix}`
                : `Repeated bearish options flow — hedging or directional shorts.${alignedSuffix}`;
        }
        if (sourceType === 'congress') {
            return `${eventCount} congressional ${direction}s in 24h — tracked but verify motive.${alignedSuffix}`;
        }
    }

    // Single event
    if (sourceType === 'insider') {
        return direction === 'buy'
            ? `${sizeWord[0].toUpperCase() + sizeWord.slice(1)} insider buy — accumulation signal.${alignedSuffix}`
            : `${sizeWord[0].toUpperCase() + sizeWord.slice(1)} insider sell — possible profit-taking.${alignedSuffix}`;
    }
    if (sourceType === 'whale') {
        return direction === 'buy'
            ? `Whale accumulation — funds moved off exchange.${alignedSuffix}`
            : `Whale distribution — funds moved to exchange for sale.${alignedSuffix}`;
    }
    if (sourceType === 'options') {
        return direction === 'buy'
            ? `${sizeWord[0].toUpperCase() + sizeWord.slice(1)} bullish options flow — directional bet.${alignedSuffix}`
            : `${sizeWord[0].toUpperCase() + sizeWord.slice(1)} bearish options flow — directional bet or hedge.${alignedSuffix}`;
    }
    if (sourceType === 'congress') {
        return direction === 'buy'
            ? `Congressional buy — track but verify.${alignedSuffix}`
            : `Congressional sell — track but verify.${alignedSuffix}`;
    }
    return `Smart money ${direction} detected.${alignedSuffix}`;
}

const WHY_MATTERS = {
    insider_buy: 'Insider buys outperform the market by ~11% over 6 months on average.',
    insider_sell: 'Insider sells are noisier than buys (often tax/diversification), but cluster sells are meaningful.',
    whale_buy: 'Wallet accumulation precedes price moves when concentrated in known smart money addresses.',
    whale_sell: 'Distribution from large wallets often signals near-term tops.',
    options_buy: 'Unusual call flow often reflects institutional positioning ahead of catalysts.',
    options_sell: 'Heavy put buying can signal hedging or directional shorts.',
    congress_buy: 'Congressional trades have historically outperformed the S&P 500 — track but verify.',
    congress_sell: 'Congressional sells deserve scrutiny — sometimes precede negative news.'
};
function getWhyMatters(sourceType, direction) {
    const key = `${sourceType}_${direction}`;
    return WHY_MATTERS[key] || 'Smart money activity worth tracking.';
}

// ═══════════════════════════════════════════════════════════
// AI INSIGHT — top-of-page narrative
// ═══════════════════════════════════════════════════════════
function buildInsight(bias, clusters, signals) {
    const { bucket, buys, sells, netDollarFlow, sources } = bias;

    // Cross-source confluence is the strongest signal
    const crossSource = clusters.find(c => c.crossSource);
    if (crossSource) {
        return {
            text: `Cross-source confluence on ${crossSource.symbol} — ${crossSource.eventCount} events from ${crossSource.sourceTypes.join(', ')} agreeing on ${crossSource.direction === 'buy' ? 'BULLISH' : 'BEARISH'} direction.`,
            primary_factor: 'cross_source'
        };
    }

    // Big cluster
    const bigCluster = clusters[0];
    if (bigCluster && bigCluster.eventCount >= 3) {
        const dirWord = bigCluster.direction === 'buy' ? 'accumulation' : 'distribution';
        return {
            text: `${bigCluster.eventCount}-event ${dirWord} cluster on ${bigCluster.symbol} — ${fmtMoney(bigCluster.totalDollars)} total flow in 24h.`,
            primary_factor: 'cluster'
        };
    }

    if (bucket === 'strong_bullish') {
        return {
            text: `Strong bullish smart money flow — ${buys} buy events vs ${sells} sells, net ${fmtMoney(netDollarFlow)} accumulation.`,
            primary_factor: 'broad_bullish'
        };
    }
    if (bucket === 'bullish') {
        return {
            text: `Mildly bullish smart money — insiders ${sources.insider}, options ${sources.options}, whales ${sources.whale}.`,
            primary_factor: 'broad_bullish'
        };
    }
    if (bucket === 'bearish' || bucket === 'strong_bearish') {
        return {
            text: `${bucket === 'strong_bearish' ? 'Strong' : 'Mildly'} bearish smart money flow — ${sells} sells vs ${buys} buys, net ${fmtMoney(Math.abs(netDollarFlow))} distribution.`,
            primary_factor: 'broad_bearish'
        };
    }
    return {
        text: `Mixed smart money environment — sources disagree, no dominant flow forming.`,
        primary_factor: 'mixed'
    };
}

// ═══════════════════════════════════════════════════════════
// UNUSUAL ACTIVITY detection
// ═══════════════════════════════════════════════════════════
function detectUnusual(events, clusters) {
    const unusual = [];

    // Type 1: cross-source confluence (already in clusters but flag separately)
    clusters.filter(c => c.crossSource).slice(0, 2).forEach(c => {
        unusual.push({
            type: 'cross_source_confluence',
            symbol: c.symbol,
            label: 'Cross-Source Confluence',
            description: `${c.eventCount} events across ${c.sourceTypes.join(', ')} agree on ${c.direction === 'buy' ? 'BULLISH' : 'BEARISH'}`,
            dollarAmount: c.totalDollars,
            direction: c.direction,
            sourceTypes: c.sourceTypes,
            isCrypto: c.sourceTypes.includes('whale')
        });
    });

    // Type 2: big single events (top 5% by size for the universe)
    const sortedBySize = [...events].sort((a, b) => b.dollarAmount - a.dollarAmount);
    const top = sortedBySize.slice(0, Math.max(2, Math.floor(events.length * 0.05)));
    top.slice(0, 2).forEach(e => {
        if (unusual.find(u => u.symbol === e.symbol)) return;
        unusual.push({
            type: 'massive_size',
            symbol: e.symbol,
            label: 'Massive Trade',
            description: `${fmtMoney(e.dollarAmount)} ${e.sourceLabel.toLowerCase()} ${e.direction.toUpperCase()} — top of the universe`,
            dollarAmount: e.dollarAmount,
            direction: e.direction,
            sourceTypes: [e.sourceType],
            isCrypto: e.sourceType === 'whale'
        });
    });

    // Type 3: large cluster (>=4 events)
    clusters.filter(c => c.eventCount >= 4 && !c.crossSource).slice(0, 2).forEach(c => {
        if (unusual.find(u => u.symbol === c.symbol)) return;
        unusual.push({
            type: 'event_cluster',
            symbol: c.symbol,
            label: 'Event Cluster',
            description: `${c.eventCount} ${c.sourceTypes[0]} events on ${c.symbol} in 24h`,
            dollarAmount: c.totalDollars,
            direction: c.direction,
            sourceTypes: c.sourceTypes,
            isCrypto: c.sourceTypes.includes('whale')
        });
    });

    return unusual.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════
// MAIN — getSmartMoneySnapshot
// ═══════════════════════════════════════════════════════════
async function getSmartMoneySnapshot({ types = ['insider', 'crypto', 'options', 'congress'], filters = {} } = {}) {
    let raw = [];
    try {
        raw = await whaleService.getAllAlerts({ limit: 150, types });
    } catch (e) {
        console.error('[SmartMoney] getAllAlerts failed:', e.message);
    }

    let events = raw.map(normalizeEvent).filter(Boolean);

    // Apply filters
    if (filters.sourceType && filters.sourceType !== 'all') {
        events = events.filter(e => e.sourceType === filters.sourceType);
    }
    if (filters.direction && filters.direction !== 'all') {
        events = events.filter(e => e.direction === filters.direction);
    }
    if (filters.minDollar) {
        const min = Number(filters.minDollar);
        events = events.filter(e => e.dollarAmount >= min);
    }
    if (filters.recency) {
        const cutoff = Date.now() - (filters.recency === '1h' ? 3600e3
            : filters.recency === '7d' ? 7 * 86400e3
            : 86400e3);
        events = events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }

    const bias = computeBias(events);
    const clusters = detectClusters(events);
    const signals = await buildSmartMoneySignals(events, clusters);
    const insight = buildInsight(bias, clusters, signals);
    const unusual = detectUnusual(events, clusters);

    // Aligned opportunity count for bridge CTA
    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const dominantDir = bias.bucket.includes('bullish') ? 'long'
        : bias.bucket.includes('bearish') ? 'short'
        : null;
    const alignedOpportunityCount = dominantDir
        ? opportunities.filter(o => o.bias === dominantDir).length
        : opportunities.length;

    // Build the feed (sorted by signal score, not time)
    const clusterMap = new Map();
    clusters.forEach(c => clusterMap.set(c.symbol, c));
    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    const feed = events
        .map(e => {
            const opp = oppMap.get(e.symbol);
            const score = scoreEvent(e, clusterMap, !!opp);
            return {
                id: e.id,
                symbol: e.symbol,
                name: e.name,
                sourceType: e.sourceType,
                sourceLabel: e.sourceLabel,
                direction: e.direction,
                actor: e.actor,
                dollarAmount: e.dollarAmount,
                timestamp: e.timestamp,
                score,
                strength: strengthFromScore(score),
                interpretation: buildInterpretation({
                    ...e,
                    isCluster: false,
                    aligned: !!opp
                }),
                whyMatters: getWhyMatters(e.sourceType, e.direction),
                hasLiveSignal: !!opp,
                signalId: opp?.id || opp?.signalId || null,
                isCrypto: e.sourceType === 'whale'
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    return {
        success: true,
        refreshedAt: new Date().toISOString(),
        totalEvents: events.length,
        bias,
        insight,
        signals,
        unusual,
        feed,
        dominantBias: dominantDir,
        alignedOpportunityCount
    };
}

// ═══════════════════════════════════════════════════════════
// BY SYMBOL — for the search detail panel
// ═══════════════════════════════════════════════════════════
async function getBySymbol(symbol) {
    let raw = [];
    try {
        raw = await whaleService.getAllAlerts({ limit: 150 });
    } catch {}
    const events = raw.map(normalizeEvent).filter(Boolean);
    const sym = symbol.toUpperCase();
    const matches = events.filter(e => e.symbol === sym);
    if (matches.length === 0) return null;

    const buys = matches.filter(e => e.direction === 'buy').length;
    const sells = matches.length - buys;
    const totalBuyDollars = matches.filter(e => e.direction === 'buy').reduce((s, e) => s + e.dollarAmount, 0);
    const totalSellDollars = matches.filter(e => e.direction === 'sell').reduce((s, e) => s + e.dollarAmount, 0);

    const opp = await opportunityEngine.getOpportunityBySymbol(sym).catch(() => null);

    return {
        symbol: sym,
        eventCount: matches.length,
        buys,
        sells,
        totalBuyDollars,
        totalSellDollars,
        netFlow: totalBuyDollars - totalSellDollars,
        bySource: {
            insider: matches.filter(e => e.sourceType === 'insider').length,
            whale: matches.filter(e => e.sourceType === 'whale').length,
            options: matches.filter(e => e.sourceType === 'options').length,
            congress: matches.filter(e => e.sourceType === 'congress').length
        },
        events: matches.slice(0, 10).map(e => ({
            sourceType: e.sourceType,
            sourceLabel: e.sourceLabel,
            actor: e.actor,
            direction: e.direction,
            dollarAmount: e.dollarAmount,
            timestamp: e.timestamp
        })),
        hasLiveSignal: !!opp,
        signalId: opp?.id || opp?.signalId || null,
        isCrypto: matches.some(e => e.sourceType === 'whale')
    };
}

module.exports = {
    getSmartMoneySnapshot,
    getBySymbol,
    computeBias,
    detectClusters
};
