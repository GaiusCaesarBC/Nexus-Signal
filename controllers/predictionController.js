// server/controllers/predictionController.js

const axios = require('axios');
// const config = require('config'); // If you use node-config, uncomment and manage keys there

// === API Keys (Ensure these are set in your Render Environment Variables) ===
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY; // For stock-related Finnhub calls
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY; // For stock-related Alpha Vantage calls
const CRYPTO_COMPARE_API_KEY = process.env.CRYPTO_COMPARE_API_KEY; // For crypto data
// === END API Keys ===

// =========================================================
// GENERAL HELPERS
// =========================================================

// Helper function to get start and end timestamps based on interval
const getDatesFromInterval = (interval, type) => {
    const now = Date.now(); // Current timestamp in milliseconds
    let startTime;
    const endTime = Math.floor(now / 1000); // Unix timestamp in seconds

    // Adjust for specific API limits if needed, e.g., CryptoCompare free tier limit of ~2000 points
    switch (interval) {
        // Intraday
        case '1m': startTime = Math.floor((now - 2 * 24 * 60 * 60 * 1000) / 1000); break; // Last 2 days for 1-min data
        case '5m': startTime = Math.floor((now - 5 * 24 * 60 * 60 * 1000) / 1000); break; // Last 5 days for 5-min data
        case '1h': startTime = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000); break; // Last 30 days for 1-hour data
        case '5h': startTime = Math.floor((now - 90 * 24 * 60 * 60 * 1000) / 1000); break; // Last 90 days for 5-hour data (approx)
        case '12h': startTime = Math.floor((now - 180 * 24 * 60 * 60 * 1000) / 1000); break; // Last 180 days for 12-hour data (approx)

        // Daily/Longer Term
        case '1d': startTime = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000); break; // Last 1 year for daily data
        case '1w': startTime = Math.floor((now - 2 * 365 * 24 * 60 * 60 * 1000) / 1000); break; // Last 2 years for weekly data
        case '1mo': startTime = Math.floor((now - 5 * 365 * 24 * 60 * 60 * 1000) / 1000); break; // Last 5 years for monthly data
        case '6mo': startTime = Math.floor((now - 365 / 2 * 24 * 60 * 60 * 1000) / 1000); break; // Last 0.5 year for 6 month data
        case '1y': startTime = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000); break; // Last 1 year for 1 year data
        default:
            startTime = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000); // Default to 1 year historical
    }
    return { startTime, endTime };
};

// =========================================================
// STOCK PREDICTION LOGIC
// =========================================================
const alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
const stockDataCache = new Map();
const STOCK_CACHE_DURATION = 10 * 60 * 1000;

const formatDailyData = (data) => {
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];
    return Object.entries(timeSeries).map(([date, values]) => ({
        time: new Date(date).getTime() / 1000,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['6. volume']),
    })).sort((a, b) => a.time - b.time);
};

const formatIntradayData = (data, interval) => {
    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) return [];
    return Object.entries(timeSeries).map(([dateTime, values]) => ({
        time: new Date(dateTime).getTime() / 1000,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['6. volume']),
    })).sort((a, b) => a.time - b.time);
};

