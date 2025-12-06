const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Gamification = require('../models/Gamification'); // 🔥 ADD THIS
const PaperTradingAccount = require('../models/PaperTradingAccount');
const BrokerageConnection = require('../models/BrokerageConnection');
const { updateUserStats, updateAllUserStats } = require('../services/statsService');
const NotificationService = require('../services/notificationService');

// ============ OPTIONAL AUTH MIDDLEWARE ============
const optionalAuth = (req, res, next) => {
    const token = req.cookies.token || req.header('x-auth-token');
    
    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        next();
    }
};

// ============ HELPER: Get date range for time period ============
const getDateRangeForPeriod = (period) => {
    const now = new Date();
    let startDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'all':
        default:
            startDate = null;
            break;
    }

    return startDate;
};

// ============ CURRENT USER STATS ============
// @route   GET /api/social/me/stats
// @desc    Get current user's stats
// @access  Private
router.get('/me/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('username profile stats gamification social vault');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            username: user.username,
            displayName: user.profile?.displayName || user.username,
            avatar: user.profile?.avatar || '',
            stats: {
                totalReturnPercent: user.stats?.totalReturnPercent || 0,
                winRate: user.stats?.winRate || 0,
                totalTrades: user.stats?.totalTrades || 0,
                currentStreak: user.stats?.currentStreak || 0,
                longestStreak: user.stats?.longestStreak || 0,
                avgTradeReturn: user.stats?.avgTradeReturn || 0,
                bestTrade: user.stats?.bestTrade || 0,
                worstTrade: user.stats?.worstTrade || 0
            },
            gamification: {
                level: user.gamification?.level || 1,
                xp: user.gamification?.xp || 0,
                title: user.gamification?.title || 'Rookie Trader',
                nexusCoins: user.gamification?.nexusCoins || 0
            },
            social: {
                followersCount: user.social?.followersCount || 0,
                followingCount: user.social?.followingCount || 0
            },
            vault: {
               // 🔥 NEW: Vault equipped items
equippedBadges: user.vault?.equippedBadges || [],
equippedBorder: user.vault?.equippedBorder || 'border-bronze',
equippedTheme: user.vault?.equippedTheme || 'default',
            }
        });
    } catch (error) {
        console.error('[Social] Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// ============ ENHANCED LEADERBOARD ============
// @route   GET /api/social/leaderboard
// @desc    Get top traders with filtering and sorting options
// @access  Public
router.get('/leaderboard', async (req, res) => {
    try {
        const { 
            period = 'all',      // today, week, month, all
            limit = 100, 
            sortBy = 'totalReturnPercent'  // totalReturnPercent, winRate, currentStreak, xp, totalTrades
        } = req.query;

        // Map frontend sortBy to database field
        const sortFieldMap = {
            'totalReturnPercent': 'stats.totalReturnPercent',
            'winRate': 'stats.winRate',
            'currentStreak': 'stats.currentStreak',
            'xp': 'gamification.xp',
            'totalTrades': 'stats.totalTrades',
            // Legacy support
            'returns': 'stats.totalReturnPercent',
            'accuracy': 'stats.winRate',
            'streak': 'stats.currentStreak',
            'trades': 'stats.totalTrades'
        };

        const sortField = sortFieldMap[sortBy] || 'stats.totalReturnPercent';

        // Build query - show public profiles OR profiles with no isPublic field
        let query = {
            $or: [
                { 'profile.isPublic': true },
                { 'profile.isPublic': { $exists: false } }
            ]
        };

        // For time-based filtering, we need users with activity in that period
        // This requires checking their recent trades - for now we'll use lastActive or createdAt
        const startDate = getDateRangeForPeriod(period);
        if (startDate) {
            query['stats.lastTradeDate'] = { $gte: startDate };
        }

        // Fetch users with all relevant fields including vault
        const users = await User.find(query)
            .select('username profile stats gamification social vault createdAt')
            .sort({ [sortField]: -1 })
            .limit(parseInt(limit));

        // Map to leaderboard format with all enhanced fields
        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            
            // Identity
            userId: user._id,
            username: user.username,
            displayName: user.profile?.displayName || user.username || 'Anonymous Trader',
            avatar: user.profile?.avatar || '',
            badges: user.profile?.badges || [],
            
            // Stats
            totalReturn: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || 0,
            currentStreak: user.stats?.currentStreak || 0,
            longestStreak: user.stats?.longestStreak || 0,
            avgTradeReturn: user.stats?.avgTradeReturn || 0,
            
            // Gamification
            level: user.gamification?.level || 1,
            xp: user.gamification?.xp || 0,
            title: user.gamification?.title || 'Rookie Trader',
            
            // Social
            followersCount: user.social?.followersCount || 0,
            followingCount: user.social?.followingCount || 0,
            
            // 🔥 NEW: Vault equipped items (INCLUDING equippedTheme!)
            equippedBadges: user.vault?.equippedBadges || [],
            equippedBorder: user.vault?.equippedBorder || 'border-bronze',
            equippedTheme: user.vault?.equippedTheme || 'default',
            
            // Meta
            memberSince: user.createdAt
        }));

        // Return with metadata
        res.json(leaderboard);

    } catch (error) {
        console.error('[Social] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============ LEADERBOARD STATS (for header display) ============
// @route   GET /api/social/leaderboard/stats
// @desc    Get leaderboard statistics
// @access  Public
router.get('/leaderboard/stats', async (req, res) => {
    try {
        const totalTraders = await User.countDocuments({
            $or: [
                { 'profile.isPublic': true },
                { 'profile.isPublic': { $exists: false } }
            ]
        });

        const activeToday = await User.countDocuments({
            'stats.lastTradeDate': { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });

        const topPerformer = await User.findOne({
            $or: [
                { 'profile.isPublic': true },
                { 'profile.isPublic': { $exists: false } }
            ]
        })
        .sort({ 'stats.totalReturnPercent': -1 })
        .select('username profile.displayName stats.totalReturnPercent');

        res.json({
            totalTraders,
            activeToday,
            topPerformer: topPerformer ? {
                username: topPerformer.username,
                displayName: topPerformer.profile?.displayName || topPerformer.username,
                totalReturn: topPerformer.stats?.totalReturnPercent || 0
            } : null
        });

    } catch (error) {
        console.error('[Social] Error fetching leaderboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard stats' });
    }
});

// ============ PROFILE ============
// @route   GET /api/social/profile/:userId
// @desc    Get user profile
// @access  Public (but respects privacy settings)
router.get('/profile/:userId', optionalAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('username profile stats achievements gamification social vault createdAt isFounder')
            .populate('social.followers', 'username profile.displayName profile.avatar')
            .populate('social.following', 'username profile.displayName profile.avatar');

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const isOwnProfile = req.user && req.user.id === req.params.userId;
        const isPublic = user.profile?.isPublic ?? true;

        if (!isPublic && !isOwnProfile) {
            return res.status(403).json({ 
                error: 'This profile is private',
                isPrivate: true 
            });
        }

        // 🔥 FIXED: Get achievements from all possible sources
        let achievements = [];
        
        // Source 1: Check User.achievements array (direct on user model)
        if (user.achievements && user.achievements.length > 0) {
            achievements = user.achievements;
            console.log(`[Profile] Found ${achievements.length} achievements in User.achievements`);
        }
        
        // Source 2: Check User.gamification.achievements (embedded in user)
        if (achievements.length === 0 && user.gamification?.achievements?.length > 0) {
            achievements = user.gamification.achievements.map(ach => ({
                achievementId: ach.id || ach.achievementId,
                id: ach.id || ach.achievementId,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                xpReward: ach.points || ach.xpReward || 0,
                points: ach.points || ach.xpReward || 0,
                rarity: ach.rarity || 'common',
                earnedAt: ach.unlockedAt || ach.earnedAt
            }));
            console.log(`[Profile] Found ${achievements.length} achievements in User.gamification.achievements`);
        }
        
        // Source 3: Check separate Gamification document
        let gamificationData = null;
        try {
            const gamificationDoc = await Gamification.findOne({ user: user._id });
            if (gamificationDoc) {
                gamificationData = gamificationDoc;
                
                if (achievements.length === 0 && gamificationDoc.achievements && gamificationDoc.achievements.length > 0) {
                    achievements = gamificationDoc.achievements.map(ach => ({
                        achievementId: ach.id || ach.achievementId,
                        id: ach.id || ach.achievementId,
                        name: ach.name,
                        description: ach.description,
                        icon: ach.icon,
                        xpReward: ach.points || ach.xpReward || 0,
                        points: ach.points || ach.xpReward || 0,
                        rarity: ach.rarity || 'common',
                        earnedAt: ach.unlockedAt || ach.earnedAt
                    }));
                    console.log(`[Profile] Found ${achievements.length} achievements in Gamification document`);
                }
            }
        } catch (gamErr) {
            console.error('[Profile] Could not fetch Gamification document:', gamErr.message);
        }

        // 🔥 GET REAL PREDICTION STATS FROM PREDICTION MODEL
        let predictionStats = {
            predictionsCreated: 0,
            correctPredictions: 0,
            predictionAccuracy: 0
        };
        
        try {
            const Prediction = require('../models/Prediction');
            
            // 🔥 Check for prediction reset date (only count predictions after this date)
            const predictionResetDate = gamificationData?.predictionResetDate || null;
            const dateFilter = predictionResetDate ? { createdAt: { $gte: predictionResetDate } } : {};
            
            const totalPredictions = await Prediction.countDocuments({ 
                user: user._id,
                ...dateFilter
            });
            const correctPredictions = await Prediction.countDocuments({ 
                user: user._id, 
                status: 'correct',
                ...dateFilter
            });
            const resolvedPredictions = await Prediction.countDocuments({
                user: user._id,
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
        } catch (predError) {
            console.warn('[Profile] Could not fetch prediction stats:', predError.message);
        }

        // 🔥 MERGE stats from User.stats AND Gamification.stats
        const mergedStats = {
            totalReturnPercent: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || gamificationData?.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || gamificationData?.stats?.totalTrades || 0,
            currentStreak: user.stats?.currentStreak || gamificationData?.profitStreak || gamificationData?.loginStreak || 0,
            longestStreak: user.stats?.longestStreak || gamificationData?.maxProfitStreak || 0,
            bestTrade: user.stats?.bestTrade || gamificationData?.stats?.biggestWinPercent || 0,
            rank: user.stats?.rank || 0,
            // 🔥 USE REAL PREDICTION STATS
            totalPredictions: predictionStats.predictionsCreated,
            correctPredictions: predictionStats.correctPredictions,
            predictionAccuracy: predictionStats.predictionAccuracy,
            profitStreak: gamificationData?.profitStreak || 0,
            lossStreak: gamificationData?.lossStreak || 0,
            loginStreak: gamificationData?.loginStreak || 0
        };

        // 🔥 AUTO-FIX: Recalculate level from XP if out of sync
        let finalLevel = gamificationData?.level || user.gamification?.level || 1;
        let finalXp = gamificationData?.xp || user.gamification?.xp || 0;
        let finalRank = gamificationData?.rank || user.gamification?.rank || 'Rookie Trader';
        
        const correctLevel = Math.floor(finalXp / 1000) + 1;
        
        if (correctLevel !== finalLevel && gamificationData) {
            console.log(`[Profile] Auto-fixing level: ${finalLevel} → ${correctLevel} (XP: ${finalXp})`);
            finalLevel = correctLevel;
            
            // Update rank based on level
            const getRankForLevel = (level) => {
                if (level >= 100) return 'Wall Street Titan';
                if (level >= 75) return 'Market Mogul';
                if (level >= 50) return 'Trading Legend';
                if (level >= 40) return 'Master Trader';
                if (level >= 30) return 'Expert Trader';
                if (level >= 20) return 'Veteran Trader';
                if (level >= 15) return 'Advanced Trader';
                if (level >= 10) return 'Skilled Trader';
                if (level >= 5) return 'Apprentice Trader';
                if (level >= 2) return 'Novice Trader';
                return 'Rookie Trader';
            };
            finalRank = getRankForLevel(correctLevel);
            
            // Save the fix to database
            gamificationData.level = correctLevel;
            gamificationData.rank = finalRank;
            await gamificationData.save();
        }
        
        // 🔥 PRIORITIZE Gamification document over User.gamification (which is often stale)
        const mergedGamification = {
            level: finalLevel,
            xp: finalXp,
            totalXpEarned: finalXp,  // Add this for profile page
            title: finalRank,
            rank: finalRank,
            nexusCoins: gamificationData?.nexusCoins || user.gamification?.nexusCoins || 0,
            totalEarned: gamificationData?.totalEarned || 0,
            loginStreak: gamificationData?.loginStreak || 0,
            profitStreak: gamificationData?.profitStreak || 0,
            stats: gamificationData?.stats || user.gamification?.stats || {},
            achievementsCount: achievements.length,
            // Add XP bounds for progress bar
            xpForCurrentLevel: (finalLevel - 1) * 1000,
            xpForNextLevel: finalLevel * 1000
        };

        console.log(`[Profile] Gamification for ${user.username}: Level ${mergedGamification.level}, Title: ${mergedGamification.title}`);

        res.json({
            userId: user._id,
            _id: user._id,
            username: user.username,
            profile: user.profile,
            stats: mergedStats,
            achievements: achievements,
            gamification: mergedGamification,
            social: {
                followersCount: user.social?.followersCount || 0,
                followingCount: user.social?.followingCount || 0,
                followers: user.social?.followers || [],
                following: user.social?.following || []
            },
            vault: {
                equippedBadges: user.vault?.equippedBadges || [],
                equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                equippedTheme: user.vault?.equippedTheme || 'default'
            },
            isFounder: user.isFounder || false,
            date: user.createdAt,
            isOwnProfile: isOwnProfile
        });
    } catch (error) {
        console.error('[Social] Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});


// @route   GET /api/social/suggested
// @desc    Get suggested users to follow
// @access  Private
router.get('/suggested', auth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const currentUser = await User.findById(req.user.id).select('social.following');
        const followingIds = currentUser?.social?.following || [];
        
        // Find users the current user doesn't follow
        const suggestedUsers = await User.find({
            _id: { $ne: req.user.id, $nin: followingIds },
            'profile.isPublic': { $ne: false }
        })
        .select('username profile social.followersCount vault')
        .sort({ 'social.followersCount': -1 })
        .limit(parseInt(limit));

        const results = suggestedUsers.map(user => ({
            id: user._id,
            name: user.profile?.displayName || user.username,
            username: user.username,
            avatar: user.profile?.avatar || '',
            mutuals: 0,
            equippedBorder: user.vault?.equippedBorder || 'border-bronze',
            equippedTheme: user.vault?.equippedTheme || 'default'
        }));

        res.json(results);
    } catch (error) {
        console.error('[Social] Suggested users error:', error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
});



// @route   GET /api/social/profile/username/:username
// @desc    Get user profile by username
// @access  Public (but respects privacy settings)
router.get('/profile/username/:username', optionalAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username profile stats achievements gamification social vault createdAt isFounder')
            .populate('social.followers', 'username profile.displayName profile.avatar')
            .populate('social.following', 'username profile.displayName profile.avatar');

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const isOwnProfile = req.user && req.user.id === user._id.toString();
        const isPublic = user.profile?.isPublic ?? true;

        if (!isPublic && !isOwnProfile) {
            return res.status(403).json({ 
                error: 'This profile is private',
                isPrivate: true 
            });
        }

        // 🔥 FIXED: Get achievements from all possible sources
        let achievements = [];
        
        // Source 1: Check User.achievements array (direct on user model)
        if (user.achievements && user.achievements.length > 0) {
            achievements = user.achievements;
            console.log(`[Profile] Found ${achievements.length} achievements in User.achievements`);
        }
        
        // Source 2: Check User.gamification.achievements (embedded in user)
        if (achievements.length === 0 && user.gamification?.achievements?.length > 0) {
            achievements = user.gamification.achievements.map(ach => ({
                achievementId: ach.id || ach.achievementId,
                id: ach.id || ach.achievementId,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
                xpReward: ach.points || ach.xpReward || 0,
                points: ach.points || ach.xpReward || 0,
                rarity: ach.rarity || 'common',
                earnedAt: ach.unlockedAt || ach.earnedAt
            }));
            console.log(`[Profile] Found ${achievements.length} achievements in User.gamification.achievements`);
        }
        
        // Source 3: Check separate Gamification document
        let gamificationData = null;
        try {
            const gamificationDoc = await Gamification.findOne({ user: user._id });
            if (gamificationDoc) {
                gamificationData = gamificationDoc;
                
                // Get achievements from Gamification doc if we don't have them yet
                if (achievements.length === 0 && gamificationDoc.achievements && gamificationDoc.achievements.length > 0) {
                    achievements = gamificationDoc.achievements.map(ach => ({
                        achievementId: ach.id || ach.achievementId,
                        id: ach.id || ach.achievementId,
                        name: ach.name,
                        description: ach.description,
                        icon: ach.icon,
                        xpReward: ach.points || ach.xpReward || 0,
                        points: ach.points || ach.xpReward || 0,
                        rarity: ach.rarity || 'common',
                        earnedAt: ach.unlockedAt || ach.earnedAt
                    }));
                    console.log(`[Profile] Found ${achievements.length} achievements in Gamification document`);
                }
            }
        } catch (gamErr) {
            console.error('[Profile] Could not fetch Gamification document:', gamErr.message);
        }
        
        console.log(`[Profile] Total achievements for ${user.username}: ${achievements.length}`);

        // 🔥 GET REAL PREDICTION STATS FROM PREDICTION MODEL (like gamificationRoutes does)
        let predictionStats = {
            predictionsCreated: 0,
            correctPredictions: 0,
            predictionAccuracy: 0
        };
        
        try {
            const Prediction = require('../models/Prediction');
            
            // 🔥 Check for prediction reset date (only count predictions after this date)
            const predictionResetDate = gamificationData?.predictionResetDate || null;
            const dateFilter = predictionResetDate ? { createdAt: { $gte: predictionResetDate } } : {};
            
            console.log(`[Profile] Prediction reset date for ${user.username}:`, predictionResetDate || 'None (counting all)');
            
            const totalPredictions = await Prediction.countDocuments({ 
                user: user._id,
                ...dateFilter
            });
            const correctPredictions = await Prediction.countDocuments({ 
                user: user._id, 
                status: 'correct',
                ...dateFilter
            });
            const resolvedPredictions = await Prediction.countDocuments({
                user: user._id,
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
            
            console.log(`[Profile] Real prediction stats for ${user.username}:`, predictionStats);
        } catch (predError) {
            console.warn('[Profile] Could not fetch prediction stats:', predError.message);
        }

        // 🔥 FETCH PAPER TRADING STATS
        let paperTradingStats = {
            portfolioValue: 100000,
            totalProfitLossPercent: 0,
            totalTrades: 0,
            winRate: 0
        };

        try {
            const paperAccount = await PaperTradingAccount.findOne({ user: user._id });
            if (paperAccount) {
                paperTradingStats = {
                    portfolioValue: paperAccount.portfolioValue || 100000,
                    totalProfitLossPercent: paperAccount.totalProfitLossPercent || 0,
                    totalTrades: paperAccount.totalTrades || 0,
                    winRate: paperAccount.winRate || 0,
                    winningTrades: paperAccount.winningTrades || 0,
                    losingTrades: paperAccount.losingTrades || 0
                };
                console.log(`[Profile] Paper trading stats for ${user.username}: ${paperTradingStats.totalProfitLossPercent.toFixed(2)}% return`);
            }
        } catch (ptError) {
            console.warn('[Profile] Could not fetch paper trading stats:', ptError.message);
        }

        // 🔥 FETCH BROKERAGE/REAL PORTFOLIO STATS
        let brokerageStats = {
            totalValue: 0,
            connectionCount: 0,
            hasConnections: false
        };

        try {
            const brokerageConnections = await BrokerageConnection.find({
                user: user._id,
                status: 'active'
            });

            if (brokerageConnections.length > 0) {
                const totalValue = brokerageConnections.reduce((sum, conn) => {
                    return sum + (conn.cachedPortfolio?.totalValue || 0);
                }, 0);

                brokerageStats = {
                    totalValue: totalValue,
                    connectionCount: brokerageConnections.length,
                    hasConnections: true
                };
                console.log(`[Profile] Brokerage stats for ${user.username}: $${totalValue.toFixed(2)} across ${brokerageConnections.length} connections`);
            }
        } catch (brokError) {
            console.warn('[Profile] Could not fetch brokerage stats:', brokError.message);
        }

        // 🔥 MERGE stats from User.stats AND Gamification.stats
        const mergedStats = {
            // From User.stats
            totalReturnPercent: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || gamificationData?.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || gamificationData?.stats?.totalTrades || 0,
            currentStreak: user.stats?.currentStreak || gamificationData?.profitStreak || gamificationData?.loginStreak || 0,
            longestStreak: user.stats?.longestStreak || gamificationData?.maxProfitStreak || 0,
            bestTrade: user.stats?.bestTrade || gamificationData?.stats?.biggestWinPercent || 0,
            worstTrade: user.stats?.worstTrade || 0,
            avgTradeReturn: user.stats?.avgTradeReturn || 0,
            rank: user.stats?.rank || 0,
            
            // 🔥 USE REAL PREDICTION STATS FROM PREDICTION MODEL
            totalPredictions: predictionStats.predictionsCreated,
            correctPredictions: predictionStats.correctPredictions,
            predictionAccuracy: predictionStats.predictionAccuracy,
            
            // Profit/loss streaks
            profitStreak: gamificationData?.profitStreak || 0,
            lossStreak: gamificationData?.lossStreak || 0,
            loginStreak: gamificationData?.loginStreak || 0,
            maxProfitStreak: gamificationData?.maxProfitStreak || 0,
            maxLossStreak: gamificationData?.maxLossStreak || 0
        };

        // 🔥 MERGE gamification data - PRIORITIZE Gamification document over User.gamification
        const mergedGamification = {
            // Level & XP - prefer Gamification doc (where real data is)
            level: gamificationData?.level || user.gamification?.level || 1,
            xp: gamificationData?.xp || user.gamification?.xp || 0,
            
            // Title/Rank - prefer Gamification doc
            title: gamificationData?.rank || user.gamification?.title || 'Rookie Trader',
            rank: gamificationData?.rank || user.gamification?.rank || 'Rookie Trader',
            
            // Coins
            nexusCoins: gamificationData?.nexusCoins || user.gamification?.nexusCoins || 0,
            totalEarned: gamificationData?.totalEarned || 0,
            
            // Streaks
            loginStreak: gamificationData?.loginStreak || 0,
            profitStreak: gamificationData?.profitStreak || 0,
            maxLoginStreak: gamificationData?.maxLoginStreak || 0,
            maxProfitStreak: gamificationData?.maxProfitStreak || 0,
            
            // Stats object
            stats: gamificationData?.stats || user.gamification?.stats || {},
            
            // Achievements count
            achievementsCount: achievements.length
        };

        console.log(`[Profile] Gamification data for ${user.username}: Level ${mergedGamification.level}, XP ${mergedGamification.xp}, Title: ${mergedGamification.title}`);

        res.json({
            userId: user._id,
            _id: user._id,
            username: user.username,
            profile: user.profile,
            stats: mergedStats, // 🔥 Use merged stats
            achievements: achievements,
            gamification: mergedGamification, // 🔥 Use merged gamification
            social: {
                followersCount: user.social?.followersCount || 0,
                followingCount: user.social?.followingCount || 0,
                followers: user.social?.followers || [],
                following: user.social?.following || []
            },
            // 🔥 Include vault data for badges and borders
            vault: {
                equippedBadges: user.vault?.equippedBadges || [],
                equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                equippedTheme: user.vault?.equippedTheme || 'default'
            },
            // 🔥 Paper trading stats
            paperTrading: paperTradingStats,
            // 🔥 Brokerage/Real portfolio stats
            brokerage: brokerageStats,
            isFounder: user.isFounder || false,
            date: user.createdAt,
            isOwnProfile: isOwnProfile
        });
    } catch (error) {
        console.error('[Social] Error fetching profile by username:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});


// ============ FOLLOW/UNFOLLOW ============
// @route   POST /api/social/follow/:userId
// @desc    Follow a user
// @access  Private
router.post('/follow/:userId', auth, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;

        if (targetUserId === currentUserId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findById(currentUserId),
            User.findById(targetUserId)
        ]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (currentUser.social.following.includes(targetUserId)) {
            return res.status(400).json({ error: 'Already following this user' });
        }

        currentUser.social.following.push(targetUserId);
        currentUser.social.followingCount++;
        targetUser.social.followers.push(currentUserId);
        targetUser.social.followersCount++;

        await Promise.all([currentUser.save(), targetUser.save()]);

        await NotificationService.createFollowNotification(
            targetUserId,
            currentUser
        );

        res.json({ success: true, message: 'Successfully followed user' });
    } catch (error) {
        console.error('[Social] Error following user:', error);
        res.status(500).json({ error: 'Failed to follow user' });
    }
});

// @route   POST /api/social/unfollow/:userId
// @desc    Unfollow a user
// @access  Private
router.post('/unfollow/:userId', auth, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;

        const [currentUser, targetUser] = await Promise.all([
            User.findById(currentUserId),
            User.findById(targetUserId)
        ]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        currentUser.social.following = currentUser.social.following.filter(
            id => id.toString() !== targetUserId
        );
        currentUser.social.followingCount = Math.max(0, currentUser.social.followingCount - 1);
        
        targetUser.social.followers = targetUser.social.followers.filter(
            id => id.toString() !== currentUserId
        );
        targetUser.social.followersCount = Math.max(0, targetUser.social.followersCount - 1);

        await Promise.all([currentUser.save(), targetUser.save()]);

        res.json({ success: true, message: 'Successfully unfollowed user' });
    } catch (error) {
        console.error('[Social] Error unfollowing user:', error);
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
});

// ============ PROFILE SETTINGS ============
// @route   PUT /api/social/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { displayName, bio, isPublic, showPortfolio } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (displayName !== undefined) user.profile.displayName = displayName;
        if (bio !== undefined) user.profile.bio = bio;
        if (isPublic !== undefined) user.profile.isPublic = isPublic;
        if (showPortfolio !== undefined) user.profile.showPortfolio = showPortfolio;

        await user.save();

        res.json({ success: true, profile: user.profile });
    } catch (error) {
        console.error('[Social] Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============ SEARCH ============
// @route   GET /api/social/search
// @desc    Search for users
// @access  Public
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        const users = await User.find({
            $or: [
                { 'profile.displayName': { $regex: q, $options: 'i' } },
                { username: { $regex: q, $options: 'i' } }
            ]
        })
        .select('username profile stats gamification social vault')
        .limit(20);

        const results = users.map(user => ({
            userId: user._id,
            username: user.username,
            displayName: user.profile?.displayName || user.username,
            avatar: user.profile?.avatar || '',
            totalReturn: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || 0,
            currentStreak: user.stats?.currentStreak || 0,
            level: user.gamification?.level || 1,
            xp: user.gamification?.xp || 0,
            followersCount: user.social?.followersCount || 0,
            badges: user.profile?.badges || [],
           // 🔥 NEW: Include vault data
            equippedBadges: user.vault?.equippedBadges || [],
            equippedBorder: user.vault?.equippedBorder || 'border-bronze',
            equippedTheme: user.vault?.equippedTheme || 'default'
        }));

        res.json(results);
    } catch (error) {
        console.error('[Social] Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// ============ COPY TRADING (Placeholder) ============
// @route   POST /api/social/copy/:userId
// @desc    Start copy trading a user
// @access  Private
router.post('/copy/:userId', auth, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;

        if (targetUserId === currentUserId) {
            return res.status(400).json({ error: 'Cannot copy trade yourself' });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // TODO: Implement actual copy trading logic
        // For now, just return a placeholder response
        res.json({ 
            success: true, 
            message: 'Copy trading feature coming soon!',
            trader: {
                username: targetUser.username,
                displayName: targetUser.profile?.displayName || targetUser.username
            }
        });
    } catch (error) {
        console.error('[Social] Error setting up copy trading:', error);
        res.status(500).json({ error: 'Failed to set up copy trading' });
    }
});

// @route   DELETE /api/social/copy/:userId
// @desc    Stop copy trading a user
// @access  Private
router.delete('/copy/:userId', auth, async (req, res) => {
    try {
        // TODO: Implement actual copy trading removal logic
        res.json({ 
            success: true, 
            message: 'Copy trading stopped'
        });
    } catch (error) {
        console.error('[Social] Error stopping copy trading:', error);
        res.status(500).json({ error: 'Failed to stop copy trading' });
    }
});

// ============ ADMIN ENDPOINTS ============

// Migration: Set display names and public profiles
router.post('/admin/migrate-profiles', async (req, res) => {
    try {
        const users = await User.find({});
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            if (!user.profile.displayName) {
                user.profile.displayName = user.username;
                needsUpdate = true;
            }
            
            if (user.profile.isPublic === undefined) {
                user.profile.isPublic = true;
                needsUpdate = true;
            }
            
            if (user.profile.showPortfolio === undefined) {
                user.profile.showPortfolio = true;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await user.save();
                updated++;
            }
        }
        
        console.log(`[Migration] Updated ${updated} user profiles`);
        
        res.json({ 
            success: true, 
            message: `Migration complete! Updated ${updated} profiles`,
            total: users.length
        });
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

// Migration: Initialize gamification for all users
router.post('/admin/migrate-gamification', async (req, res) => {
    try {
        const users = await User.find({});
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Initialize gamification if not present
            if (!user.gamification) {
                user.gamification = {
                    xp: 0,
                    level: 1,
                    title: 'Rookie Trader',
                    achievements: [],
                    badges: []
                };
                needsUpdate = true;
            }
            
            // Initialize streak fields in stats if not present
            if (user.stats && user.stats.currentStreak === undefined) {
                user.stats.currentStreak = 0;
                user.stats.bestStreak = 0;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await user.save();
                updated++;
            }
        }
        
        console.log(`[Migration] Initialized gamification for ${updated} users`);
        
        res.json({ 
            success: true, 
            message: `Gamification migration complete! Updated ${updated} users`,
            total: users.length
        });
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

// Migration: Initialize vault for all users
router.post('/admin/migrate-vault', async (req, res) => {
    try {
        const users = await User.find({});
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Initialize vault if not present
            if (!user.vault) {
                user.vault = {
                    ownedItems: [],
                    equippedBadges: [],
                    equippedBorder: null,
                    equippedTheme: null,
                    activePerks: []
                };
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await user.save();
                updated++;
            }
        }
        
        console.log(`[Migration] Initialized vault for ${updated} users`);
        
        res.json({ 
            success: true, 
            message: `Vault migration complete! Updated ${updated} users`,
            total: users.length
        });
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

// Update all user stats
router.post('/admin/update-stats', async (req, res) => {
    try {
        await updateAllUserStats();
        res.json({ 
            success: true, 
            message: 'All user stats updated successfully from portfolio data' 
        });
    } catch (error) {
        console.error('[Admin] Error updating stats:', error);
        res.status(500).json({ error: 'Failed to update stats', details: error.message });
    }
});

// Update single user's stats
router.post('/admin/update-stats/:userId', async (req, res) => {
    try {
        await updateUserStats(req.params.userId);
        res.json({ 
            success: true, 
            message: `User ${req.params.userId} stats updated successfully` 
        });
    } catch (error) {
        console.error('[Admin] Error updating user stats:', error);
        res.status(500).json({ error: 'Failed to update user stats', details: error.message });
    }
});

// 🔥 DEBUG: Check where achievements are stored for a user
router.get('/debug/achievements/:username', async (req, res) => {
    try {
        // Find user
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.json({ error: 'User not found' });
        }
        
        // Find separate gamification doc
        let gamificationDoc = null;
        try {
            gamificationDoc = await Gamification.findOne({ user: user._id });
        } catch (e) {
            console.log('No separate Gamification collection');
        }
        
        res.json({
            username: user.username,
            userId: user._id,
            
            // Check User.achievements array
            userAchievements: {
                location: 'User.achievements',
                exists: !!user.achievements,
                count: user.achievements?.length || 0,
                sample: user.achievements?.slice(0, 3) || []
            },
            
            // Check User.gamification.achievements (embedded)
            embeddedGamificationAchievements: {
                location: 'User.gamification.achievements',
                exists: !!(user.gamification?.achievements),
                count: user.gamification?.achievements?.length || 0,
                sample: user.gamification?.achievements?.slice(0, 3) || []
            },
            
            // Check separate Gamification document
            separateGamificationDoc: {
                location: 'Gamification collection (separate document)',
                exists: !!gamificationDoc,
                docId: gamificationDoc?._id || null,
                count: gamificationDoc?.achievements?.length || 0,
                sample: gamificationDoc?.achievements?.slice(0, 3) || []
            },
            
            // Summary
            summary: {
                totalAchievementsFound: 
                    (user.achievements?.length || 0) + 
                    (user.gamification?.achievements?.length || 0) + 
                    (gamificationDoc?.achievements?.length || 0),
                recommendedSource: 
                    user.achievements?.length > 0 ? 'User.achievements' :
                    user.gamification?.achievements?.length > 0 ? 'User.gamification.achievements' :
                    gamificationDoc?.achievements?.length > 0 ? 'Gamification document' :
                    'NO ACHIEVEMENTS FOUND'
            }
        });
    } catch (error) {
        console.error('[Debug] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;