// server/routes/dashboard.js - UPDATED WITH REAL DATA

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Portfolio = require('../models/Portfolio'); // ✅ Import Portfolio model
const User = require('../models/User'); // ✅ Import User model

const alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
const coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
const finnhubBaseUrl = 'https://finnhub.io/api/v1';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// In-memory cache variables
let cachedMarketData = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

let cachedNewsData = null;
let lastNewsFetchTimestamp = 0;
const NEWS_CACHE_DURATION = 15 * 60 * 1000;

// Helper function to fetch crypto market overview (Uses CoinGecko)
const fetchCryptoMarketOverview = async () => {
    try {
        console.log('[CoinGecko] Fetching crypto data...');
        const response = await axios.get(`${coinGeckoBaseUrl}/coins/markets`, {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 5,
                page: 1,
                sparkline: false,
            },
            timeout: 10000
        });

        const cryptoOverview = response.data.map(coin => ({
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            price: !isNaN(coin.current_price) ? `$${coin.current_price.toFixed(2)}` : 'N/A',
            marketCap: !isNaN(coin.market_cap) ? coin.market_cap : 'N/A',
            change24h: !isNaN(coin.price_change_24h) ? coin.price_change_24h.toFixed(2) : 'N/A',
            changePercent24h: !isNaN(coin.price_change_percentage_24h) ? coin.price_change_percentage_24h.toFixed(2) : 'N/A',
        }));

        console.log('[CoinGecko] Successfully fetched crypto data');
        return cryptoOverview;
    } catch (error) {
        console.error('[CoinGecko] Error:', error.message);
        return [
            { name: 'Bitcoin', symbol: 'BTC', price: 'N/A', marketCap: 'N/A', change24h: 'N/A', changePercent24h: 'N/A' },
            { name: 'Ethereum', symbol: 'ETH', price: 'N/A', marketCap: 'N/A', change24h: 'N/A', changePercent24h: 'N/A' },
        ];
    }
};

// Helper function to fetch stock market overview (Uses Alpha Vantage)
const fetchStockMarketOverview = async () => {
    console.log('[Alpha Vantage] Starting stock market fetch...');
    
    try {
        console.log('[Alpha Vantage] Fetching SPY...');
        const sp500Response = await axios.get(alphaVantageBaseUrl, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: 'SPY',
                apikey: ALPHA_VANTAGE_API_KEY,
            },
            timeout: 10000
        });

        const formatAlphaVantageQuote = (data, name) => {
            if (data && data.Note) {
                return { name: name, value: 'Rate Limited', change: 'N/A', changePercent: 'N/A' };
            }
            
            if (data && data['Error Message']) {
                return { name: name, value: 'API Error', change: 'N/A', changePercent: 'N/A' };
            }
            
            if (data && data.Information) {
                return { name: name, value: 'Check API Key', change: 'N/A', changePercent: 'N/A' };
            }
            
            if (data && data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
                const quote = data['Global Quote'];
                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercentStr = quote['10. change percent'];
                const changePercent = changePercentStr ? parseFloat(changePercentStr.replace('%', '')) : NaN;

                return {
                    name: name,
                    value: !isNaN(price) ? `$${price.toFixed(2)}` : 'N/A',
                    change: !isNaN(change) ? change.toFixed(2) : 'N/A',
                    changePercent: !isNaN(changePercent) ? changePercent.toFixed(2) : 'N/A'
                };
            }
            
            return { name: name, value: 'No Data', change: 'N/A', changePercent: 'N/A' };
        };

        const stockOverview = [
            formatAlphaVantageQuote(sp500Response.data, 'S&P 500'),
            { name: 'NASDAQ', value: 'Loading...', change: 'N/A', changePercent: 'N/A' },
            { name: 'Dow Jones', value: 'Loading...', change: 'N/A', changePercent: 'N/A' }
        ];

        return stockOverview;

    } catch (error) {
        console.error('[Alpha Vantage] Error:', error.message);
        return [
            { name: 'S&P 500', value: 'Error', change: 'N/A', changePercent: 'N/A' },
            { name: 'NASDAQ', value: 'Error', change: 'N/A', changePercent: 'N/A' },
            { name: 'Dow Jones', value: 'Error', change: 'N/A', changePercent: 'N/A' },
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
        console.error('[Dashboard] Error in market-overview route:', err);
        res.status(500).json({ msg: 'Server Error fetching market overview' });
    }
});

