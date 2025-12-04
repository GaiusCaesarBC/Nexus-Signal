// server/routes/leaderboardRoutes.js - Leaderboard & Top Traders

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');

// @route   GET /api/leaderboard
// @desc    Get top traders leaderboard
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { period = 'all', limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get users with their portfolio data
        const users = await User.find({ isActive: { $ne: false } })
            .select('username displayName avatar profile vault xp level createdAt')
            .lean();

        // Get portfolio data for all users
        const portfolios = await Portfolio.find({})
            .select('user cashBalance totalValue totalChangePercent holdings')
            .lean();

        // Create a map of portfolios by user ID
        const portfolioMap = {};
        portfolios.forEach(p => {
            const userId = p.user?.toString();
            if (userId) {
                portfolioMap[userId] = p;
            }
        });

        // Combine user and portfolio data
        const leaderboardData = users.map(user => {
            const userId = user._id.toString();
            const portfolio = portfolioMap[userId] || {};
            
            // Calculate stats - starting balance is 10000 per your model
            const startingBalance = 10000;
            const totalValue = portfolio.totalValue || portfolio.cashBalance || startingBalance;
            const totalReturn = totalValue - startingBalance;
            const totalReturnPercent = portfolio.totalChangePercent || 
                ((totalValue - startingBalance) / startingBalance * 100);
            const holdingsCount = portfolio.holdings?.length || 0;

            return {
                _id: user._id,
                userId: userId,
                username: user.username || 'Anonymous',
                displayName: user.displayName || user.username || 'Anonymous Trader',
                avatar: user.avatar || user.profile?.avatar,
                level: user.level || 1,
                xp: user.xp || 0,
                equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                equippedTheme: user.profile?.equippedTheme || 'theme-default',
                totalValue: totalValue,
                totalReturn: totalReturn,
                totalReturnPercent: totalReturnPercent,
                holdingsCount: holdingsCount,
                joinedAt: user.createdAt
            };
        });

        // Sort by total return percent (best performers first)
        leaderboardData.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);

        // Apply pagination
        const paginatedData = leaderboardData.slice(skip, skip + parseInt(limit));

        // Add rank
        const rankedData = paginatedData.map((trader, index) => ({
            ...trader,
            rank: skip + index + 1
        }));

        res.json({
            success: true,
            leaderboard: rankedData,
            total: leaderboardData.length,
            page: parseInt(page),
            pages: Math.ceil(leaderboardData.length / parseInt(limit))
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

// @route   GET /api/leaderboard/top
// @desc    Get top 3-10 traders (for landing page / widgets)
// @access  Public
router.get('/top', async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        // Get users with portfolio performance
        const users = await User.find({ isActive: { $ne: false } })
            .select('username displayName avatar profile vault xp level')
            .lean();

        const portfolios = await Portfolio.find({})
            .select('user cashBalance totalValue totalChangePercent')
            .lean();

        const portfolioMap = {};
        portfolios.forEach(p => {
            const userId = p.user?.toString();
            if (userId) portfolioMap[userId] = p;
        });

        const startingBalance = 10000;
        
        const topTraders = users.map(user => {
            const portfolio = portfolioMap[user._id.toString()] || {};
            const totalValue = portfolio.totalValue || portfolio.cashBalance || startingBalance;
            const totalReturnPercent = portfolio.totalChangePercent || 
                ((totalValue - startingBalance) / startingBalance * 100);

            return {
                _id: user._id,
                username: user.username || 'Anonymous',
                displayName: user.displayName || user.username,
                avatar: user.avatar || user.profile?.avatar,
                level: user.level || 1,
                equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                totalReturnPercent: totalReturnPercent
            };
        })
        .filter(t => t.totalReturnPercent > 0) // Only show profitable traders
        .sort((a, b) => b.totalReturnPercent - a.totalReturnPercent)
        .slice(0, parseInt(limit));

        // Add rank
        const rankedTraders = topTraders.map((trader, index) => ({
            ...trader,
            rank: index + 1
        }));

        res.json({
            success: true,
            topTraders: rankedTraders
        });

    } catch (error) {
        console.error('Top traders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top traders'
        });
    }
});

