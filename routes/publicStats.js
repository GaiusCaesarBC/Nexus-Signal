// server/routes/publicStats.js
// Public statistics endpoint for landing page - NO AUTH REQUIRED

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const PaperTradingAccount = require('../models/PaperTradingAccount');

// Cache for public stats (refresh every 5 minutes)
let statsCache = null;
let statsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for hot stocks (refresh every 2 minutes)
let hotStocksCache = null;
let hotStocksCacheTime = 0;
const HOT_STOCKS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Cache for market ticker (refresh every 1 minute)
let tickerCache = null;
let tickerCacheTime = 0;
const TICKER_CACHE_DURATION = 60 * 1000; // 1 minute

// GET /api/public/stats - Get platform statistics for landing page
router.get('/stats', async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if fresh
        if (statsCache && (now - statsCacheTime) < CACHE_DURATION) {
            return res.json(statsCache);
        }

        console.log('[PublicStats] Fetching fresh platform statistics...');

        // Get total users
        const totalUsers = await User.countDocuments();

        // Get total predictions
        const totalPredictions = await Prediction.countDocuments();

        // Get resolved predictions for accuracy calculation
        const resolvedPredictions = await Prediction.countDocuments({
            status: { $in: ['correct', 'incorrect'] }
        });

        const correctPredictions = await Prediction.countDocuments({
            status: 'correct'
        });

        // Calculate platform-wide prediction accuracy
        const predictionAccuracy = resolvedPredictions > 0 
            ? (correctPredictions / resolvedPredictions) * 100 
            : 0;

        // Get total trades from paper trading
        const tradeStats = await PaperTradingAccount.aggregate([
            {
                $group: {
                    _id: null,
                    totalTrades: { $sum: '$totalTrades' },
                    totalVolume: { $sum: '$portfolioValue' }
                }
            }
        ]);

        const totalTrades = tradeStats[0]?.totalTrades || 0;
        const totalVolume = tradeStats[0]?.totalVolume || 0;

        // Get average win rate from leaderboard
        const winRateStats = await PaperTradingAccount.aggregate([
            { $match: { totalTrades: { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    avgWinRate: { $avg: '$winRate' }
                }
            }
        ]);

        const avgWinRate = winRateStats[0]?.avgWinRate || 0;

        // Get top performer return
        const topPerformer = await PaperTradingAccount.findOne({
            totalTrades: { $gt: 0 }
        }).sort({ totalProfitLossPercent: -1 }).limit(1);

        const topPerformerReturn = topPerformer?.totalProfitLossPercent || 0;

        // Build response
        const stats = {
            success: true,
            stats: {
                totalUsers,
                totalPredictions,
                resolvedPredictions,
                correctPredictions,
                predictionAccuracy: Math.round(predictionAccuracy * 10) / 10,
                totalTrades,
                totalVolume: Math.round(totalVolume),
                avgWinRate: Math.round(avgWinRate * 10) / 10,
                topPerformerReturn: Math.round(topPerformerReturn * 10) / 10
            },
            cachedAt: new Date().toISOString()
        };

        // Cache the results
        statsCache = stats;
        statsCacheTime = now;

        console.log('[PublicStats] Stats:', stats.stats);
        res.json(stats);

    } catch (error) {
        console.error('[PublicStats] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics',
            stats: {
                totalUsers: 0,
                totalPredictions: 0,
                predictionAccuracy: 0,
                totalTrades: 0
            }
        });
    }
});

