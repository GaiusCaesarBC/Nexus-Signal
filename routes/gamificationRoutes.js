// server/routes/gamificationRoutes.js - UPDATED WITH ACHIEVEMENT INTEGRATION
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Gamification = require('../models/Gamification');
const GamificationService = require('../services/gamificationService');
const AchievementService = require('../services/achievementService');
const ACHIEVEMENTS = require('../config/achievements');

// @route   GET /api/gamification/stats
// @desc    Get user gamification stats
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        console.log('[Gamification] Fetching data for user:', req.user.id);
        
        let gamification = await Gamification.findOne({ user: req.user.id });
        
        if (!gamification) {
            console.log('[Gamification] No data found, initializing...');
            gamification = await GamificationService.initializeUser(req.user.id);
        }

        // Get real stats from User model (paper trading)
        const User = require('../models/User');
        const user = await User.findById(req.user.id).select('stats').lean();

        // Also try to get paper trading account stats
        let paperTradingStats = {};
        try {
            const PaperTradingAccount = require('../models/PaperTradingAccount');
            const paperAccount = await PaperTradingAccount.findOne({ user: req.user.id }).lean();
            if (paperAccount) {
                paperTradingStats = {
                    totalTrades: paperAccount.totalTrades || 0,
                    profitableTrades: paperAccount.winningTrades || 0,
                    losingTrades: paperAccount.losingTrades || 0,
                    portfolioValue: paperAccount.portfolioValue || 100000,
                    totalProfit: paperAccount.totalProfitLoss || 0,
                    winRate: paperAccount.winRate || 0,
                    stocksOwned: paperAccount.positions?.length || 0,
                    biggestWin: paperAccount.biggestWin || 0,
                    biggestLoss: paperAccount.biggestLoss || 0,
                    currentStreak: paperAccount.currentStreak || 0,
                    bestStreak: paperAccount.bestStreak || 0
                };
            }
        } catch (err) {
            console.log('[Gamification] No paper trading account found');
        }

        // Merge stats - prefer paper trading stats when available
        const mergedStats = {
            totalTrades: paperTradingStats.totalTrades || user?.stats?.totalTrades || gamification.stats.totalTrades || 0,
            profitableTrades: paperTradingStats.profitableTrades || user?.stats?.winningTrades || gamification.stats.profitableTrades || 0,
            losingTrades: paperTradingStats.losingTrades || gamification.stats.losingTrades || 0,
            totalProfit: paperTradingStats.totalProfit || user?.stats?.totalReturn || gamification.stats.totalProfit || 0,
            totalReturnPercent: user?.stats?.totalReturnPercent || 0,
            winRate: paperTradingStats.winRate || user?.stats?.winRate || gamification.stats.winRate || 0,
            predictionsCreated: user?.stats?.totalPredictions || gamification.stats.predictionsCreated || 0,
            correctPredictions: user?.stats?.correctPredictions || gamification.stats.correctPredictions || 0,
            predictionAccuracy: user?.stats?.predictionAccuracy || gamification.stats.predictionAccuracy || 0,
            portfolioValue: paperTradingStats.portfolioValue || user?.stats?.currentValue || gamification.stats.portfolioValue || 100000,
            daysActive: gamification.stats.daysActive || 0,
            stocksOwned: paperTradingStats.stocksOwned || user?.stats?.openPositions || gamification.stats.stocksOwned || 0,
            referrals: gamification.stats.referrals || 0,
            // Paper trading specific
            totalRefills: gamification.stats.totalRefills || 0,
            leveragedTrades: gamification.stats.leveragedTrades || 0,
            shortTrades: gamification.stats.shortTrades || 0,
            maxProfitStreak: gamification.stats.maxProfitStreak || paperTradingStats.bestStreak || 0,
            maxLossStreak: gamification.stats.maxLossStreak || 0,
            followersCount: gamification.stats.followersCount || 0,
            followingCount: gamification.stats.followingCount || 0
        };

        // Calculate XP bounds for current level
        const xpForCurrentLevel = (gamification.level - 1) * 1000;
        const xpForNextLevel = gamification.level * 1000;

        res.json({
            success: true,
            data: {
                xp: gamification.xp,
                level: gamification.level,
                rank: gamification.rank,
                nexusCoins: gamification.nexusCoins,
                totalEarned: gamification.totalEarned,
                loginStreak: gamification.loginStreak,
                maxLoginStreak: gamification.maxLoginStreak,
                profitStreak: gamification.profitStreak,
                maxProfitStreak: gamification.maxProfitStreak,
                achievements: gamification.achievements,
                stats: mergedStats,
                dailyChallenge: gamification.dailyChallenge,
                lastLoginDate: gamification.lastLoginDate,
                xpForCurrentLevel: xpForCurrentLevel,
                xpForNextLevel: xpForNextLevel,
                equippedItems: gamification.equippedItems || {
                    avatarBorder: null,
                    profileTheme: 'theme-default',
                    activePerk: null,
                    badges: []
                }
            }
        });
        
        console.log('[Gamification] Returned stats with totalReturnPercent:', mergedStats.totalReturnPercent);
    } catch (error) {
        console.error('[Gamification] Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch gamification stats'
        });
    }
});

