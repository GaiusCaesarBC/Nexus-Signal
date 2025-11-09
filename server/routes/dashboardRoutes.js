// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Assuming this path is correct

// Dummy data for now - you'll replace this with actual data fetching logic later
const dummyMarketOverview = {
    totalMarketCap: '$120T',
    dailyVolume: '$500B',
    gainers: [{ symbol: 'TSLA', change: '+5.2%' }],
    losers: [{ symbol: 'AAPL', change: '-2.1%' }],
};

const dummyAIGraphData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [65, 59, 80, 81, 56, 55],
};

const dummySummary = {
    portfolioValue: '$15,230',
    todayChange: '+1.5%',
    totalReturn: '+12.3%',
};

const dummyNews = [
    { id: 1, title: 'Tech Stocks Soar Ahead of Earnings', source: 'Reuters', date: '2025-11-08' },
    { id: 2, title: 'Crypto Market Sees Bitcoin Rally', source: 'CoinDesk', date: '2025-11-08' },
];

// All dashboard routes should likely be protected
router.get('/market-overview', authMiddleware, (req, res) => {
    console.log('[Dashboard Route] Fetching market overview');
    res.json(dummyMarketOverview);
});

router.get('/ai-graph-data', authMiddleware, (req, res) => {
    console.log('[Dashboard Route] Fetching AI graph data');
    res.json(dummyAIGraphData);
});

router.get('/summary', authMiddleware, (req, res) => {
    console.log('[Dashboard Route] Fetching dashboard summary');
    res.json(dummySummary);
});

router.get('/news', authMiddleware, (req, res) => {
    console.log('[Dashboard Route] Fetching news');
    res.json(dummyNews);
});

module.exports = router;