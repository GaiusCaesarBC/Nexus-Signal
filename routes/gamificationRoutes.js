// server/routes/gamificationRoutes.js - UPDATED TO READ FROM USER.GAMIFICATION
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const GamificationService = require('../services/gamificationService');
const AchievementService = require('../services/achievementService');
const ACHIEVEMENTS = require('../config/achievements');
const DailyRewardService = require('../services/dailyRewardService');

// @route   GET /api/gamification/stats
// @desc    Get user gamification stats INCLUDING VAULT DATA AND PREDICTION STATS
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        console.log('[Gamification] Fetching data for user:', req.user.id);
        
        // ✅ READ FROM USER.GAMIFICATION (THE SOURCE OF TRUTH)
        const user = await User.findById(req.user.id).select('stats vault name username profile gamification').lean();
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Initialize gamification if it doesn't exist
        if (!user.gamification) {
            console.log('[Gamification] No gamification data, initializing...');
            const updatedUser = await User.findById(req.user.id);
            // Gamification is initialized by User model defaults
            await updatedUser.save();
            user.gamification = updatedUser.gamification;
        }
        
        const gamification = user.gamification;

        // ✅ GET REAL PREDICTION STATS FROM PREDICTION MODEL
        let predictionStats = {
            predictionsCreated: 0,
            correctPredictions: 0,
            predictionAccuracy: 0
        };
        
        try {
            const Prediction = require('../models/Prediction');
            
            // 🔥 Check for prediction reset date (only count predictions after this date)
            const predictionResetDate = gamification.predictionResetDate || null;
            const dateFilter = predictionResetDate ? { createdAt: { $gte: predictionResetDate } } : {};
            
            console.log('[Gamification] Prediction reset date:', predictionResetDate || 'None (counting all)');
            
            const totalPredictions = await Prediction.countDocuments({ 
                user: req.user.id,
                ...dateFilter
            });
            const correctPredictions = await Prediction.countDocuments({ 
                user: req.user.id, 
                status: 'correct',
                ...dateFilter
            });
            const resolvedPredictions = await Prediction.countDocuments({
                user: req.user.id,
                status: { $in: ['correct', 'incorrect'] },
                ...dateFilter
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
            totalTrades: paperTradingStats.totalTrades || user?.stats?.totalTrades || gamification.stats?.totalTrades || 0,
            profitableTrades: paperTradingStats.profitableTrades || user?.stats?.winningTrades || gamification.stats?.profitableTrades || 0,
            losingTrades: paperTradingStats.losingTrades || gamification.stats?.losingTrades || 0,
            totalProfit: paperTradingStats.totalProfit || user?.stats?.totalReturn || gamification.stats?.totalProfit || 0,
            totalReturnPercent: user?.stats?.totalReturnPercent || 0,
            winRate: paperTradingStats.winRate || user?.stats?.winRate || gamification.stats?.winRate || 0,
            // ✅ USE REAL PREDICTION STATS (with reset date filter)
            predictionsCreated: predictionStats.predictionsCreated,
            correctPredictions: predictionStats.correctPredictions,
            predictionAccuracy: predictionStats.predictionAccuracy,
            portfolioValue: paperTradingStats.portfolioValue || user?.stats?.currentValue || gamification.stats?.portfolioValue || 100000,
            daysActive: gamification.stats?.daysActive || 0,
            stocksOwned: paperTradingStats.stocksOwned || user?.stats?.openPositions || gamification.stats?.stocksOwned || 0,
            referrals: gamification.stats?.referrals || 0,
            // Paper trading specific
            totalRefills: gamification.stats?.totalRefills || 0,
            leveragedTrades: gamification.stats?.leveragedTrades || 0,
            shortTrades: gamification.stats?.shortTrades || 0,
            maxProfitStreak: gamification.stats?.maxProfitStreak || paperTradingStats.bestStreak || 0,
            maxLossStreak: gamification.stats?.maxLossStreak || 0,
            followersCount: gamification.stats?.followersCount || 0,
            followingCount: gamification.stats?.followingCount || 0
        };

        // Calculate XP bounds for current level
        const level = gamification.level || 1;
        const xp = gamification.xp || 0;
        const xpForCurrentLevel = (level - 1) * 1000;
        const xpForNextLevel = level * 1000;

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
                xp: gamification.xp || 0,
                level: gamification.level || 1,
                rank: gamification.title || 'Rookie Trader',  // Use title from User model
                nexusCoins: gamification.nexusCoins || 0,
                totalEarned: gamification.totalXpEarned || 0,
                loginStreak: gamification.loginStreak || 0,
                maxLoginStreak: gamification.maxLoginStreak || 0,
                profitStreak: gamification.profitStreak || 0,
                maxProfitStreak: gamification.maxProfitStreak || 0,
                achievements: gamification.achievements || [],
                stats: mergedStats,
                dailyChallenge: gamification.dailyChallenge || null,
                lastLoginDate: gamification.lastLoginDate || null,
                xpForCurrentLevel: xpForCurrentLevel,
                xpForNextLevel: xpForNextLevel,
                predictionResetDate: gamification.predictionResetDate || null,
                
                // Legacy equippedItems (keep for backward compatibility)
                equippedItems: {
                    avatarBorder: vaultData.equippedBorder,
                    profileTheme: vaultData.equippedTheme,
                    activePerk: vaultData.activePerks[0] || null,
                    badges: vaultData.equippedBadges
                },
                
                // NEW: Full vault data for borders, themes, badges
                vault: vaultData
            },
            
            // Also include at top level for easier access
            level: gamification.level || 1,
            nexusCoins: gamification.nexusCoins || 0,
            vault: vaultData
        });
        
        console.log('[Gamification] Returned stats - XP:', xp, 'Level:', level, 'Coins:', gamification.nexusCoins);
    } catch (error) {
        console.error('[Gamification] Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch gamification stats'
        });
    }
});

