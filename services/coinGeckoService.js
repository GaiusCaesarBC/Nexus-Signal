// server/services/coinGeckoService.js - CoinGecko Pro Service (FIXED)

const axios = require('axios');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

class CoinGeckoService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (can be shorter with Pro)
    }

    // Helper to make authenticated requests
    async makeRequest(endpoint, params = {}) {
        try {
            const response = await axios.get(`${COINGECKO_BASE_URL}${endpoint}`, {
                params: params,
                headers: {
                    'x-cg-pro-api-key': COINGECKO_API_KEY,  // ✅ API key goes in HEADER, not params
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`[CoinGecko] Error on ${endpoint}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Helper for caching
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log(`[CoinGecko] Cache HIT for ${key}`);
            return cached.data;
        }
        console.log(`[CoinGecko] Cache MISS for ${key}`);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Get list of all coins
    async getCoinsList() {
        const cacheKey = 'coins-list';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const data = await this.makeRequest('/coins/list');
        this.setCache(cacheKey, data);
        return data;
    }

    // Get markets data (prices, market cap, volume)
    async getMarkets(params = {}) {
        const cacheKey = `markets-${JSON.stringify(params)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const defaultParams = {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            page: 1,
            sparkline: false,
            ...params
        };

        const data = await this.makeRequest('/coins/markets', defaultParams);
        this.setCache(cacheKey, data);
        return data;
    }

    // Get specific coin data
    async getCoin(coinId) {
        const cacheKey = `coin-${coinId}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const data = await this.makeRequest(`/coins/${coinId}`, {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false
        });

        this.setCache(cacheKey, data);
        return data;
    }

    // Get simple price for one or more coins
    async getSimplePrice(ids, params = {}) {
        const idsString = Array.isArray(ids) ? ids.join(',') : ids;
        const cacheKey = `simple-price-${idsString}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const defaultParams = {
            ids: idsString,
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_24hr_vol: true,
            include_market_cap: true,
            ...params
        };

        const data = await this.makeRequest('/simple/price', defaultParams);
        this.setCache(cacheKey, data);
        return data;
    }

    // Get market chart data
    async getMarketChart(coinId, days = 30) {
        const cacheKey = `chart-${coinId}-${days}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const params = {
            vs_currency: 'usd',
            days: days
        };

        if (days > 90) {
            params.interval = 'daily';
        }

        const data = await this.makeRequest(`/coins/${coinId}/market_chart`, params);
        this.setCache(cacheKey, data);
        return data;
    }

    // Get trending coins
    async getTrending() {
        const cacheKey = 'trending';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const data = await this.makeRequest('/search/trending');
        this.setCache(cacheKey, data);
        return data;
    }

    // Get global crypto data
    async getGlobal() {
        const cacheKey = 'global';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const data = await this.makeRequest('/global');
        this.setCache(cacheKey, data);
        return data;
    }

    // Search coins
    async searchCoins(query) {
        const data = await this.makeRequest('/search', { query });
        return data.coins || [];
    }

    // Get top gainers/losers
    async getTopGainersLosers() {
        const cacheKey = 'top-gainers-losers';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        // Get top 250 coins by market cap
        const markets = await this.getMarkets({
            per_page: 250,
            price_change_percentage: '24h'
        });

        const gainers = markets
            .filter(coin => (coin.price_change_percentage_24h || 0) > 0)
            .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
            .slice(0, 20);

        const losers = markets
            .filter(coin => (coin.price_change_percentage_24h || 0) < 0)
            .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
            .slice(0, 20);

        const data = { gainers, losers };
        this.setCache(cacheKey, data);
        return data;
    }

    // Get coin by symbol (helper to convert symbol to ID)
    async getCoinBySymbol(symbol) {
        const coinsList = await this.getCoinsList();
        const coin = coinsList.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
        
        if (!coin) {
            throw new Error(`Coin with symbol ${symbol} not found`);
        }

        return await this.getCoin(coin.id);
    }

    // Get prices for multiple symbols at once
    async getPricesForSymbols(symbols) {
        // Symbol to CoinGecko ID mapping
        const symbolToId = {
            'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'BNB': 'binancecoin',
            'XRP': 'ripple', 'USDC': 'usd-coin', 'ADA': 'cardano', 'DOGE': 'dogecoin',
            'SOL': 'solana', 'TRX': 'tron', 'DOT': 'polkadot', 'MATIC': 'matic-network',
            'SHIB': 'shiba-inu', 'LTC': 'litecoin', 'AVAX': 'avalanche-2', 'UNI': 'uniswap',
            'LINK': 'chainlink', 'XLM': 'stellar', 'ATOM': 'cosmos', 'ETC': 'ethereum-classic',
            'XMR': 'monero', 'BCH': 'bitcoin-cash', 'APT': 'aptos', 'FIL': 'filecoin',
            'NEAR': 'near', 'VET': 'vechain', 'ALGO': 'algorand', 'ICP': 'internet-computer',
            'HBAR': 'hedera-hashgraph', 'APE': 'apecoin', 'QNT': 'quant-network',
            'ARB': 'arbitrum', 'OP': 'optimism', 'MKR': 'maker', 'AAVE': 'aave',
            'GRT': 'the-graph', 'SAND': 'the-sandbox', 'MANA': 'decentraland',
            'AXS': 'axie-infinity', 'FTM': 'fantom', 'PEPE': 'pepe', 'WLD': 'worldcoin-wld',
            'SUI': 'sui', 'SEI': 'sei-network', 'TIA': 'celestia', 'JUP': 'jupiter-exchange-solana',
            'BONK': 'bonk', 'WIF': 'dogwifcoin', 'THETA': 'theta-token', 'EOS': 'eos'
        };

        // Convert symbols to IDs
        const ids = symbols
            .map(s => symbolToId[s.toUpperCase()])
            .filter(Boolean);

        if (ids.length === 0) {
            return {};
        }

        const priceData = await this.getSimplePrice(ids);

        // Map back to symbols
        const result = {};
        for (const [symbol, id] of Object.entries(symbolToId)) {
            if (priceData[id]) {
                result[symbol] = {
                    currentPrice: priceData[id].usd || 0,
                    change: (priceData[id].usd * (priceData[id].usd_24h_change || 0)) / 100,
                    changePercent: priceData[id].usd_24h_change || 0,
                    volume24h: priceData[id].usd_24h_vol || 0,
                    marketCap: priceData[id].usd_market_cap || 0
                };
            }
        }

        return result;
    }
}

module.exports = new CoinGeckoService();