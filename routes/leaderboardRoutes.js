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


// Import models for real portfolio leaderboard
const BrokerageConnection = require('../models/BrokerageConnection');
const BrokeragePortfolioHistory = require('../models/BrokeragePortfolioHistory');

// @route   GET /api/leaderboard/real-portfolio
// @desc    Get real portfolio leaderboard (based on portfolio history with gain/loss)
// @access  Public (shows anonymized data) or Private (shows your rank)
router.get('/real-portfolio', async (req, res) => {
    try {
        const {
            sortBy = 'totalReturnPercent',
            period = 'all',
            limit = 100
        } = req.query;

        const safeLimit = Math.min(parseInt(limit) || 100, 100);

        // Get all portfolio histories with gain/loss data
        const histories = await BrokeragePortfolioHistory.find({
            currentValue: { $gt: 0 }
        })
        .populate('user', 'username displayName avatar profile vault level xp gamification')
        .lean();

        // Build leaderboard from portfolio histories
        const leaderboard = histories
            .filter(h => h.user) // Only include entries with valid users
            .map(history => ({
                userId: history.user._id.toString(),
                username: history.user.username || 'Anonymous',
                displayName: history.user.displayName || history.user.profile?.displayName || history.user.username || 'Anonymous Trader',
                avatar: history.user.avatar || history.user.profile?.avatar,
                level: history.user.gamification?.level || history.user.level || 1,
                xp: history.user.gamification?.xp || history.user.xp || 0,
                equippedBorder: history.user.vault?.equippedBorder || 'border-bronze',
                equippedBadges: history.user.vault?.equippedBadges || [],
                totalValue: history.currentValue || 0,
                initialValue: history.initialValue || 0,
                totalReturn: history.totalGain || 0,
                totalReturnPercent: history.totalGainPercent || 0,
                allTimeHigh: history.allTimeHigh?.value || 0,
                allTimeLow: history.allTimeLow?.value || 0,
                lastSync: history.lastUpdated,
                trackingSince: history.initialDate
            }));

        // Sort based on sortBy parameter - default is by percentage gain (highest to lowest)
        switch (sortBy) {
            case 'totalReturnPercent':
            case 'returns':
                leaderboard.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
                break;
            case 'totalValue':
            case 'value':
                leaderboard.sort((a, b) => b.totalValue - a.totalValue);
                break;
            case 'totalReturn':
            case 'gain':
                leaderboard.sort((a, b) => b.totalReturn - a.totalReturn);
                break;
            case 'xp':
                leaderboard.sort((a, b) => b.xp - a.xp);
                break;
            case 'level':
                leaderboard.sort((a, b) => b.level - a.level);
                break;
            default:
                // Default: sort by percentage gain (highest to lowest)
                leaderboard.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
        }

        // Limit results
        const limitedLeaderboard = leaderboard.slice(0, safeLimit);

        // Add rank
        const rankedLeaderboard = limitedLeaderboard.map((trader, index) => ({
            rank: index + 1,
            ...trader
        }));

        console.log(`[Leaderboard] Real portfolio: ${rankedLeaderboard.length} users, sorted by ${sortBy}`);

        res.json({
            success: true,
            type: 'real-portfolio',
            leaderboard: rankedLeaderboard,
            total: leaderboard.length,
            filters: { sortBy, period }
        });

    } catch (error) {
        console.error('[Leaderboard] Real portfolio error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch real portfolio leaderboard'
        });
    }
});


module.exports = router;