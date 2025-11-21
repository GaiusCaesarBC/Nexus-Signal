// server/services/heatmapService.js - Market Heatmap Data Service

const alphaVantageService = require('./alphaVantageService');
const coinGeckoService = require('./coinGeckoService');

class HeatmapService {
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

    // Get stock market heatmap data
    async getStockHeatmap() {
        const cacheKey = 'stock-heatmap';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const topMovers = await alphaVantageService.getTopGainersLosers();
            
            // Combine all stocks
            const allStocks = [
                ...topMovers.topGainers,
                ...topMovers.topLosers,
                ...topMovers.mostActivelyTraded
            ];

            // Remove duplicates
            const uniqueStocks = Array.from(
                new Map(allStocks.map(stock => [stock.ticker, stock])).values()
            );

            // Format for heatmap
            const formatted = uniqueStocks.slice(0, 50).map(stock => ({
                symbol: stock.ticker,
                name: stock.ticker,
                price: parseFloat(stock.price),
                change: parseFloat(stock.change_percentage.replace('%', '')),
                sector: 'Unknown',
                size: parseInt(stock.volume) / 1000000 // Use volume as size
            }));

            this.setCache(cacheKey, formatted);
            return formatted;

        } catch (error) {
            console.error('[Heatmap] Error getting stock heatmap:', error.message);
            throw error;
        }
    }

    // Get crypto market heatmap data
    async getCryptoHeatmap() {
        const cacheKey = 'crypto-heatmap';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const markets = await coinGeckoService.getMarkets({
                per_page: 50,
                order: 'market_cap_desc'
            });

            const formatted = markets.map(coin => ({
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                change: coin.price_change_percentage_24h || 0,
                sector: 'Crypto',
                size: coin.market_cap / 1000000000 // Market cap in billions
            }));

            this.setCache(cacheKey, formatted);
            return formatted;

        } catch (error) {
            console.error('[Heatmap] Error getting crypto heatmap:', error.message);
            throw error;
        }
    }
}

module.exports = new HeatmapService();