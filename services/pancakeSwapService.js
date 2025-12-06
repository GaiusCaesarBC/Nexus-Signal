// server/services/pancakeSwapService.js - PancakeSwap DEX Token Service
// Fetches top BSC tokens from PancakeSwap V3 via The Graph

const axios = require('axios');

class PancakeSwapService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (DEX data changes fast)
    }

    // Lazy getter for endpoint - ensures env vars are loaded
    getEndpoint() {
        const apiKey = process.env.THE_GRAPH_API_KEY;
        const subgraphId = process.env.PANCAKESWAP_V3_SUBGRAPH_ID || 'A1fvJWQLBeUAggX2WQTMm3FKjXTekNXo77ZySun4YN2m';

        if (!apiKey) {
            return null;
        }
        return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
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
     * Get top tokens by volume from PancakeSwap
     * Returns tokens with price data and 24h changes
     */
    async getTopTokens(limit = 100) {
        const endpoint = this.getEndpoint();
        console.log('[PancakeSwap] getTopTokens called, endpoint:', endpoint ? 'configured' : 'NOT configured');

        if (!endpoint) {
            console.log('[PancakeSwap] No API key configured - THE_GRAPH_API_KEY:', process.env.THE_GRAPH_API_KEY ? 'set' : 'NOT set');
            return [];
        }

        const cacheKey = `top-tokens-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log('[PancakeSwap] Returning cached tokens:', cached.length);
            return cached;
        }

        console.log('[PancakeSwap] Fetching fresh data from The Graph...');
        try {
            // Query for tokens with highest TVL (Total Value Locked)
            // This gives us the most liquid/traded tokens
            const query = `
                query GetTopTokens {
                    tokens(
                        first: ${limit},
                        orderBy: totalValueLockedUSD,
                        orderDirection: desc,
                        where: {
                            totalValueLockedUSD_gt: "1000",
                            derivedUSD_gt: "0"
                        }
                    ) {
                        id
                        symbol
                        name
                        decimals
                        derivedUSD
                        totalValueLockedUSD
                        volumeUSD
                        txCount
                    }
                }
            `;

            const response = await axios.post(
                endpoint,
                { query },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );

            if (response.data.errors) {
                console.error('[PancakeSwap] GraphQL error:', response.data.errors[0]?.message);
                return [];
            }

            const tokens = response.data?.data?.tokens || [];
            console.log(`[PancakeSwap] Fetched ${tokens.length} tokens`);

            // Get token day data for price changes
            const tokensWithChanges = await this.addPriceChanges(tokens, endpoint);

            this.setCache(cacheKey, tokensWithChanges);
            return tokensWithChanges;

        } catch (error) {
            console.error('[PancakeSwap] Error fetching tokens:', error.message);
            return [];
        }
    }

    /**
     * Add 24h price change data to tokens
     */
    async addPriceChanges(tokens, endpoint) {
        if (!tokens.length || !endpoint) return [];

        try {
            // Get timestamp for 24 hours ago
            const timestamp24hAgo = Math.floor(Date.now() / 1000) - 86400;

            // Query for token day data to get price changes
            const tokenIds = tokens.slice(0, 50).map(t => `"${t.id}"`).join(',');

            const query = `
                query GetTokenDayData {
                    tokenDayDatas(
                        first: 100,
                        orderBy: date,
                        orderDirection: desc,
                        where: {
                            token_in: [${tokenIds}],
                            date_gte: ${timestamp24hAgo}
                        }
                    ) {
                        token {
                            id
                        }
                        date
                        priceUSD
                        volumeUSD
                        open
                        high
                        low
                        close
                    }
                }
            `;

            const response = await axios.post(
                endpoint,
                { query },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );

            // Build a map of token prices from day data
            const priceMap = new Map();
            const dayData = response.data?.data?.tokenDayDatas || [];

            for (const data of dayData) {
                const tokenId = data.token?.id;
                if (!tokenId) continue;

                if (!priceMap.has(tokenId)) {
                    priceMap.set(tokenId, {
                        currentPrice: parseFloat(data.close) || parseFloat(data.priceUSD) || 0,
                        openPrice: parseFloat(data.open) || 0,
                        high24h: parseFloat(data.high) || 0,
                        low24h: parseFloat(data.low) || 0,
                        volume24h: parseFloat(data.volumeUSD) || 0
                    });
                }
            }

            // Format tokens with price change data
            return tokens.map(token => {
                const dayInfo = priceMap.get(token.id) || {};
                const currentPrice = parseFloat(token.derivedUSD) || 0;
                const openPrice = dayInfo.openPrice || currentPrice;

                // Calculate 24h change
                let priceChange24h = 0;
                let priceChangePercent24h = 0;

                if (openPrice > 0 && currentPrice > 0) {
                    priceChange24h = currentPrice - openPrice;
                    priceChangePercent24h = ((currentPrice - openPrice) / openPrice) * 100;
                }

                return {
                    id: token.id,
                    symbol: token.symbol?.toUpperCase() || 'UNKNOWN',
                    name: token.name || token.symbol || 'Unknown Token',
                    price: currentPrice,
                    change: priceChange24h,
                    changePercent: priceChangePercent24h,
                    volume: dayInfo.volume24h || parseFloat(token.volumeUSD) || 0,
                    tvl: parseFloat(token.totalValueLockedUSD) || 0,
                    txCount: parseInt(token.txCount) || 0,
                    high24h: dayInfo.high24h || currentPrice,
                    low24h: dayInfo.low24h || currentPrice,
                    source: 'pancakeswap',
                    chain: 'BSC',
                    contractAddress: token.id
                };
            });

        } catch (error) {
            console.error('[PancakeSwap] Error fetching price changes:', error.message);

            // Return tokens without change data
            return tokens.map(token => ({
                id: token.id,
                symbol: token.symbol?.toUpperCase() || 'UNKNOWN',
                name: token.name || token.symbol || 'Unknown Token',
                price: parseFloat(token.derivedUSD) || 0,
                change: 0,
                changePercent: 0,
                volume: parseFloat(token.volumeUSD) || 0,
                tvl: parseFloat(token.totalValueLockedUSD) || 0,
                txCount: parseInt(token.txCount) || 0,
                source: 'pancakeswap',
                chain: 'BSC',
                contractAddress: token.id
            }));
        }
    }

    /**
     * Get top gainers from PancakeSwap
     */
    async getTopGainers(limit = 50) {
        const tokens = await this.getTopTokens(100);

        return tokens
            .filter(t => t.changePercent > 0 && t.price > 0 && t.tvl > 10000)
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit);
    }

    /**
     * Get top losers from PancakeSwap
     */
    async getTopLosers(limit = 50) {
        const tokens = await this.getTopTokens(100);

        return tokens
            .filter(t => t.changePercent < 0 && t.price > 0 && t.tvl > 10000)
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
        const endpoint = this.getEndpoint();
        if (!endpoint || !query) return [];

        try {
            const isAddress = query.startsWith('0x') && query.length === 42;

            const graphQuery = isAddress ? `
                query SearchByAddress {
                    tokens(where: { id: "${query.toLowerCase()}" }) {
                        id
                        symbol
                        name
                        derivedUSD
                        totalValueLockedUSD
                        volumeUSD
                    }
                }
            ` : `
                query SearchBySymbol {
                    tokens(
                        first: 10,
                        where: { symbol_contains_nocase: "${query}" },
                        orderBy: totalValueLockedUSD,
                        orderDirection: desc
                    ) {
                        id
                        symbol
                        name
                        derivedUSD
                        totalValueLockedUSD
                        volumeUSD
                    }
                }
            `;

            const response = await axios.post(
                endpoint,
                { query: graphQuery },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            const tokens = response.data?.data?.tokens || [];

            return tokens
                .filter(t => parseFloat(t.derivedUSD) > 0)
                .map(t => ({
                    id: t.id,
                    symbol: t.symbol?.toUpperCase(),
                    name: t.name,
                    price: parseFloat(t.derivedUSD),
                    tvl: parseFloat(t.totalValueLockedUSD),
                    volume: parseFloat(t.volumeUSD),
                    source: 'pancakeswap',
                    chain: 'BSC',
                    contractAddress: t.id
                }));

        } catch (error) {
            console.error('[PancakeSwap] Search error:', error.message);
            return [];
        }
    }
}

module.exports = new PancakeSwapService();
