const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

// @route   GET /api/news/:symbol
// @desc    Get latest news for a stock symbol
// @access  Private
router.get('/:symbol', auth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const finnhubApiKey = process.env.FINNHUB_API_KEY;

  if (!finnhubApiKey) {
    return res.status(500).json({ msg: 'Finnhub API key not configured.' });
  }

  // Get today's date and a date from 7 days ago for the query
  const to = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // YYYY-MM-DD

  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${finnhubApiKey}`;

  try {
    const response = await axios.get(url);
    // Finnhub returns an array of news articles. We'll take the first 5.
    const articles = response.data.slice(0, 5);
    res.json(articles);
  } catch (err) {
    console.error('Error fetching news from Finnhub:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
