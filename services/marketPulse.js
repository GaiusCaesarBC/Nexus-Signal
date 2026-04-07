// server/services/marketPulse.js
// Market Pulse — derivation layer over existing heatmap data.
// Adds: sentiment computation, AI insight narrative, tradeable movers
// selection, and top movers breakdown. Joins with opportunityEngine
// so every selected mover has a working trade-setup CTA.

const heatmapService = require('./heatmapService');
const opportunityEngine = require('./opportunityEngine');

// ═══════════════════════════════════════════════════════════
// SENTIMENT COMPUTATION
// ═══════════════════════════════════════════════════════════
function computeSentiment(tiles) {
    if (!tiles || tiles.length === 0) {
        return {
            bucket: 'neutral',
            label: 'Neutral',
            needlePosition: 0.5,
            breadth: { up: 0, down: 0, flat: 0 },
            avgMove: 0,
            avgVolumeSpike: 1,
            composite: 0,
            dispersion: 'normal'
        };
    }

    const total = tiles.length;
    const up = tiles.filter(t => t.change > 0.1).length;
    const down = tiles.filter(t => t.change < -0.1).length;
    const flat = total - up - down;

    // Volume-weighted average move
    const totalVol = tiles.reduce((s, t) => s + (t.volume || 0), 0);
    const vwAvg = totalVol > 0
        ? tiles.reduce((s, t) => s + (t.change || 0) * (t.volume || 0), 0) / totalVol
        : tiles.reduce((s, t) => s + (t.change || 0), 0) / total;

    // Breadth ratio
    const breadthRatio = up / Math.max(1, down);

    // Composite: -100 to +100 (tanh-shaped)
    const breadthScore = Math.tanh((breadthRatio - 1) / 1.5) * 50;
    const moveScore = Math.tanh(vwAvg / 1.5) * 50;
    const composite = breadthScore + moveScore;

    let bucket, label;
    if (composite > 35)        { bucket = 'strong_bullish';   label = 'Strong Bullish'; }
    else if (composite > 12)   { bucket = 'mildly_bullish';   label = 'Mildly Bullish'; }
    else if (composite > -12)  { bucket = 'neutral';          label = 'Neutral'; }
    else if (composite > -35)  { bucket = 'mildly_bearish';   label = 'Mildly Bearish'; }
    else                       { bucket = 'strong_bearish';   label = 'Strong Bearish'; }

    const needlePosition = Math.max(0, Math.min(1, (composite + 100) / 200));

    // Dispersion — high if many extreme movers
    const extremes = tiles.filter(t => Math.abs(t.change) > 5).length;
    const extremeRatio = extremes / total;
    const dispersion = extremeRatio > 0.25 ? 'high'
        : extremeRatio > 0.10 ? 'normal'
        : 'low';

    return {
        bucket,
        label,
        needlePosition: Math.round(needlePosition * 1000) / 1000,
        breadth: { up, down, flat },
        avgMove: Math.round(vwAvg * 100) / 100,
        avgVolumeSpike: 1, // placeholder; real calc would need historical volume
        composite: Math.round(composite),
        dispersion
    };
}

