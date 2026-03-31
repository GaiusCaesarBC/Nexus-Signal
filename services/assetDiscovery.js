// services/assetDiscovery.js — Smart Asset Discovery Pipeline
// Hybrid selection: Liquidity → Movement → Multi-Bucket → Scoring
// Produces ranked candidate lists for the hourly signal scan.

const axios = require('axios');

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// ═══════════════════════════════════════════════════════════
// CONFIGURATION (tunable thresholds)
// ═══════════════════════════════════════════════════════════
const CONFIG = {
    crypto: {
        minVolume24h: 5_000_000,      // $5M minimum 24h volume
        minMarketCap: 10_000_000,     // $10M minimum market cap
        minPrice: 0.0000001,          // filter dead coins
        maxResults: 15,               // max crypto candidates per cycle
        topPoolSize: 80,              // initial pool to fetch
    },
    stocks: {
        minVolume24h: 1_000_000,      // 1M shares minimum daily volume
        minPrice: 2.00,               // no penny stocks
        maxPrice: 10_000,             // sanity cap
        maxTickerLength: 5,           // filter warrants (RMSGW, etc.)
        maxResults: 15,               // max stock candidates per cycle
    },
    // Stablecoins and wrapped tokens to exclude
    excludeSymbols: new Set([
        'USDT','USDC','BUSD','DAI','TUSD','USDP','GUSD','FRAX','LUSD','USD1',
        'FDUSD','PYUSD','EURC','USDD','CEUR','WBTC','WETH','STETH','WSTETH',
        'CBETH','RETH','WEETH','EZETH','BETH'
    ]),
    // Scoring weights
    weights: {
        liquidity: 0.20,    // base liquidity score
        movement: 0.25,     // 24h % change magnitude
        relVolume: 0.25,    // volume relative to average (spike detection)
        momentum: 0.20,     // short-term trend consistency
        volatility: 0.10,   // intraday range
    }
};

// ═══════════════════════════════════════════════════════════
// CRYPTO DISCOVERY
// ═══════════════════════════════════════════════════════════

/**
 * Fetch top crypto by volume from CryptoCompare with full market data
 */