// @route   GET /api/gamification/achievements
// @desc    Get all achievements (with unlock status)
// @access  Private
router.get('/achievements', authMiddleware, async (req, res) => {
    try {
        const gamification = await Gamification.findOne({ user: req.user.id });
        
        // Map all achievements with unlock status
        const allAchievements = Object.values(ACHIEVEMENTS).map(ach => {
            const userAchievement = gamification?.achievements?.find(ua => ua.id === ach.id);
            
            return {
                id: ach.id,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                category: ach.category,
                rarity: ach.rarity,
                points: ach.points,
                unlocked: !!userAchievement,
                unlockedAt: userAchievement ? userAchievement.unlockedAt : null
            };
        });

        // Sort: unlocked first, then by rarity (legendary first)
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        allAchievements.sort((a, b) => {
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        });

        res.json({
            success: true,
            achievements: allAchievements,
            total: allAchievements.length,
            unlocked: allAchievements.filter(a => a.unlocked).length
        });

    } catch (error) {
        console.error('[Gamification] Get achievements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch achievements'
        });
    }
});

// @route   POST /api/gamification/check-achievements
// @desc    Check and unlock any new achievements
// @access  Private
router.post('/check-achievements', authMiddleware, async (req, res) => {
    try {
        const result = await AchievementService.checkAllAchievements(req.user.id);
        
        res.json({
            success: true,
            newlyUnlocked: result.newlyUnlocked,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel,
            newRank: result.newRank
        });

    } catch (error) {
        console.error('[Gamification] Check achievements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check achievements'
        });
    }
});

// @route   GET /api/gamification/achievement-progress
// @desc    Get detailed achievement progress
// @access  Private
router.get('/achievement-progress', authMiddleware, async (req, res) => {
    try {
        const progress = await AchievementService.getAchievementProgress(req.user.id);
        
        res.json({
            success: true,
            progress
        });

    } catch (error) {
        console.error('[Gamification] Achievement progress error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get achievement progress'
        });
    }
});

// @route   POST /api/gamification/login-streak
// @desc    Update login streak
// @access  Private
router.post('/login-streak', authMiddleware, async (req, res) => {
    try {
        const result = await GamificationService.updateLoginStreak(req.user.id);
        
        // Check achievements after login streak update
        const achievementResult = await AchievementService.checkAllAchievements(req.user.id);
        
        res.json({
            success: true,
            streak: result.streak,
            isNew: result.isNew,
            broken: result.broken || false,
            newAchievements: achievementResult.newlyUnlocked
        });
    } catch (error) {
        console.error('[Gamification] Login streak error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update login streak'
        });
    }
});

// @route   GET /api/gamification/leaderboard
// @desc    Get leaderboard
// @access  Private
router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        const { type = 'xp', limit = 10 } = req.query;
        const leaderboard = await GamificationService.getLeaderboard(type, parseInt(limit));
        
        res.json({
            success: true,
            leaderboard
        });
    } catch (error) {
        console.error('[Gamification] Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

// @route   POST /api/gamification/daily-challenge
// @desc    Generate or get daily challenge
// @access  Private
router.post('/daily-challenge', authMiddleware, async (req, res) => {
    try {
        const challenge = await GamificationService.generateDailyChallenge(req.user.id);
        
        res.json({
            success: true,
            challenge
        });
    } catch (error) {
        console.error('[Gamification] Daily challenge error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate daily challenge'
        });
    }
});

// @route   POST /api/gamification/sync-stats
// @desc    Sync stats from paper trading and check achievements
// @access  Private
router.post('/sync-stats', authMiddleware, async (req, res) => {
    try {
        // Get paper trading account
        const PaperTradingAccount = require('../models/PaperTradingAccount');
        const paperAccount = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (paperAccount) {
            const result = await AchievementService.updatePaperTradingStats(req.user.id, paperAccount);
            
            res.json({
                success: true,
                message: 'Stats synced successfully',
                newAchievements: result.newlyUnlocked,
                leveledUp: result.leveledUp
            });
        } else {
            res.json({
                success: true,
                message: 'No paper trading account found',
                newAchievements: []
            });
        }
    } catch (error) {
        console.error('[Gamification] Sync stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync stats'
        });
    }
});

module.exports = router;