const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
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

        // Fetch users with all relevant fields
        const users = await User.find(query)
            .select('username profile stats gamification social createdAt')
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
            .select('username profile stats achievements gamification social')
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

        res.json({
            username: user.username,
            profile: user.profile,
            stats: user.stats,
            achievements: user.achievements,
            gamification: user.gamification,
            social: {
                followersCount: user.social?.followersCount || 0,
                followingCount: user.social?.followingCount || 0,
                followers: user.social?.followers || [],
                following: user.social?.following || []
            },
            isOwnProfile: isOwnProfile
        });
    } catch (error) {
        console.error('[Social] Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// @route   GET /api/social/profile/username/:username
// @desc    Get user profile by username
// @access  Public (but respects privacy settings)
router.get('/profile/username/:username', optionalAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username profile stats achievements gamification social')
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

        res.json({
            userId: user._id,
            username: user.username,
            profile: user.profile,
            stats: user.stats,
            achievements: user.achievements,
            gamification: user.gamification,
            social: {
                followersCount: user.social?.followersCount || 0,
                followingCount: user.social?.followingCount || 0,
                followers: user.social?.followers || [],
                following: user.social?.following || []
            },
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
        .select('username profile stats gamification social')
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
            badges: user.profile?.badges || []
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

module.exports = router;