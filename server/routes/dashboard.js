const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware'); // Corrected path

const alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
const coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3'; // Keep this

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY; // Keep this

// In-memory cache variables for market-overview
let cachedMarketData = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes (in milliseconds)

// Helper function to fetch stock market overview (Uses Alpha Vantage)
const fetchStockMarketOverview = async () => {
    try {
        const sp500Response = await axios.get(`${alphaVantageBaseUrl}`, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: '^GSPC', // S&P 500 Index (common symbol)
                apikey: ALPHA_VANTAGE_API_KEY,
            }
        });

        const nasdaqResponse = await axios.get(`${alphaVantageBaseUrl}`, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: '^IXIC', // NASDAQ Composite Index
                apikey: ALPHA_VANTAGE_API_KEY,
            }
        });

        const dowResponse = await axios.get(`${alphaVantageBaseUrl}`, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: '^DJI', // Dow Jones Industrial Average
                apikey: ALPHA_VANTAGE_API_KEY,
            }
        });

        const formatAlphaVantageQuote = (data, name) => {
            if (data && data['Global Quote']) {
                const quote = data['Global Quote'];
                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

                return {
                    name: name,
                    value: !isNaN(price) ? `$${price.toFixed(2)}` : 'N/A',
                    change: !isNaN(change) ? change.toFixed(2) : 'N/A',
                    changePercent: !isNaN(changePercent) ? changePercent.toFixed(2) : 'N/A'
                };
            }
            return { name: name, value: 'N/A', change: 'N/A', changePercent: 'N/A' };
        };

        const stockOverview = [
            formatAlphaVantageQuote(sp500Response.data, 'S&P 500'),
            formatAlphaVantageQuote(nasdaqResponse.data, 'NASDAQ'),
            formatAlphaVantageQuote(dowResponse.data, 'Dow Jones')
        ];

        return stockOverview;

    } catch (error) {
        console.error('Error fetching stock market overview from Alpha Vantage:', error.message);
        return [
            { name: 'S&P 500', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
            { name: 'NASDAQ', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
            { name: 'Dow Jones', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
        ];
    }
};

// Helper function to fetch crypto market overview (Uses CoinGecko)
const fetchCryptoMarketOverview = async () => {
    try {
        const response = await axios.get(`${coinGeckoBaseUrl}/coins/markets`, {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 5,
                page: 1,
                sparkline: false,
            },
        });

        const cryptoOverview = response.data.map(coin => ({
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            price: !isNaN(coin.current_price) ? `$${coin.current_price.toFixed(2)}` : 'N/A',
            marketCap: !isNaN(coin.market_cap) ? coin.market_cap : 'N/A',
            change24h: !isNaN(coin.price_change_24h) ? coin.price_change_24h.toFixed(2) : 'N/A',
            changePercent24h: !isNaN(coin.price_change_percentage_24h) ? coin.price_change_percentage_24h.toFixed(2) : 'N/A',
        }));

        return cryptoOverview;
    } catch (error) {
        console.error('Error fetching crypto market overview from CoinGecko:', error.message);
        return [
            { name: 'Bitcoin', symbol: 'BTC', price: 'N/A', marketCap: 'N/A', change24h: 'N/A', changePercent24h: 'N/A' },
            { name: 'Ethereum', symbol: 'ETH', price: 'N/A', marketCap: 'N/A', change24h: 'N/A', changePercent24h: 'N/A' },
        ];
    }
};

// @route   GET /api/dashboard/market-overview
// @desc    Get consolidated market overview data (stocks and crypto) with caching
// @access  Private
router.get('/market-overview', auth, async (req, res) => {
    const currentTime = Date.now();

    if (cachedMarketData && (currentTime - lastFetchTimestamp < CACHE_DURATION)) {
        console.log('[Dashboard] Serving market data from cache.');
        return res.json(cachedMarketData);
    }

    console.log('[Dashboard] Fetching new market data...');
    try {
        const stockOverview = await fetchStockMarketOverview();
        const cryptoOverview = await fetchCryptoMarketOverview();

        const marketData = {
            stockOverview,
            cryptoOverview,
        };

        cachedMarketData = marketData;
        lastFetchTimestamp = currentTime;

        return res.json(marketData);
    } catch (err) {
        console.error('Error in market-overview route:', err);
        res.status(500).json({ msg: 'Server Error fetching market overview' });
    }
});

// @route   GET /api/dashboard/summary
// @desc    Get dashboard summary statistics (MODIFIED)
// @access  Private
router.get('/summary', auth, async (req, res) => {
    try {
        // Fetch S&P 500 data to use for a metric
        const stockOverview = await fetchStockMarketOverview();
        const sp500Data = stockOverview.find(index => index.name === 'S&P 500');

        // Generate other mock data points
        const activeSignals = Math.floor(Math.random() * 10) + 3; // 3-12 signals
        const portfolioGrowth = (Math.random() * 15 - 5).toFixed(2); // -5% to +10%
        const marketVolatilityOptions = ['Low', 'Moderate', 'High'];
        const marketVolatility = marketVolatilityOptions[Math.floor(Math.random() * marketVolatilityOptions.length)];
        const totalAssets = Math.floor(Math.random() * 50) + 10; // 10-60 assets

        const summaryMetrics = [
            {
                id: 'portfolio_value',
                label: 'Current Portfolio Value',
                value: `$${(Math.random() * 50000 + 5000).toFixed(2)}`, // Placeholder value for now
                change: `${portfolioGrowth}%`,
                changeType: parseFloat(portfolioGrowth) >= 0 ? 'increase' : 'decrease',
                timeframe: '24h',
                icon: 'wallet',
            },
            {
                id: 'active_signals',
                label: 'Active Signals',
                value: activeSignals,
                change: null, // No numeric change for active signals usually
                changeType: null,
                timeframe: 'today',
                icon: 'signal',
            },
            {
                id: 'market_sentiment',
                label: 'Overall Market Sentiment',
                value: sp500Data && sp500Data.changePercent !== 'N/A'
                               ? (parseFloat(sp500Data.changePercent) > 0 ? 'Bullish' : 'Bearish')
                               : 'Neutral', // Use S&P 500 for a more realistic sentiment
                change: null,
                changeType: null,
                timeframe: '24h',
                icon: 'sentiment',
            },
            {
                id: 'market_volatility', // New metric based on previous discussion
                label: 'Market Volatility',
                value: marketVolatility,
                change: null,
                changeType: null,
                timeframe: '24h',
                icon: 'volatility', // You'd map this to a specific icon
            },
             {
                id: 'total_assets',
                label: 'Total Monitored Assets',
                value: totalAssets,
                change: `${(Math.random() * 5 - 2).toFixed(0)}`, // e.g., +3 new assets
                changeType: Math.random() > 0.5 ? 'increase' : 'decrease',
                timeframe: 'this week',
                icon: 'assets',
            }
        ];

        console.log('[Dashboard] Serving dashboard summary data.');
        return res.json({ mainMetrics: summaryMetrics }); // Return as an object with 'mainMetrics' key

    } catch (err) {
        console.error('Error in /api/dashboard/summary route:', err);
        res.status(500).json({ msg: 'Server Error fetching dashboard summary' });
    }
});
// @route   GET /api/dashboard/ai-graph-data
// @desc    Get mock historical AI performance data for graph
// @access  Private
router.get('/ai-graph-data', auth, (req, res) => {
    try {
        const generateMockChartData = () => {
            const data = [];
            let currentValue = 10000; // Starting portfolio value
            const days = 90; // Data for the last 90 days

            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (days - 1 - i)); // Go back 'days' from today

                // Simulate daily change: mostly small fluctuations, occasional larger moves
                const fluctuation = (Math.random() - 0.5) * 200; // -100 to +100
                const trend = i * 20; // Upward trend over time
                currentValue += fluctuation + trend / days; // Add trend influence gradually

                // Ensure value doesn't go below a certain point if you want
                if (currentValue < 5000) currentValue = 5000;

                data.push({
                    date: date.toISOString().split('T')[0], // YYYY-MM-DD format
                    value: parseFloat(currentValue.toFixed(2)),
                });
            }
            return data;
        };

        const chartData = generateMockChartData();
        console.log('[Dashboard] Serving mock AI graph data.');
        res.json(chartData);

    } catch (err) {
        console.error('Error generating AI graph data:', err);
        res.status(500).json({ msg: 'Server Error generating AI graph data' });
    }
});const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY; // Add this line near other API key declarations
const finnhubBaseUrl = 'https://finnhub.io/api/v1'; // Add this line near other base URL declarations