async function fetchCryptoPool() {
    // Try CryptoCompare first
    try {
        const res = await axios.get(
            `https://min-api.cryptocompare.com/data/top/totalvolfull?limit=${CONFIG.crypto.topPoolSize}&tsym=USD`,
            { timeout: 12000 }
        );

        const rawData = res.data?.Data;
        if (Array.isArray(rawData) && rawData.length > 0) {
            const coins = rawData.map(c => {
                const info = c.CoinInfo || {};
                const raw = c.RAW?.USD || {};
                return {
                    symbol: info.Name,
                    name: info.FullName,
                    price: raw.PRICE || 0,
                    volume24h: raw.TOTALVOLUME24HTO || 0,
                    marketCap: raw.MKTCAP || 0,
                    change24h: raw.CHANGEPCT24HOUR || 0,
                    changeDay: raw.CHANGEDAY || 0,
                    high24h: raw.HIGH24HOUR || 0,
                    low24h: raw.LOW24HOUR || 0,
                    open24h: raw.OPEN24HOUR || 0,
                    supply: raw.SUPPLY || 0,
                };
            });
            console.log(`[Discovery] Fetched ${coins.length} crypto from CryptoCompare`);
            return coins;
        }
        console.warn('[Discovery] CryptoCompare returned empty/invalid Data:', typeof rawData, JSON.stringify(rawData)?.slice(0, 200));
    } catch (err) {
        console.error('[Discovery] CryptoCompare failed:', err.message);
    }

    // Fallback: CoinGecko markets endpoint
    try {
        console.log('[Discovery] Trying CoinGecko fallback for crypto pool...');
        const res = await axios.get(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=${CONFIG.crypto.topPoolSize}&page=1&sparkline=false&price_change_percentage=24h`,
            { timeout: 12000 }
        );
        if (Array.isArray(res.data) && res.data.length > 0) {
            const coins = res.data.map(c => ({
                symbol: (c.symbol || '').toUpperCase(),
                name: c.name,
                price: c.current_price || 0,
                volume24h: c.total_volume || 0,
                marketCap: c.market_cap || 0,
                change24h: c.price_change_percentage_24h || 0,
                changeDay: c.price_change_24h || 0,
                high24h: c.high_24h || 0,
                low24h: c.low_24h || 0,
                open24h: 0,
                supply: c.circulating_supply || 0,
            }));
            console.log(`[Discovery] CoinGecko fallback: ${coins.length} crypto fetched`);
            return coins;
        }
        console.warn('[Discovery] CoinGecko also returned empty data');
    } catch (fallbackErr) {
        console.error('[Discovery] CoinGecko fallback also failed:', fallbackErr.message);
    }

    // Last resort: Binance US top volume (low liquidity exchange, mark source)
    try {
        console.log('[Discovery] Trying Binance US fallback...');
        const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr', { timeout: 10000 });
        if (Array.isArray(res.data)) {
            const usdtPairs = res.data
                .filter(t => t.symbol?.endsWith('USDT') && parseFloat(t.quoteVolume) > 0)
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, CONFIG.crypto.topPoolSize);
            const coins = usdtPairs.map(t => ({
                symbol: t.symbol.replace('USDT', ''),
                name: t.symbol.replace('USDT', ''),
                price: parseFloat(t.lastPrice) || 0,
                volume24h: parseFloat(t.quoteVolume) || 0,
                marketCap: 0,
                change24h: parseFloat(t.priceChangePercent) || 0,
                changeDay: parseFloat(t.priceChange) || 0,
                high24h: parseFloat(t.highPrice) || 0,
                low24h: parseFloat(t.lowPrice) || 0,
                open24h: parseFloat(t.openPrice) || 0,
                supply: 0,
                _source: 'binance-us', // flag for relaxed filtering
            }));
            console.log(`[Discovery] Binance US fallback: ${coins.length} crypto fetched`);
            return coins;
        }
    } catch (binanceErr) {
        console.error('[Discovery] Binance US fallback also failed:', binanceErr.message);
    }

    console.error('[Discovery] All crypto sources failed — 0 candidates');
    return [];
}

/**
 * Fetch hourly OHLCV for momentum calculation
 */
async function fetchCryptoHourly(symbol, hours = 12) {
    try {
        const res = await axios.get(
            `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol}&tsym=USD&limit=${hours}`,
            { timeout: 5000 }
        );
        return res.data?.Data?.Data || [];
    } catch (e) {
        return [];
    }
}

/**
 * Filter + score crypto assets
 */
async function discoverCrypto() {
    const pool = await fetchCryptoPool();

    // STEP 1: Liquidity filter (relaxed for Binance US which has low volumes + no market cap)
    const isBinanceFallback = pool.length > 0 && pool[0]._source === 'binance-us';
    const minVol = isBinanceFallback ? 10_000 : CONFIG.crypto.minVolume24h;       // $10K for Binance US vs $5M
    const minMcap = isBinanceFallback ? 0 : CONFIG.crypto.minMarketCap;           // skip mcap check for Binance
    const filtered = pool.filter(c =>
        !CONFIG.excludeSymbols.has(c.symbol) &&
        c.volume24h >= minVol &&
        c.marketCap >= minMcap &&
        c.price >= CONFIG.crypto.minPrice
    );
    if (isBinanceFallback) console.log(`[Discovery] Using relaxed filters for Binance US data (minVol=$${minVol.toLocaleString()})`);

    console.log(`[Discovery] Crypto: ${pool.length} → ${filtered.length} after liquidity filter`);

    // STEP 2: Enrich with momentum data (sample top candidates)
    const topByActivity = filtered
        .sort((a, b) => Math.abs(b.change24h) * b.volume24h - Math.abs(a.change24h) * a.volume24h)
        .slice(0, 30);

    const enriched = [];
    for (const coin of topByActivity) {
        const bars = await fetchCryptoHourly(coin.symbol, 12);
        const momentum = calculateMomentum(bars, coin);
        enriched.push({ ...coin, ...momentum });
        await new Promise(r => setTimeout(r, 200)); // rate limit
    }

    // STEP 3: Score and bucket
    const scored = enriched.map(c => {
        const scores = scoreCrypto(c);
        const bucket = assignBucket(c);
        const reasons = buildReasons(c, bucket);
        return { ...c, ...scores, bucket, reasons, assetType: 'crypto' };
    });

    // STEP 4: Sort by composite score, return top N
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const candidates = scored.slice(0, CONFIG.crypto.maxResults);

    console.log(`[Discovery] Crypto candidates: ${candidates.map(c => `${c.symbol}(${c.bucket[0]})`).join(', ')}`);
    return candidates;
}

// ═══════════════════════════════════════════════════════════
// STOCK DISCOVERY
// ═══════════════════════════════════════════════════════════

/**
 * Fetch stocks from Alpha Vantage: gainers + losers + most active
 */
async function fetchStockPool() {
    const all = new Map();

    try {
        if (!ALPHA_VANTAGE_KEY) throw new Error('No Alpha Vantage key');
        const res = await axios.get(
            `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_KEY}`,
            { timeout: 10000 }
        );

        const sources = [
            { list: res.data?.top_gainers || [], tag: 'gainer' },
            { list: res.data?.top_losers || [], tag: 'loser' },
            { list: res.data?.most_actively_traded || [], tag: 'active' },
        ];

        for (const { list, tag } of sources) {
            for (const s of list) {
                if (all.has(s.ticker)) {
                    all.get(s.ticker).tags.push(tag);
                    continue;
                }
                all.set(s.ticker, {
                    symbol: s.ticker,
                    price: parseFloat(s.price) || 0,
                    change24h: parseFloat(s.change_percentage) || 0,
                    volume24h: parseInt(s.volume) || 0,
                    changeAmount: parseFloat(s.change_amount) || 0,
                    tags: [tag],
                });
            }
        }
    } catch (err) {
        console.error('[Discovery] Alpha Vantage failed:', err.message);
    }

    console.log(`[Discovery] Fetched ${all.size} stocks from Alpha Vantage`);
    return Array.from(all.values());
}

/**
 * Get Finnhub quote for a stock (for relative volume + intraday data)
 */
async function fetchStockQuote(symbol) {
    if (!FINNHUB_KEY) return null;
    try {
        const res = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
            { timeout: 5000 }
        );
        // c=current, h=high, l=low, o=open, pc=prev close, dp=change%
        return res.data;
    } catch (e) {
        return null;
    }
}

/**
 * Filter + score stock assets
 */
async function discoverStocks() {
    const pool = await fetchStockPool();

    // STEP 1: Liquidity + quality filter
    const filtered = pool.filter(s =>
        s.price >= CONFIG.stocks.minPrice &&
        s.price <= CONFIG.stocks.maxPrice &&
        s.volume24h >= CONFIG.stocks.minVolume24h &&
        s.symbol.length <= CONFIG.stocks.maxTickerLength &&
        !s.symbol.includes('^') &&      // no warrants
        !s.symbol.includes('.') &&      // no foreign listings
        !/[A-Z]{5,}/.test(s.symbol)     // skip very long tickers (warrants)
    );

    console.log(`[Discovery] Stocks: ${pool.length} → ${filtered.length} after quality filter`);

    // STEP 2: Enrich top candidates with Finnhub data
    const topByActivity = filtered
        .sort((a, b) => Math.abs(b.change24h) * Math.log(b.volume24h + 1) - Math.abs(a.change24h) * Math.log(a.volume24h + 1))
        .slice(0, 25);

    const enriched = [];
    for (const stock of topByActivity) {
        const quote = await fetchStockQuote(stock.symbol);
        if (quote && quote.c > 0) {
            const dayRange = quote.h - quote.l;
            const avgRange = quote.pc > 0 ? (dayRange / quote.pc) * 100 : 0;
            enriched.push({
                ...stock,
                currentPrice: quote.c,
                high: quote.h,
                low: quote.l,
                open: quote.o,
                prevClose: quote.pc,
                dayRange,
                avgRange,
                // Estimate relative volume (compare to what we'd expect)
                relativeVolume: stock.volume24h > 0 ? Math.min(stock.volume24h / 5_000_000, 5) : 1,
            });
        } else {
            enriched.push({
                ...stock,
                currentPrice: stock.price,
                high: stock.price * 1.02,
                low: stock.price * 0.98,
                open: stock.price,
                prevClose: stock.price,
                dayRange: stock.price * 0.04,
                avgRange: 2,
                relativeVolume: 1,
            });
        }
        await new Promise(r => setTimeout(r, 300)); // Finnhub rate limit
    }

    // STEP 3: Score and bucket
    const scored = enriched.map(s => {
        const scores = scoreStock(s);
        const bucket = assignBucketStock(s);
        const reasons = buildReasonsStock(s, bucket);
        return { ...s, ...scores, bucket, reasons, assetType: 'stock' };
    });

    // STEP 4: Sort and return
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const candidates = scored.slice(0, CONFIG.stocks.maxResults);

    console.log(`[Discovery] Stock candidates: ${candidates.map(s => `${s.symbol}(${s.bucket[0]})`).join(', ')}`);
    return candidates;
}

// ═══════════════════════════════════════════════════════════
// MOMENTUM CALCULATION
// ═══════════════════════════════════════════════════════════

function calculateMomentum(bars, coin) {
    if (!bars || bars.length < 4) {
        return { momentum: 0, relativeVolume: 1, volatility: 0, trendConsistency: 0 };
    }

    // Recent bars (last 6h) vs older bars (6-12h ago)
    const mid = Math.floor(bars.length / 2);
    const recentBars = bars.slice(mid);
    const olderBars = bars.slice(0, mid);

    // Momentum: are recent bars consistently moving in one direction?
    let upBars = 0, downBars = 0;
    for (const b of recentBars) {
        if (b.close > b.open) upBars++;
        else downBars++;
    }
    const trendConsistency = Math.abs(upBars - downBars) / recentBars.length;
    const momentumDir = upBars > downBars ? 1 : -1;

    // Relative volume: recent volume vs older volume
    const recentVol = recentBars.reduce((s, b) => s + (b.volumeto || 0), 0);
    const olderVol = olderBars.reduce((s, b) => s + (b.volumeto || 0), 0);
    const relativeVolume = olderVol > 0 ? recentVol / olderVol : 1;

    // Volatility: average bar range as % of price
    const ranges = bars.map(b => b.high > 0 ? (b.high - b.low) / b.high * 100 : 0);
    const volatility = ranges.reduce((s, r) => s + r, 0) / ranges.length;

    // Speed: price change over recent bars
    const recentChange = recentBars.length > 0
        ? ((recentBars[recentBars.length - 1].close - recentBars[0].open) / recentBars[0].open) * 100
        : 0;

    return {
        momentum: recentChange * momentumDir,
        relativeVolume: Math.max(0.1, Math.min(relativeVolume, 10)),
        volatility,
        trendConsistency,
        recentChange,
    };
}

// ═══════════════════════════════════════════════════════════
// SCORING MODELS
// ═══════════════════════════════════════════════════════════

function scoreCrypto(c) {
    const w = CONFIG.weights;

    // Liquidity: log-scaled volume score (0-10)
    const liquidityScore = Math.min(10, Math.log10(Math.max(c.volume24h, 1)) - 5); // 100K=0, 10B=5

    // Movement: absolute % change, capped (0-10)
    const movementScore = Math.min(10, Math.abs(c.change24h) * 0.8);

    // Relative volume spike (0-10)
    const relVolScore = Math.min(10, (c.relativeVolume || 1) * 3);

    // Momentum consistency (0-10)
    const momentumScore = Math.min(10, (c.trendConsistency || 0) * 10 + Math.abs(c.recentChange || 0) * 0.5);

    // Volatility (0-10) — some volatility is good, too much is noise
    const volScore = Math.min(10, Math.max(0, (c.volatility || 0) * 3 - 0.5));

    const compositeScore =
        liquidityScore * w.liquidity +
        movementScore * w.movement +
        relVolScore * w.relVolume +
        momentumScore * w.momentum +
        volScore * w.volatility;

    return {
        liquidityScore: +liquidityScore.toFixed(1),
        movementScore: +movementScore.toFixed(1),
        relVolScore: +relVolScore.toFixed(1),
        momentumScore: +momentumScore.toFixed(1),
        volatilityScore: +volScore.toFixed(1),
        compositeScore: +compositeScore.toFixed(2),
    };
}

function scoreStock(s) {
    const w = CONFIG.weights;

    const liquidityScore = Math.min(10, Math.log10(Math.max(s.volume24h, 1)) - 5);
    const movementScore = Math.min(10, Math.abs(s.change24h) * 0.6);
    const relVolScore = Math.min(10, (s.relativeVolume || 1) * 2.5);
    const momentumScore = Math.min(10, s.tags?.length * 3 || 0); // appears in multiple AV lists = interesting
    const volScore = Math.min(10, (s.avgRange || 0) * 2);

    const compositeScore =
        liquidityScore * w.liquidity +
        movementScore * w.movement +
        relVolScore * w.relVolume +
        momentumScore * w.momentum +
        volScore * w.volatility;

    return {
        liquidityScore: +liquidityScore.toFixed(1),
        movementScore: +movementScore.toFixed(1),
        relVolScore: +relVolScore.toFixed(1),
        momentumScore: +momentumScore.toFixed(1),
        volatilityScore: +volScore.toFixed(1),
        compositeScore: +compositeScore.toFixed(2),
    };
}

// ═══════════════════════════════════════════════════════════
// BUCKET ASSIGNMENT
// ═══════════════════════════════════════════════════════════

function assignBucket(c) {
    const absChange = Math.abs(c.change24h);
    const rv = c.relativeVolume || 1;
    const tc = c.trendConsistency || 0;

    // Trending: strong move + consistent direction + decent volume
    if (absChange > 3 && tc > 0.5 && rv > 0.8) return 'Trending';

    // Breakout Watch: volume spike + starting to move
    if (rv > 1.5 && absChange > 1 && absChange < 8) return 'Breakout Watch';

    // Reversal: big move already happened + momentum fading
    if (absChange > 6 && tc < 0.4) return 'Reversal Setup';

    // Default based on movement
    if (absChange > 2) return 'Trending';
    if (rv > 1.2) return 'Breakout Watch';
    return 'Watchlist';
}

function assignBucketStock(s) {
    const absChange = Math.abs(s.change24h);
    const rv = s.relativeVolume || 1;

    if (absChange > 4 && rv > 1.5) return 'Trending';
    if (rv > 2 && absChange > 1.5 && absChange < 10) return 'Breakout Watch';
    if (absChange > 8 && s.tags?.includes('loser')) return 'Reversal Setup';
    if (absChange > 8 && s.tags?.includes('gainer')) return 'Trending';
    if (absChange > 2) return 'Trending';
    if (rv > 1.3) return 'Breakout Watch';
    return 'Watchlist';
}

// ═══════════════════════════════════════════════════════════
// REASON BUILDER
// ═══════════════════════════════════════════════════════════

function buildReasons(c, bucket) {
    const parts = [];
    if (c.volume24h > 100_000_000) parts.push('high liquidity');
    else if (c.volume24h > 20_000_000) parts.push('strong liquidity');
    else parts.push('adequate liquidity');

    if (Math.abs(c.change24h) > 5) parts.push(`${c.change24h > 0 ? 'strong upward' : 'strong downward'} move (${c.change24h.toFixed(1)}%)`);
    else if (Math.abs(c.change24h) > 2) parts.push(`${c.change24h > 0 ? 'upward' : 'downward'} movement`);

    if ((c.relativeVolume || 1) > 1.5) parts.push('volume spike detected');
    if ((c.trendConsistency || 0) > 0.6) parts.push('consistent trend direction');
    if ((c.volatility || 0) > 1) parts.push('elevated volatility');

    return `${bucket} — ${parts.join(' + ')}`;
}

function buildReasonsStock(s, bucket) {
    const parts = [];
    if (s.volume24h > 50_000_000) parts.push('very high volume');
    else if (s.volume24h > 10_000_000) parts.push('strong volume');
    else parts.push('adequate volume');

    if (Math.abs(s.change24h) > 5) parts.push(`${s.change24h > 0 ? 'surging' : 'dropping'} (${s.change24h.toFixed(1)}%)`);
    else if (Math.abs(s.change24h) > 2) parts.push(`${s.change24h > 0 ? 'rising' : 'falling'}`);

    if ((s.relativeVolume || 1) > 2) parts.push('unusual volume activity');
    if (s.tags?.length > 1) parts.push('appears in multiple screeners');
    if ((s.avgRange || 0) > 3) parts.push('wide intraday range');

    return `${bucket} — ${parts.join(' + ')}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN DISCOVERY FUNCTION
// ═══════════════════════════════════════════════════════════

/**
 * Run full discovery pipeline. Returns { stocks: [...], crypto: [...] }
 * Each item has: symbol, price, compositeScore, bucket, reasons, assetType
 */
async function discoverAssets() {
    console.log('[Discovery] ════════════════════════════════════');
    console.log('[Discovery] Starting asset discovery pipeline...');

    const [cryptoCandidates, stockCandidates] = await Promise.all([
        discoverCrypto(),
        discoverStocks(),
    ]);

    const totalCandidates = cryptoCandidates.length + stockCandidates.length;
    console.log(`[Discovery] Pipeline complete: ${stockCandidates.length} stocks + ${cryptoCandidates.length} crypto = ${totalCandidates} candidates`);

    // Log bucket distribution
    const buckets = {};
    [...stockCandidates, ...cryptoCandidates].forEach(c => {
        buckets[c.bucket] = (buckets[c.bucket] || 0) + 1;
    });
    console.log(`[Discovery] Buckets: ${Object.entries(buckets).map(([k,v])=>`${k}=${v}`).join(', ')}`);
    console.log('[Discovery] ════════════════════════════════════');

    return { stocks: stockCandidates, crypto: cryptoCandidates };
}

module.exports = {
    discoverAssets,
    discoverCrypto,
    discoverStocks,
    CONFIG,
};