// @route   GET /api/leaderboard/winners
// @desc    Get recent winners (traders who made profit recently)
// @access  Public
router.get('/winners', async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        // Get recent profitable trades or users
        const users = await User.find({ isActive: { $ne: false } })
            .select('username displayName avatar profile vault xp level updatedAt')
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();

        const portfolios = await Portfolio.find({})
            .select('user totalChangePercent updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        const portfolioMap = {};
        portfolios.forEach(p => {
            const userId = p.user?.toString();
            if (userId) portfolioMap[userId] = p;
        });

        const recentWinners = users
            .map(user => {
                const portfolio = portfolioMap[user._id.toString()] || {};
                return {
                    _id: user._id,
                    username: user.username || 'Anonymous',
                    displayName: user.displayName || user.username,
                    avatar: user.avatar || user.profile?.avatar,
                    level: user.level || 1,
                    equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                    totalReturnPercent: portfolio.totalChangePercent || 0,
                    updatedAt: portfolio.updatedAt || user.updatedAt
                };
            })
            .filter(u => u.totalReturnPercent > 0)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, parseInt(limit));

        res.json({
            success: true,
            winners: recentWinners
        });

    } catch (error) {
        console.error('Recent winners error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent winners'
        });
    }
});

// @route   GET /api/leaderboard/user/:userId
// @desc    Get specific user's rank
// @access  Public
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Get all users with portfolios to calculate rank
        const users = await User.find({ isActive: { $ne: false } })
            .select('_id username')
            .lean();

        const portfolios = await Portfolio.find({})
            .select('user totalChangePercent')
            .lean();

        const portfolioMap = {};
        portfolios.forEach(p => {
            const portfolioUserId = p.user?.toString();
            if (portfolioUserId) portfolioMap[portfolioUserId] = p;
        });

        const rankings = users.map(user => ({
            oduserId: user._id.toString(),
            totalReturnPercent: portfolioMap[user._id.toString()]?.totalChangePercent || 0
        }))
        .sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);

        const userRank = rankings.findIndex(r => r.oduserId === userId) + 1;

        if (userRank === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            rank: userRank,
            totalTraders: rankings.length,
            percentile: Math.round((1 - userRank / rankings.length) * 100)
        });

    } catch (error) {
        console.error('User rank error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user rank'
        });
    }
});


// Add this to your existing leaderboardRoutes.js

// @route   GET /api/leaderboard/real-portfolio
// @desc    Get real portfolio leaderboard (based on user stats)
router.get('/real-portfolio', auth, async (req, res) => {
    try {
        const { 
            timeframe = 'all-time', 
            metric = 'return', 
            limit = 50 
        } = req.query;
        
        const safeLimit = Math.min(parseInt(limit) || 50, 100);
        
        // Build query based on timeframe
        let query = { 'stats.lastUpdated': { $exists: true } };
        const now = new Date();
        
        if (timeframe === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            query['stats.lastUpdated'] = { $gte: startOfDay };
        } else if (timeframe === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query['stats.lastUpdated'] = { $gte: weekAgo };
        } else if (timeframe === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            query['stats.lastUpdated'] = { $gte: monthAgo };
        }
        
        // Build sort based on metric
        let sortField = {};
        if (metric === 'return') {
            sortField = { 'stats.totalReturnPercent': -1 };
        } else if (metric === 'profit') {
            sortField = { 'stats.totalReturn': -1 };
        } else if (metric === 'winrate') {
            sortField = { 'stats.winRate': -1 };
        } else if (metric === 'trades') {
            sortField = { 'stats.totalTrades': -1 };
        }
        
        // Fetch users with real portfolio data
        const users = await User.find(query)
            .select('username name profile vault stats')
            .sort(sortField)
            .limit(safeLimit);
        
        // Find current user's rank
        const allUsers = await User.find(query).sort(sortField).select('_id');
        const currentUserRank = allUsers.findIndex(u => 
            u._id.toString() === req.user.id
        ) + 1;
        
        // Format leaderboard
        const leaderboard = users
            .filter(user => user.stats && user.stats.totalTrades > 0)
            .map((user, index) => ({
                rank: index + 1,
                user: {
                    id: user._id,
                    username: user.username,
                    displayName: user.profile?.displayName || user.name || user.username,
                    avatar: user.profile?.avatar || null,
                    verified: user.profile?.verified || false,
                    equippedBorder: user.vault?.equippedBorder || 'border-bronze'
                },
                isCurrentUser: user._id.toString() === req.user.id,
                portfolioValue: user.stats?.currentValue || 0,
                profitLoss: user.stats?.totalReturn || 0,
                profitLossPercent: user.stats?.totalReturnPercent || 0,
                winRate: user.stats?.winRate || 0,
                totalTrades: user.stats?.totalTrades || 0,
                predictionAccuracy: user.stats?.predictionAccuracy || 0,
                currentStreak: user.stats?.currentStreak || 0,
                lastUpdated: user.stats?.lastUpdated
            }));
        
        res.json({
            success: true,
            type: 'real-portfolio',
            leaderboard,
            currentUserRank: currentUserRank || null,
            filters: { timeframe, metric },
            total: leaderboard.length
        });
        
    } catch (error) {
        console.error('[Leaderboard] Real portfolio error:', error);
        res.status(500).json({ error: 'Failed to fetch real portfolio leaderboard' });
    }
});


module.exports = router;