// server/routes/gamificationRoutes.js - UPDATED TO READ FROM USER.GAMIFICATION
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const GamificationService = require('../services/gamificationService');
const AchievementService = require('../services/achievementService');
const ACHIEVEMENTS = require('../config/achievements');
const DailyRewardService = require('../services/dailyRewardService');

// ============ LEVEL THRESHOLDS (MUST MATCH User.js!) ============
const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    1000,   // Level 5
    1750,   // Level 6
    2750,   // Level 7
    4000,   // Level 8
    5500,   // Level 9
    7500,   // Level 10
    10000,  // Level 11
    13000,  // Level 12
    16500,  // Level 13
    20500,  // Level 14
    25000,  // Level 15
    30000,  // Level 16
    36000,  // Level 17
    43000,  // Level 18
    51000,  // Level 19
    60000,  // Level 20
    70000,  // Level 21
    81000,  // Level 22
    93000,  // Level 23
    106000, // Level 24
    120000, // Level 25
    135000, // Level 26
    151000, // Level 27
    168000, // Level 28
    186000, // Level 29
    205000, // Level 30
    225000, // Level 31
    246000, // Level 32
    268000, // Level 33
    291000, // Level 34
    315000, // Level 35
    340000, // Level 36
    366000, // Level 37
    393000, // Level 38
    421000, // Level 39
    450000, // Level 40
    480000, // Level 41
    511000, // Level 42
    543000, // Level 43
    576000, // Level 44
    610000, // Level 45
    645000, // Level 46
    681000, // Level 47
    718000, // Level 48
    756000, // Level 49
    795000, // Level 50
    850000, // Level 51
    910000, // Level 52
    975000, // Level 53
    1045000, // Level 54
    1120000, // Level 55
    1200000, // Level 56
    1285000, // Level 57
    1375000, // Level 58
    1470000, // Level 59
    1570000, // Level 60
    1680000, // Level 61
    1800000, // Level 62
    1930000, // Level 63
    2070000, // Level 64
    2220000, // Level 65
    2380000, // Level 66
    2550000, // Level 67
    2730000, // Level 68
    2920000, // Level 69
    3120000, // Level 70
    3340000, // Level 71
    3580000, // Level 72
    3840000, // Level 73
    4120000, // Level 74
    4420000, // Level 75
    4750000, // Level 76
    5100000, // Level 77
    5480000, // Level 78
    5890000, // Level 79
    6330000, // Level 80
    6810000, // Level 81
    7330000, // Level 82
    7890000, // Level 83
    8500000, // Level 84
    9160000, // Level 85
    9870000, // Level 86
    10640000, // Level 87
    11470000, // Level 88
    12370000, // Level 89
    13340000, // Level 90
    14390000, // Level 91
    15520000, // Level 92
    16740000, // Level 93
    18060000, // Level 94
    19490000, // Level 95
    21030000, // Level 96
    22700000, // Level 97
    24500000, // Level 98
    26450000, // Level 99
    28560000, // Level 100
];

const LEVEL_TITLES = [
    'Rookie Trader',        // 1
    'Market Novice',        // 2
    'Chart Reader',         // 3
    'Trend Spotter',        // 4
    'Risk Taker',           // 5
    'Pattern Hunter',       // 6
    'Swing Trader',         // 7
    'Market Analyst',       // 8
    'Portfolio Builder',    // 9
    'Day Trader',           // 10
    'Momentum Rider',       // 11
    'Value Seeker',         // 12
    'Growth Investor',      // 13
    'Sector Expert',        // 14
    'Market Timer',         // 15
    'Options Trader',       // 16
    'Futures Master',       // 17
    'Crypto Pioneer',       // 18
    'Dividend Hunter',      // 19
    'Alpha Generator',      // 20
    'Market Wizard',        // 21-30
    'Trading Guru',         // 31-40
    'Wall Street Wolf',     // 41-50
    'Hedge Fund Hero',      // 51-60
    'Market Maverick',      // 61-70
    'Trading Titan',        // 71-80
    'Nexus Legend',         // 81-90
    'Ultimate Trader',      // 91-99
    'Nexus One'             // 100 (MAX)
];

// Helper function to get level from totalXpEarned
function calculateLevelFromXp(totalXpEarned) {
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXpEarned >= LEVEL_THRESHOLDS[i]) {
            level = i + 1;
            break;
        }
    }
    return level;
}

// Helper function to get title for level
function getTitleForLevel(level) {
    if (level <= 20) return LEVEL_TITLES[Math.min(level - 1, 19)];
    if (level <= 30) return LEVEL_TITLES[20];
    if (level <= 40) return LEVEL_TITLES[21];
    if (level <= 50) return LEVEL_TITLES[22];
    if (level <= 60) return LEVEL_TITLES[23];
    if (level <= 70) return LEVEL_TITLES[24];
    if (level <= 80) return LEVEL_TITLES[25];
    if (level <= 90) return LEVEL_TITLES[26];
    if (level <= 99) return LEVEL_TITLES[27];
    return LEVEL_TITLES[28]; // Level 100
}

