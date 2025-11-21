// server/services/screenerService.js - Real-time Screener Service

const alphaVantageService = require('./alphaVantageService');
const coinGeckoService = require('./coinGeckoService');

class ScreenerService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
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

    // Screen crypto
    async screenCrypto(filters = {}) {
        const cacheKey = `crypto-${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Get market data from CoinGecko
            const markets = await coinGeckoService.getMarkets({
                per_page: 100,
                order: filters.sortBy || 'market_cap_desc'
            });

            let results = markets;

            // Apply filters
            if (filters.minPrice) {
                results = results.filter(c => c.current_price >= filters.minPrice);
            }
            if (filters.maxPrice) {
                results = results.filter(c => c.current_price <= filters.maxPrice);
            }
            if (filters.minVolume) {
                results = results.filter(c => c.total_volume >= filters.minVolume);
            }
            if (filters.minMarketCap) {
                results = results.filter(c => c.market_cap >= filters.minMarketCap * 1000000000);
            }
            if (filters.maxMarketCap) {
                results = results.filter(c => c.market_cap <= filters.maxMarketCap * 1000000000);
            }
            if (filters.changeFilter === 'gainers') {
                results = results.filter(c => c.price_change_percentage_24h > 0);
            }
            if (filters.changeFilter === 'losers') {
                results = results.filter(c => c.price_change_percentage_24h < 0);
            }

            // Format results
            const formatted = results.map(coin => ({
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                change: coin.price_change_24h || 0,
                changePercent: coin.price_change_percentage_24h || 0,
                volume: coin.total_volume,
                marketCap: coin.market_cap,
                sector: 'Crypto',
                badge: Math.abs(coin.price_change_percentage_24h || 0) > 10 ? 'hot' : 
                       Math.abs(coin.price_change_percentage_24h || 0) > 5 ? 'trending' : null
            }));

            this.setCache(cacheKey, formatted);
            return formatted;

        } catch (error) {
            console.error('[Screener] Error screening crypto:', error.message);
            throw error;
        }
    }
}

module.exports = new ScreenerService();