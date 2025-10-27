// server/routes/dashboard.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware'); // Corrected path: assuming auth.js is directly in server/middleware/
const alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
const coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';

// Load API keys from environment variables
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY; // CoinGecko doesn't always require a key for public endpoints, but good to have if needed for specific tiers

// In-memory cache variables for market-overview
let cachedMarketData = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes (in milliseconds)

// Helper function to fetch stock market overview
const fetchStockMarketOverview = async () => {
    try {
        // We'll use GLOBAL_QUOTE for major indices as discussed.
        // Alpha Vantage free tier has rate limits, be mindful if making many requests.
        const sp500Response = await axios.get(`${alphaVantageBaseUrl}`, { // Removed /query from URL as it's in baseUrl
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

        // Helper to format Alpha Vantage Global Quote
        const formatAlphaVantageQuote = (data, name) => {
            if (data && data['Global Quote']) {
                const quote = data['Global Quote'];
                // Ensure values are parsed as floats before toFixed
                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

                return {
                    name: name,
                    // Check if price is a valid number before formatting
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
        // Return default values in case of error
        return [
            { name: 'S&P 500', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
            { name: 'NASDAQ', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
            { name: 'Dow Jones', value: 'N/A', change: 'N/A', changePercent: 'N/A' },
        ];
    }
};

// Helper function to fetch crypto market overview
const fetchCryptoMarketOverview = async () => {
    try {
        const response = await axios.get(`${coinGeckoBaseUrl}/coins/markets`, {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 5, // Get top 5 cryptocurrencies
                page: 1,
                sparkline: false,
                // Add API key if CoinGecko requires it for your tier or if traffic is high
                // x_cg_demo_api_key: COINGECKO_API_KEY, // Example for CoinGecko's new key system
            },
        });

        const cryptoOverview = response.data.map(coin => ({
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            // Ensure price, change24h, changePercent24h are converted to numbers and then formatted safely
            price: !isNaN(coin.current_price) ? `$${coin.current_price.toFixed(2)}` : 'N/A',
            marketCap: !isNaN(coin.market_cap) ? coin.market_cap : 'N/A', // Potentially format marketCap better later
            change24h: !isNaN(coin.price_change_24h) ? coin.price_change_24h.toFixed(2) : 'N/A',
            changePercent24h: !isNaN(coin.price_change_percentage_24h) ? coin.price_change_percentage_24h.toFixed(2) : 'N/A',
        }));

        return cryptoOverview;
    } catch (error) {
        console.error('Error fetching crypto market overview from CoinGecko:', error.message);
        // Return default values in case of error
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

    // Check if cache is valid
    if (cachedMarketData && (currentTime - lastFetchTimestamp < CACHE_DURATION)) {
        console.log('[Dashboard] Serving market data from cache.');
        return res.json(cachedMarketData);
    }

    // If cache is expired or not present, fetch new data
    console.log('[Dashboard] Fetching new market data...');
    try {
        const stockOverview = await fetchStockMarketOverview();
        const cryptoOverview = await fetchCryptoMarketOverview();

        const marketData = {
            stockOverview,
            cryptoOverview,
        };

        // Update cache
        cachedMarketData = marketData;
        lastFetchTimestamp = currentTime;

        return res.json(marketData);
    } catch (err) {
        console.error('Error in market-overview route:', err);
        res.status(500).json({ msg: 'Server Error fetching market overview' });
    }
});


// @route   GET /api/dashboard/summary
// @desc    Get dashboard summary statistics
// @access  Private
router.get('/summary', auth, async (req, res) => {
    try {
        // In a real application, this data would come from your database,
        // calculated based on user's portfolio, signal performance, etc.
        // For now, returning mock data to satisfy the frontend.

        // You would typically have a Mongoose model for User, Signals, Portfolio etc.
        // Example if you had a User model with a portfolio:
        // const user = await User.findById(req.user.id).select('portfolio');
        // if (!user) return res.status(404).json({ msg: 'User not found' });
        // const portfolioValue = calculatePortfolioValue(user.portfolio); // A function you'd write
        // const signals = await Signal.find({ user: req.user.id, isActive: true });

        const mockSummary = {
            activeSignals: 5, // Placeholder
            portfolioGrowth: 7.25, // Placeholder percentage
            marketVolatility: 'Moderate', // Placeholder string
            lastUpdate: new Date().toISOString() // Current server time
        };

        console.log('[Dashboard] Serving dashboard summary data.');
        return res.json(mockSummary);

    } catch (err) {
        console.error('Error in /api/dashboard/summary route:', err);
        res.status(500).json({ msg: 'Server Error fetching dashboard summary' });
    }
});


module.exports = router;