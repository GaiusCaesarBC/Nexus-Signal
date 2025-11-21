const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET /api/social/leaderboard
// @desc    Get top traders
// @access  Public
router.get('/leaderboard', async (req, res) => {
    try {
        const { timeframe = 'all', limit = 100 } = req.query;

        const users = await User.find({ 'profile.isPublic': true })
            .select('profile.displayName profile.avatar profile.badges stats')
            .sort({ 'stats.totalReturnPercent': -1 })
            .limit(parseInt(limit));

        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            userId: user._id,
            displayName: user.profile.displayName || 'Anonymous Trader',
            avatar: user.profile.avatar,
            totalReturn: user.stats.totalReturnPercent || 0,
            winRate: user.stats.winRate || 0,
            totalTrades: user.stats.totalTrades || 0,
            badges: user.profile.badges || []
        }));

        res.json(leaderboard);
    } catch (error) {
        console.error('[Social] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// @route   GET /api/social/profile/:userId
// @desc    Get user profile
// @access  Public
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('profile stats achievements social')
            .populate('social.followers', 'profile.displayName profile.avatar')
            .populate('social.following', 'profile.displayName profile.avatar');

        if (!user || !user.profile.isPublic) {
            return res.status(404).json({ error: 'Profile not found or private' });
        }

        res.json({
            profile: user.profile,
            stats: user.stats,
            achievements: user.achievements,
            followersCount: user.social.followersCount,
            followingCount: user.social.followingCount
        });
    } catch (error) {
        console.error('[Social] Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

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

// @route   PUT /api/social/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { displayName, bio, isPublic, showPortfolio } = req.body;

        const user = await User.findById(req.user.id);

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
            'profile.isPublic': true,
            'profile.displayName': { $regex: q, $options: 'i' }
        })
        .select('profile.displayName profile.avatar stats')
        .limit(20);

        res.json(users);
    } catch (error) {
        console.error('[Social] Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

module.exports = router;