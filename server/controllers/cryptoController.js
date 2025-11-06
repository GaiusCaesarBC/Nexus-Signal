// server/controllers/cryptoController.js - COMPLETE & CORRECT EXPORT

require('dotenv').config();
const axios = require('axios');
const asyncHandler = require('express-async-handler');
const { LRUCache } = require('lru-cache');

// Initialize LRU cache for crypto data
const cryptoCache = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 10,
});

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Helper for introducing a delay (needed due to aggressive rate limits)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mapFrontendToCoinGecko = (interval, range) => {
    let cgInterval = 'daily';
    let cgDays = 30;

    switch (interval) {
        case '1min': case '5min': case '15min': case '30min': case '1h': case '5h': case '12h': cgInterval = 'hourly'; break;
        case '1d': case '1w': case '1mo': case '6mo': case '1y': cgInterval = 'daily'; break;
        default: cgInterval = 'daily';
    }

    switch (range) {
        case '1D': cgDays = 1; break; case '5D': cgDays = 5; break; case '1M': cgDays = 30; break;
        case '3M': cgDays = 90; break; case '6M': cgDays = 180; break; case '1Y': cgDays = 365; break;
        case '5Y': cgDays = 5 * 365; break; case 'MAX': cgDays = 'max'; break;
        default: cgDays = 30;
    }

    if (cgDays <= 90 && ['1h', '5h', '12h'].includes(interval)) {
        cgInterval = 'hourly';
    } else if (cgDays === 1 && ['1min', '5min', '15min', '30min'].includes(interval)) {
        cgInterval = 'hourly';
    } else {
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
    let coingeckoUrl = '';

    try {
        console.log(`[CryptoController] Fetching data for ${symbol}, Range: ${range}, Interval: ${interval}`);

        // --- RATE LIMIT MANAGEMENT: DELAY BEFORE EXTERNAL API CALLS ---
        await delay(1500); // Wait 1.5 seconds

        const coinListResponse = await axios.get(`${COINGECKO_API_BASE}/coins/list`);
        const coin = coinListResponse.data.find(c =>
            c.symbol.toLowerCase() === symbol.toLowerCase() || c.id.toLowerCase() === symbol.toLowerCase()
        );

        if (!coin) {
            return res.status(404).json({ msg: `Could not find crypto with symbol or ID: ${symbol}.` });
        }
        coinId = coin.id;

        await delay(1500); // Wait another 1.5 seconds

        const { cgDays, cgInterval } = mapFrontendToCoinGecko(interval, range);
        const vsCurrency = 'usd';

        coingeckoUrl = `${COINGECKO_API_BASE}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${cgDays}&interval=${cgInterval}`;
        console.log(`[CryptoController] Calling CoinGecko URL: ${coingeckoUrl}`);

        const response = await axios.get(coingeckoUrl);

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

        // --- MOCK PREDICTION LOGIC ---
        const predictedPrice = lastClosePrice * (1 + (Math.random() - 0.5) * 0.05);
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
        console.error(`[CryptoController] FATAL ERROR for ${symbol}. CoinGecko request URL: ${coingeckoUrl}`);
        console.error('CoinGecko detailed error:', error.response?.status, error.response?.data || error.message);

        let errorMsg = 'Failed to fetch crypto historical data.';
        if (error.response?.status === 404) {
            errorMsg = `CoinGecko 404: Crypto symbol "${symbol}" not found.`;
        } else if (error.response?.data?.error) {
            errorMsg = `CoinGecko API Error: ${error.response.data.error}`;
        } else if (error.response?.status === 429) {
            errorMsg = `CoinGecko Rate Limit Exceeded. Please try again in 5-10 seconds.`;
        }
        res.status(error.response?.status || 500).json({
            msg: errorMsg,
            details: error.message,
            coingeckoError: error.response?.data
        });
    }
});

exports.getCryptoHistoricalData = getCryptoHistoricalData; // <--- THE EXPLICIT EXPORT