// ═══════════════════════════════════════════════════════════
// AI MARKET INSIGHT — templated narrative
// ═══════════════════════════════════════════════════════════
function buildInsight(sentiment, tiles, assetType) {
    const { bucket, breadth, avgMove, dispersion, composite } = sentiment;
    const total = breadth.up + breadth.down + breadth.flat;
    const upPct = Math.round((breadth.up / Math.max(1, total)) * 100);

    // Find sector concentration (stocks only)
    let dominantSector = null;
    if (assetType === 'stocks') {
        const sectorMap = new Map();
        tiles.forEach(t => {
            const sec = t.sector || 'Unknown';
            if (!sectorMap.has(sec)) sectorMap.set(sec, { up: 0, down: 0, total: 0 });
            const entry = sectorMap.get(sec);
            entry.total++;
            if (t.change > 0) entry.up++;
            else if (t.change < 0) entry.down++;
        });
        // Pick sector with strongest directional skew
        let bestSkew = 0;
        for (const [sec, entry] of sectorMap.entries()) {
            if (entry.total < 3) continue;
            const skew = Math.abs((entry.up - entry.down) / entry.total);
            if (skew > bestSkew) {
                bestSkew = skew;
                dominantSector = sec;
            }
        }
    }

    const assetWord = assetType === 'crypto' ? 'crypto' : 'stocks';

    let text;
    let primaryFactor = 'breadth';

    if (bucket === 'strong_bullish') {
        text = dominantSector
            ? `Strong bullish concentration in ${dominantSector.toLowerCase()} — ${upPct}% of names are up with momentum clustering in top gainers.`
            : `Strong bullish breadth across ${assetWord} — ${breadth.up} of ${total} names showing upside pressure with avg move ${avgMove >= 0 ? '+' : ''}${avgMove}%.`;
        primaryFactor = 'volume_concentration';
    } else if (bucket === 'mildly_bullish') {
        text = `Mildly bullish environment — ${upPct}% of ${assetWord} are up, ${dispersion === 'high' ? 'with elevated dispersion creating selective opportunities' : 'broad participation across the universe'}.`;
        primaryFactor = 'breadth';
    } else if (bucket === 'neutral') {
        text = dispersion === 'high'
            ? `Mixed signals — high dispersion with no dominant trend. Stockpicker's market.`
            : `Quiet market — ${assetWord} showing balanced flows, neither side dominating.`;
        primaryFactor = 'dispersion';
    } else if (bucket === 'mildly_bearish') {
        text = `Mildly bearish environment — ${100 - upPct}% of ${assetWord} are down. ${dispersion === 'high' ? 'Selective weakness, not broad capitulation.' : 'Watch for stabilization or deeper breakdown.'}`;
        primaryFactor = 'breadth';
    } else {
        text = dominantSector
            ? `Strong bearish pressure across ${assetWord} — concentrated weakness in ${dominantSector.toLowerCase()} with ${breadth.down} names down.`
            : `Strong bearish breadth — ${breadth.down} of ${total} ${assetWord} under pressure. Look for short setups or wait for capitulation.`;
        primaryFactor = 'breadth';
    }

    return { text, primary_factor: primaryFactor, sector: dominantSector };
}

// ═══════════════════════════════════════════════════════════
// TRADEABLE MOVERS — AI-selected hero cards
// ═══════════════════════════════════════════════════════════
function buildWhyMatters(tile, opp, isLong) {
    if (opp) {
        return opp.whySurfaced || `${isLong ? 'Bullish' : 'Bearish'} setup ready — trade plan loaded`;
    }
    if (tile.volume > 0 && Math.abs(tile.change) > 3) {
        return isLong
            ? `Strong momentum — up ${tile.change.toFixed(2)}% on heavy participation`
            : `Heavy selling — down ${Math.abs(tile.change).toFixed(2)}% with volume`;
    }
    return isLong
        ? `Above-average move — ${tile.change.toFixed(2)}% gain forming`
        : `Notable decline — ${tile.change.toFixed(2)}% slip`;
}

async function selectTradeableMovers(tiles, limit = 6) {
    if (!tiles || tiles.length === 0) return [];

    // Get active opportunities to join with
    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    // Score each tile
    const scored = tiles
        .filter(t => Math.abs(t.change) >= 1)
        .map(t => {
            const opp = oppMap.get(t.symbol);
            const liveBonus = opp ? 100 : 0;
            const score = Math.abs(t.change) * 10
                        + (opp?.aiScore || 0) * 0.8
                        + liveBonus;
            return { tile: t, opp, score };
        })
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ tile, opp }) => {
        const isLong = tile.change > 0;
        return {
            symbol: tile.symbol,
            name: tile.name || tile.symbol,
            bias: isLong ? 'long' : 'short',
            changePct: Math.round(tile.change * 100) / 100,
            price: tile.price,
            volume: tile.volume,
            volumeSpike: tile.volumeSpike || null,
            setupType: opp?.setupType || (isLong ? 'momentum' : 'momentum_short'),
            setupLabel: opp?.setupLabel || (isLong ? 'Momentum' : 'Momentum'),
            whyMatters: buildWhyMatters(tile, opp, isLong),
            hasLiveSignal: !!opp,
            signalId: opp?.id || opp?.signalId || null,
            isCrypto: tile.sector === 'Crypto' || tile.sector === 'DEX',
            aiScore: opp?.aiScore || null
        };
    });
}

