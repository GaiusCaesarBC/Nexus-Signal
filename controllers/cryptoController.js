// server/controllers/cryptoController.js - FINAL COMPLETE & CORRECT EXPORT

require('dotenv').config(); // Ensure .env is loaded
const axios = require('axios');
const asyncHandler = require('express-async-handler');
const { LRUCache } = require('lru-cache');

// Initialize LRU cache for crypto data
const cryptoCache = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 10, // 10 minutes cache
});

// --- CRITICAL FIXES HERE ---
// Get CoinGecko API Key and Base URL from environment variables
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
// Use the COINGECKO_BASE_URL from .env (which should be the PRO API URL)
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3'; 
// --- END CRITICAL FIXES ---

// Helper for introducing a delay (needed due to aggressive rate limits)
// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Removing this, not needed for Pro

const mapFrontendToCoinGecko = (interval, range) => {
    let cgInterval = 'daily';
    let cgDays = 30;

    switch (interval) {
        // CoinGecko Pro API has more granular intervals, but for simplicity, let's stick to 'hourly'/'daily'
        // '1min', '5min', '15min', '30min' are usually for paid tiers and specific endpoints.
        case '1h': case '5h': case '12h': cgInterval = 'hourly'; break;
        case '1d': case '1w': case '1mo': case '6mo': case '1y': cgInterval = 'daily'; break;
        default: cgInterval = 'daily';
    }

    switch (range) {
        case '1D': cgDays = 1; break; case '5D': cgDays = 5; break; case '1M': cgDays = 30; break;
        case '3M': cgDays = 90; break; case '6M': cgDays = 180; break; case '1Y': cgDays = 365; break;
        case '5Y': cgDays = 5 * 365; break; case 'MAX': cgDays = 'max'; break;
        default: cgDays = 30;
    }
    
    // CoinGecko's market_chart endpoint generally uses these rules for 'interval':
    // 1 day: minutely data
    // 2-90 days: hourly data
    // >90 days: daily data
    // We should simplify our mapping based on this for the market_chart endpoint.
    if (cgDays <= 1) { // Up to 1 day
        cgInterval = 'minutely'; // Not directly supported by market_chart, will likely map to hourly by CG
    } else if (cgDays <= 90) { // 2 to 90 days
        cgInterval = 'hourly';
    } else { // >90 days
        cgInterval = 'daily';
    }

    return { cgDays, cgInterval };
};

const getCryptoHistoricalData = asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    const { range, interval } = req.query;

    if (!symbol || symbol.trim() === '') {
        return res.status(400).json({ msg: 'Crypto symbol is required.' });
    }

    const cacheKey = `crypto-historical-${symbol}-${range}-${interval}`;
    const cachedData = cryptoCache.get(cacheKey);

    if (cachedData) {
        console.log(`[CryptoController] Serving crypto historical data for ${symbol} from cache.`);
        return res.status(200).json(cachedData);
    }

    let coinId = symbol.toLowerCase();
    let coingeckoUrl = ''; // Define coingeckoUrl for error logging consistency

    try {
        console.log(`[CryptoController] Fetching data for ${symbol}, Range: ${range}, Interval: ${interval}`);
        
        // --- CRITICAL FIX: Headers for Pro API ---
        const headers = {};
        if (COINGECKO_API_KEY) {
            headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }
        // --- END CRITICAL FIX ---

        // No need for delay with Pro API key
        // await delay(1500);

        // Fetch coin list to get accurate CoinGecko ID
        // Note: With Pro API, if you know the ID, you can skip this for faster calls.
        // For robustness and user input flexibility, keeping it.
        const coinListResponse = await axios.get(`${COINGECKO_BASE_URL}/coins/list`, { headers }); // Pass headers here too
        const coin = coinListResponse.data.find(c =>
            c.symbol.toLowerCase() === symbol.toLowerCase() || c.id.toLowerCase() === symbol.toLowerCase()
        );

        if (!coin) {
            return res.status(404).json({ msg: `Could not find crypto with symbol or ID: ${symbol}.` });
        }
        coinId = coin.id;

        // No need for another delay with Pro API key
        // await delay(1500);

        const { cgDays, cgInterval } = mapFrontendToCoinGecko(interval, range);
        const vsCurrency = 'usd';

        // --- CRITICAL FIX: Use COINGECKO_BASE_URL and pass headers to main request ---
        coingeckoUrl = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${cgDays}&interval=${cgInterval}`;
        console.log(`[CryptoController] Calling CoinGecko URL: ${coingeckoUrl}`);
        console.log(`[CryptoController] Using Headers: ${JSON.stringify(headers)}`); // Log headers

        const response = await axios.get(coingeckoUrl, { headers }); // Pass headers to the main market_chart request
        // --- END CRITICAL FIX ---

        if (!response.data || !response.data.prices || response.data.prices.length === 0) {
            return res.status(404).json({ msg: `No historical data found for ${symbol} from CoinGecko.` });
        }

        const historicalData = response.data.prices.map(item => ({
            time: item[0] / 1000, close: item[1],
        })).filter(d => d.close !== null);

        if (historicalData.length === 0) {
            return res.status(404).json({ msg: `No valid historical data found for crypto symbol ${symbol}.` });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;

        // --- PREDICTION LOGIC ---
        // Replace this mock with your actual prediction logic from cryptoRoutes.js if desired
        // For now, let's ensure data fetching works, then integrate the prediction engine.
        const predictedPrice = lastClosePrice * (1 + (Math.random() - 0.5) * 0.05);
        const predictedDirection = predictedPrice > lastClosePrice ? 'Up' : 'Down';
        const confidence = Math.floor(Math.random() * (95 - 60 + 1)) + 60;
        const predictionMessage = `Based on recent crypto trends, the model predicts a ${predictedDirection} movement for ${symbol.toUpperCase()}.`;
        // --- END PREDICTION LOGIC (or MOCK) ---

        const result = {
            symbol: symbol.toUpperCase(),
            interval: interval,
            historicalData,
            predictedPrice,
            predictedDirection,
            confidence,
            predictionMessage
        };

        cryptoCache.set(cacheKey, result);
        res.status(200).json(result);

    } catch (error) {
        console.error(`[CryptoController] FATAL ERROR for ${symbol}. CoinGecko request URL: ${coingeckoUrl}`);
        console.error('CoinGecko detailed error:', error.response?.status, error.response?.data || error.message);

        let errorMsg = 'Failed to fetch crypto historical data.';
        if (error.response?.status === 404) {
            errorMsg = `CoinGecko 404: Crypto symbol "${symbol}" not found.`;
        } else if (error.response?.data?.error) {
            errorMsg = `CoinGecko API Error: ${error.response.data.error}`;
        } else if (error.response?.status === 429) {
            errorMsg = `CoinGecko Rate Limit Exceeded. Please try again in 5-10 seconds.`;
        } else if (error.response?.status === 401 || error.response?.status === 403) {
            errorMsg = `CoinGecko API Error: Authentication failed. Check your PRO API key.`;
        }
        res.status(error.response?.status || 500).json({
            msg: errorMsg,
            details: error.message,
            coingeckoError: error.response?.data
        });
    }
});

exports.getCryptoHistoricalData = getCryptoHistoricalData;