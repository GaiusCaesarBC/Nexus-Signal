// server/routes/gamificationRoutes.js - UPDATED WITH VAULT DATA
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Gamification = require('../models/Gamification');
const User = require('../models/User');
const GamificationService = require('../services/gamificationService');
const AchievementService = require('../services/achievementService');
const ACHIEVEMENTS = require('../config/achievements');

// @route   GET /api/gamification/stats
// @desc    Get user gamification stats INCLUDING VAULT DATA AND PREDICTION STATS
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        console.log('[Gamification] Fetching data for user:', req.user.id);
        
        let gamification = await Gamification.findOne({ user: req.user.id });
        
        if (!gamification) {
            console.log('[Gamification] No data found, initializing...');
            gamification = await GamificationService.initializeUser(req.user.id);
        }

        // Get user with stats AND vault data
        const user = await User.findById(req.user.id).select('stats vault name username profile').lean();

        // ✅ GET REAL PREDICTION STATS FROM PREDICTION MODEL
        let predictionStats = {
            predictionsCreated: 0,
            correctPredictions: 0,
            predictionAccuracy: 0
        };
        
        try {
            const Prediction = require('../models/Prediction');
            
            const totalPredictions = await Prediction.countDocuments({ user: req.user.id });
            const correctPredictions = await Prediction.countDocuments({ 
                user: req.user.id, 
                status: 'correct' 
            });
            const resolvedPredictions = await Prediction.countDocuments({
                user: req.user.id,
                status: { $in: ['correct', 'incorrect'] }
            });
            
            const accuracy = resolvedPredictions > 0 
                ? Math.round((correctPredictions / resolvedPredictions) * 100)
                : 0;
            
            predictionStats = {
                predictionsCreated: totalPredictions,
                correctPredictions: correctPredictions,
                predictionAccuracy: accuracy
            };
            
            console.log('[Gamification] Prediction stats:', predictionStats);
        } catch (predError) {
            console.warn('[Gamification] Could not fetch prediction stats:', predError.message);
        }

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

        // Merge stats - prefer real data from models over gamification.stats
        const mergedStats = {
            totalTrades: paperTradingStats.totalTrades || user?.stats?.totalTrades || gamification.stats.totalTrades || 0,
            profitableTrades: paperTradingStats.profitableTrades || user?.stats?.winningTrades || gamification.stats.profitableTrades || 0,
            losingTrades: paperTradingStats.losingTrades || gamification.stats.losingTrades || 0,
            totalProfit: paperTradingStats.totalProfit || user?.stats?.totalReturn || gamification.stats.totalProfit || 0,
            totalReturnPercent: user?.stats?.totalReturnPercent || 0,
            winRate: paperTradingStats.winRate || user?.stats?.winRate || gamification.stats.winRate || 0,
            // ✅ USE REAL PREDICTION STATS
            predictionsCreated: predictionStats.predictionsCreated,
            correctPredictions: predictionStats.correctPredictions,
            predictionAccuracy: predictionStats.predictionAccuracy,
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

        // Build vault data from User model
        const vaultData = {
            equippedBorder: user?.vault?.equippedBorder || 'border-bronze',
            equippedTheme: user?.vault?.equippedTheme || 'theme-default',
            equippedBadges: user?.vault?.equippedBadges || [],
            activePerks: user?.vault?.activePerks || [],
            ownedItems: user?.vault?.ownedItems || ['border-bronze', 'theme-default']
        };

        console.log('[Gamification] Vault data:', vaultData);

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
                
                // Legacy equippedItems (keep for backward compatibility)
                equippedItems: gamification.equippedItems || {
                    avatarBorder: vaultData.equippedBorder,
                    profileTheme: vaultData.equippedTheme,
                    activePerk: vaultData.activePerks[0] || null,
                    badges: vaultData.equippedBadges
                },
                
                // NEW: Full vault data for borders, themes, badges
                vault: vaultData
            },
            
            // Also include at top level for easier access
            level: gamification.level,
            nexusCoins: gamification.nexusCoins,
            vault: vaultData
        });
        
        console.log('[Gamification] Returned stats with predictions:', predictionStats);
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
// @desc    Get leaderboard with vault data for borders/badges
// @access  Private
router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        const { type = 'xp', limit = 10 } = req.query;
        const leaderboard = await GamificationService.getLeaderboard(type, parseInt(limit));
        
        // Enhance leaderboard with vault data
        const enhancedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
                try {
                    const user = await User.findById(entry.userId || entry.user)
                        .select('vault profile name username')
                        .lean();
                    
                    return {
                        ...entry,
                        equippedBorder: user?.vault?.equippedBorder || 'border-bronze',
                        equippedBadges: user?.vault?.equippedBadges || [],
                        avatar: user?.profile?.avatar || null
                    };
                } catch (err) {
                    return entry;
                }
            })
        );
        
        res.json({
            success: true,
            leaderboard: enhancedLeaderboard
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

// @route   GET /api/gamification/user/:userId
// @desc    Get another user's public gamification data (for profiles)
// @access  Private
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const gamification = await Gamification.findOne({ user: userId });
        const user = await User.findById(userId)
            .select('vault profile name username')
            .lean();
        
        if (!gamification || !user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                level: gamification.level,
                rank: gamification.rank,
                xp: gamification.xp,
                achievements: gamification.achievements?.length || 0,
                loginStreak: gamification.loginStreak,
                stats: {
                    totalTrades: gamification.stats.totalTrades || 0,
                    winRate: gamification.stats.winRate || 0,
                    totalProfit: gamification.stats.totalProfit || 0
                },
                vault: {
                    equippedBorder: user?.vault?.equippedBorder || 'border-bronze',
                    equippedTheme: user?.vault?.equippedTheme || 'theme-default',
                    equippedBadges: user?.vault?.equippedBadges || []
                },
                profile: {
                    name: user.name,
                    username: user.username,
                    avatar: user?.profile?.avatar
                }
            }
        });
        
    } catch (error) {
        console.error('[Gamification] Get user data error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user data'
        });
    }
});

