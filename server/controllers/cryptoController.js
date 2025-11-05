// server/controllers/cryptoController.js

const axios = require('axios');
const asyncHandler = require('express-async-handler'); // For async error handling
const LRUCache = require('lru-cache'); // For caching API responses

// Initialize LRU cache for crypto data
const cryptoCache = new LRUCache({
    max: 100, // Maximum 100 entries in the cache
    ttl: 1000 * 60 * 10, // Cache entries for 10 minutes (in milliseconds)
});

// CoinGecko API Base URL
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Helper to map frontend intervals/ranges to CoinGecko parameters
const mapFrontendToCoinGecko = (interval, range) => {
    let cgInterval = 'daily'; // Default to daily
    let cgDays = 30; // Default to 30 days

    // Map interval
    switch (interval) {
        case '1min':
        case '5min':
        case '15min':
        case '30min':
        case '1h':
        case '5h':
        case '12h':
            cgInterval = 'hourly'; // CoinGecko provides hourly for up to 90 days, minute data for less than 1 day
            break;
        case '1d':
        case '1w':
        case '1mo':
        case '6mo':
        case '1y':
            cgInterval = 'daily'; // Use daily for daily, weekly, monthly, yearly
            break;
        default:
            cgInterval = 'daily';
    }

    // Map range (frontend sends '1D', '1M', '6M', '1Y', '5Y', 'MAX')
    // CoinGecko uses 'days' parameter.
    switch (range) {
        case '1D':
            cgDays = 1; // For 1 day, CoinGecko often provides hourly or even minute data (depending on API)
            // If interval is minute/hourly for '1D', CoinGecko's '1' day parameter works for granularity.
            // For minute data, CoinGecko's 'days=1' can give hourly. For truly minute-by-minute, might need a different endpoint or special handling.
            // For simplicity, we'll keep `hourly` if a short interval is selected.
            if (['1min', '5min', '15min', '30min'].includes(interval)) {
                // CoinGecko's /coins/{id}/market_chart endpoint is better for granular short-term data.
                // We'll primarily use 'days' parameter and let CoinGecko decide granularity for '1' day.
                // It usually gives hourly data for days=1. For minute-level, it requires a different approach if truly needed.
            }
            break;
        case '5D': cgDays = 5; break;
        case '1M': cgDays = 30; break;
        case '3M': cgDays = 90; break;
        case '6M': cgDays = 180; break;
        case '1Y': cgDays = 365; break;
        case '5Y': cgDays = 5 * 365; break;
        case 'MAX': cgDays = 'max'; break; // CoinGecko understands 'max'
        default: cgDays = 30;
    }

    // Special handling for short intervals and days parameter for CoinGecko
    // CoinGecko /market_chart with days=1 gives hourly data.
    // For more granular than hourly on days=1, you'd need to consider a different CoinGecko endpoint
    // or aggregate from a higher frequency source, which is out of scope for a direct historical call here.
    if (cgDays === 1 && cgInterval === 'hourly') {
        // CoinGecko's API for `days=1` typically provides hourly data.
        // It does not provide minute data with the `/market_chart` endpoint for `days=1` for 'hourly' interval directly.
        // For sub-hourly intervals, `days` usually needs to be < 1 or a different endpoint.
        // For now, we'll stick to 'hourly' granularity for `days=1` if requested.
        // The frontend interval (`1min`, `5min`, etc.) will act as a hint, but actual CoinGecko data might be hourly.
    } else if (cgDays <= 90 && ['1h', '5h', '12h'].includes(interval)) {
        cgInterval = 'hourly';
    } else {
        cgInterval = 'daily'; // For ranges > 90 days, CoinGecko only provides daily
    }

    return { cgDays, cgInterval };
};

