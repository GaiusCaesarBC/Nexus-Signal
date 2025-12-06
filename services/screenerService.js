// server/services/screenerService.js - Real-time Screener Service

const alphaVantageService = require('./alphaVantageService');
const coinGeckoService = require('./coinGeckoService');
const pancakeSwapService = require('./pancakeSwapService');

class ScreenerService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 3 * 60 * 1000; // 3 minutes (faster for DEX data)
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

    // Screen stocks
    async screenStocks(filters = {}) {
        const cacheKey = `stocks-${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Get top gainers/losers from Alpha Vantage
            const topMovers = await alphaVantageService.getTopGainersLosers();
            
            let results = [
                ...topMovers.topGainers.map(stock => ({
                    ...stock,
                    type: 'gainer'
                })),
                ...topMovers.topLosers.map(stock => ({
                    ...stock,
                    type: 'loser'
                })),
                ...topMovers.mostActivelyTraded.map(stock => ({
                    ...stock,
                    type: 'active'
                }))
            ];

            // Apply filters
            if (filters.minPrice) {
                results = results.filter(s => parseFloat(s.price) >= filters.minPrice);
            }
            if (filters.maxPrice) {
                results = results.filter(s => parseFloat(s.price) <= filters.maxPrice);
            }
            if (filters.minVolume) {
                results = results.filter(s => parseInt(s.volume) >= filters.minVolume);
            }
            if (filters.changeFilter === 'gainers') {
                results = results.filter(s => parseFloat(s.change_percentage.replace('%', '')) > 0);
            }
            if (filters.changeFilter === 'losers') {
                results = results.filter(s => parseFloat(s.change_percentage.replace('%', '')) < 0);
            }

            // Format results
            const formatted = results.map(stock => ({
                symbol: stock.ticker,
                name: stock.ticker,
                price: parseFloat(stock.price),
                change: parseFloat(stock.change_amount),
                changePercent: parseFloat(stock.change_percentage.replace('%', '')),
                volume: parseInt(stock.volume),
                sector: 'Unknown', // Alpha Vantage top movers doesn't include sector
                badge: stock.type === 'gainer' ? 'hot' : stock.type === 'active' ? 'trending' : null
            }));

            this.setCache(cacheKey, formatted);
            return formatted;

        } catch (error) {
            console.error('[Screener] Error screening stocks:', error.message);
            throw error;
        }
    }

    // Screen crypto - combines CoinGecko + PancakeSwap data
    async screenCrypto(filters = {}) {
        const cacheKey = `crypto-${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Fetch from both sources in parallel
            const [coinGeckoData, pancakeSwapData] = await Promise.all([
                this.fetchCoinGeckoData(filters),
                this.fetchPancakeSwapData(filters)
            ]);

            // Combine results - PancakeSwap first (more volatile/interesting), then CoinGecko
            let results = [];

            // Add PancakeSwap tokens (BSC DEX tokens with high volatility)
            if (pancakeSwapData.length > 0) {
                results.push(...pancakeSwapData);
            }

            // Add CoinGecko tokens (established coins)
            if (coinGeckoData.length > 0) {
                // Avoid duplicates by symbol
                const existingSymbols = new Set(results.map(r => r.symbol.toUpperCase()));
                const uniqueCoinGecko = coinGeckoData.filter(c => !existingSymbols.has(c.symbol.toUpperCase()));
                results.push(...uniqueCoinGecko);
            }

            // Apply universal filters
            if (filters.minPrice) {
                results = results.filter(c => c.price >= filters.minPrice);
            }
            if (filters.maxPrice) {
                results = results.filter(c => c.price <= filters.maxPrice);
            }
            if (filters.minVolume) {
                results = results.filter(c => c.volume >= filters.minVolume);
            }
            if (filters.changeFilter === 'gainers') {
                results = results.filter(c => c.changePercent > 0);
            }
            if (filters.changeFilter === 'losers') {
                results = results.filter(c => c.changePercent < 0);
            }

            // Sort by percentage change (biggest movers first)
            results.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

            // If filter is gainers, sort descending; if losers, sort ascending
            if (filters.changeFilter === 'gainers') {
                results.sort((a, b) => b.changePercent - a.changePercent);
            } else if (filters.changeFilter === 'losers') {
                results.sort((a, b) => a.changePercent - b.changePercent);
            }

            console.log(`[Screener] Combined crypto results: ${results.length} tokens (${pancakeSwapData.length} from DexScreener BSC, ${coinGeckoData.length} from CoinGecko)`);

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error('[Screener] Error screening crypto:', error.message);
            throw error;
        }
    }

    // Fetch data from CoinGecko
    async fetchCoinGeckoData(filters = {}) {
        try {
            const markets = await coinGeckoService.getMarkets({
                per_page: 100,
                order: filters.sortBy || 'market_cap_desc'
            });

            let results = markets;

            // Apply CoinGecko-specific filters
            if (filters.minMarketCap) {
                results = results.filter(c => c.market_cap >= filters.minMarketCap * 1000000000);
            }
            if (filters.maxMarketCap) {
                results = results.filter(c => c.market_cap <= filters.maxMarketCap * 1000000000);
            }

            // Format results
            return results.map(coin => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                change: coin.price_change_24h || 0,
                changePercent: coin.price_change_percentage_24h || 0,
                volume: coin.total_volume,
                marketCap: coin.market_cap,
                source: 'coingecko',
                badge: Math.abs(coin.price_change_percentage_24h || 0) > 10 ? 'hot' :
                       Math.abs(coin.price_change_percentage_24h || 0) > 5 ? 'trending' : null
            }));

        } catch (error) {
            console.error('[Screener] CoinGecko fetch error:', error.message);
            return [];
        }
    }

    // Fetch data from PancakeSwap (BSC DEX tokens)
    async fetchPancakeSwapData(filters = {}) {
        try {
            console.log('[Screener] Fetching DexScreener BSC data with filters:', filters);
            const tokens = await pancakeSwapService.getTokens({
                sortBy: 'changePercent',
                order: 'desc',
                minTvl: 5000, // Minimum $5k TVL to filter dust tokens
                limit: 100,
                changeFilter: filters.changeFilter || 'all'
            });
            console.log(`[Screener] DexScreener returned ${tokens.length} BSC tokens`);

            // Format results to match CoinGecko structure
            return tokens.map(token => ({
                id: token.contractAddress,
                symbol: token.symbol,
                name: token.name,
                price: token.price,
                change: token.change,
                changePercent: token.changePercent,
                volume: token.volume,
                marketCap: token.tvl, // Use TVL as proxy for market cap on DEX
                tvl: token.tvl,
                source: 'pancakeswap',
                chain: 'BSC',
                contractAddress: token.contractAddress,
                badge: Math.abs(token.changePercent || 0) > 50 ? 'hot' :
                       Math.abs(token.changePercent || 0) > 20 ? 'trending' :
                       Math.abs(token.changePercent || 0) > 10 ? 'volatile' : null
            }));

        } catch (error) {
            console.error('[Screener] PancakeSwap fetch error:', error.message);
            return [];
        }
    }

    // Get only PancakeSwap tokens (for dedicated BSC view)
    async screenPancakeSwap(filters = {}) {
        const cacheKey = `pancakeswap-${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const tokens = await this.fetchPancakeSwapData(filters);

            // Apply additional filters
            let results = tokens;

            if (filters.minPrice) {
                results = results.filter(t => t.price >= filters.minPrice);
            }
            if (filters.maxPrice) {
                results = results.filter(t => t.price <= filters.maxPrice);
            }
            if (filters.minVolume) {
                results = results.filter(t => t.volume >= filters.minVolume);
            }
            if (filters.minTvl) {
                results = results.filter(t => t.tvl >= filters.minTvl);
            }

            // Sort by change percent for biggest movers
            if (filters.changeFilter === 'gainers') {
                results.sort((a, b) => b.changePercent - a.changePercent);
            } else if (filters.changeFilter === 'losers') {
                results.sort((a, b) => a.changePercent - b.changePercent);
            } else {
                results.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
            }

            this.setCache(cacheKey, results);
            return results;

        } catch (error) {
            console.error('[Screener] Error screening PancakeSwap:', error.message);
            throw error;
        }
    }
}

module.exports = new ScreenerService();