// @route   POST /api/gamification/sync-level
// @desc    Recalculate and sync level with current XP
// @access  Private
router.post('/sync-level', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const oldLevel = user.gamification.level;
        const oldTitle = user.gamification.title;
        
        // Recalculate level based on XP (1000 XP per level)
        const correctLevel = Math.floor(user.gamification.xp / 1000) + 1;
        
        // Get correct title for the level (from User model's getTitleForLevel method)
        const correctTitle = user.getTitleForLevel ? user.getTitleForLevel(correctLevel) : 'Rookie Trader';
        
        // Update if different
        if (correctLevel !== oldLevel || correctTitle !== oldTitle) {
            user.gamification.level = correctLevel;
            user.gamification.title = correctTitle;
            await user.save();
            
            console.log(`[Gamification] Synced level for user ${req.user.id}: Level ${oldLevel} → ${correctLevel}, Title: ${oldTitle} → ${correctTitle}`);
            
            return res.json({
                success: true,
                message: 'Level synced successfully',
                changes: {
                    xp: user.gamification.xp,
                    oldLevel,
                    newLevel: correctLevel,
                    oldTitle,
                    newTitle: correctTitle
                }
            });
        }
        
        res.json({
            success: true,
            message: 'Level already in sync',
            data: {
                xp: user.gamification.xp,
                level: user.gamification.level,
                title: user.gamification.title
            }
        });
    } catch (error) {
        console.error('[Gamification] Error syncing level:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync level'
        });
    }
});

// @route   POST /api/gamification/reset-prediction-stats
// @desc    Reset prediction stats by setting a new tracking start date
// @access  Private
router.post('/reset-prediction-stats', authMiddleware, async (req, res) => {
    try {
        const { resetDate } = req.body;
        
        // Use provided date or default to now
        const newResetDate = resetDate ? new Date(resetDate) : new Date();
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { 
                $set: { 
                    'gamification.predictionResetDate': newResetDate,
                    // Also reset the stored stats to 0
                    'gamification.stats.predictionsCreated': 0,
                    'gamification.stats.correctPredictions': 0,
                    'gamification.stats.predictionAccuracy': 0
                }
            },
            { new: true }
        );
        
        console.log(`[Gamification] Reset prediction stats for user ${req.user.id}. New tracking starts from: ${newResetDate}`);
        
        res.json({
            success: true,
            message: 'Prediction stats reset successfully',
            predictionResetDate: newResetDate,
            note: 'Only predictions created after this date will be counted'
        });
    } catch (error) {
        console.error('[Gamification] Error resetting prediction stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset prediction stats'
        });
    }
});

// @route   DELETE /api/gamification/clear-prediction-reset
// @desc    Clear the prediction reset date (count all predictions again)
// @access  Private
router.delete('/clear-prediction-reset', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $unset: { 'gamification.predictionResetDate': 1 } },
            { new: true }
        );
        
        console.log(`[Gamification] Cleared prediction reset date for user ${req.user.id}. Now counting all predictions.`);
        
        res.json({
            success: true,
            message: 'Prediction reset date cleared. All predictions will now be counted.',
            predictionResetDate: null
        });
    } catch (error) {
        console.error('[Gamification] Error clearing prediction reset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear prediction reset'
        });
    }
});

