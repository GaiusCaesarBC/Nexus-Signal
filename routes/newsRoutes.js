// server/routes/newsRoutes.js - Enhanced News with AI Sentiment

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const alphaVantageService = require('../services/alphaVantageService');

// @route   GET /api/news
// @desc    Get market news with AI sentiment
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { symbol, limit = 50 } = req.query;

        const news = await alphaVantageService.getNewsSentiment(symbol || 'market', limit);

        // Format news for frontend
        const formatted = news.map(article => ({
            id: article.url,
            title: article.title,
            description: article.summary || article.title,
            content: article.summary,
            source: article.source,
            sentiment: determineSentiment(article.overall_sentiment_score),
            confidence: Math.abs(article.overall_sentiment_score) * 100,
            timestamp: article.time_published,
            category: 'stocks',
            tickers: article.ticker_sentiment?.map(t => t.ticker) || [],
            image: article.banner_image || null,
            trending: article.relevance_score > 0.5,
            url: article.url
        }));

        res.json(formatted);

    } catch (error) {
        console.error('[News] Error fetching news:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// @route   GET /api/news/:symbol
// @desc    Get news for specific symbol
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { symbol, limit = 50 } = req.query;

        const news = await alphaVantageService.getNewsSentiment(symbol || 'market', limit);

        // Format news for frontend
        const formatted = news.map(article => ({
            id: article.url,
            title: article.title,
            description: article.summary || article.title,
            content: article.summary,
            source: article.source,
            sentiment: determineSentiment(article.overall_sentiment_score),
            confidence: Math.abs(article.overall_sentiment_score) * 100,
            timestamp: article.time_published,
            category: 'stocks',
            tickers: article.ticker_sentiment?.map(t => t.ticker) || [],
            image: article.banner_image || null,
            trending: article.relevance_score > 0.5,
            url: article.url
        }));

        res.json(formatted);

    } catch (error) {
        console.error('[News] Error fetching news:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// Helper function to determine sentiment
function determineSentiment(score) {
    if (score >= 0.15) return 'bullish';
    if (score <= -0.15) return 'bearish';
    return 'neutral';
}

module.exports = router;