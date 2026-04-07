// server/routes/newsRoutes.js - Enhanced News with AI Sentiment + Intelligence Layer

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const alphaVantageService = require('../services/alphaVantageService');
const newsIntelligence = require('../services/newsIntelligence');

// Snapshot cache (60s TTL)
const niCache = new Map();
const NI_TTL_MS = 60 * 1000;
function niGet(key) {
    const hit = niCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > NI_TTL_MS) { niCache.delete(key); return null; }
    return hit.v;
}
function niSet(key, value) {
    if (niCache.size > 30) {
        const first = niCache.keys().next().value;
        niCache.delete(first);
    }
    niCache.set(key, { t: Date.now(), v: value });
}

// Helper function to determine sentiment
function determineSentiment(score) {
    if (score >= 0.15) return 'bullish';
    if (score <= -0.15) return 'bearish';
    return 'neutral';
}

// @route   GET /api/news
// @desc    Get market news with AI sentiment (legacy endpoint, kept for back-compat)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { symbol, limit = 50 } = req.query;
        const news = await alphaVantageService.getNewsSentiment(symbol || 'market', limit);
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

// @route   GET /api/news/intelligence
// @desc    Full news intelligence snapshot — narrative + ranked articles +
//          sidebar widgets, all enriched with trade impact
// @access  Private
router.get('/intelligence', auth, async (req, res) => {
    try {
        const filters = {
            sentiment: req.query.sentiment || 'all',
            impact: req.query.impact || 'all',
            sector: req.query.sector || 'all',
            tradeOppOnly: req.query.tradeOppOnly === '1' || req.query.tradeOppOnly === 'true',
            search: req.query.search || ''
        };
        const cacheKey = `ni:${JSON.stringify(filters)}`;
        let snapshot = niGet(cacheKey);
        if (!snapshot) {
            snapshot = await newsIntelligence.getNewsSnapshot({ filters });
            niSet(cacheKey, snapshot);
        }
        res.json(snapshot);
    } catch (error) {
        console.error('[News Intelligence] Snapshot error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to load news intelligence' });
    }
});

module.exports = router;