// @route   POST /api/gamification/sync-predictions
// @desc    Sync prediction stats from Prediction model to gamification
// @access  Private
router.post('/sync-predictions', authMiddleware, async (req, res) => {
    try {
        const Prediction = require('../models/Prediction');
        
        // Get actual counts from Prediction model
        const totalPredictions = await Prediction.countDocuments({ user: req.user.id });
        const correctPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'correct' 
        });
        const incorrectPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'incorrect' 
        });
        const pendingPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'pending' 
        });
        const resolvedPredictions = correctPredictions + incorrectPredictions;
        
        // Calculate accuracy based on resolved predictions only
        const accuracy = resolvedPredictions > 0 
            ? Math.round((correctPredictions / resolvedPredictions) * 100)
            : 0;
        
        // Update gamification record
        const gamification = await Gamification.findOneAndUpdate(
            { user: req.user.id },
            {
                $set: {
                    'stats.predictionsCreated': totalPredictions,
                    'stats.correctPredictions': correctPredictions,
                    'stats.predictionAccuracy': accuracy
                }
            },
            { new: true, upsert: true }
        );
        
        console.log(`[Gamification] Synced prediction stats for ${req.user.id}:`, {
            total: totalPredictions,
            correct: correctPredictions,
            incorrect: incorrectPredictions,
            pending: pendingPredictions,
            accuracy: accuracy
        });
        
        res.json({
            success: true,
            message: 'Prediction stats synced successfully',
            stats: {
                totalPredictions,
                correctPredictions,
                incorrectPredictions,
                pendingPredictions,
                resolvedPredictions,
                accuracy
            }
        });
    } catch (error) {
        console.error('[Gamification] Error syncing prediction stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync prediction stats'
        });
    }
});

// @route   GET /api/gamification/debug-predictions
// @desc    Debug endpoint to see raw prediction data
// @access  Private
router.get('/debug-predictions', authMiddleware, async (req, res) => {
    try {
        const Prediction = require('../models/Prediction');
        
        // Get counts
        const total = await Prediction.countDocuments({ user: req.user.id });
        const correct = await Prediction.countDocuments({ user: req.user.id, status: 'correct' });
        const incorrect = await Prediction.countDocuments({ user: req.user.id, status: 'incorrect' });
        const pending = await Prediction.countDocuments({ user: req.user.id, status: 'pending' });
        const expired = await Prediction.countDocuments({ user: req.user.id, status: 'expired' });
        
        // Get recent predictions
        const recentPredictions = await Prediction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('symbol direction status confidence createdAt expiresAt outcome');
        
        // Get gamification stats
        const gamification = await Gamification.findOne({ user: req.user.id });
        
        res.json({
            success: true,
            predictionModel: {
                total,
                correct,
                incorrect,
                pending,
                expired,
                accuracy: (correct + incorrect) > 0 ? ((correct / (correct + incorrect)) * 100).toFixed(1) + '%' : '0%'
            },
            gamificationStats: {
                predictionsCreated: gamification?.stats?.predictionsCreated || 0,
                correctPredictions: gamification?.stats?.correctPredictions || 0,
                predictionAccuracy: gamification?.stats?.predictionAccuracy || 0
            },
            recentPredictions: recentPredictions.map(p => ({
                symbol: p.symbol,
                direction: p.direction,
                status: p.status,
                confidence: p.confidence,
                createdAt: p.createdAt,
                expiresAt: p.expiresAt,
                wasCorrect: p.outcome?.wasCorrect
            })),
            note: 'If predictionModel counts differ from gamificationStats, call POST /api/gamification/sync-predictions'
        });
    } catch (error) {
        console.error('[Gamification] Debug error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;