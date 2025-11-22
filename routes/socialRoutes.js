const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const { updateUserStats, updateAllUserStats } = require('../services/statsService'); // ✅ ADD THIS

// ============ OPTIONAL AUTH MIDDLEWARE ============
// Allows routes to work with or without authentication
const optionalAuth = (req, res, next) => {
    const token = req.cookies.token || req.header('x-auth-token');
    
    if (!token) {
        return next(); // No token, continue without user
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        next(); // Invalid token, continue without user
    }
};

// ============ LEADERBOARD ============
// @route   GET /api/social/leaderboard
// @desc    Get top traders
// @access  Public
router.get('/leaderboard', async (req, res) => {
    try {
        const { timeframe = 'all', limit = 100, sortBy = 'totalReturnPercent' } = req.query;

        // Show public profiles OR profiles with no isPublic field (defaults to public)
        const users = await User.find({
            $or: [
                { 'profile.isPublic': true },
                { 'profile.isPublic': { $exists: false } }
            ]
        })
            .select('username profile.displayName profile.avatar profile.badges stats social')
            .sort({ [`stats.${sortBy}`]: -1 })
            .limit(parseInt(limit));

        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            userId: user._id,
            username: user.username,
            displayName: user.profile?.displayName || user.username || 'Anonymous Trader',
            avatar: user.profile?.avatar || '',
            totalReturn: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || 0,
            followersCount: user.social?.followersCount || 0,
            badges: user.profile?.badges || []
        }));

        res.json(leaderboard);
    } catch (error) {
        console.error('[Social] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============ PROFILE ============
// @route   GET /api/social/profile/:userId
// @desc    Get user profile
// @access  Public (but respects privacy settings)
router.get('/profile/:userId', optionalAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('username profile stats achievements social')
            .populate('social.followers', 'username profile.displayName profile.avatar')
            .populate('social.following', 'username profile.displayName profile.avatar');

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if this is the user's own profile
        const isOwnProfile = req.user && req.user.id === req.params.userId;
        const isPublic = user.profile?.isPublic ?? true; // Default to public if not set

        // If profile is private and not own profile, deny access
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
            .select('username profile stats achievements social')
            .populate('social.followers', 'username profile.displayName profile.avatar')
            .populate('social.following', 'username profile.displayName profile.avatar');

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if this is the user's own profile
        const isOwnProfile = req.user && req.user.id === user._id.toString();
        const isPublic = user.profile?.isPublic ?? true; // Default to public if not set

        // If profile is private and not own profile, deny access
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

        // Check if already following
        if (currentUser.social.following.includes(targetUserId)) {
            return res.status(400).json({ error: 'Already following this user' });
        }

        // Add to following/followers
        currentUser.social.following.push(targetUserId);
        currentUser.social.followingCount++;
        targetUser.social.followers.push(currentUserId);
        targetUser.social.followersCount++;

        await Promise.all([currentUser.save(), targetUser.save()]);

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

        // Remove from following/followers
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

        // Search by both displayName AND username
        const users = await User.find({
            $or: [
                { 'profile.displayName': { $regex: q, $options: 'i' } },
                { username: { $regex: q, $options: 'i' } }
            ]
        })
        .select('username profile.displayName profile.avatar profile.badges stats social')
        .limit(20);

        // Return data in the same format as leaderboard
        const results = users.map(user => ({
            userId: user._id,
            username: user.username,
            displayName: user.profile?.displayName || user.username,
            avatar: user.profile?.avatar || '',
            totalReturn: user.stats?.totalReturnPercent || 0,
            winRate: user.stats?.winRate || 0,
            totalTrades: user.stats?.totalTrades || 0,
            followersCount: user.social?.followersCount || 0,
            badges: user.profile?.badges || []
        }));

        res.json(results);
    } catch (error) {
        console.error('[Social] Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// ============ ADMIN ENDPOINTS (TEMPORARY - REMOVE AFTER RUNNING) ============

// ⚠️ MIGRATION: Set display names and public profiles
router.post('/admin/migrate-profiles', async (req, res) => {
    try {
        const users = await User.find({});
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Set displayName to username if not set
            if (!user.profile.displayName) {
                user.profile.displayName = user.username;
                needsUpdate = true;
            }
            
            // Set isPublic to true if not set
            if (user.profile.isPublic === undefined) {
                user.profile.isPublic = true;
                needsUpdate = true;
            }
            
            // Set showPortfolio to true if not set
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

// ⚠️ STATS: Update all user stats from portfolios
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

// ⚠️ STATS: Update single user's stats
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
