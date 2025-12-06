// server/services/pancakeSwapService.js - PancakeSwap DEX Token Service
// Fetches top BSC tokens from PancakeSwap V2 via NodeReal (FREE)

const axios = require('axios');

class PancakeSwapService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (conserve API calls - 200/day limit)
        this.bnbPriceCache = { price: 0, timestamp: 0 };
    }

    // Lazy getter for endpoint - NodeReal free tier
    getEndpoint() {
        const apiKey = process.env.NODEREAL_API_KEY;

        if (!apiKey) {
            console.log('[PancakeSwap] NODEREAL_API_KEY not configured');
            return null;
        }
        return `https://open-platform.nodereal.io/${apiKey}/pancakeswap-free/graphql`;
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
     * Get BNB price in USD (needed to convert derivedETH to USD)
     */
    async getBnbPrice() {
        // Cache BNB price for 5 minutes
        if (this.bnbPriceCache.price > 0 &&
            Date.now() - this.bnbPriceCache.timestamp < 5 * 60 * 1000) {
            return this.bnbPriceCache.price;
        }

        const endpoint = this.getEndpoint();
        if (!endpoint) return 240; // Fallback BNB price

        try {
            // WBNB contract address on BSC
            const query = `
                query GetBnbPrice {
                    bundle(id: "1") {
                        ethPrice
                    }
                }
            `;

            const response = await axios.post(
                endpoint,
                { query },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            const bnbPrice = parseFloat(response.data?.data?.bundle?.ethPrice) || 240;
            this.bnbPriceCache = { price: bnbPrice, timestamp: Date.now() };
            console.log(`[PancakeSwap] BNB price: $${bnbPrice.toFixed(2)}`);
            return bnbPrice;

        } catch (error) {
            console.error('[PancakeSwap] Error fetching BNB price:', error.message);
            return this.bnbPriceCache.price || 240;
        }
    }

    /**
     * Get top tokens by liquidity from PancakeSwap V2
     * Returns tokens with price data and 24h changes
     */
    async getTopTokens(limit = 100) {
        const endpoint = this.getEndpoint();
        console.log('[PancakeSwap] getTopTokens called, endpoint:', endpoint ? 'configured' : 'NOT configured');

        if (!endpoint) {
            console.log('[PancakeSwap] No API key configured - NODEREAL_API_KEY:', process.env.NODEREAL_API_KEY ? 'set' : 'NOT set');
            return [];
        }

        const cacheKey = `top-tokens-v2-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log('[PancakeSwap] Returning cached tokens:', cached.length);
            return cached;
        }

        console.log('[PancakeSwap] Fetching fresh data from NodeReal...');
        try {
            // Get BNB price first
            const bnbPrice = await this.getBnbPrice();

            // Query for tokens with highest liquidity (V2 schema)
            const query = `
                query GetTopTokens {
                    tokens(
                        first: ${limit},
                        orderBy: tradeVolumeUSD,
                        orderDirection: desc,
                        where: {
                            tradeVolumeUSD_gt: "10000",
                            derivedETH_gt: "0"
                        }
                    ) {
                        id
                        symbol
                        name
                        decimals
                        derivedETH
                        tradeVolumeUSD
                        totalLiquidity
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
            const tokensWithChanges = await this.addPriceChanges(tokens, endpoint, bnbPrice);

            this.setCache(cacheKey, tokensWithChanges);
            return tokensWithChanges;

        } catch (error) {
            console.error('[PancakeSwap] Error fetching tokens:', error.message);
            return [];
        }
    }

    /**
     * Add 24h price change data to tokens (V2 schema)
     */
    async addPriceChanges(tokens, endpoint, bnbPrice) {
        if (!tokens.length || !endpoint) return [];

        try {
            // Get timestamp for yesterday (start of day)
            const now = Math.floor(Date.now() / 1000);
            const yesterday = now - 86400;

            // Query for token day data
            const tokenIds = tokens.slice(0, 50).map(t => `"${t.id}"`).join(',');

            const query = `
                query GetTokenDayData {
                    tokenDayDatas(
                        first: 100,
                        orderBy: date,
                        orderDirection: desc,
                        where: {
                            token_in: [${tokenIds}],
                            date_gte: ${yesterday - 86400}
                        }
                    ) {
                        token {
                            id
                        }
                        date
                        priceUSD
                        dailyVolumeUSD
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
            // We need today's price and yesterday's price to calculate change
            const priceMap = new Map();
            const dayData = response.data?.data?.tokenDayDatas || [];

            for (const data of dayData) {
                const tokenId = data.token?.id;
                if (!tokenId) continue;

                const priceUSD = parseFloat(data.priceUSD) || 0;
                const date = parseInt(data.date);
                const volume = parseFloat(data.dailyVolumeUSD) || 0;

                if (!priceMap.has(tokenId)) {
                    priceMap.set(tokenId, {
                        currentPrice: priceUSD,
                        previousPrice: 0,
                        volume24h: volume
                    });
                } else {
                    // This is an older record, use as previous price
                    const existing = priceMap.get(tokenId);
                    if (existing.previousPrice === 0) {
                        existing.previousPrice = priceUSD;
                    }
                }
            }

            // Format tokens with price change data
            return tokens.map(token => {
                const dayInfo = priceMap.get(token.id) || {};

                // Calculate current price from derivedETH * BNB price
                const derivedETH = parseFloat(token.derivedETH) || 0;
                const currentPrice = dayInfo.currentPrice || (derivedETH * bnbPrice);
                const previousPrice = dayInfo.previousPrice || currentPrice;

                // Calculate 24h change
                let priceChange24h = 0;
                let priceChangePercent24h = 0;

                if (previousPrice > 0 && currentPrice > 0) {
                    priceChange24h = currentPrice - previousPrice;
                    priceChangePercent24h = ((currentPrice - previousPrice) / previousPrice) * 100;
                }

                // Calculate liquidity in USD
                const totalLiquidity = parseFloat(token.totalLiquidity) || 0;
                const liquidityUSD = totalLiquidity * currentPrice;

                return {
                    id: token.id,
                    symbol: token.symbol?.toUpperCase() || 'UNKNOWN',
                    name: token.name || token.symbol || 'Unknown Token',
                    price: currentPrice,
                    change: priceChange24h,
                    changePercent: priceChangePercent24h,
                    volume: dayInfo.volume24h || parseFloat(token.tradeVolumeUSD) || 0,
                    tvl: liquidityUSD,
                    txCount: parseInt(token.txCount) || 0,
                    source: 'pancakeswap',
                    chain: 'BSC',
                    contractAddress: token.id
                };
            });

        } catch (error) {
            console.error('[PancakeSwap] Error fetching price changes:', error.message);

            // Return tokens without change data
            const bnbPrice = this.bnbPriceCache.price || 240;
            return tokens.map(token => {
                const derivedETH = parseFloat(token.derivedETH) || 0;
                const currentPrice = derivedETH * bnbPrice;
                const totalLiquidity = parseFloat(token.totalLiquidity) || 0;

                return {
                    id: token.id,
                    symbol: token.symbol?.toUpperCase() || 'UNKNOWN',
                    name: token.name || token.symbol || 'Unknown Token',
                    price: currentPrice,
                    change: 0,
                    changePercent: 0,
                    volume: parseFloat(token.tradeVolumeUSD) || 0,
                    tvl: totalLiquidity * currentPrice,
                    txCount: parseInt(token.txCount) || 0,
                    source: 'pancakeswap',
                    chain: 'BSC',
                    contractAddress: token.id
                };
            });
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
            const bnbPrice = await this.getBnbPrice();
            const isAddress = query.startsWith('0x') && query.length === 42;

            const graphQuery = isAddress ? `
                query SearchByAddress {
                    tokens(where: { id: "${query.toLowerCase()}" }) {
                        id
                        symbol
                        name
                        derivedETH
                        tradeVolumeUSD
                        totalLiquidity
                    }
                }
            ` : `
                query SearchBySymbol {
                    tokens(
                        first: 10,
                        where: { symbol_contains_nocase: "${query}" },
                        orderBy: tradeVolumeUSD,
                        orderDirection: desc
                    ) {
                        id
                        symbol
                        name
                        derivedETH
                        tradeVolumeUSD
                        totalLiquidity
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
                .filter(t => parseFloat(t.derivedETH) > 0)
                .map(t => {
                    const derivedETH = parseFloat(t.derivedETH) || 0;
                    const price = derivedETH * bnbPrice;
                    const totalLiquidity = parseFloat(t.totalLiquidity) || 0;

                    return {
                        id: t.id,
                        symbol: t.symbol?.toUpperCase(),
                        name: t.name,
                        price: price,
                        tvl: totalLiquidity * price,
                        volume: parseFloat(t.tradeVolumeUSD),
                        source: 'pancakeswap',
                        chain: 'BSC',
                        contractAddress: t.id
                    };
                });

        } catch (error) {
            console.error('[PancakeSwap] Search error:', error.message);
            return [];
        }
    }
}

module.exports = new PancakeSwapService();
