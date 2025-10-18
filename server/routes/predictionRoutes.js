const express = require('express');
const router = express.Router();
const axios = require('axios');
const { generatePrediction } = require('../predictionEngine');

// @route   GET api/predict/:symbol
// @desc    Get AI prediction for a stock symbol
// @access  Public
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=full`;

  try {
    const response = await axios.get(url);
    const dailyData = response.data['Time Series (Daily)'];

    if (!dailyData) {
      console.error('API did not return "Time Series (Daily)". Full API Response:', response.data);
      return res.status(404).json({ msg: `No data found for symbol: ${symbol}. Check symbol or API limit.` });
    }

    const historicalData = Object.keys(dailyData).map(date => ({
      date,
      close: parseFloat(dailyData[date]['4. close']),
    })).reverse(); // Reverse to have oldest data first

    const prediction = generatePrediction(historicalData);
    
    // Get the last 100 days for the chart
    const chartData = historicalData.slice(-100);

    res.json({ ...prediction, symbol, chartData });

  } catch (err) {
    console.error('Error fetching data from market API:', err.message);
    res.status(500).json({ msg: 'Error fetching data from the market API.' });
  }
});

module.exports = router;