exports.getStockPrediction = async (req, res) => {
    const { symbol, interval } = req.params;

    if (!symbol) {
        return res.status(400).json({ msg: 'Stock symbol is required' });
    }
    if (!ALPHA_VANTAGE_API_KEY) {
        console.error('ALPHA_VANTAGE_API_KEY is not set.');
        return res.status(500).json({ msg: 'Server configuration error: Stock API key missing.' });
    }

    const cacheKey = `stock-prediction-${symbol}-${interval}`;
    const cachedEntry = stockDataCache.get(cacheKey);
    const currentTime = Date.now();

    if (cachedEntry && (currentTime - cachedEntry.timestamp < STOCK_CACHE_DURATION)) {
        console.log(`[Prediction:Stock] Serving data for ${symbol} (${interval}) from cache.`);
        return res.json(cachedEntry.data); // Return the full cached object
    }

    console.log(`[Prediction:Stock] Fetching NEW data for ${symbol} (${interval}) from Alpha Vantage.`);
    try {
        let alphaVantageFunction = '';
        let avInterval = '';
        let params = { apikey: ALPHA_VANTAGE_API_KEY, symbol: symbol, outputsize: 'full' };
        let formattedData = [];

        // Map frontend interval to Alpha Vantage specific interval/function
        switch (interval) {
            case '1m':
            case '5m':
            case '1h': // Alpha Vantage uses '60min' for 1h
                alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                avInterval = interval === '1h' ? '60min' : interval.replace('m', 'min');
                params.interval = avInterval;
                break;
            case '5h': // 5 hours - Alpha Vantage doesn't have 5h, get 60min and aggregate
            case '12h': // 12 hours - Alpha Vantage doesn't have 12h, get 60min and aggregate
                alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                avInterval = '60min'; // Fetch 60min data and filter/aggregate on backend
                params.interval = avInterval;
                break;
            case '1d': // Daily
            case '1w': // Weekly - Alpha Vantage has TIME_SERIES_WEEKLY
            case '1mo': // Monthly - Alpha Vantage has TIME_SERIES_MONTHLY
            case '6mo': // Use daily and filter
            case '1y': // Use daily and filter
                alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
                break;
            default:
                alphaVantageFunction = 'TIME_SERIES_DAILY_ADJUSTED';
                break;
        }

        params.function = alphaVantageFunction;

        const response = await axios.get(alphaVantageBaseUrl, { params });
        const avData = response.data;

        if (avData['Error Message'] || avData.Note) {
            console.error('Alpha Vantage Error:', avData['Error Message'] || avData.Note);
            if ((avData['Error Message'] || avData.Note).includes('frequency is 5 calls per minute')) {
                return res.status(429).json({ msg: 'Alpha Vantage API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(400).json({ msg: avData['Error Message'] || avData.Note || 'Invalid stock symbol or data not available.' });
        }

        if (alphaVantageFunction.includes('INTRADAY')) {
            formattedData = formatIntradayData(avData, avInterval);
        } else { // Daily, Weekly, Monthly Adjusted
            formattedData = formatDailyData(avData);
        }

        // Apply filtering for specific ranges (e.g., 6mo, 1y for Daily data)
        if (formattedData.length > 0 && ['6mo', '1y'].includes(interval)) {
            const now = new Date();
            let startDate;
            if (interval === '6mo') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            } else if (interval === '1y') {
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            }
            formattedData = formattedData.filter(d => new Date(d.time * 1000) >= startDate);
        }

        // --- Placeholder Prediction Logic (adjust as needed for actual ML model) ---
        let predictedPrice = 0;
        let predictionMessage = 'No specific prediction model is integrated yet.';
        let historicalDataPoints = formattedData.length;

        if (historicalDataPoints > 0) {
            const lastClose = formattedData[historicalDataPoints - 1].close;
            // Simple placeholder: Last price + a small random change
            predictedPrice = lastClose * (1 + (Math.random() - 0.5) * 0.005); // +/- 0.25%
            predictionMessage = `Based on historical data, the projected next price is: $${predictedPrice.toFixed(2)}.`;
        }

        // Append the "predicted" point to the data for charting
        const lastTimestamp = historicalDataPoints > 0 ? formattedData[historicalDataPoints - 1].time : Math.floor(Date.now() / 1000);
        const predictionTimestamp = lastTimestamp + (interval.includes('m') || interval.includes('h') ? 3600 : 86400); // 1 hour or 1 day after last point

        // Prepare response in the format expected by PredictPage.js
        const responseData = {
            symbol,
            interval,
            data: [
                ...formattedData.map(item => ({ ...item, predictedPrice: null })), // Historical points only have actualPrice
                {
                    time: predictionTimestamp,
                    open: null, high: null, low: null, actualPrice: null, // Predicted point has no actual data
                    close: predictedPrice, // Use close for prediction
                    predictedPrice: predictedPrice, // Explicitly set predictedPrice
                    volume: null
                }
            ],
            predictedPrice: predictedPrice,
            predictionMessage: predictionMessage,
        };

        stockDataCache.set(cacheKey, { data: responseData, timestamp: currentTime });
        return res.json(responseData);

    } catch (err) {
        console.error(`[Prediction:Stock] Error fetching prediction for ${symbol} (${interval}):`, err.message);
        if (err.response) {
            console.error('External API response error:', err.response.data);
            if (err.response.status === 429) {
                return res.status(429).json({ msg: 'API rate limit exceeded. Please try again in a moment.' });
            }
            return res.status(err.response.status).json({ msg: err.response.data['Error Message'] || 'Error from stock data API' });
        }
        res.status(500).json({ msg: 'Server Error fetching stock prediction.' });
    }
};

// =========================================================
// CRYPTO PREDICTION LOGIC
// =========================================================

const cryptoDataCache = new Map();
const CRYPTO_CACHE_DURATION = 10 * 60 * 1000;

exports.getCryptoPrediction = async (req, res) => {
    const { symbol, interval } = req.params; // symbol like BTC, ETH
    const tsym = 'USD'; // Target symbol, always USD for now

    if (!symbol) {
        return res.status(400).json({ msg: 'Crypto symbol is required' });
    }
    if (!CRYPTO_COMPARE_API_KEY) {
        console.error('CRYPTO_COMPARE_API_KEY is not set.');
        return res.status(500).json({ msg: 'Server configuration error: Crypto API key missing.' });
    }

    const cacheKey = `crypto-prediction-${symbol}-${interval}`;
    const cachedEntry = cryptoDataCache.get(cacheKey);
    const currentTime = Date.now();

    if (cachedEntry && (currentTime - cachedEntry.timestamp < CRYPTO_CACHE_DURATION)) {
        console.log(`[Prediction:Crypto] Serving data for ${symbol} (${interval}) from cache.`);
        return res.json(cachedEntry.data);
    }

    console.log(`[Prediction:Crypto] Fetching NEW data for ${symbol} (${interval}) from CryptoCompare.`);
    try {
        let apiUrl = '';
        let limit = 2000; // CryptoCompare max limit for free tier
        let aggregate = 1; // Default aggregate to 1 unit of resolution
        const { startTime, endTime } = getDatesFromInterval(interval, 'crypto'); // endTime is already in seconds

        // Map frontend interval to CryptoCompare API endpoints and parameters
        switch (interval) {
            case '1m':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histominute`;
                limit = 1440; // 24 hours of 1-minute data
                aggregate = 1;
                break;
            case '5m':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histominute`;
                limit = 1152; // Approx 4 days of 5-min data (24h * 12 * 4 days)
                aggregate = 5;
                break;
            case '1h':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histohour`;
                limit = 720; // 30 days of 1-hour data
                aggregate = 1;
                break;
            case '5h':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histohour`;
                limit = 432; // Approx 90 days of 5-hour data (90 days * 24h/5h)
                aggregate = 5;
                break;
            case '12h':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histohour`;
                limit = 360; // Approx 180 days of 12-hour data
                aggregate = 12;
                break;
            case '1d':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histoday`;
                limit = 365; // 1 year of daily data
                aggregate = 1;
                break;
            case '1w': // No direct 'histoweek', use histoday and aggregate/filter
            case '1mo': // No direct 'histomonth', use histoday and aggregate/filter
            case '6mo':
            case '1y':
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histoday`;
                limit = 2000; // Fetch max daily and filter
                aggregate = 1;
                break;
            default:
                apiUrl = `https://min-api.cryptocompare.com/data/v2/histoday`;
                limit = 365;
                aggregate = 1;
        }

        const cryptoResponse = await axios.get(apiUrl, {
            params: {
                fsym: symbol.toUpperCase(),
                tsym: tsym,
                limit: limit, // Number of data points
                aggregate: aggregate, // For intervals like 5m, 1h
                toTs: endTime, // End timestamp
                api_key: CRYPTO_COMPARE_API_KEY,
            },
        });

        const historicalCryptoData = cryptoResponse.data;

        if (!historicalCryptoData || historicalCryptoData.Response === 'Error') {
            console.error('CryptoCompare Error:', historicalCryptoData.Message);
            if (historicalCryptoData.Message.includes('Invalid pair')) {
                return res.status(400).json({ msg: `Invalid crypto symbol: ${symbol.toUpperCase()}.` });
            }
            return res.status(404).json({ msg: historicalCryptoData.Message || 'Could not fetch historical crypto data.' });
        }
        if (!historicalCryptoData.Data || !historicalCryptoData.Data.Data || historicalCryptoData.Data.Data.length === 0) {
            return res.status(404).json({ msg: `No historical data found for crypto symbol: ${symbol.toUpperCase()} for the requested interval.` });
        }

        const formattedData = historicalCryptoData.Data.Data.map(item => ({
            time: item.time, // Unix timestamp in seconds
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volumefrom, // or volumeto depending on preference
        })).sort((a, b) => a.time - b.time);

        // Filter for specific longer-term intervals if needed (e.g., 1w, 1mo, 6mo, 1y from daily data)
        if (formattedData.length > 0 && ['1w', '1mo', '6mo', '1y'].includes(interval)) {
            const now = Date.now();
            let startDate;
            switch (interval) {
                case '1w': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
                case '1mo': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break; // Approx 30 days
                case '6mo': startDate = new Date(now - 180 * 24 * 60 * 60 * 1000); break; // Approx 180 days
                case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
                default: startDate = new Date(0); // No filter
            }
            formattedData = formattedData.filter(d => new Date(d.time * 1000) >= startDate);
        }

        // --- Placeholder Prediction Logic for Crypto ---
        let predictedPrice = 0;
        let predictionMessage = 'No specific prediction model is integrated yet for crypto.';
        let historicalDataPoints = formattedData.length;

        if (historicalDataPoints > 0) {
            const lastClose = formattedData[historicalDataPoints - 1].close;
            // Simple placeholder: Last price + a small random change
            predictedPrice = lastClose * (1 + (Math.random() - 0.5) * 0.008); // +/- 0.4%
            predictionMessage = `Based on historical crypto data, the projected next price is: $${predictedPrice.toFixed(2)}.`;
        }

        // Append the "predicted" point to the data for charting
        const lastTimestamp = historicalDataPoints > 0 ? formattedData[historicalDataPoints - 1].time : Math.floor(Date.now() / 1000);
        const predictionTimestamp = lastTimestamp + (interval.includes('m') || interval.includes('h') ? 3600 : 86400); // 1 hour or 1 day after last point

        // Prepare response in the format expected by PredictPage.js
        const responseData = {
            symbol,
            interval,
            data: [
                ...formattedData.map(item => ({ ...item, predictedPrice: null })), // Historical points only have actualPrice
                {
                    time: predictionTimestamp,
                    open: null, high: null, low: null, actualPrice: null,
                    close: predictedPrice, // Use close for prediction
                    predictedPrice: predictedPrice, // Explicitly set predictedPrice
                    volume: null
                }
            ],
            predictedPrice: predictedPrice,
            predictionMessage: predictionMessage,
        };

        cryptoDataCache.set(cacheKey, { data: responseData, timestamp: currentTime });
        return res.json(responseData);

    } catch (err) {
        console.error(`[Prediction:Crypto] Error fetching prediction for ${symbol} (${interval}):`, err.message);
        if (err.response) {
            console.error('External API response error:', err.response.data);
            return res.status(err.response.status).json({ msg: err.response.data.Message || 'Error from crypto data API' });
        }
        res.status(500).json({ msg: 'Server Error fetching crypto prediction.' });
    }
};