// @route   GET /api/gamification/achievements
// @desc    Get all achievements (with unlock status)
// @access  Private
router.get('/achievements', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('gamification').lean();
        
        // Map all achievements with unlock status
        const allAchievements = Object.values(ACHIEVEMENTS).map(ach => {
            const userAchievement = user?.gamification?.achievements?.find(ua => ua.id === ach.id);
            
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
        
        // Build leaderboard from User model directly
        let sortField = 'gamification.totalXpEarned';
        if (type === 'level') sortField = 'gamification.level';
        if (type === 'coins') sortField = 'gamification.nexusCoins';
        if (type === 'streak') sortField = 'gamification.loginStreak';
        
        const users = await User.find({})
            .select('name username profile gamification vault')
            .sort({ [sortField]: -1 })
            .limit(parseInt(limit))
            .lean();
        
        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            userId: user._id,
            username: user.username || user.name,
            level: user.gamification?.level || 1,
            xp: user.gamification?.totalXpEarned || 0,
            nexusCoins: user.gamification?.nexusCoins || 0,
            loginStreak: user.gamification?.loginStreak || 0,
            equippedBorder: user.vault?.equippedBorder || 'border-bronze',
            equippedBadges: user.vault?.equippedBadges || [],
            avatar: user.profile?.avatar || null
        }));
        
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

// @route   GET /api/gamification/user/:userId
// @desc    Get another user's public gamification data (for profiles)
// @access  Private
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .select('vault profile name username gamification')
            .lean();
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                level: user.gamification?.level || 1,
                rank: user.gamification?.title || 'Rookie Trader',
                xp: user.gamification?.xp || 0,
                achievements: user.gamification?.achievements?.length || 0,
                loginStreak: user.gamification?.loginStreak || 0,
                stats: {
                    totalTrades: user.gamification?.stats?.totalTrades || 0,
                    winRate: user.gamification?.stats?.winRate || 0,
                    totalProfit: user.gamification?.stats?.totalProfit || 0
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
// @desc    Sync prediction stats from Prediction model to User.gamification
// @access  Private
router.post('/sync-predictions', authMiddleware, async (req, res) => {
    try {
        const Prediction = require('../models/Prediction');
        const user = await User.findById(req.user.id);
        
        // 🔥 Check for prediction reset date
        const predictionResetDate = user.gamification?.predictionResetDate || null;
        const dateFilter = predictionResetDate ? { createdAt: { $gte: predictionResetDate } } : {};
        
        // Get actual counts from Prediction model (respecting reset date)
        const totalPredictions = await Prediction.countDocuments({ 
            user: req.user.id,
            ...dateFilter
        });
        const correctPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'correct',
            ...dateFilter
        });
        const incorrectPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'incorrect',
            ...dateFilter
        });
        const pendingPredictions = await Prediction.countDocuments({ 
            user: req.user.id, 
            status: 'pending',
            ...dateFilter
        });
        const resolvedPredictions = correctPredictions + incorrectPredictions;
        
        // Calculate accuracy based on resolved predictions only
        const accuracy = resolvedPredictions > 0 
            ? Math.round((correctPredictions / resolvedPredictions) * 100)
            : 0;
        
        // Update user gamification record
        if (!user.gamification.stats) user.gamification.stats = {};
        user.gamification.stats.predictionsCreated = totalPredictions;
        user.gamification.stats.correctPredictions = correctPredictions;
        user.gamification.stats.predictionAccuracy = accuracy;
        await user.save();
        
        console.log(`[Gamification] Synced prediction stats for ${req.user.id}:`, {
            total: totalPredictions,
            correct: correctPredictions,
            incorrect: incorrectPredictions,
            pending: pendingPredictions,
            accuracy: accuracy,
            resetDate: predictionResetDate
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
            },
            predictionResetDate: predictionResetDate
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
        const user = await User.findById(req.user.id).select('gamification').lean();
        
        // Check for reset date
        const predictionResetDate = user.gamification?.predictionResetDate || null;
        const dateFilter = predictionResetDate ? { createdAt: { $gte: predictionResetDate } } : {};
        
        // Get counts (ALL predictions, ignoring reset date for comparison)
        const totalAll = await Prediction.countDocuments({ user: req.user.id });
        const correctAll = await Prediction.countDocuments({ user: req.user.id, status: 'correct' });
        const incorrectAll = await Prediction.countDocuments({ user: req.user.id, status: 'incorrect' });
        const pendingAll = await Prediction.countDocuments({ user: req.user.id, status: 'pending' });
        const expiredAll = await Prediction.countDocuments({ user: req.user.id, status: 'expired' });
        
        // Get counts (FILTERED by reset date)
        const totalFiltered = await Prediction.countDocuments({ user: req.user.id, ...dateFilter });
        const correctFiltered = await Prediction.countDocuments({ user: req.user.id, status: 'correct', ...dateFilter });
        const incorrectFiltered = await Prediction.countDocuments({ user: req.user.id, status: 'incorrect', ...dateFilter });
        const pendingFiltered = await Prediction.countDocuments({ user: req.user.id, status: 'pending', ...dateFilter });
        
        // Get recent predictions
        const recentPredictions = await Prediction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('symbol direction status confidence createdAt expiresAt outcome');
        
        res.json({
            success: true,
            predictionResetDate: predictionResetDate,
            allTimePredictions: {
                total: totalAll,
                correct: correctAll,
                incorrect: incorrectAll,
                pending: pendingAll,
                expired: expiredAll,
                accuracy: (correctAll + incorrectAll) > 0 ? ((correctAll / (correctAll + incorrectAll)) * 100).toFixed(1) + '%' : '0%'
            },
            filteredPredictions: {
                note: predictionResetDate ? `Only counting predictions after ${predictionResetDate}` : 'No reset date set, counting all',
                total: totalFiltered,
                correct: correctFiltered,
                incorrect: incorrectFiltered,
                pending: pendingFiltered,
                accuracy: (correctFiltered + incorrectFiltered) > 0 ? ((correctFiltered / (correctFiltered + incorrectFiltered)) * 100).toFixed(1) + '%' : '0%'
            },
            gamificationStats: {
                predictionsCreated: user.gamification?.stats?.predictionsCreated || 0,
                correctPredictions: user.gamification?.stats?.correctPredictions || 0,
                predictionAccuracy: user.gamification?.stats?.predictionAccuracy || 0
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
            actions: {
                resetStats: 'POST /api/gamification/reset-prediction-stats',
                clearReset: 'DELETE /api/gamification/clear-prediction-reset',
                syncStats: 'POST /api/gamification/sync-predictions'
            }
        });
    } catch (error) {
        console.error('[Gamification] Debug error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ============ DAILY REWARD ROUTES ============

// @route   GET /api/gamification/daily-reward/status
// @desc    Check if daily reward is available and get preview
// @access  Private
router.get('/daily-reward/status', authMiddleware, async (req, res) => {
    try {
        const preview = await DailyRewardService.getRewardPreview(req.user.id);
        
        if (!preview) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            ...preview
        });
        
    } catch (error) {
        console.error('[Gamification] Daily reward status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get reward status'
        });
    }
});