// @desc    Get historical crypto data (and mock prediction)
// @route   GET /api/crypto/historical/:symbol
// @access  Private
const getCryptoHistoricalData = asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    const { range, interval } = req.query; // range for historical depth, interval for granularity

    // Validate symbol to prevent unnecessary API calls for invalid inputs
    if (!symbol || symbol.trim() === '') {
        return res.status(400).json({ msg: 'Crypto symbol is required.' });
    }

    const cacheKey = `crypto-historical-${symbol}-${range}-${interval}`;
    const cachedData = cryptoCache.get(cacheKey);

    if (cachedData) {
        console.log(`Serving crypto historical data for ${symbol} from cache.`);
        return res.status(200).json(cachedData);
    }

    // CoinGecko uses `id` (e.g., 'bitcoin') rather than `symbol` (e.g., 'BTC') for many endpoints.
    // We need to first convert the symbol to a CoinGecko ID.
    let coinId = symbol.toLowerCase(); // Assume symbol is also the ID for common ones like 'bitcoin', 'ethereum'
                                      // Or if frontend sends 'btc', 'eth', we assume this mapping.

    try {
        // Step 1: Search for the coin ID by symbol (e.g., BTC -> bitcoin)
        // CoinGecko's `/search` endpoint can help with this, but it's rate-limited.
        // For simplicity, we'll try a direct ID first (e.g., 'bitcoin', 'ethereum')
        // if the symbol matches common IDs, or fetch a list of coins and map.

        // A more robust solution would be to cache the full list of coins or use a dedicated mapping.
        // For now, let's try to get a direct ID.
        // A direct lookup might be required if `symbol` isn't the `id`.
        // Example: /coins/list gives id, symbol, name.
        // For a quick fix, let's assume popular symbols (BTC, ETH) are often their ID or easily matched.
        // If 'BTC' is passed, we might need to query CoinGecko to find its ID ('bitcoin').

        // Let's implement a quick lookup for common symbols to their IDs
        const coinListResponse = await axios.get(`${COINGECKO_API_BASE}/coins/list`);
        const coin = coinListResponse.data.find(c =>
            c.symbol.toLowerCase() === symbol.toLowerCase() || c.id.toLowerCase() === symbol.toLowerCase()
        );

        if (!coin) {
            return res.status(404).json({ msg: `Could not find crypto with symbol or ID: ${symbol}.` });
        }
        coinId = coin.id; // Use the found CoinGecko ID

        // Step 2: Fetch historical market chart data using the CoinGecko ID
        const { cgDays, cgInterval } = mapFrontendToCoinGecko(interval, range);
        const vsCurrency = 'usd';

        // CoinGecko /market_chart endpoint
        const coingeckoUrl = `${COINGECKO_API_BASE}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${cgDays}&interval=${cgInterval}`;
        console.log(`Fetching CoinGecko data: ${coingeckoUrl}`);

        const response = await axios.get(coingeckoUrl);

        if (!response.data || !response.data.prices || response.data.prices.length === 0) {
            return res.status(404).json({ msg: `No historical data found for ${symbol} from CoinGecko.` });
        }

        // CoinGecko returns data as [timestamp, price]. Convert to our desired format.
        const historicalData = response.data.prices.map(item => ({
            time: item[0] / 1000, // CoinGecko provides milliseconds, convert to seconds
            close: item[1], // We'll just use price as close price for simplicity
            // You might also get market_caps and total_volumes if needed
        })).filter(d => d.close !== null); // Filter out any null prices

        if (historicalData.length === 0) {
            return res.status(404).json({ msg: `No valid historical data found for crypto symbol ${symbol}.` });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;

        // --- MOCK PREDICTION LOGIC (similar to frontend, but on backend) ---
        const predictedPrice = lastClosePrice * (1 + (Math.random() - 0.5) * 0.05); // +/- 2.5%
        const predictedDirection = predictedPrice > lastClosePrice ? 'Up' : 'Down';
        const confidence = Math.floor(Math.random() * (95 - 60 + 1)) + 60;
        const predictionMessage = `Based on recent crypto trends, the model predicts a ${predictedDirection} movement for ${symbol.toUpperCase()}.`;
        // --- END MOCK PREDICTION ---

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
        console.error(`Error fetching crypto data for ${symbol}:`, error.response?.data || error.message);
        let errorMsg = 'Failed to fetch crypto historical data.';
        if (error.response?.status === 404) {
            errorMsg = `Crypto symbol "${symbol}" not found on CoinGecko.`;
        } else if (error.response?.data?.error) {
            errorMsg = `CoinGecko API Error: ${error.response.data.error}`;
        }
        res.status(error.response?.status || 500).json({
            msg: errorMsg,
            details: error.message
        });
    }
});

module.exports = {
    getCryptoHistoricalData,
};