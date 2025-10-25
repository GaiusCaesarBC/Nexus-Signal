// server/routes/marketDataRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware'); // Assuming you want this protected

// --- New Endpoint: Get Basic Quote by Symbol (supports Stock and Crypto) ---
// @route   GET api/market-data/quote/:symbol?type=stock/crypto
// @desc    Get current price and basic information for a stock or crypto symbol
// @access  Private (recommended, uses auth middleware)
router.get('/quote/:symbol', auth, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const type = req.query.type || 'stock'; // Default to 'stock' if not specified

    if (type === 'stock') {
        const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;

        if (!alphaVantageApiKey) {
            console.error('Alpha Vantage API key is missing for stock quote endpoint.');
            return res.status(500).json({ msg: 'Server configuration error: Alpha Vantage API key missing.' });
        }

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaVantageApiKey}`;

        try {
            const response = await axios.get(url);
            const data = response.data;

            if (data['Error Message'] || Object.keys(data['Global Quote']).length === 0) {
                console.error('Alpha Vantage Quote API Error or no data. Response:', data);
                return res.status(404).json({ msg: `Could not retrieve stock data for symbol: ${symbol}. Please check the symbol.` });
            }

            const quote = data['Global Quote'];

            const formattedQuote = {
                type: 'stock',
                symbol: quote['01. symbol'],
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                price: parseFloat(quote['05. price']),
                volume: parseInt(quote['06. volume']),
                latestTradingDay: quote['07. latest trading day'],
                previousClose: parseFloat(quote['08. previous close']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
            };

            res.json(formattedQuote);

        } catch (err) {
            console.error(`Error fetching global quote for stock ${symbol}:`, err.message);
            res.status(500).json({ msg: 'Server Error fetching stock quote.' });
        }
    } else if (type === 'crypto') {
        const coinGeckoApiKey = process.env.COINGECKO_API_KEY;
        const coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';

        try {
            // Step 1: Search for the coin ID
            const coinListResponse = await axios.get(`${coinGeckoBaseUrl}/coins/list`);
            const coinList = coinListResponse.data;

            const targetCoin = coinList.find(
                (coin) => coin.symbol.toUpperCase() === symbol || coin.id.toUpperCase() === symbol
            );

            if (!targetCoin) {
                return res.status(404).json({ msg: `Could not find cryptocurrency with symbol or ID: ${symbol}.` });
            }

            const coinId = targetCoin.id;

            // Step 2: Get market data for the found coin ID
            const vsCurrency = 'usd';

            const headers = {};
            if (coinGeckoApiKey) {
                headers['x-cg-pro-api-key'] = coinGeckoApiKey;
            }

            const marketDataUrl = `${coinGeckoBaseUrl}/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;

            console.log('CoinGecko marketDataUrl:', marketDataUrl); // LOGGING ADDED HERE
            const marketDataResponse = await axios.get(marketDataUrl, { headers });
            console.log('CoinGecko Raw Response Data:', marketDataResponse.data); // <<< ADDED THIS IMPORTANT LOG

            const cryptoData = marketDataResponse.data[coinId];
            console.log('CoinGecko Parsed cryptoData:', cryptoData); // LOGGING ADDED HERE

            if (!cryptoData) {
                return res.status(404).json({ msg: `No market data found for cryptocurrency: ${symbol}.` });
            }

            const formattedCryptoQuote = {
                type: 'crypto',
                id: coinId,
                symbol: symbol,
                name: targetCoin.name,
                price: cryptoData[vsCurrency],
                marketCap: cryptoData[`${vsCurrency}_market_cap`],
                volume24h: cryptoData[`${vsCurrency}_24h_vol`],
                change24h: cryptoData[`${vsCurrency}_24h_change`],
                lastUpdatedAt: new Date(cryptoData.last_updated_at * 1000).toISOString(),
            };

            res.json(formattedCryptoQuote);

        } catch (err) {
            console.error(`Error fetching crypto quote for ${symbol}:`, err.message);
            if (err.response?.status === 429) { // Rate limit exceeded
                 return res.status(429).json({ msg: 'CoinGecko API rate limit exceeded. Please try again later.' });
            }
            res.status(500).json({ msg: 'Server Error fetching cryptocurrency quote.' });
        }

    } else {
        return res.status(400).json({ msg: 'Invalid market data type specified. Use "stock" or "crypto".' });
    }
});


// @route   GET api/market-data/movers
// @desc    Get top market gainers and losers
// @access  Public (or Private, decided by you)
router.get('/movers', async (req, res) => {
    const finnhubApiKey = process.env.FINNHUB_API_KEY; // If you plan to use Finnhub for real movers

    const mockMovers = {
        gainers: [
            { symbol: 'NVDA', changePercent: 5.2, price: 920.00 },
            { symbol: 'TSLA', changePercent: 3.1, price: 175.50 },
            { symbol: 'META', changePercent: 2.5, price: 490.75 },
        ],
        losers: [
            { symbol: 'BA', changePercent: -3.8, price: 185.20 },
            { symbol: 'PFE', changePercent: -2.1, price: 28.10 },
            { symbol: 'DIS', changePercent: -1.9, price: 110.30 },
        ]
    };
    res.json(mockMovers);
});

module.exports = router;