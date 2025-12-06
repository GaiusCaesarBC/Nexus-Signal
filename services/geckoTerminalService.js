// server/services/geckoTerminalService.js - GeckoTerminal API Service
// FREE API for DEX token data across multiple chains (BSC, Ethereum, Solana, etc.)

const axios = require('axios');

class GeckoTerminalService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
        this.BASE_URL = 'https://api.geckoterminal.com/api/v2';

        // Supported networks
        this.NETWORKS = {
            bsc: 'bsc',
            ethereum: 'eth',
            solana: 'solana',
            polygon: 'polygon_pos',
            arbitrum: 'arbitrum',
            base: 'base',
            avalanche: 'avax'
        };
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data, duration = this.CACHE_DURATION) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            duration
        });
    }

    /**
     * Search for tokens/pools across networks
     */
    async search(query, network = null, fixPercentages = true) {
        if (!query || query.length < 2) return [];

        const cacheKey = `search-${query}-${network || 'all'}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const url = network
                ? `${this.BASE_URL}/search/pools?query=${encodeURIComponent(query)}&network=${network}`
                : `${this.BASE_URL}/search/pools?query=${encodeURIComponent(query)}`;

            const response = await axios.get(url, {
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const pools = response.data?.data || [];
            let results = pools.slice(0, 20).map(pool => this.formatPoolData(pool));

            // Fix suspicious percentages using OHLCV data
            if (fixPercentages) {
                results = await this.fixSuspiciousPercentages(results);
            }

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error('[GeckoTerminal] Search error:', error.message);
            return [];
        }
    }

    /**
     * Get trending pools for a network
     */
    async getTrendingPools(network = 'bsc', limit = 20, fixPercentages = true) {
        const cacheKey = `trending-${network}-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/trending_pools`,
                {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const pools = response.data?.data || [];
            let results = pools.slice(0, limit).map(pool => this.formatPoolData(pool));

            // Fix suspicious percentages using OHLCV data
            if (fixPercentages) {
                results = await this.fixSuspiciousPercentages(results);
            }

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error(`[GeckoTerminal] Trending ${network} error:`, error.message);
            return [];
        }
    }

    /**
     * Get top pools by volume for a network
     */
    async getTopPools(network = 'bsc', sortBy = 'h24_volume_usd_desc', limit = 20, fixPercentages = true) {
        const cacheKey = `top-${network}-${sortBy}-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/pools?page=1&sort=${sortBy}`,
                {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const pools = response.data?.data || [];
            let results = pools.slice(0, limit).map(pool => this.formatPoolData(pool));

            // Fix suspicious percentages using OHLCV data
            if (fixPercentages) {
                results = await this.fixSuspiciousPercentages(results);
            }

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error(`[GeckoTerminal] Top pools ${network} error:`, error.message);
            return [];
        }
    }

    /**
     * Get new pools for a network
     */
    async getNewPools(network = 'bsc', limit = 20, fixPercentages = true) {
        const cacheKey = `new-${network}-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/new_pools`,
                {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const pools = response.data?.data || [];
            let results = pools.slice(0, limit).map(pool => this.formatPoolData(pool));

            // Fix suspicious percentages using OHLCV data
            if (fixPercentages) {
                results = await this.fixSuspiciousPercentages(results);
            }

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error(`[GeckoTerminal] New pools ${network} error:`, error.message);
            return [];
        }
    }

    /**
     * Get token price by address
     */
    async getTokenPrice(network, tokenAddress) {
        if (!network || !tokenAddress) return null;

        const cacheKey = `price-${network}-${tokenAddress}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/tokens/${tokenAddress}`,
                {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const token = response.data?.data;
            if (!token) return null;

            const attrs = token.attributes || {};
            const result = {
                address: tokenAddress,
                symbol: attrs.symbol?.toUpperCase(),
                name: attrs.name,
                price: parseFloat(attrs.price_usd) || 0,
                priceChange24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
                volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
                marketCap: parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0,
                network: network,
                source: 'geckoterminal'
            };

            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error(`[GeckoTerminal] Token price error:`, error.message);
            return null;
        }
    }

    /**
     * Get pool/pair data by address
     */
    async getPoolData(network, poolAddress) {
        if (!network || !poolAddress) return null;

        const cacheKey = `pool-${network}-${poolAddress}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/pools/${poolAddress}`,
                {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const pool = response.data?.data;
            if (!pool) return null;

            const result = this.formatPoolData(pool);
            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error(`[GeckoTerminal] Pool data error:`, error.message);
            return null;
        }
    }

    /**
     * Get OHLCV data for charts
     */
    async getOHLCV(network, poolAddress, timeframe = 'hour', aggregate = 1, limit = 100) {
        if (!network || !poolAddress) return [];

        const cacheKey = `ohlcv-${network}-${poolAddress}-${timeframe}-${aggregate}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // GeckoTerminal timeframes: minute, hour, day
            const response = await axios.get(
                `${this.BASE_URL}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`,
                {
                    timeout: 15000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const ohlcvData = response.data?.data?.attributes?.ohlcv_list || [];

            // Format: [timestamp, open, high, low, close, volume]
            const results = ohlcvData.map(candle => ({
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            })).reverse(); // GeckoTerminal returns newest first

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error(`[GeckoTerminal] OHLCV error:`, error.message);
            return [];
        }
    }

    /**
     * Get top gainers across a network
     */
    async getTopGainers(network = 'bsc', limit = 20) {
        const pools = await this.getTrendingPools(network, 50);

        return pools
            .filter(p => p.changePercent > 0 && p.tvl > 5000)
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit);
    }

    /**
     * Get top losers across a network
     */
    async getTopLosers(network = 'bsc', limit = 20) {
        const pools = await this.getTrendingPools(network, 50);

        return pools
            .filter(p => p.changePercent < 0 && p.tvl > 5000)
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit);
    }

    /**
     * Get tokens for heatmap display
     */
    async getHeatmapData(network = 'bsc', limit = 30) {
        const cacheKey = `heatmap-${network}-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Get trending pools which have the most activity
            const pools = await this.getTrendingPools(network, limit * 2);

            // Filter and format for heatmap
            const results = pools
                .filter(p => !this.isStablecoinPair(p.name) && p.tvl > 1000)
                .slice(0, limit)
                .map(pool => ({
                    symbol: pool.symbol,
                    name: pool.name,
                    price: pool.price,
                    change: pool.changePercent,
                    volume: pool.volume,
                    marketCap: pool.marketCap || pool.tvl,
                    category: 'DEX',
                    chain: network.toUpperCase(),
                    source: 'geckoterminal'
                }));

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error(`[GeckoTerminal] Heatmap error:`, error.message);
            return [];
        }
    }

    /**
     * Calculate accurate 24h percentage change from OHLCV data
     * This is more reliable than the API's price_change_percentage field
     */
    async calculateAccurate24hChange(network, poolAddress, currentPrice) {
        try {
            // Fetch hourly OHLCV for the last 25 hours (to ensure we have 24h ago data)
            const ohlcv = await this.getOHLCV(network, poolAddress, 'hour', 1, 25);

            if (!ohlcv || ohlcv.length < 2) {
                return null; // Not enough data
            }

            // Find the candle closest to 24 hours ago
            const now = Date.now() / 1000;
            const targetTime = now - (24 * 60 * 60); // 24 hours ago in seconds

            // OHLCV is sorted oldest to newest after our reverse()
            let price24hAgo = null;
            for (const candle of ohlcv) {
                if (candle.time <= targetTime) {
                    price24hAgo = candle.close;
                } else {
                    break;
                }
            }

            // If we didn't find a candle 24h ago, use the oldest available
            if (!price24hAgo && ohlcv.length > 0) {
                price24hAgo = ohlcv[0].close;
            }

            if (!price24hAgo || price24hAgo === 0) {
                return null;
            }

            // Calculate percentage change
            const actualPrice = currentPrice || ohlcv[ohlcv.length - 1].close;
            const percentChange = ((actualPrice - price24hAgo) / price24hAgo) * 100;

            return percentChange;

        } catch (error) {
            console.error(`[GeckoTerminal] Error calculating accurate 24h change:`, error.message);
            return null;
        }
    }

    /**
     * Fix suspicious percentage values by fetching OHLCV data
     * Only fixes pools where the reported percentage seems unreliable
     */
    async fixSuspiciousPercentages(pools, concurrencyLimit = 5) {
        // Identify pools with suspicious percentages (>100% or <-70%)
        // Very aggressive threshold since GeckoTerminal is highly unreliable
        const suspiciousPools = pools.filter(p =>
            p._suspiciousPercent || Math.abs(p.changePercent) > 100 || p.changePercent < -70
        );

        if (suspiciousPools.length === 0) {
            return pools;
        }

        console.log(`[GeckoTerminal] Fixing ${suspiciousPools.length} pools with suspicious percentages...`);

        // Process in batches to avoid rate limiting
        const batches = [];
        for (let i = 0; i < suspiciousPools.length; i += concurrencyLimit) {
            batches.push(suspiciousPools.slice(i, i + concurrencyLimit));
        }

        for (const batch of batches) {
            await Promise.all(batch.map(async (pool) => {
                const accurateChange = await this.calculateAccurate24hChange(
                    pool.network,
                    pool.poolAddress,
                    pool.price
                );

                if (accurateChange !== null) {
                    const oldPercent = pool.changePercent;
                    pool.changePercent = Math.round(accurateChange * 100) / 100; // Round to 2 decimals
                    pool.change = pool.price * (pool.changePercent / 100);
                    pool._suspiciousPercent = false;
                    console.log(`[GeckoTerminal] Fixed ${pool.symbol}: ${oldPercent}% -> ${pool.changePercent}% (from OHLCV)`);
                }
            }));

            // Small delay between batches to avoid rate limiting
            if (batches.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return pools;
    }

    /**
     * Format pool data to standard format
     */
    formatPoolData(pool) {
        const attrs = pool.attributes || {};
        const priceUsd = parseFloat(attrs.base_token_price_usd) || 0;
        let priceChange24h = parseFloat(attrs.price_change_percentage?.h24) || 0;
        const volume24h = parseFloat(attrs.volume_usd?.h24) || 0;
        const liquidity = parseFloat(attrs.reserve_in_usd) || 0;
        const marketCap = parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0;

        // Flag suspicious percentage changes for later OHLCV-based correction
        // Values over 100% or under -70% should be verified with OHLCV data
        // Very aggressive threshold since GeckoTerminal is highly unreliable
        let suspiciousPercent = false;
        if (Math.abs(priceChange24h) > 100 || priceChange24h < -70) {
            console.log(`[GeckoTerminal] Flagging suspicious change for ${attrs.name}: ${priceChange24h}%`);
            suspiciousPercent = true;
        }

        const txns = attrs.transactions?.h24 || {};
        const txCount = (txns.buys || 0) + (txns.sells || 0);

        // Extract token info from pool name
        const poolName = attrs.name || '';
        const baseSymbol = poolName.split('/')[0]?.trim().split(' ')[0] || 'UNKNOWN';

        // Get network from pool ID
        const poolId = pool.id || '';
        const network = poolId.split('_')[0] || 'bsc';

        // Get token address
        const baseTokenId = pool.relationships?.base_token?.data?.id || '';
        const tokenAddress = baseTokenId.replace(`${network}_`, '');

        return {
            id: tokenAddress || attrs.address,
            symbol: baseSymbol.toUpperCase(),
            name: poolName,
            price: priceUsd,
            change: priceUsd * (priceChange24h / 100),
            changePercent: priceChange24h,
            volume: volume24h,
            tvl: liquidity,
            marketCap: marketCap,
            txCount: txCount,
            source: 'geckoterminal',
            chain: network.toUpperCase(),
            network: network,
            contractAddress: tokenAddress,
            poolAddress: attrs.address,
            dexId: pool.relationships?.dex?.data?.id || 'unknown',
            _suspiciousPercent: suspiciousPercent // Internal flag for fixing
        };
    }

    /**
     * Check if pool is a stablecoin pair
     */
    isStablecoinPair(name) {
        if (!name) return false;
        const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX', 'UST'];
        const parts = name.split('/').map(p => p.trim().split(' ')[0].toUpperCase());
        const stableCount = parts.filter(p => stables.includes(p)).length;
        return stableCount >= 2;
    }
}

module.exports = new GeckoTerminalService();
