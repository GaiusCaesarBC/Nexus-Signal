// server/services/alphaVantageService.js - Alpha Vantage Pro Service

const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

class AlphaVantageService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    // Helper to check cache
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log(`[AlphaVantage] Cache HIT for ${key}`);
            return cached.data;
        }
        console.log(`[AlphaVantage] Cache MISS for ${key}`);
        return null;
    }

    // Helper to set cache
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Get real-time quote
    async getQuote(symbol) {
        const cacheKey = `quote-${symbol}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'GLOBAL_QUOTE',
                    symbol: symbol,
                    apikey: ALPHA_VANTAGE_API_KEY
                }
            });

            const quote = response.data['Global Quote'];
            if (!quote || Object.keys(quote).length === 0) {
                throw new Error(`No data found for ${symbol}`);
            }

            const result = {
                symbol: quote['01. symbol'],
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
                volume: parseInt(quote['06. volume']),
                latestTradingDay: quote['07. latest trading day'],
                previousClose: parseFloat(quote['08. previous close']),
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low'])
            };

            this.setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching quote for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get intraday data
    async getIntraday(symbol, interval = '5min') {
        const cacheKey = `intraday-${symbol}-${interval}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'TIME_SERIES_INTRADAY',
                    symbol: symbol,
                    interval: interval,
                    apikey: ALPHA_VANTAGE_API_KEY,
                    outputsize: 'full'
                }
            });

            const timeSeries = response.data[`Time Series (${interval})`];
            if (!timeSeries) {
                throw new Error(`No intraday data found for ${symbol}`);
            }

            const data = Object.entries(timeSeries).map(([time, values]) => ({
                time: new Date(time).getTime(),
                open: parseFloat(values['1. open']),
                high: parseFloat(values['2. high']),
                low: parseFloat(values['3. low']),
                close: parseFloat(values['4. close']),
                volume: parseInt(values['5. volume'])
            })).sort((a, b) => a.time - b.time);

            this.setCache(cacheKey, data);
            return data;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching intraday for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get daily data
    async getDaily(symbol, outputsize = 'full') {
        const cacheKey = `daily-${symbol}-${outputsize}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'TIME_SERIES_DAILY',
                    symbol: symbol,
                    apikey: ALPHA_VANTAGE_API_KEY,
                    outputsize: outputsize
                }
            });

            const timeSeries = response.data['Time Series (Daily)'];
            if (!timeSeries) {
                throw new Error(`No daily data found for ${symbol}`);
            }

            const data = Object.entries(timeSeries).map(([date, values]) => ({
                time: new Date(date).getTime(),
                open: parseFloat(values['1. open']),
                high: parseFloat(values['2. high']),
                low: parseFloat(values['3. low']),
                close: parseFloat(values['4. close']),
                volume: parseInt(values['5. volume'])
            })).sort((a, b) => a.time - b.time);

            this.setCache(cacheKey, data);
            return data;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching daily for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get technical indicators
    async getTechnicalIndicator(symbol, indicator, interval = 'daily', timePeriod = 14) {
        const cacheKey = `indicator-${symbol}-${indicator}-${interval}-${timePeriod}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        const functionMap = {
            'RSI': 'RSI',
            'MACD': 'MACD',
            'SMA': 'SMA',
            'EMA': 'EMA',
            'BBANDS': 'BBANDS'
        };

        try {
            const params = {
                function: functionMap[indicator],
                symbol: symbol,
                interval: interval,
                time_period: timePeriod,
                series_type: 'close',
                apikey: ALPHA_VANTAGE_API_KEY
            };

            const response = await axios.get(BASE_URL, { params });
            
            const technicalKey = `Technical Analysis: ${functionMap[indicator]}`;
            const data = response.data[technicalKey];

            if (!data) {
                throw new Error(`No ${indicator} data found for ${symbol}`);
            }

            this.setCache(cacheKey, data);
            return data;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching ${indicator} for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get company overview
    async getCompanyOverview(symbol) {
        const cacheKey = `overview-${symbol}`;
        // Cache for longer (1 hour) since this data doesn't change often
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
            return cached.data;
        }

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'OVERVIEW',
                    symbol: symbol,
                    apikey: ALPHA_VANTAGE_API_KEY
                }
            });

            const overview = response.data;
            if (!overview || !overview.Symbol) {
                throw new Error(`No overview data found for ${symbol}`);
            }

            this.setCache(cacheKey, overview);
            return overview;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching overview for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get news and sentiment
    async getNewsSentiment(symbol, limit = 50) {
        const cacheKey = `news-${symbol}-${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const params = {
                function: 'NEWS_SENTIMENT',
                apikey: ALPHA_VANTAGE_API_KEY
            };

            if (symbol && symbol !== 'market') {
                params.tickers = symbol;
            }

            params.limit = limit;

            const response = await axios.get(BASE_URL, { params });
            
            const feed = response.data.feed;
            if (!feed) {
                throw new Error('No news data found');
            }

            this.setCache(cacheKey, feed);
            return feed;

        } catch (error) {
            console.error(`[AlphaVantage] Error fetching news for ${symbol}:`, error.message);
            throw error;
        }
    }

    // Get top gainers/losers
    async getTopGainersLosers() {
        const cacheKey = 'top-gainers-losers';
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'TOP_GAINERS_LOSERS',
                    apikey: ALPHA_VANTAGE_API_KEY
                }
            });

            const data = {
                topGainers: response.data.top_gainers || [],
                topLosers: response.data.top_losers || [],
                mostActivelyTraded: response.data.most_actively_traded || [],
                lastUpdated: response.data.last_updated
            };

            this.setCache(cacheKey, data);
            return data;

        } catch (error) {
            console.error('[AlphaVantage] Error fetching top gainers/losers:', error.message);
            throw error;
        }
    }

    // Search symbols
    async searchSymbols(keywords) {
        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    function: 'SYMBOL_SEARCH',
                    keywords: keywords,
                    apikey: ALPHA_VANTAGE_API_KEY
                }
            });

            return response.data.bestMatches || [];

        } catch (error) {
            console.error(`[AlphaVantage] Error searching for ${keywords}:`, error.message);
            throw error;
        }
    }
}

module.exports = new AlphaVantageService();