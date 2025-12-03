// server/routes/publicStats.js - Public Statistics & Market Data Routes
// No authentication required for these endpoints

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Try to import models (may not all exist)
let User, Portfolio, Prediction, Trade;
try { User = require('../models/User'); } catch (e) { console.log('[PublicStats] User model not found'); }
try { Portfolio = require('../models/Portfolio'); } catch (e) { console.log('[PublicStats] Portfolio model not found'); }
try { Prediction = require('../models/Prediction'); } catch (e) { console.log('[PublicStats] Prediction model not found'); }
try { Trade = require('../models/Trade'); } catch (e) { console.log('[PublicStats] Trade model not found'); }

// Cache for market data (refresh every 60 seconds)
let marketCache = { stocks: [], crypto: [], timestamp: 0 };
const CACHE_DURATION = 60 * 1000; // 60 seconds

// @route   GET /api/public/stats
// @desc    Get public platform statistics
// @access  Public
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            totalUsers: 0,
            totalTrades: 0,
            totalPredictions: 0,
            predictionAccuracy: 0
        };

        if (User) {
            stats.totalUsers = await User.countDocuments({ isActive: { $ne: false } });
        }

        if (Trade) {
            stats.totalTrades = await Trade.countDocuments({});
        }

        if (Prediction) {
            stats.totalPredictions = await Prediction.countDocuments({});
            
            // Calculate accuracy
            const resolved = await Prediction.countDocuments({ 
                status: { $in: ['correct', 'incorrect'] } 
            });
            const correct = await Prediction.countDocuments({ status: 'correct' });
            
            if (resolved > 0) {
                stats.predictionAccuracy = (correct / resolved) * 100;
            }
        }

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('[PublicStats] Stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// @route   GET /api/public/market-ticker
// @desc    Get live market ticker data for landing page
// @access  Public
router.get('/market-ticker', async (req, res) => {
    try {
        // Check cache
        if (Date.now() - marketCache.timestamp < CACHE_DURATION && 
            (marketCache.stocks.length > 0 || marketCache.crypto.length > 0)) {
            return res.json({
                success: true,
                ticker: [...marketCache.stocks, ...marketCache.crypto]
            });
        }

        const ticker = [];
        
        // Fetch stock data from Yahoo Finance
        const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];
        try {
            const stockPromises = stockSymbols.map(async (symbol) => {
                try {
                    const response = await axios.get(
                        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
                        { timeout: 5000 }
                    );
                    const result = response.data?.chart?.result?.[0];
                    if (result?.meta) {
                        const meta = result.meta;
                        const price = meta.regularMarketPrice;
                        const prevClose = meta.previousClose || meta.chartPreviousClose;
                        const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
                        
                        return {
                            symbol,
                            price: price,
                            change: change,
                            type: 'stock'
                        };
                    }
                } catch (e) { return null; }
                return null;
            });
            
            const stockResults = await Promise.all(stockPromises);
            ticker.push(...stockResults.filter(Boolean));
        } catch (e) { console.log('[PublicStats] Stock fetch failed'); }

        // Fetch crypto data from CoinGecko
        try {
            const cryptoResponse = await axios.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd&include_24hr_change=true',
                { timeout: 5000 }
            );
            
            const cryptoMap = {
                bitcoin: 'BTC',
                ethereum: 'ETH',
                solana: 'SOL',
                cardano: 'ADA'
            };
            
            for (const [id, symbol] of Object.entries(cryptoMap)) {
                const data = cryptoResponse.data?.[id];
                if (data) {
                    ticker.push({
                        symbol,
                        price: data.usd,
                        change: data.usd_24h_change || 0,
                        type: 'crypto'
                    });
                }
            }
        } catch (e) { console.log('[PublicStats] Crypto fetch failed'); }

        // Update cache
        marketCache = {
            stocks: ticker.filter(t => t.type === 'stock'),
            crypto: ticker.filter(t => t.type === 'crypto'),
            timestamp: Date.now()
        };

        res.json({
            success: true,
            ticker
        });
    } catch (error) {
        console.error('[PublicStats] Market ticker error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch market data' });
    }
});

// @route   GET /api/public/hot-stocks
// @desc    Get top gaining stocks for landing page
// @access  Public
router.get('/hot-stocks', async (req, res) => {
    try {
        const { limit = 4 } = req.query;
        
        // Try to get from screener data or fetch fresh
        const hotSymbols = ['NVDA', 'TSLA', 'AMD', 'AAPL', 'META', 'GOOGL'];
        const stocks = [];
        
        const promises = hotSymbols.slice(0, parseInt(limit) + 2).map(async (symbol) => {
            try {
                const response = await axios.get(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
                    { timeout: 5000 }
                );
                const result = response.data?.chart?.result?.[0];
                if (result?.meta) {
                    const meta = result.meta;
                    const price = meta.regularMarketPrice;
                    const prevClose = meta.previousClose || meta.chartPreviousClose;
                    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
                    
                    return {
                        symbol,
                        name: meta.shortName || meta.longName || symbol,
                        price,
                        change
                    };
                }
            } catch (e) { return null; }
            return null;
        });
        
        const results = await Promise.all(promises);
        const validStocks = results.filter(Boolean);
        
        // Sort by change (gainers first)
        validStocks.sort((a, b) => b.change - a.change);
        
        res.json({
            success: true,
            stocks: validStocks.slice(0, parseInt(limit))
        });
    } catch (error) {
        console.error('[PublicStats] Hot stocks error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hot stocks' });
    }
});

// @route   GET /api/public/platform-stats  
// @desc    Get comprehensive platform statistics for landing page
// @access  Public
router.get('/platform-stats', async (req, res) => {
    try {
        const stats = {
            totalUsers: 0,
            totalTrades: 0,
            totalPredictions: 0,
            correctPredictions: 0,
            resolvedPredictions: 0,
            predictionAccuracy: 0,
            avgWinRate: 0,
            topPerformerReturn: 0
        };

        // User count
        if (User) {
            stats.totalUsers = await User.countDocuments({ isActive: { $ne: false } });
        }

        // Trade count
        if (Trade) {
            stats.totalTrades = await Trade.countDocuments({});
        }

        // Prediction stats
        if (Prediction) {
            stats.totalPredictions = await Prediction.countDocuments({});
            stats.resolvedPredictions = await Prediction.countDocuments({ 
                status: { $in: ['correct', 'incorrect'] } 
            });
            stats.correctPredictions = await Prediction.countDocuments({ status: 'correct' });
            
            if (stats.resolvedPredictions > 0) {
                stats.predictionAccuracy = (stats.correctPredictions / stats.resolvedPredictions) * 100;
            }
        }

        // Top performer
        if (Portfolio) {
            const topPortfolio = await Portfolio.findOne({})
                .sort({ totalChangePercent: -1 })
                .select('totalChangePercent')
                .lean();
            
            if (topPortfolio) {
                stats.topPerformerReturn = topPortfolio.totalChangePercent || 0;
            }
        }

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('[PublicStats] Platform stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch platform stats' });
    }
});

module.exports = router;