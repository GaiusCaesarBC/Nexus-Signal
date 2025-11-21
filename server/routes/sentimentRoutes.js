// server/routes/sentimentRoutes.js - Social Sentiment Analysis Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const axios = require('axios');

// Mock data for development - replace with real Twitter/Reddit API calls
const MOCK_TWEETS = [
    {
        author: { username: 'TradingPro', verified: true },
        text: "AMD looking strong! Breaking resistance at $165. Long term bullish 🚀",
        sentiment: { classification: 'bullish', score: 0.85 },
        likes: 234,
        retweets: 45,
        replies: 12,
        timestamp: new Date(Date.now() - 3600000)
    },
    {
        author: { username: 'MarketWatch2024', verified: false },
        text: "AMD earnings next week. Expecting good results based on recent chip demand.",
        sentiment: { classification: 'bullish', score: 0.72 },
        likes: 156,
        retweets: 28,
        replies: 8,
        timestamp: new Date(Date.now() - 7200000)
    },
    {
        author: { username: 'TechInvestor', verified: true },
        text: "Concerned about AMD's competition from NVDA. Market share pressure.",
        sentiment: { classification: 'bearish', score: -0.65 },
        likes: 89,
        retweets: 15,
        replies: 23,
        timestamp: new Date(Date.now() - 10800000)
    },
    {
        author: { username: 'ChipAnalyst', verified: false },
        text: "AMD price action looking neutral. Waiting for clear direction before entry.",
        sentiment: { classification: 'neutral', score: 0.05 },
        likes: 67,
        retweets: 8,
        replies: 5,
        timestamp: new Date(Date.now() - 14400000)
    },
    {
        author: { username: 'BullMarkets', verified: true },
        text: "AMD breaking out! Target $180 by end of month 📈🔥",
        sentiment: { classification: 'bullish', score: 0.92 },
        likes: 445,
        retweets: 89,
        replies: 34,
        timestamp: new Date(Date.now() - 18000000)
    }
];

// Helper function to analyze sentiment (mock for now)
const analyzeSentiment = (text) => {
    const bullishKeywords = ['bullish', 'buy', 'long', 'moon', 'rocket', '🚀', 'strong', 'breakout', 'pump', 'calls'];
    const bearishKeywords = ['bearish', 'sell', 'short', 'dump', 'puts', 'crash', 'drop', 'fall', 'weak'];
    
    const lowerText = text.toLowerCase();
    const bullishCount = bullishKeywords.filter(word => lowerText.includes(word)).length;
    const bearishCount = bearishKeywords.filter(word => lowerText.includes(word)).length;
    
    if (bullishCount > bearishCount) {
        return { classification: 'bullish', score: 0.5 + (bullishCount * 0.1) };
    } else if (bearishCount > bullishCount) {
        return { classification: 'bearish', score: -(0.5 + (bearishCount * 0.1)) };
    } else {
        return { classification: 'neutral', score: 0 };
    }
};

// Helper function to generate mock tweets for any symbol
const generateMockTweets = (symbol) => {
    const templates = [
        { text: `${symbol} looking strong! Breaking resistance. Long term bullish 🚀`, sentiment: 'bullish' },
        { text: `${symbol} earnings soon. Expecting good results based on sector trends.`, sentiment: 'bullish' },
        { text: `Concerned about ${symbol}'s valuation at current levels. Might pull back.`, sentiment: 'bearish' },
        { text: `${symbol} price action looking neutral. Waiting for clear direction.`, sentiment: 'neutral' },
        { text: `${symbol} breaking out! This could be the start of a major move 📈`, sentiment: 'bullish' },
        { text: `Taking profits on ${symbol}. Risk/reward not favorable here.`, sentiment: 'bearish' },
        { text: `${symbol} holding support well. Could be accumulation phase.`, sentiment: 'bullish' },
        { text: `${symbol} volatility increasing. Be careful with position sizing.`, sentiment: 'neutral' },
    ];

    return templates.map((template, idx) => ({
        author: { 
            username: ['TradingPro', 'MarketWatch', 'TechInvestor', 'ChipAnalyst'][idx % 4],
            verified: idx % 3 === 0
        },
        text: template.text,
        sentiment: analyzeSentiment(template.text),
        likes: Math.floor(Math.random() * 500) + 50,
        retweets: Math.floor(Math.random() * 100) + 10,
        replies: Math.floor(Math.random() * 50) + 5,
        timestamp: new Date(Date.now() - (idx * 3600000))
    }));
};

