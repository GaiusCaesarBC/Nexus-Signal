// server/routes/stockRoutes.js - CONSOLIDATED & UPDATED
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

// Helper function to format Alpha Vantage daily data for frontend
const formatDailyData = (data) => {
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];

    const formattedData = Object.entries(timeSeries).map(([date, values]) => ({
        time: date, // YYYY-MM-DD for daily data
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['6. volume']), // Added volume
    }));

    // Sort oldest to newest, which lightweight-charts (and our frontend chart) expects
    return formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));
};

// Helper function to format Alpha Vantage intraday data for frontend
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
            volume: parseFloat(values['6. volume']), // Added volume
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

    // === Caching Logic ===
    const cacheKey = `${symbol}-${range}-${interval || 'default'}-${outputsize || 'default'}`;
    const cachedEntry = stockDataCache.get(cacheKey);
    const currentTime = Date.now();

    if (cachedEntry && (currentTime - cachedEntry.timestamp < STOCK_CACHE_DURATION)) {
        console.log(`[Stocks] Serving historical data for ${symbol} (range: ${range}) from cache.`);
        return res.json({ msg: 'Historical data fetched successfully (cached)', historicalData: cachedEntry.data });
    }
    // === END CACHING LOGIC ===


    console.log(`[Stocks] Fetching NEW historical data for ${symbol} (range: ${range}) from Alpha Vantage.`);
    try {
        let alphaVantageFunction = '';
        let params = { apikey: ALPHA_VANTAGE_API_KEY, symbol: symbol };
        let formattedData = [];

        // Determine Alpha Vantage function based on requested range/interval
        // Note: Alpha Vantage 'interval' is only for intraday. Daily uses 'full' or 'compact' outputsize.
        if (['1D', '5D'].includes(range)) {
            alphaVantageFunction = 'TIME_SERIES_INTRADAY';
            params.interval = interval || '5min'; // Frontend sends '1d', '5d', etc. need to map to AV intervals
            // For 1D, you generally want high resolution. For 5D, 60min might be more appropriate.
            // Let's ensure the interval is valid for AV and chosen wisely.
            // Valid AV intraday intervals: 1min, 5min, 15min, 30min, 60min.
            if (interval && !['1min', '5min', '15min', '30min', '60min'].includes(interval)) {
                 // Fallback to a default if frontend sends an incompatible interval for intraday
                 params.interval = '5min';
            }
            params.outputsize = 'full'; // Always request full for better range control on backend
        } else {
            // For ranges like 1M, 6M, 1Y, YTD, MAX, use daily adjusted
            alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
            params.outputsize = 'full'; // Always request full to apply custom filtering below
        }

        params.function = alphaVantageFunction;

        const response = await axios.get(alphaVantageBaseUrl, { params });
        const avData = response.data;

        if (avData['Error Message']) {
            console.error('Alpha Vantage Error:', avData['Error Message']);
            if (avData['Error Message'].includes('Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.')) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(400).json({ msg: avData['Error Message'] });
        }
        if (!avData['Time Series (Daily)'] && !Object.keys(avData).some(key => key.startsWith('Time Series ('
        ))) {
            console.log(`No time series data found for ${symbol} with function ${alphaVantageFunction}. Response keys:`, Object.keys(avData));
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

        // Apply filtering for specific ranges (e.g., YTD, 1D, 5D, 1M, 6M, 1Y)
        if (formattedData.length > 0) {
            const now = new Date();
            let startDate;

            switch (range) {
                case '1D':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
                    // Intraday data 'time' is Unix timestamp (seconds), so convert startDate to Unix too
                    formattedData = formattedData.filter(d => d.time >= startDate.getTime() / 1000);
                    break;
                case '5D':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 5);
                    startDate.setHours(0, 0, 0, 0); // Start of 5 days ago
                    formattedData = formattedData.filter(d => d.time >= startDate.getTime() / 1000);
                    break;
                case '1M':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 1);
                    startDate.setHours(0, 0, 0, 0); // Start of 1 month ago
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '3M': // Added 3 Months
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 3);
                    startDate.setHours(0, 0, 0, 0); // Start of 3 months ago
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '6M':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 6);
                    startDate.setHours(0, 0, 0, 0); // Start of 6 months ago
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '1Y':
                    startDate = new Date(now);
                    startDate.setFullYear(now.getFullYear() - 1);
                    startDate.setHours(0, 0, 0, 0); // Start of 1 year ago
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '5Y': // Added 5 Years
                    startDate = new Date(now);
                    startDate.setFullYear(now.getFullYear() - 5);
                    startDate.setHours(0, 0, 0, 0); // Start of 5 years ago
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'YTD':
                    startDate = new Date(now.getFullYear(), 0, 1); // Start of current year
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'MAX':
                    // 'MAX' already implies 'full' outputsize and no further date filtering
                    break;
            }
            // Ensure data is sorted by time for chart consistency after filtering
            if (formattedData.length > 0 && typeof formattedData[0].time === 'number') {
                // Intraday data uses Unix timestamp
                formattedData.sort((a, b) => a.time - b.time);
            } else {
                // Daily data uses YYYY-MM-DD string
                formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));
            }
        }

        // === Store data in cache ===
        stockDataCache.set(cacheKey, { data: formattedData, timestamp: currentTime });
        // === END CACHE ===

        // The frontend expects the historical data to be under a 'historicalData' key
        return res.json({ msg: 'Historical data fetched successfully', historicalData: formattedData });

    } catch (err) {
        console.error('Server error fetching historical stock data:', err.message);
        if (err.response) {
            console.error('Alpha Vantage response error:', err.response.data);
            if (err.response.status === 429) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            // Generic error for other AV issues
            return res.status(err.response.status).json({ msg: err.response.data['Error Message'] || 'Error from Alpha Vantage API' });
        }
        res.status(500).json({ msg: 'Server Error fetching historical stock data' });
    }
});


module.exports = router;