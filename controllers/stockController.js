// server/controllers/stockController.js

const axios = require('axios');

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
        volume: parseFloat(values['6. volume']),
    }));

    // Sort oldest to newest, which frontend charting libraries expect
    return formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));
};

// Helper function to format Alpha Vantage intraday data for frontend
const formatIntradayData = (data, interval) => {
    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) return [];

    const formattedData = Object.entries(timeSeries).map(([dateTime, values]) => {
        return {
            time: new Date(dateTime).getTime() / 1000, // Unix timestamp in seconds
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseFloat(values['6. volume']),
        };
    });

    return formattedData.sort((a, b) => a.time - b.time);
};

// @desc    Get historical stock data for a given symbol and range with caching
// @access  Private
exports.getHistoricalData = async (req, res) => {
    const { symbol } = req.params;
    const { range, interval, outputsize } = req.query;

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
        if (['1D', '5D'].includes(range)) {
            alphaVantageFunction = 'TIME_SERIES_INTRADAY';
            params.interval = interval || '5min';
            if (interval && !['1min', '5min', '15min', '30min', '60min'].includes(interval)) {
                 params.interval = '5min'; // Fallback
            }
            params.outputsize = 'full';
        } else {
            // For ranges like 1M, 6M, 1Y, YTD, MAX, use daily adjusted
            alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
            params.outputsize = 'full';
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

            // This filtering logic is robust and should remain here:
            switch (range) {
                case '1D':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    formattedData = formattedData.filter(d => d.time >= startDate.getTime() / 1000);
                    break;
                case '5D':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 5);
                    startDate.setHours(0, 0, 0, 0);
                    formattedData = formattedData.filter(d => d.time >= startDate.getTime() / 1000);
                    break;
                case '1M':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 1);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '3M':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 3);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '6M':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 6);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '1Y':
                    startDate = new Date(now);
                    startDate.setFullYear(now.getFullYear() - 1);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case '5Y':
                    startDate = new Date(now);
                    startDate.setFullYear(now.getFullYear() - 5);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'YTD':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    formattedData = formattedData.filter(d => new Date(d.time) >= startDate);
                    break;
                case 'MAX':
                    break;
            }
            // Final sort to ensure chronological order after filtering
            formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));
        }

        // === Store data in cache ===
        stockDataCache.set(cacheKey, { data: formattedData, timestamp: currentTime });
        // === END CACHE ===

        // The frontend expects the historical data to be under a 'historicalData' key
        // Note: The frontend PredictPage.js will expect additional keys like predictedPrice, etc.
        // We are adding placeholders for those required keys now.
        return res.json({
            msg: 'Historical data fetched successfully (no prediction model run)',
            historicalData: formattedData,
            // --- Placeholder Prediction Keys ---
            predictedPrice: formattedData.length > 0 ? formattedData[formattedData.length - 1].close : 0, // Last known close price
            predictedDirection: 'Neutral',
            confidence: 50.00,
            predictionMessage: 'Historical data retrieved successfully. Prediction model pending.',
            // --- End Placeholder Keys ---
        });

    } catch (err) {
        console.error('Server error fetching historical stock data:', err.message);
        if (err.response) {
            console.error('Alpha Vantage response error:', err.response.data);
            if (err.response.status === 429) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(err.response.status).json({ msg: err.response.data['Error Message'] || 'Error from Alpha Vantage API' });
        }
        res.status(500).json({ msg: 'Server Error fetching historical stock data' });
    }
};