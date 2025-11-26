// server/routes/gamificationRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Gamification = require('../models/Gamification');
const GamificationService = require('../services/gamificationService');
const ACHIEVEMENTS = require('../config/achievements');

// @route   GET /api/gamification/stats
// @desc    Get user gamification stats
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        console.log('[Gamification] Fetching data for user:', req.user.id);
        
        // ✅ Get BOTH Gamification data AND User stats
        let gamification = await Gamification.findOne({ user: req.user.id });
        
        if (!gamification) {
            console.log('[Gamification] No data found, initializing...');
            gamification = await GamificationService.initializeUser(req.user.id);
        }

        // ✅ Get real stats from User model (paper trading)
        const User = require('../models/User');
        const user = await User.findById(req.user.id).select('stats').lean();

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
                
                // ✅ Use REAL stats from User model (calculated from paper trading)
                stats: {
                    totalTrades: user?.stats?.totalTrades || 0,
                    profitableTrades: user?.stats?.winningTrades || 0,
                    totalProfit: user?.stats?.totalReturn || 0,
                    totalReturnPercent: user?.stats?.totalReturnPercent || 0,  // ✅ REAL DATA
                    winRate: user?.stats?.winRate || 0,  // ✅ REAL DATA
                    predictionsCreated: user?.stats?.totalPredictions || 0,
                    correctPredictions: user?.stats?.correctPredictions || 0,
                    predictionAccuracy: user?.stats?.predictionAccuracy || 0,
                    portfolioValue: user?.stats?.currentValue || user?.stats?.portfolioValue || 0,
                    daysActive: gamification.daysActive || 0,
                    stocksOwned: user?.stats?.openPositions || 0,
                    referrals: 0
                },
                
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
        
        console.log('[Gamification] Returned stats with totalReturnPercent:', user?.stats?.totalReturnPercent);
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
        
        if (!gamification) {
            // Return all achievements as locked if user has no gamification data
            const allAchievements = Object.values(ACHIEVEMENTS).map(ach => ({
                id: ach.id,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                category: ach.category,
                rarity: ach.rarity,
                points: ach.points,
                unlocked: false,
                unlockedAt: null
            }));

            return res.json({
                success: true,
                achievements: allAchievements
            });
        }

        // Map all achievements with unlock status
        const allAchievements = Object.values(ACHIEVEMENTS).map(ach => {
            // Find if this achievement is unlocked by the user
            const userAchievement = gamification.achievements.find(ua => ua.id === ach.id);
            
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

        res.json({
            success: true,
            achievements: allAchievements
        });

    } catch (error) {
        console.error('[Gamification] Get achievements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch achievements'
        });
    }
});

// @route   POST /api/gamification/login-streak
// @desc    Update login streak
// @access  Private
router.post('/login-streak', authMiddleware, async (req, res) => {
    try {
        const result = await GamificationService.updateLoginStreak(req.user.id);
        
        res.json({
            success: true,
            streak: result.streak,
            isNew: result.isNew,
            broken: result.broken || false
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

module.exports = router;