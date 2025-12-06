// server/services/heatmapService.js - Market Heatmap Data Service (MOVERS FOCUS)

const alphaVantageService = require('./alphaVantageService');
const coinGeckoService = require('./coinGeckoService');
const geckoTerminalService = require('./geckoTerminalService');

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

    // Get crypto market movers heatmap (CoinGecko + GeckoTerminal DEX tokens)
    async getCryptoHeatmap() {
        const cacheKey = 'crypto-heatmap-movers';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            // Fetch CoinGecko and GeckoTerminal data in parallel
            const [markets, dexTokens] = await Promise.all([
                coinGeckoService.getMarkets({
                    per_page: 200,
                    order: 'market_cap_desc'
                }).catch(err => {
                    console.error('[Heatmap] CoinGecko error:', err.message);
                    return [];
                }),
                geckoTerminalService.getTrendingPools('bsc', 50).catch(err => {
                    console.error('[Heatmap] GeckoTerminal error:', err.message);
                    return [];
                })
            ]);

            // Format CoinGecko data
            const coinGeckoFormatted = markets.map(coin => {
                const change = coin.price_change_percentage_24h || 0;
                const absChange = Math.abs(change);
                return {
                    id: coin.id,
                    symbol: coin.symbol.toUpperCase(),
                    name: coin.name,
                    price: coin.current_price,
                    change: change,
                    marketCap: coin.market_cap,
                    volume: coin.total_volume || 0,
                    size: Math.max(1, absChange * 10),
                    image: coin.image,
                    sector: 'Crypto',
                    source: 'coingecko'
                };
            });

            // Format GeckoTerminal DEX tokens
            const dexFormatted = dexTokens
                .filter(token => !this.isStablecoin(token.symbol))
                .map(token => {
                    const change = token.changePercent || 0;
                    const absChange = Math.abs(change);
                    return {
                        id: token.contractAddress,
                        symbol: token.symbol,
                        name: token.name,
                        price: token.price,
                        change: change,
                        marketCap: token.tvl,
                        volume: token.volume || 0,
                        size: Math.max(1, absChange * 10),
                        sector: 'DEX',
                        chain: 'BSC',
                        source: 'geckoterminal'
                    };
                });

            // Combine and deduplicate (prefer CoinGecko for established coins)
            const existingSymbols = new Set(coinGeckoFormatted.map(c => c.symbol));
            const uniqueDex = dexFormatted.filter(d => !existingSymbols.has(d.symbol));

            const allTokens = [...coinGeckoFormatted, ...uniqueDex];

            // Sort by absolute change and take top movers
            const formatted = allTokens
                .filter(coin => coin.change !== 0)
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 150);

            // Calculate stats
            const stats = {
                total: formatted.length,
                gainers: formatted.filter(c => c.change > 0).length,
                losers: formatted.filter(c => c.change < 0).length,
                avgChange: formatted.reduce((sum, c) => sum + c.change, 0) / formatted.length || 0,
                topGainer: formatted.reduce((max, c) => c.change > (max?.change || -Infinity) ? c : max, null),
                topLoser: formatted.reduce((min, c) => c.change < (min?.change || Infinity) ? c : min, null),
                totalMarketCap: formatted.reduce((sum, c) => sum + (c.marketCap || 0), 0),
                totalVolume: formatted.reduce((sum, c) => sum + c.volume, 0),
                dexTokensCount: uniqueDex.length,
                coinGeckoCount: coinGeckoFormatted.length
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

    // Check if symbol is a stablecoin
    isStablecoin(symbol) {
        const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX', 'UST', 'USDP', 'GUSD'];
        return stables.includes(symbol?.toUpperCase());
    }

    // Get DEX-only heatmap (BSC tokens from GeckoTerminal)
    async getDexHeatmap(network = 'bsc') {
        const cacheKey = `dex-heatmap-${network}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const dexTokens = await geckoTerminalService.getTrendingPools(network, 100);

            const formatted = dexTokens
                .filter(token => !this.isStablecoin(token.symbol) && token.changePercent !== 0)
                .map(token => {
                    const change = token.changePercent || 0;
                    const absChange = Math.abs(change);
                    return {
                        id: token.contractAddress,
                        symbol: token.symbol,
                        name: token.name,
                        price: token.price,
                        change: change,
                        marketCap: token.tvl,
                        volume: token.volume || 0,
                        size: Math.max(1, absChange * 10),
                        sector: 'DEX',
                        chain: network.toUpperCase(),
                        source: 'geckoterminal',
                        poolAddress: token.poolAddress
                    };
                })
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

            const stats = {
                total: formatted.length,
                gainers: formatted.filter(c => c.change > 0).length,
                losers: formatted.filter(c => c.change < 0).length,
                avgChange: formatted.reduce((sum, c) => sum + c.change, 0) / formatted.length || 0,
                topGainer: formatted.reduce((max, c) => c.change > (max?.change || -Infinity) ? c : max, null),
                topLoser: formatted.reduce((min, c) => c.change < (min?.change || Infinity) ? c : min, null),
                totalVolume: formatted.reduce((sum, c) => sum + c.volume, 0)
            };

            const result = {
                items: formatted,
                stats: stats,
                network: network,
                source: 'geckoterminal',
                lastUpdated: new Date().toISOString()
            };

            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error('[Heatmap] Error getting DEX heatmap:', error.message);
            throw error;
        }
    }
}

module.exports = new HeatmapService();
