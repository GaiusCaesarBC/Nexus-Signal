// server/services/heatmapService.js - Market Heatmap Data Service (MOVERS FOCUS)

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

    // Get stock market movers heatmap
    async getStockHeatmap() {
        const cacheKey = 'stock-heatmap-movers';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const topMovers = await alphaVantageService.getTopGainersLosers();

            // Combine all stocks from gainers and losers
            const allStocks = [
                ...topMovers.topGainers,
                ...topMovers.topLosers
            ];

            // Remove duplicates by ticker
            const uniqueStocks = Array.from(
                new Map(allStocks.map(stock => [stock.ticker, stock])).values()
            );

            // Format for heatmap - sort by absolute change (biggest movers first)
            const formatted = uniqueStocks
                .map(stock => {
                    const change = parseFloat(stock.change_percentage.replace('%', ''));
                    const absChange = Math.abs(change);
                    return {
                        symbol: stock.ticker,
                        name: stock.ticker,
                        price: parseFloat(stock.price),
                        change: change,
                        volume: parseInt(stock.volume) || 0,
                        // Size based on absolute change for consistent treemap - min 1, scale for visibility
                        size: Math.max(1, absChange * 10),
                        sector: 'Stocks'
                    };
                })
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 100); // Get top 100 movers

            // Calculate stats
            const stats = {
                total: formatted.length,
                gainers: formatted.filter(s => s.change > 0).length,
                losers: formatted.filter(s => s.change < 0).length,
                avgChange: formatted.reduce((sum, s) => sum + s.change, 0) / formatted.length || 0,
                topGainer: formatted.reduce((max, s) => s.change > (max?.change || -Infinity) ? s : max, null),
                topLoser: formatted.reduce((min, s) => s.change < (min?.change || Infinity) ? s : min, null),
                totalVolume: formatted.reduce((sum, s) => sum + s.volume, 0)
            };

            const result = {
                items: formatted,
                stats: stats,
                lastUpdated: new Date().toISOString()
            };

            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error('[Heatmap] Error getting stock heatmap:', error.message);
            throw error;
        }
    }

    // Get crypto market movers heatmap
    async getCryptoHeatmap() {
        const cacheKey = 'crypto-heatmap-movers';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Get more crypto data - 250 coins to find the biggest movers
            const markets = await coinGeckoService.getMarkets({
                per_page: 250,
                order: 'market_cap_desc'
            });

            // Format and sort by absolute change (biggest movers)
            const formatted = markets
                .map(coin => {
                    const change = coin.price_change_percentage_24h || 0;
                    const absChange = Math.abs(change);
                    return {
                        id: coin.id, // CoinGecko ID for navigation
                        symbol: coin.symbol.toUpperCase(),
                        name: coin.name,
                        price: coin.current_price,
                        change: change,
                        marketCap: coin.market_cap,
                        volume: coin.total_volume || 0,
                        // Size based on absolute change for consistent treemap - min 1, scale for visibility
                        size: Math.max(1, absChange * 10),
                        image: coin.image,
                        sector: 'Crypto'
                    };
                })
                .filter(coin => coin.change !== 0) // Remove flat coins
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 150); // Get top 150 movers

            // Calculate stats
            const stats = {
                total: formatted.length,
                gainers: formatted.filter(c => c.change > 0).length,
                losers: formatted.filter(c => c.change < 0).length,
                avgChange: formatted.reduce((sum, c) => sum + c.change, 0) / formatted.length || 0,
                topGainer: formatted.reduce((max, c) => c.change > (max?.change || -Infinity) ? c : max, null),
                topLoser: formatted.reduce((min, c) => c.change < (min?.change || Infinity) ? c : min, null),
                totalMarketCap: formatted.reduce((sum, c) => sum + (c.marketCap || 0), 0),
                totalVolume: formatted.reduce((sum, c) => sum + c.volume, 0)
            };

            const result = {
                items: formatted,
                stats: stats,
                lastUpdated: new Date().toISOString()
            };

            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error('[Heatmap] Error getting crypto heatmap:', error.message);
            throw error;
        }
    }
}

module.exports = new HeatmapService();
