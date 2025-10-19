const express = require('express');
const router = express.Router();
const axios = require('axios');

// @route   GET api/market-data/movers
// @desc    Get top market gainers and losers
// @access  Public
router.get('/movers', async (req, res) => {
    const finnhubApiKey = process.env.FINNHUB_API_KEY;

    if (!finnhubApiKey) {
        console.error('Finnhub API key not configured on server.');
        return res.status(500).json({ msg: 'Finnhub API key not configured.' });
    }

    try {
        // For this example, we will use a pre-canned "movers" list to simulate the feature,
        // as live-calculating movers can be intensive and exceed free tier API limits quickly.
        
        const mockMovers = {
            gainers: [
                { symbol: 'NVDA', changePercent: 5.2 },
                { symbol: 'TSLA', changePercent: 3.1 },
                { symbol: 'META', changePercent: 2.5 },
            ],
            losers: [
                { symbol: 'BA', changePercent: -3.8 },
                { symbol: 'PFE', changePercent: -2.1 },
                { symbol: 'DIS', changePercent: -1.9 },
            ]
        };

        res.json(mockMovers);

    } catch (err) {
        console.error('Error in market movers route:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

