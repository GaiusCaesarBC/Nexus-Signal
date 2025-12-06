// server/services/pancakeSwapService.js - BSC DEX Token Service via DexScreener
// Fetches top BSC tokens from DexScreener API (FREE - no API key required)

const axios = require('axios');

class PancakeSwapService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
        this.DEXSCREENER_BASE = 'https://api.dexscreener.com';
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
     * Get top BSC tokens from DexScreener
     * Returns tokens with price data and 24h changes
     */
    async getTopTokens(limit = 100) {
        const cacheKey = `dexscreener-bsc-tokens-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log('[DexScreener] Returning cached tokens:', cached.length);
            return cached;
        }

        console.log('[DexScreener] Fetching fresh BSC token data...');

        try {
            // Get top token boosts/trending tokens
            const [boostsResponse, bscPairsResponse] = await Promise.all([
                axios.get(`${this.DEXSCREENER_BASE}/token-boosts/top/v1`, {
                    timeout: 15000
                }).catch(() => ({ data: [] })),
                // Get latest pairs on BSC with good volume
                axios.get(`${this.DEXSCREENER_BASE}/latest/dex/pairs/bsc`, {
                    timeout: 15000
                }).catch(() => ({ data: { pairs: [] } }))
            ]);

            const boosts = boostsResponse.data || [];
            const bscPairs = bscPairsResponse.data?.pairs || [];

            console.log(`[DexScreener] Got ${boosts.length} boosted tokens, ${bscPairs.length} BSC pairs`);

            // Process boosted tokens that are on BSC
            const bscBoosts = boosts.filter(t => t.chainId === 'bsc');

            // Get detailed pair data for boosted BSC tokens
            const tokenAddresses = bscBoosts.slice(0, 30).map(t => t.tokenAddress);
            let detailedTokens = [];

            if (tokenAddresses.length > 0) {
                try {
                    // DexScreener allows comma-separated addresses
                    const addressChunks = this.chunkArray(tokenAddresses, 10);

                    for (const chunk of addressChunks) {
                        const response = await axios.get(
                            `${this.DEXSCREENER_BASE}/latest/dex/tokens/${chunk.join(',')}`,
                            { timeout: 15000 }
                        );

                        if (response.data?.pairs) {
                            detailedTokens.push(...response.data.pairs);
                        }
                    }
                } catch (err) {
                    console.log('[DexScreener] Error fetching token details:', err.message);
                }
            }

            // Combine BSC pairs data
            const allPairs = [...detailedTokens, ...bscPairs];

            // Deduplicate by base token address, keeping highest liquidity pair
            const tokenMap = new Map();

            for (const pair of allPairs) {
                if (pair.chainId !== 'bsc') continue;

                const baseToken = pair.baseToken;
                if (!baseToken?.address) continue;

                const existing = tokenMap.get(baseToken.address);
                const liquidity = pair.liquidity?.usd || 0;

                if (!existing || liquidity > (existing.liquidity?.usd || 0)) {
                    tokenMap.set(baseToken.address, pair);
                }
            }

            // Convert to array and format
            const tokens = Array.from(tokenMap.values())
                .filter(pair => {
                    const liquidity = pair.liquidity?.usd || 0;
                    const volume = pair.volume?.h24 || 0;
                    const price = parseFloat(pair.priceUsd) || 0;
                    // Filter out dust tokens
                    return liquidity > 1000 && price > 0;
                })
                .map(pair => this.formatPairData(pair))
                .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
                .slice(0, limit);

            console.log(`[DexScreener] Processed ${tokens.length} BSC tokens`);

            this.setCache(cacheKey, tokens);
            return tokens;

        } catch (error) {
            console.error('[DexScreener] Error fetching tokens:', error.message);
            return [];
        }
    }

    /**
     * Format DexScreener pair data to our standard format
     */
    formatPairData(pair) {
        const baseToken = pair.baseToken || {};
        const priceUsd = parseFloat(pair.priceUsd) || 0;
        const priceChange24h = pair.priceChange?.h24 || 0;
        const volume24h = pair.volume?.h24 || 0;
        const liquidity = pair.liquidity?.usd || 0;
        const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

        // Calculate absolute price change
        const priceChange = priceUsd * (priceChange24h / 100);

        return {
            id: baseToken.address,
            symbol: baseToken.symbol?.toUpperCase() || 'UNKNOWN',
            name: baseToken.name || baseToken.symbol || 'Unknown Token',
            price: priceUsd,
            change: priceChange,
            changePercent: priceChange24h,
            volume: volume24h,
            tvl: liquidity,
            txCount: txns24h,
            source: 'dexscreener',
            chain: 'BSC',
            contractAddress: baseToken.address,
            pairAddress: pair.pairAddress,
            dexId: pair.dexId || 'pancakeswap'
        };
    }

    /**
     * Helper to chunk array
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
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
            const isAddress = query.startsWith('0x') && query.length === 42;

            if (isAddress) {
                // Search by address
                const response = await axios.get(
                    `${this.DEXSCREENER_BASE}/latest/dex/tokens/${query}`,
                    { timeout: 10000 }
                );

                const pairs = response.data?.pairs || [];
                const bscPairs = pairs.filter(p => p.chainId === 'bsc');

                if (bscPairs.length === 0) return [];

                // Return the highest liquidity pair
                const bestPair = bscPairs.reduce((best, pair) =>
                    (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best
                );

                return [this.formatPairData(bestPair)];
            } else {
                // Search by symbol - use the search endpoint
                const response = await axios.get(
                    `${this.DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`,
                    { timeout: 10000 }
                );

                const pairs = response.data?.pairs || [];
                const bscPairs = pairs.filter(p =>
                    p.chainId === 'bsc' &&
                    p.baseToken?.symbol?.toUpperCase().includes(query.toUpperCase())
                );

                // Deduplicate by token address
                const tokenMap = new Map();
                for (const pair of bscPairs) {
                    const addr = pair.baseToken?.address;
                    if (!addr) continue;

                    const existing = tokenMap.get(addr);
                    if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
                        tokenMap.set(addr, pair);
                    }
                }

                return Array.from(tokenMap.values())
                    .slice(0, 10)
                    .map(pair => this.formatPairData(pair));
            }

        } catch (error) {
            console.error('[DexScreener] Search error:', error.message);
            return [];
        }
    }
}

module.exports = new PancakeSwapService();