// @route   POST /api/gamification/daily-reward/claim
// @desc    Claim daily reward
// @access  Private
router.post('/daily-reward/claim', authMiddleware, async (req, res) => {
    try {
        const result = await DailyRewardService.claimReward(req.user.id);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json({
            success: true,
            message: 'Daily reward claimed successfully!',
            ...result
        });
        
    } catch (error) {
        console.error('[Gamification] Claim reward error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to claim reward'
        });
    }
});

// @route   GET /api/gamification/daily-reward/history
// @desc    Get daily reward claim history
// @access  Private
router.get('/daily-reward/history', authMiddleware, async (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const history = await DailyRewardService.getRewardHistory(req.user.id, parseInt(limit));
        
        res.json({
            success: true,
            history
        });
        
    } catch (error) {
        console.error('[Gamification] Reward history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get reward history'
        });
    }
});

// @route   GET /api/gamification/daily-reward/milestones
// @desc    Get information about all streak milestones
// @access  Private
router.get('/daily-reward/milestones', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const currentStreak = user.gamification?.loginStreak || 0;
        
        const milestones = [
            { day: 7, name: '1 Week Streak', reward: '200 XP + 300 Coins + Badge' },
            { day: 14, name: '2 Week Streak', reward: '400 XP + 500 Coins + Badge + Border' },
            { day: 30, name: '1 Month Streak', reward: '1000 XP + 1500 Coins + Badge + Theme' },
            { day: 60, name: '2 Month Streak', reward: '2000 XP + 3000 Coins + Diamond Border' },
            { day: 90, name: '3 Month Streak', reward: '3000 XP + 5000 Coins + Elite Theme' },
            { day: 180, name: '6 Month Streak', reward: 'Legendary Rewards' },
            { day: 365, name: '1 Year Streak', reward: 'Ultimate Rewards' }
        ].map(m => ({
            ...m,
            achieved: currentStreak >= m.day,
            daysUntil: Math.max(0, m.day - currentStreak)
        }));
        
        res.json({
            success: true,
            currentStreak,
            milestones
        });
        
    } catch (error) {
        console.error('[Gamification] Milestones error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get milestones'
        });
    }
});

module.exports = router;