// ═══════════════════════════════════════════════════════════
// TOP MOVERS BREAKDOWN — 3 winners + 3 losers with mini-explanations
// ═══════════════════════════════════════════════════════════
function buildTopMovers(tiles) {
    const sorted = [...tiles].sort((a, b) => b.change - a.change);
    const winners = sorted.slice(0, 3);
    const losers = sorted.slice(-3).reverse();

    const annotate = (t, isWinner) => ({
        symbol: t.symbol,
        name: t.name || t.symbol,
        changePct: Math.round(t.change * 100) / 100,
        price: t.price,
        volume: t.volume,
        sector: t.sector,
        why: isWinner
            ? `Up ${t.change.toFixed(2)}% — top gainer in this scan`
            : `Down ${Math.abs(t.change).toFixed(2)}% — leading the decline`,
        isCrypto: t.sector === 'Crypto' || t.sector === 'DEX'
    });

    return {
        winners: winners.map(t => annotate(t, true)),
        losers:  losers.map(t => annotate(t, false))
    };
}

// ═══════════════════════════════════════════════════════════
// FILTER TILES — applies user filters before everything else
// ═══════════════════════════════════════════════════════════
function applyFilters(tiles, filters = {}) {
    let result = tiles;
    if (filters.minAbsMove) {
        const m = Number(filters.minAbsMove);
        result = result.filter(t => Math.abs(t.change) >= m);
    }
    if (filters.minVolumeSpike) {
        const v = Number(filters.minVolumeSpike);
        result = result.filter(t => (t.volumeSpike || 1) >= v);
    }
    if (filters.sectors && filters.sectors.length > 0) {
        const set = new Set(filters.sectors);
        result = result.filter(t => set.has(t.sector));
    }
    return result;
}

// ═══════════════════════════════════════════════════════════
// MAIN — getPulseSnapshot returns the full state for /api/pulse
// ═══════════════════════════════════════════════════════════
async function getPulseSnapshot({ assetType = 'stocks', timeframe = '24h', filters = {} } = {}) {
    let raw;
    try {
        raw = assetType === 'crypto'
            ? await heatmapService.getCryptoHeatmap()
            : await heatmapService.getStockHeatmap();
    } catch (e) {
        console.error('[MarketPulse] Heatmap fetch failed:', e.message);
        raw = { items: [], stats: {}, lastUpdated: new Date().toISOString() };
    }

    const allTiles = (raw.items || []).map(t => ({
        ...t,
        change: typeof t.change === 'number' ? t.change : parseFloat(t.change) || 0
    }));

    const filteredTiles = applyFilters(allTiles, filters);

    const sentiment = computeSentiment(filteredTiles);
    const insight = buildInsight(sentiment, filteredTiles, assetType);
    const tradeableMovers = await selectTradeableMovers(filteredTiles, 6);
    const topMovers = buildTopMovers(filteredTiles);

    // Group tiles by sector for treemap layout (stocks only)
    const sectors = [];
    if (assetType === 'stocks') {
        const sectorMap = new Map();
        filteredTiles.forEach(t => {
            const sec = t.sector || 'Other';
            if (!sectorMap.has(sec)) sectorMap.set(sec, []);
            sectorMap.get(sec).push(t);
        });
        for (const [name, list] of sectorMap.entries()) {
            sectors.push({
                name,
                tileCount: list.length,
                marketCap: list.reduce((s, t) => s + (t.marketCap || 0), 0),
                tiles: list
            });
        }
        sectors.sort((a, b) => b.tileCount - a.tileCount);
    } else {
        sectors.push({
            name: 'Crypto',
            tileCount: filteredTiles.length,
            marketCap: filteredTiles.reduce((s, t) => s + (t.marketCap || 0), 0),
            tiles: filteredTiles
        });
    }

    return {
        success: true,
        timeframe,
        assetType,
        refreshedAt: new Date().toISOString(),
        sentiment,
        insight,
        tradeableMovers,
        topMovers,
        treemap: {
            totalTiles: filteredTiles.length,
            sectors
        },
        opportunityCount: (await opportunityEngine.getOpportunities({}).catch(() => [])).length
    };
}

module.exports = {
    getPulseSnapshot,
    computeSentiment,
    buildInsight,
    selectTradeableMovers,
    buildTopMovers
};
