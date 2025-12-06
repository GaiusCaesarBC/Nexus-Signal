// server/services/pancakeSwapService.js - BSC DEX Token Service via GeckoTerminal
// Fetches top BSC tokens from GeckoTerminal API (FREE - by CoinGecko)

const axios = require('axios');

class PancakeSwapService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
        this.GECKOTERMINAL_BASE = 'https://api.geckoterminal.com/api/v2';
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Get top BSC tokens from GeckoTerminal
     * Returns tokens with price data and 24h changes
     */
    async getTopTokens(limit = 100) {
        const cacheKey = `geckoterminal-bsc-tokens-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log('[GeckoTerminal] Returning cached tokens:', cached.length);
            return cached;
        }

        console.log('[GeckoTerminal] Fetching fresh BSC token data...');

        try {
            // Fetch multiple pages of trending and top pools in parallel
            const [trendingRes, topVolumeRes, newPoolsRes] = await Promise.all([
                axios.get(`${this.GECKOTERMINAL_BASE}/networks/bsc/trending_pools`, {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }).catch(err => {
                    console.log('[GeckoTerminal] Trending pools error:', err.message);
                    return { data: { data: [] } };
                }),
                axios.get(`${this.GECKOTERMINAL_BASE}/networks/bsc/pools?page=1&sort=h24_volume_usd_desc`, {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }).catch(err => {
                    console.log('[GeckoTerminal] Top volume error:', err.message);
                    return { data: { data: [] } };
                }),
                axios.get(`${this.GECKOTERMINAL_BASE}/networks/bsc/new_pools`, {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }).catch(err => {
                    console.log('[GeckoTerminal] New pools error:', err.message);
                    return { data: { data: [] } };
                })
            ]);

            const trendingPools = trendingRes.data?.data || [];
            const topVolumePools = topVolumeRes.data?.data || [];
            const newPools = newPoolsRes.data?.data || [];

            console.log(`[GeckoTerminal] Got ${trendingPools.length} trending, ${topVolumePools.length} top volume, ${newPools.length} new pools`);

            // Combine all pools
            const allPools = [...trendingPools, ...topVolumePools, ...newPools];

            // Deduplicate by pool address, keeping first occurrence (trending > volume > new)
            const poolMap = new Map();
            for (const pool of allPools) {
                const addr = pool.attributes?.address;
                if (addr && !poolMap.has(addr)) {
                    poolMap.set(addr, pool);
                }
            }

            // Format and filter tokens
            const tokens = Array.from(poolMap.values())
                .map(pool => this.formatPoolData(pool))
                .filter(token => {
                    // Filter out stablecoins pairs and dust tokens
                    const isStablePair = this.isStablecoinPair(token.name);
                    const hasLiquidity = token.tvl > 1000;
                    const hasPrice = token.price > 0;
                    return !isStablePair && hasLiquidity && hasPrice;
                })
                .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
                .slice(0, limit);

            console.log(`[GeckoTerminal] Processed ${tokens.length} BSC tokens`);

            this.setCache(cacheKey, tokens);
            return tokens;

        } catch (error) {
            console.error('[GeckoTerminal] Error fetching tokens:', error.message);
            return [];
        }
    }

    /**
     * Check if a pool name is a stablecoin pair (less volatile)
     */
    isStablecoinPair(name) {
        if (!name) return false;
        const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX'];
        const parts = name.split('/').map(p => p.trim().split(' ')[0].toUpperCase());

        // If both sides are stablecoins, it's a stable pair
        const stableCount = parts.filter(p => stables.includes(p)).length;
        return stableCount >= 2;
    }

    /**
     * Format GeckoTerminal pool data to our standard format
     */
    formatPoolData(pool) {
        const attrs = pool.attributes || {};
        const priceUsd = parseFloat(attrs.base_token_price_usd) || 0;
        let priceChange24h = parseFloat(attrs.price_change_percentage?.h24) || 0;
        const volume24h = parseFloat(attrs.volume_usd?.h24) || 0;
        const liquidity = parseFloat(attrs.reserve_in_usd) || 0;
        const marketCap = parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0;

        // Sanity check: Cap extreme percentage changes (GeckoTerminal sometimes returns bad data)
        // Max reasonable 24h change is ~10000% (100x) for extreme cases
        if (Math.abs(priceChange24h) > 10000) {
            console.log(`[PancakeSwap] Capping extreme change for ${attrs.name}: ${priceChange24h}% -> flagged as unreliable`);
            priceChange24h = priceChange24h > 0 ? 9999 : -99; // Cap to indicate extreme movement
        }

        const txns = attrs.transactions?.h24 || {};
        const txCount = (txns.buys || 0) + (txns.sells || 0);

        // Extract token symbol from pool name (e.g., "cBNB / WBNB" -> "cBNB")
        const poolName = attrs.name || '';
        const baseSymbol = poolName.split('/')[0]?.trim().split(' ')[0] || 'UNKNOWN';

        // Calculate absolute price change
        const priceChange = priceUsd * (priceChange24h / 100);

        // Get token address from relationships
        const baseTokenId = pool.relationships?.base_token?.data?.id || '';
        const tokenAddress = baseTokenId.replace('bsc_', '');

        return {
            id: tokenAddress,
            symbol: baseSymbol.toUpperCase(),
            name: poolName,
            price: priceUsd,
            change: priceChange,
            changePercent: priceChange24h,
            volume: volume24h,
            tvl: liquidity,
            marketCap: marketCap,
            txCount: txCount,
            source: 'geckoterminal',
            chain: 'BSC',
            contractAddress: tokenAddress,
            poolAddress: attrs.address,
            dexId: pool.relationships?.dex?.data?.id || 'pancakeswap'
        };
    }

    /**
     * Get top gainers from BSC DEX
     */
    async getTopGainers(limit = 50) {
        const tokens = await this.getTopTokens(100);

        return tokens
            .filter(t => t.changePercent > 0 && t.price > 0 && t.tvl > 5000)
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit);
    }

    /**
     * Get top losers from BSC DEX
     */
    async getTopLosers(limit = 50) {
        const tokens = await this.getTopTokens(100);

        return tokens
            .filter(t => t.changePercent < 0 && t.price > 0 && t.tvl > 5000)
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit);
    }

    /**
     * Get tokens sorted by various criteria
     */
    async getTokens(options = {}) {
        const {
            sortBy = 'tvl',
            order = 'desc',
            minTvl = 1000,
            minPrice = 0,
            limit = 50,
            changeFilter = 'all' // 'all', 'gainers', 'losers'
        } = options;

        let tokens = await this.getTopTokens(100);

        // Filter by TVL and price
        tokens = tokens.filter(t =>
            t.tvl >= minTvl &&
            t.price >= minPrice
        );

        // Filter by gainers/losers
        if (changeFilter === 'gainers') {
            tokens = tokens.filter(t => t.changePercent > 0);
        } else if (changeFilter === 'losers') {
            tokens = tokens.filter(t => t.changePercent < 0);
        }

        // Sort
        const sortFunctions = {
            tvl: (a, b) => order === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl,
            volume: (a, b) => order === 'desc' ? b.volume - a.volume : a.volume - b.volume,
            price: (a, b) => order === 'desc' ? b.price - a.price : a.price - b.price,
            changePercent: (a, b) => order === 'desc' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent,
            txCount: (a, b) => order === 'desc' ? b.txCount - a.txCount : a.txCount - b.txCount
        };

        if (sortFunctions[sortBy]) {
            tokens.sort(sortFunctions[sortBy]);
        }

        return tokens.slice(0, limit);
    }

    /**
     * Search for a specific token by symbol or address
     */
    async searchToken(query) {
        if (!query) return [];

        try {
            const response = await axios.get(
                `${this.GECKOTERMINAL_BASE}/search/pools?query=${encodeURIComponent(query)}&network=bsc`,
                {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const pools = response.data?.data || [];

            return pools
                .slice(0, 10)
                .map(pool => this.formatPoolData(pool));

        } catch (error) {
            console.error('[GeckoTerminal] Search error:', error.message);
            return [];
        }
    }
}

module.exports = new PancakeSwapService();