// In-memory cache variables for news
let cachedNewsData = null;
let lastNewsFetchTimestamp = 0;
const NEWS_CACHE_DURATION = 15 * 60 * 1000; // Cache news for 15 minutes

// @route   GET /api/dashboard/news
// @desc    Get latest financial news from Finnhub with caching
// @access  Private
router.get('/news', auth, async (req, res) => {
    const currentTime = Date.now();

    if (cachedNewsData && (currentTime - lastNewsFetchTimestamp < NEWS_CACHE_DURATION)) {
        console.log('[Dashboard] Serving news data from cache.');
        return res.json(cachedNewsData);
    }

    console.log('[Dashboard] Fetching new news data from Finnhub...');
    try {
        const response = await axios.get(`${finnhubBaseUrl}/news`, {
            params: {
                category: 'general', // You can change category (e.g., 'forex', 'crypto', 'merger')
                minId: 0, // Fetch the latest news
                token: FINNHUB_API_KEY,
            },
        });

        // Filter out news without image or summary for better display
        const filteredNews = response.data
            .filter(article => article.image && article.summary && article.headline && article.url)
            .slice(0, 10); // Limit to top 10 articles

        const formattedNews = filteredNews.map(article => ({
            id: article.id,
            headline: article.headline,
            summary: article.summary,
            source: article.source,
            image: article.image,
            url: article.url,
            datetime: new Date(article.datetime * 1000).toLocaleString(), // Convert Unix timestamp to readable date
        }));

        cachedNewsData = formattedNews;
        lastNewsFetchTimestamp = currentTime;

        return res.json(formattedNews);

    } catch (err) {
        console.error('Error fetching news from Finnhub:', err.response?.data || err.message);
        res.status(500).json({ msg: 'Server Error fetching news' });
    }
});
module.exports = router;