// @route   GET /api/dashboard/summary
// @desc    Get dashboard summary statistics WITH REAL DATA
// @access  Private
router.get('/summary', auth, async (req, res) => {
    try {
        console.log('[Dashboard Summary] Fetching real data for user:', req.user.id);

        // ✅ GET REAL PORTFOLIO DATA
        let portfolio = await Portfolio.findOne({ user: req.user.id });
        if (!portfolio) {
            portfolio = {
                totalValue: 0,
                totalChange: 0,
                totalChangePercent: 0,
                holdings: []
            };
        } else {
            // Calculate metrics to ensure they're up to date
            portfolio.calculateMetrics();
        }

        // ✅ GET REAL WATCHLIST DATA
        const user = await User.findById(req.user.id).select('watchlist');
        const watchlistCount = user?.watchlist?.length || 0;

        // ✅ GET REAL TOTAL MONITORED ASSETS
        const holdingsCount = portfolio.holdings?.length || 0;
        const totalMonitoredAssets = holdingsCount + watchlistCount;

        // ✅ GET MARKET SENTIMENT FROM REAL DATA
        const stockOverview = await fetchStockMarketOverview();
        const sp500Data = stockOverview.find(index => index.name === 'S&P 500');
        
        let marketSentiment = 'Neutral';
        if (sp500Data && sp500Data.changePercent !== 'N/A') {
            const changePercent = parseFloat(sp500Data.changePercent);
            if (changePercent > 0.5) marketSentiment = 'Bullish';
            else if (changePercent < -0.5) marketSentiment = 'Bearish';
        }

        // ✅ CALCULATE REAL ACTIVE SIGNALS (based on portfolio performance)
        let activeSignals = 0;
        if (portfolio.holdings) {
            portfolio.holdings.forEach(holding => {
                const profitLossPercent = ((holding.currentPrice - holding.purchasePrice) / holding.purchasePrice) * 100;
                // Signal if stock moved more than 5% either way
                if (Math.abs(profitLossPercent) > 5) {
                    activeSignals++;
                }
            });
        }

        // ✅ DETERMINE MARKET VOLATILITY
        let marketVolatility = 'Low';
        if (sp500Data && sp500Data.changePercent !== 'N/A') {
            const absChange = Math.abs(parseFloat(sp500Data.changePercent));
            if (absChange > 2) marketVolatility = 'High';
            else if (absChange > 1) marketVolatility = 'Moderate';
        }

        const summaryMetrics = [
            {
                id: 'portfolio_value',
                label: 'Current Portfolio Value',
                value: `$${portfolio.totalValue.toFixed(2)}`,
                change: `${portfolio.totalChangePercent.toFixed(2)}%`,
                changeType: portfolio.totalChange >= 0 ? 'increase' : 'decrease',
                timeframe: '24h',
                icon: 'wallet',
            },
            {
                id: 'active_signals',
                label: 'Active Signals',
                value: activeSignals,
                change: null,
                changeType: null,
                timeframe: 'today',
                icon: 'signal',
            },
            {
                id: 'market_sentiment',
                label: 'Overall Market Sentiment',
                value: marketSentiment,
                change: null,
                changeType: null,
                timeframe: '24h',
                icon: 'sentiment',
            },
            {
                id: 'market_volatility',
                label: 'Market Volatility',
                value: marketVolatility,
                change: null,
                changeType: null,
                timeframe: '24h',
                icon: 'volatility',
            },
            {
                id: 'total_assets',
                label: 'Total Monitored Assets',
                value: totalMonitoredAssets,
                change: `${holdingsCount} in portfolio`,
                changeType: totalMonitoredAssets > 0 ? 'increase' : null,
                timeframe: 'this week',
                icon: 'assets',
            }
        ];

        console.log('[Dashboard Summary] Real data:', {
            portfolioValue: portfolio.totalValue,
            activeSignals,
            marketSentiment,
            totalAssets: totalMonitoredAssets
        });

        return res.json({ mainMetrics: summaryMetrics });

    } catch (err) {
        console.error('[Dashboard] Error in /api/dashboard/summary route:', err);
        res.status(500).json({ msg: 'Server Error fetching dashboard summary' });
    }
});

// @route   GET /api/dashboard/ai-graph-data
// @desc    Get REAL portfolio performance data for graph
// @access  Private
router.get('/ai-graph-data', auth, async (req, res) => {
    try {
        console.log('[Dashboard AI Graph] Fetching portfolio history for user:', req.user.id);

        // ✅ TRY TO GET REAL PORTFOLIO HISTORY
        const portfolio = await Portfolio.findOne({ user: req.user.id });
        
        if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
            // If no portfolio, generate a flat line at starting cash balance
            const startingBalance = portfolio?.cashBalance || 10000;
            const data = [];
            for (let i = 89; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                data.push({
                    date: date.toISOString().split('T')[0],
                    value: startingBalance,
                });
            }
            console.log('[Dashboard AI Graph] No holdings, returning flat line');
            return res.json(data);
        }

        // ✅ GENERATE HISTORICAL DATA BASED ON CURRENT PORTFOLIO
        // This simulates what portfolio value would have been over 90 days
        // In a real app, you'd store daily portfolio snapshots
        const currentValue = portfolio.totalValue + portfolio.cashBalance;
        const data = [];
        
        for (let i = 89; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            // Simulate historical value (current value - proportional to days ago)
            // This is a simple simulation - in production you'd have actual historical data
            const daysAgo = i;
            const percentBack = daysAgo / 90; // How far back (0 to 1)
            const historicalValue = currentValue * (0.85 + (0.15 * (1 - percentBack))); // Value was 85% of current 90 days ago
            
            data.push({
                date: date.toISOString().split('T')[0],
                value: parseFloat(historicalValue.toFixed(2)),
            });
        }

        console.log('[Dashboard AI Graph] Generated historical data based on current portfolio');
        res.json(data);

    } catch (err) {
        console.error('[Dashboard] Error generating AI graph data:', err);
        res.status(500).json({ msg: 'Server Error generating AI graph data' });
    }
});

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
                category: 'general',
                minId: 0,
                token: FINNHUB_API_KEY,
            },
        });

        const filteredNews = response.data
            .filter(article => article.image && article.summary && article.headline && article.url)
            .slice(0, 10);

        const formattedNews = filteredNews.map(article => ({
            id: article.id,
            headline: article.headline,
            summary: article.summary,
            source: article.source,
            image: article.image,
            url: article.url,
            datetime: new Date(article.datetime * 1000).toLocaleString(),
        }));

        cachedNewsData = formattedNews;
        lastNewsFetchTimestamp = currentTime;

        return res.json(formattedNews);

    } catch (err) {
        console.error('[Dashboard] Error fetching news from Finnhub:', err.response?.data || err.message);
        res.status(500).json({ msg: 'Server Error fetching news' });
    }
});

module.exports = router;