// GET /api/public/market-ticker - Get live market data for ticker
router.get('/market-ticker', async (req, res) => {
    try {
        const axios = require('axios');
        
        // Symbols to show in ticker
        const stockSymbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMD', 'META'];
        const cryptoSymbols = ['bitcoin', 'ethereum', 'solana', 'ripple', 'dogecoin'];
        
        const results = [];

        // Fetch stock prices from Yahoo Finance
        for (const symbol of stockSymbols.slice(0, 4)) {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 5000
                });
                
                const data = response.data?.chart?.result?.[0];
                if (data) {
                    const price = data.meta?.regularMarketPrice || 0;
                    const prevClose = data.meta?.chartPreviousClose || price;
                    const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
                    
                    results.push({
                        symbol,
                        price: Math.round(price * 100) / 100,
                        change: Math.round(change * 100) / 100,
                        type: 'stock'
                    });
                }
            } catch (e) {
                // Skip failed symbols
            }
        }

        // Fetch crypto prices from CoinGecko
        try {
            const ids = cryptoSymbols.join(',');
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
            const response = await axios.get(url, { timeout: 5000 });
            
            const symbolMap = {
                'bitcoin': 'BTC',
                'ethereum': 'ETH',
                'solana': 'SOL',
                'ripple': 'XRP',
                'dogecoin': 'DOGE'
            };

            for (const [id, data] of Object.entries(response.data)) {
                results.push({
                    symbol: symbolMap[id] || id.toUpperCase(),
                    price: data.usd,
                    change: Math.round((data.usd_24h_change || 0) * 100) / 100,
                    type: 'crypto'
                });
            }
        } catch (e) {
            console.log('[PublicStats] CoinGecko fetch failed');
        }

        res.json({
            success: true,
            ticker: results,
            fetchedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PublicStats] Market ticker error:', error.message);
        res.status(500).json({ success: false, ticker: [] });
    }
});

// GET /api/public/hot-stocks - Get top gainers
router.get('/hot-stocks', async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if fresh
        if (hotStocksCache && (now - hotStocksCacheTime) < HOT_STOCKS_CACHE_DURATION) {
            return res.json(hotStocksCache);
        }
        
        console.log('[PublicStats] Fetching fresh hot stocks data...');
        const axios = require('axios');
        
        // Fetch a broad list of popular/volatile stocks to find today's gainers
        const watchList = [
            'NVDA', 'TSLA', 'AMD', 'SMCI', 'PLTR', 'MSTR', 'COIN', 'META', 
            'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NFLX', 'AVGO', 'MU', 'INTC',
            'SOFI', 'HOOD', 'RBLX', 'SNAP', 'UBER', 'LYFT', 'SQ', 'PYPL',
            'BA', 'F', 'GM', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI',
            'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'V', 'MA',
            'XOM', 'CVX', 'OXY', 'SLB', 'HAL', 'DVN', 'MRO', 'APA',
            'PFE', 'MRNA', 'JNJ', 'UNH', 'LLY', 'ABBV', 'MRK', 'BMY',
            'DIS', 'WMT', 'TGT', 'COST', 'HD', 'LOW', 'NKE', 'SBUX'
        ];
        
        const results = [];
        
        // Batch fetch using Yahoo Finance
        // Process in smaller batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < Math.min(watchList.length, 40); i += batchSize) {
            const batch = watchList.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (symbol) => {
                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                    const response = await axios.get(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        timeout: 5000
                    });
                    
                    const data = response.data?.chart?.result?.[0];
                    if (data) {
                        const price = data.meta?.regularMarketPrice || 0;
                        const prevClose = data.meta?.chartPreviousClose || price;
                        const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
                        
                        return {
                            symbol,
                            name: data.meta?.shortName || data.meta?.longName || symbol,
                            price: Math.round(price * 100) / 100,
                            change: Math.round(change * 100) / 100
                        };
                    }
                } catch (e) {
                    // Skip failed symbols
                    return null;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(r => r !== null));
            
            // Small delay between batches to avoid rate limiting
            if (i + batchSize < watchList.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Sort by change descending (highest gainers first)
        results.sort((a, b) => b.change - a.change);
        
        // Return top 4 gainers (only positive gains)
        const topGainers = results.filter(s => s.change > 0).slice(0, 4);
        
        // If no gainers today, return top 4 by change anyway
        const finalResults = topGainers.length >= 4 ? topGainers : results.slice(0, 4);

        const response = {
            success: true,
            stocks: finalResults,
            totalScanned: results.length,
            fetchedAt: new Date().toISOString()
        };
        
        // Cache the results
        hotStocksCache = response;
        hotStocksCacheTime = now;

        res.json(response);

    } catch (error) {
        console.error('[PublicStats] Hot stocks error:', error.message);
        res.status(500).json({ success: false, stocks: [] });
    }
});

module.exports = router;