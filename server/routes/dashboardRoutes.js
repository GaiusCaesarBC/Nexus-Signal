// server/routes/dashboardRoutes.js - WITH REAL NEWS FROM ALPHA VANTAGE

const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for news (refresh every 30 minutes)
let newsCache = null;
let newsCacheTimestamp = 0;
const NEWS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Dummy data for market overview (you can update this later with real API)
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

// ✅ REAL NEWS FROM ALPHA VANTAGE
router.get('/news', authMiddleware, async (req, res) => {
    console.log('[Dashboard Route] Fetching news');
    
    try {
        // Check cache first
        if (newsCache && (Date.now() - newsCacheTimestamp < NEWS_CACHE_DURATION)) {
            console.log('[NEWS CACHE HIT]');
            return res.json(newsCache);
        }

        // Fetch from Alpha Vantage News API
        const topics = 'technology,finance,earnings'; // You can customize topics
        const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=${topics}&limit=10&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
        console.log('[NEWS] Fetching from Alpha Vantage...');
        const response = await axios.get(url);

        if (response.data.feed && response.data.feed.length > 0) {
            // Transform to match your frontend format
            const newsArticles = response.data.feed.slice(0, 6).map((article, index) => ({
                id: index + 1,
                title: article.title,
                source: article.source || 'Market News',
                date: article.time_published ? new Date(article.time_published).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                url: article.url,
                summary: article.summary,
                sentiment: article.overall_sentiment_label, // POSITIVE, NEGATIVE, NEUTRAL
            }));

            // Update cache
            newsCache = newsArticles;
            newsCacheTimestamp = Date.now();

            res.json(newsArticles);
        } else {
            // Fallback to dummy data if API fails
            console.warn('[NEWS] No articles returned from API, using fallback');
            res.json([
                { id: 1, title: 'Market Update', source: 'Financial Times', date: new Date().toISOString().split('T')[0] }
            ]);
        }

    } catch (error) {
        console.error('[Dashboard Route] Error fetching news:', error.message);
        
        // Return cached data if available, otherwise fallback
        if (newsCache) {
            console.log('[NEWS] Using stale cache due to error');
            return res.json(newsCache);
        }
        
        res.json([
            { id: 1, title: 'Unable to fetch news', source: 'System', date: new Date().toISOString().split('T')[0] }
        ]);
    }
});

module.exports = router;