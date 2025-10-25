// server/routes/marketDataRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware'); // Assuming you want this protected

// --- New Endpoint: Get Basic Stock Quote by Symbol ---
// @route   GET api/market-data/quote/:symbol
// @desc    Get current price and basic information for a stock symbol
// @access  Private (recommended, uses auth middleware)
router.get('/quote/:symbol', auth, async (req, res) => { // Added 'auth' middleware
    const symbol = req.params.symbol.toUpperCase();
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;

    if (!alphaVantageApiKey) {
        console.error('Alpha Vantage API key is missing for quote endpoint.');
        return res.status(500).json({ msg: 'Server configuration error: Alpha Vantage API key missing.' });
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaVantageApiKey}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data['Error Message'] || Object.keys(data['Global Quote']).length === 0) {
            console.error('Alpha Vantage Quote API Error or no data. Response:', data);
            // Handle cases where symbol is not found or API limits hit
            return res.status(404).json({ msg: `Could not retrieve data for symbol: ${symbol}. Please check the symbol.` });
        }

        const quote = data['Global Quote'];

        const formattedQuote = {
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
        console.error(`Error fetching global quote for ${symbol}:`, err.message);
        res.status(500).send('Server Error fetching stock quote.');
    }
});
// --- End New Endpoint ---


// @route   GET api/market-data/movers
// @desc    Get top market gainers and losers
// @access  Public (or Private, decided by you)
router.get('/movers', async (req, res) => {
    const finnhubApiKey = process.env.FINNHUB_API_KEY; // If you plan to use Finnhub for real movers

    // Currently uses mock data. If you want to use real data, you'd integrate Finnhub here.
    // Example (requires Finnhub API, may exceed free tier easily):
    // const finnhubUrl = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=AAPL&from=2023-01-01&to=2023-12-31&token=${finnhubApiKey}`;
    // const finnhubResponse = await axios.get(finnhubUrl);
    // ... process finnhubResponse.data ...

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

    // Note: If you want these mock movers to also show real-time prices,
    // you'd need to fetch quotes for each of these symbols,
    // or include mock prices as I've done above.
    res.json(mockMovers);
});

module.exports = router;