const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware'); // Assuming this path is correct

// NEW: Debugging middleware specific to the stockRoutes router
router.use((req, res, next) => {
    console.log(`[STOCKROUTES DEBUG] Stock Router activated. Base URL: ${req.baseUrl}, Path: ${req.path}`);
    next();
});

const alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// === NEW: In-memory cache for historical stock data ===
const stockDataCache = new Map(); // Stores data like: Map<cacheKey, { data: [], timestamp: Date }>
const STOCK_CACHE_DURATION = 10 * 60 * 1000; // Cache for 10 minutes (in milliseconds)
// === END NEW CACHE VARIABLES ===

// Helper function to format Alpha Vantage daily data for lightweight-charts
const formatDailyData = (data) => {
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];

    const formattedData = Object.entries(timeSeries).map(([date, values]) => ({
        time: date, // YYYY-MM-DD for daily data
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
    }));

    // Sort oldest to newest, which lightweight-charts expects
    return formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));
};

// Helper function to format Alpha Vantage intraday data for lightweight-charts
const formatIntradayData = (data, interval) => {
    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) return [];

    const formattedData = Object.entries(timeSeries).map(([dateTime, values]) => {
        // Lightweight-charts prefers UTC timestamps for intraday, or YYYY-MM-DD HH:MM:SS
        return {
            time: new Date(dateTime).getTime() / 1000, // Unix timestamp in seconds
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
        };
    });

    return formattedData.sort((a, b) => a.time - b.time);
};


// @route   GET /api/stocks/historical/:symbol
// @desc    Get historical stock data for a given symbol and range with caching
// @access  Private
router.get('/historical/:symbol', auth, async (req, res) => {
    const { symbol } = req.params;
    const { range, interval, outputsize } = req.query; // e.g., range=1M, interval=1day

    if (!symbol) {
        return res.status(400).json({ msg: 'Stock symbol is required' });
    }
    if (!ALPHA_VANTAGE_API_KEY) {
        console.error('ALPHA_VANTAGE_API_KEY is not set in environment variables.');
        return res.status(500).json({ msg: 'Server configuration error: Alpha Vantage API key missing.' });
    }

    // === NEW: Caching Logic ===
    const cacheKey = `${symbol}-${range}-${interval || 'default'}-${outputsize || 'default'}`;
    const cachedEntry = stockDataCache.get(cacheKey);
    const currentTime = Date.now();

    if (cachedEntry && (currentTime - cachedEntry.timestamp < STOCK_CACHE_DURATION)) {
        console.log(`[Stocks] Serving historical data for ${symbol} (range: ${range}) from cache.`);
        return res.json(cachedEntry.data);
    }
    // === END NEW CACHING LOGIC ===


    console.log(`[Stocks] Fetching NEW historical data for ${symbol} (range: ${range}) from Alpha Vantage.`);
    try {
        let alphaVantageFunction = '';
        let params = { apikey: ALPHA_VANTAGE_API_KEY, symbol: symbol };
        let formattedData = [];

        switch (range) {
            case '1D':
                alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                params.interval = interval || '5min';
                params.outputsize = outputsize || 'compact'; // 'compact' is default for most recent ~100 points
                break;

            case '5D':
                 alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                 params.interval = interval || '60min'; // Default to 60min for 5D
                 params.outputsize = outputsize || 'full'; // Need more data for 5 days
                 break;

            case '1M':
            case '6M':
            case '1Y':
            case 'YTD':
            case 'MAX':
                alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
                params.outputsize = 'full';
                break;
            default:
                alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
                params.outputsize = 'full';
                break;
        }

        params.function = alphaVantageFunction;

        const response = await axios.get(alphaVantageBaseUrl, { params });
        const avData = response.data;

        if (avData['Error Message']) {
            console.error('Alpha Vantage Error:', avData['Error Message']);
            // Specifically check for rate limit error
            if (avData['Error Message'].includes('Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.')) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(400).json({ msg: avData['Error Message'] });
        }
        // Handle case where no time series data is returned but no explicit error message
        if (!avData['Time Series (Daily)'] && !Object.keys(avData).some(key => key.startsWith('Time Series ('
        ))) {
             console.log(`No time series data found for ${symbol} with function ${alphaVantageFunction}. Response keys:`, Object.keys(avData));
             // If there's an "Information" field, it might indicate API limit or no data for symbol
             if (avData.Information && avData.Information.includes('API call frequency is 5 calls per minute')) {
                 return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
             }
             if (avData.Note && avData.Note.includes('Please consider optimizing your API call frequency')) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit might be exceeded. Please try again in a moment.' });
             }
             return res.status(404).json({ msg: `No historical data found for symbol: ${symbol}. It might be an invalid symbol or no data is available for the requested range.` });
        }


        // Format data based on the Alpha Vantage function used
        if (alphaVantageFunction.includes('INTRADAY')) {
            formattedData = formatIntradayData(avData, params.interval);
        } else if (alphaVantageFunction.includes('DAILY')) {
            formattedData = formatDailyData(avData);
        }

        // Apply filtering for specific ranges (e.g., YTD, 1D, 5D)
        if (formattedData.length > 0) {
            const today = new Date();
            let startDate;

            switch (range) {
                case '1D':
                    // Filter to only include today's data from intraday
                    startDate = new Date(today.setHours(0, 0, 0, 0));
                    formattedData = formattedData.filter(d => new Date(d.time * 1000) >= startDate);
                    break;
                case '5D':
                    startDate = new Date(today.setDate(today.getDate() - 5));
                    // Intraday data for 5 days. Filter by UNIX timestamp
                    formattedData = formattedData.filter(d => new Date(d.time * 1000) >= startDate);
                    break;
                case '1M':
                    startDate = new Date(today.setMonth(today.getMonth() - 1));
                    // Daily data for 1 month. Filter by YYYY-MM-DD string
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '6M':
                    startDate = new Date(today.setMonth(today.getMonth() - 6));
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '1Y':
                    startDate = new Date(today.setFullYear(today.getFullYear() - 1));
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'YTD':
                    startDate = new Date(today.getFullYear(), 0, 1);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'MAX':
                    // 'MAX' already implies 'full' outputsize, no further date filtering needed
                    break;
            }
        }
        
        // === NEW: Store data in cache ===
        stockDataCache.set(cacheKey, { data: formattedData, timestamp: currentTime });
        // === END NEW CACHE ===

        return res.json(formattedData);

    } catch (err) {
        console.error('Server error fetching historical stock data:', err.message);
        if (err.response) {
            console.error('Alpha Vantage response error:', err.response.data);
            if (err.response.status === 429) { // Explicitly catch 429 for rate limiting
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(err.response.status).json({ msg: err.response.data['Error Message'] || 'Error from Alpha Vantage API' });
        }
        res.status(500).json({ msg: 'Server Error fetching historical stock data' });
    }
});


module.exports = router;