// @route   GET /api/sentiment/search/:symbol
// @desc    Get sentiment analysis for a specific stock/crypto symbol
// @access  Private
router.get('/search/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        
        // TODO: Replace with real Twitter API call
        // For now, using mock data
        const tweets = generateMockTweets(symbol.toUpperCase());
        
        // Calculate sentiment distribution
        const bullishTweets = tweets.filter(t => t.sentiment.classification === 'bullish');
        const bearishTweets = tweets.filter(t => t.sentiment.classification === 'bearish');
        const neutralTweets = tweets.filter(t => t.sentiment.classification === 'neutral');
        
        const total = tweets.length;
        const bullishPercentage = Math.round((bullishTweets.length / total) * 100);
        const bearishPercentage = Math.round((bearishTweets.length / total) * 100);
        const neutralPercentage = Math.round((neutralTweets.length / total) * 100);
        
        // Determine overall sentiment
        let overall = 'neutral';
        if (bullishPercentage > 50) overall = 'bullish';
        else if (bearishPercentage > 50) overall = 'bearish';
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            sentiment: {
                overall,
                distribution: {
                    bullish: bullishPercentage,
                    neutral: neutralPercentage,
                    bearish: bearishPercentage
                },
                counts: {
                    bullish: bullishTweets.length,
                    neutral: neutralTweets.length,
                    bearish: bearishTweets.length
                }
            },
            tweets: tweets.slice(0, 10), // Return top 10 tweets
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Sentiment search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentiment data'
        });
    }
});

// @route   GET /api/sentiment/trending
// @desc    Get trending stocks/crypto by social mention volume
// @access  Private
router.get('/trending', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // TODO: Replace with real trending data from Twitter/Reddit APIs
        const trendingSymbols = [
            { symbol: 'TSLA', mentions: 12450, score: 95 },
            { symbol: 'AAPL', mentions: 10230, score: 92 },
            { symbol: 'NVDA', mentions: 8940, score: 88 },
            { symbol: 'AMD', mentions: 7820, score: 85 },
            { symbol: 'MSFT', mentions: 6730, score: 82 },
            { symbol: 'BTC', mentions: 15600, score: 98 },
            { symbol: 'ETH', mentions: 9870, score: 91 },
            { symbol: 'AMZN', mentions: 5420, score: 78 },
            { symbol: 'GOOGL', mentions: 4930, score: 75 },
            { symbol: 'META', mentions: 4210, score: 72 }
        ];
        
        res.json({
            success: true,
            trending: trendingSymbols.slice(0, parseInt(limit)),
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending data'
        });
    }
});

// @route   GET /api/sentiment/market
// @desc    Get overall market sentiment
// @access  Private
router.get('/market', auth, async (req, res) => {
    try {
        // TODO: Replace with real market-wide sentiment analysis
        // This would aggregate sentiment across major indices and popular stocks
        
        const marketSentiment = {
            overall: 'bullish',
            bullishPercentage: 58,
            bearishPercentage: 27,
            neutralPercentage: 15,
            totalTweets: 45230,
            topMentions: ['TSLA', 'AAPL', 'BTC', 'NVDA', 'AMD'],
            sentiment24h: {
                bullish: 12450,
                bearish: 5890,
                neutral: 3210
            }
        };
        
        res.json({
            success: true,
            market: marketSentiment,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Market sentiment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market sentiment'
        });
    }
});

// @route   GET /api/sentiment/history/:symbol
// @desc    Get historical sentiment data for a symbol
// @access  Private
router.get('/history/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days = 7 } = req.query;
        
        // TODO: Replace with real historical sentiment data
        const history = [];
        for (let i = parseInt(days); i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            history.push({
                date: date.toISOString().split('T')[0],
                bullish: Math.floor(Math.random() * 30) + 40,
                neutral: Math.floor(Math.random() * 20) + 15,
                bearish: Math.floor(Math.random() * 25) + 20,
                volume: Math.floor(Math.random() * 5000) + 1000
            });
        }
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            history,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Sentiment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentiment history'
        });
    }
});

module.exports = router;