// @route   GET /api/gamification/stats
// @desc    Get user gamification stats INCLUDING VAULT DATA AND PREDICTION STATS
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        console.log('[Gamification] Fetching data for user:', req.user.id);

        // ✅ READ FROM USER.GAMIFICATION (THE SOURCE OF TRUTH)
        // Use non-lean() first so we can auto-sync if needed
        let userDoc = await User.findById(req.user.id).select('stats vault name username profile gamification');

        if (!userDoc) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Initialize gamification if it doesn't exist
        if (!userDoc.gamification) {
            console.log('[Gamification] No gamification data, initializing...');
            userDoc.gamification = {
                xp: 0,
                level: 1,
                title: 'Rookie Trader',
                totalXpEarned: 0,
                nexusCoins: 1000,
                totalCoinsEarned: 1000
            };
            await userDoc.save();
        }

        // ✅ AUTO-SYNC: Check if level is correct based on totalXpEarned
        const totalXpEarned = userDoc.gamification.totalXpEarned || 0;
        const correctLevel = calculateLevelFromXp(totalXpEarned);
        const correctTitle = getTitleForLevel(correctLevel);
        const storedLevel = userDoc.gamification.level || 1;
        const storedTitle = userDoc.gamification.title || 'Rookie Trader';

        if (storedLevel !== correctLevel || storedTitle !== correctTitle) {
            console.log(`[Gamification] Auto-sync for ${req.user.id}: Level ${storedLevel} → ${correctLevel}, Title: ${storedTitle} → ${correctTitle}`);
            userDoc.gamification.level = correctLevel;
            userDoc.gamification.title = correctTitle;

            // Also sync xp with totalXpEarned if they differ
            if (userDoc.gamification.xp !== totalXpEarned) {
                console.log(`[Gamification] Syncing XP: ${userDoc.gamification.xp} → ${totalXpEarned}`);
                userDoc.gamification.xp = totalXpEarned;
            }

            await userDoc.save();
        }

        // Now convert to lean object for rest of processing
        const user = userDoc.toObject();
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
// @desc    Recalculate and sync level with current XP (FIXED: uses totalXpEarned and LEVEL_THRESHOLDS)
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

        // Initialize gamification if missing
        if (!user.gamification) {
            user.gamification = {
                xp: 0,
                level: 1,
                title: 'Rookie Trader',
                totalXpEarned: 0,
                nexusCoins: 1000
            };
        }

        const oldLevel = user.gamification.level || 1;
        const oldTitle = user.gamification.title || 'Rookie Trader';
        const oldXp = user.gamification.xp || 0;
        const totalXpEarned = user.gamification.totalXpEarned || 0;

        // ✅ FIXED: Calculate level based on totalXpEarned using LEVEL_THRESHOLDS
        const correctLevel = calculateLevelFromXp(totalXpEarned);
        const correctTitle = getTitleForLevel(correctLevel);

        // Calculate next level XP
        const nextLevelIndex = Math.min(correctLevel, LEVEL_THRESHOLDS.length - 1);
        const nextLevelXp = LEVEL_THRESHOLDS[nextLevelIndex] - totalXpEarned;

        // Check if xp and totalXpEarned are synced (they should be the same)
        const xpMismatch = oldXp !== totalXpEarned;

        const changes = [];

        // Update if different
        if (correctLevel !== oldLevel) {
            user.gamification.level = correctLevel;
            changes.push(`Level: ${oldLevel} → ${correctLevel}`);
        }

        if (correctTitle !== oldTitle) {
            user.gamification.title = correctTitle;
            changes.push(`Title: ${oldTitle} → ${correctTitle}`);
        }

        // Sync xp with totalXpEarned if they're different
        if (xpMismatch) {
            user.gamification.xp = totalXpEarned;
            changes.push(`XP synced: ${oldXp} → ${totalXpEarned}`);
        }

        // Update nextLevelXp
        user.gamification.nextLevelXp = nextLevelXp;

        if (changes.length > 0) {
            await user.save();

            console.log(`[Gamification] Synced for user ${req.user.id}:`, changes.join(', '));

            return res.json({
                success: true,
                message: 'Gamification data synced successfully',
                changes: {
                    totalXpEarned,
                    xp: user.gamification.xp,
                    oldLevel,
                    newLevel: correctLevel,
                    oldTitle,
                    newTitle: correctTitle,
                    nextLevelXp,
                    xpWasMismatched: xpMismatch,
                    changesApplied: changes
                }
            });
        }

        res.json({
            success: true,
            message: 'Gamification data already in sync',
            data: {
                totalXpEarned,
                xp: user.gamification.xp,
                level: user.gamification.level,
                title: user.gamification.title,
                nextLevelXp
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

// Progress tracking for achievements (statKey -> threshold)
const ACHIEVEMENT_PROGRESS_MAP = {
    // Trading
    'first_blood': { statKey: 'totalTrades', threshold: 1 },
    'trade_apprentice': { statKey: 'totalTrades', threshold: 10 },
    'trade_journeyman': { statKey: 'totalTrades', threshold: 50 },
    'trade_master': { statKey: 'totalTrades', threshold: 100 },
    'trading_legend': { statKey: 'totalTrades', threshold: 500 },

    // Profitable trades
    'show_me_the_money': { statKey: 'profitableTrades', threshold: 1 },
    'money_maker': { statKey: 'profitableTrades', threshold: 10 },
    'profit_machine': { statKey: 'profitableTrades', threshold: 50 },

    // Days active
    'baby_steps': { statKey: 'daysActive', threshold: 1 },
    'week_warrior': { statKey: 'daysActive', threshold: 7 },
    'month_master': { statKey: 'daysActive', threshold: 30 },
    'dedicated_trader': { statKey: 'daysActive', threshold: 90 },
    'yearly_veteran': { statKey: 'daysActive', threshold: 365 },

    // Portfolio
    'portfolio_starter': { statKey: 'stocksOwned', threshold: 1 },
    'portfolio_builder': { statKey: 'stocksOwned', threshold: 5 },
    'diversified': { statKey: 'stocksOwned', threshold: 10 },

    // Predictions
    'crystal_ball': { statKey: 'predictionsCreated', threshold: 1 },
    'prediction_rookie': { statKey: 'predictionsCreated', threshold: 5 },
    'prediction_pro': { statKey: 'predictionsCreated', threshold: 25 },
    'prediction_master': { statKey: 'predictionsCreated', threshold: 100 },

    // Correct predictions
    'first_correct': { statKey: 'correctPredictions', threshold: 1 },
    'oracle': { statKey: 'correctPredictions', threshold: 10 },
    'prophet': { statKey: 'correctPredictions', threshold: 50 },

    // Streaks
    'hot_streak_3': { statKey: 'currentWinStreak', threshold: 3 },
    'hot_streak_5': { statKey: 'maxWinStreak', threshold: 5 },
    'hot_streak_10': { statKey: 'maxWinStreak', threshold: 10 },
    'unstoppable': { statKey: 'maxWinStreak', threshold: 20 },

    // Refills
    'first_refill': { statKey: 'totalRefills', threshold: 1 },
    'refill_veteran': { statKey: 'totalRefills', threshold: 5 },

    // Leveraged trades
    'first_leverage': { statKey: 'leveragedTrades', threshold: 1 },
    'leverage_addict': { statKey: 'leveragedTrades', threshold: 25 },

    // Loss streaks (for humorous achievements)
    'loss_streak_5': { statKey: 'maxLossStreak', threshold: 5 },
    'loss_streak_10': { statKey: 'maxLossStreak', threshold: 10 },

    // Losing trades
    'first_loss': { statKey: 'losingTrades', threshold: 1 },

    // Login streak
    'login_streak_3': { statKey: 'loginStreak', threshold: 3 },
    'login_streak_7': { statKey: 'loginStreak', threshold: 7 },
    'login_streak_30': { statKey: 'loginStreak', threshold: 30 },

    // Level achievements (use special 'level' statKey)
    'level_5': { statKey: 'level', threshold: 5 },
    'level_10': { statKey: 'level', threshold: 10 },
    'level_25': { statKey: 'level', threshold: 25 },
    'level_50': { statKey: 'level', threshold: 50 },
    'level_75': { statKey: 'level', threshold: 75 },
    'level_100': { statKey: 'level', threshold: 100 },
};

// @route   GET /api/gamification/achievements
// @desc    Get all achievements (with unlock status and progress)
// @access  Private
router.get('/achievements', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('gamification').lean();
        const userStats = user?.gamification?.stats || {};

        // Map all achievements with unlock status and progress
        const allAchievements = Object.values(ACHIEVEMENTS).map(ach => {
            const userAchievement = user?.gamification?.achievements?.find(ua => ua.id === ach.id);
            const progressInfo = ACHIEVEMENT_PROGRESS_MAP[ach.id];

            // Calculate progress for locked achievements
            let progress = undefined;
            let threshold = undefined;

            if (!userAchievement && progressInfo) {
                threshold = progressInfo.threshold;
                // Special handling for level - it's in gamification.level, not stats
                if (progressInfo.statKey === 'level') {
                    progress = user?.gamification?.level || 1;
                } else {
                    progress = userStats[progressInfo.statKey] || 0;
                }
                // Cap progress at threshold (100%)
                progress = Math.min(progress, threshold);
            }

            return {
                id: ach.id,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                category: ach.category,
                rarity: ach.rarity,
                points: ach.points,
                unlocked: !!userAchievement,
                unlockedAt: userAchievement ? userAchievement.unlockedAt : null,
                progress,
                threshold
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