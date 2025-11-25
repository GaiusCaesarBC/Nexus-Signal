// server/routes/onboardingRoutes.js - Onboarding API Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');

// ============ UPDATE PROFILE ============
// @route   PUT /api/auth/profile
// @desc    Update user profile (displayName, bio)
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { displayName, bio, location, website, twitter } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize profile if not exists
        if (!user.profile) {
            user.profile = {};
        }

        // Update fields
        if (displayName !== undefined) {
            user.profile.displayName = displayName.trim().substring(0, 50);
        }
        if (bio !== undefined) {
            user.bio = bio.trim().substring(0, 160);
        }
        if (location !== undefined) {
            user.profile.location = location.trim().substring(0, 100);
        }
        if (website !== undefined) {
            user.profile.website = website.trim().substring(0, 200);
        }
        if (twitter !== undefined) {
            user.profile.twitter = twitter.trim().replace('@', '').substring(0, 50);
        }

        await user.save();

        console.log(`[Onboarding] Updated profile for user ${req.user.id}`);

        res.json({
            success: true,
            profile: user.profile,
            bio: user.bio
        });

    } catch (error) {
        console.error('[Onboarding] Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============ UPDATE PREFERENCES/INTERESTS ============
// @route   PUT /api/auth/preferences
// @desc    Update user preferences and interests
// @access  Private
router.put('/preferences', auth, async (req, res) => {
    try {
        const { 
            interests, 
            riskTolerance, 
            tradingExperience,
            preferredTimeframe,
            notifications 
        } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize preferences if not exists
        if (!user.preferences) {
            user.preferences = {};
        }

        // Update interests (array of strings)
        if (interests !== undefined && Array.isArray(interests)) {
            user.preferences.interests = interests.slice(0, 20); // Max 20 interests
        }

        // Update risk tolerance
        if (riskTolerance !== undefined) {
            const validRisk = ['conservative', 'moderate', 'aggressive'];
            if (validRisk.includes(riskTolerance)) {
                user.riskTolerance = riskTolerance;
            }
        }

        // Update trading experience
        if (tradingExperience !== undefined) {
            const validExp = ['beginner', 'intermediate', 'advanced', 'expert'];
            if (validExp.includes(tradingExperience)) {
                user.tradingExperience = tradingExperience;
            }
        }

        // Update preferred timeframe
        if (preferredTimeframe !== undefined) {
            user.preferences.preferredTimeframe = preferredTimeframe;
        }

        // Update notification preferences
        if (notifications !== undefined) {
            user.preferences.notifications = {
                ...user.preferences.notifications,
                ...notifications
            };
        }

        await user.save();

        console.log(`[Onboarding] Updated preferences for user ${req.user.id}`);

        res.json({
            success: true,
            preferences: user.preferences,
            riskTolerance: user.riskTolerance,
            tradingExperience: user.tradingExperience
        });

    } catch (error) {
        console.error('[Onboarding] Preferences update error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// ============ COMPLETE ONBOARDING ============
// @route   PUT /api/auth/onboarding-complete
// @desc    Mark onboarding as complete
// @access  Private
router.put('/onboarding-complete', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Mark onboarding as complete
        user.onboardingCompleted = true;
        user.onboardingCompletedAt = new Date();

        // Award welcome XP if gamification exists
        if (user.gamification) {
            user.gamification.xp = (user.gamification.xp || 0) + 100;
            user.gamification.totalXpEarned = (user.gamification.totalXpEarned || 0) + 100;

            // Check for level up
            if (typeof user.checkLevelUp === 'function') {
                user.checkLevelUp();
            }
        }

        await user.save();

        // Send welcome notification
        try {
            await NotificationService.createWelcomeNotification(user._id);
        } catch (e) {
            console.error('[Onboarding] Welcome notification error:', e);
        }

        console.log(`[Onboarding] Completed onboarding for user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Onboarding completed!',
            xpAwarded: 100
        });

    } catch (error) {
        console.error('[Onboarding] Complete error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

// ============ CHECK ONBOARDING STATUS ============
// @route   GET /api/auth/onboarding-status
// @desc    Check if user needs to complete onboarding
// @access  Private
router.get('/onboarding-status', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('onboardingCompleted onboardingCompletedAt profile preferences');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Determine what's missing
        const missingSteps = [];
        
        if (!user.profile?.displayName) {
            missingSteps.push('profile');
        }
        if (!user.preferences?.interests || user.preferences.interests.length === 0) {
            missingSteps.push('interests');
        }
        if (!user.social?.following || user.social.following.length === 0) {
            missingSteps.push('follow_traders');
        }

        res.json({
            success: true,
            onboardingCompleted: user.onboardingCompleted || false,
            onboardingCompletedAt: user.onboardingCompletedAt,
            missingSteps,
            shouldShowOnboarding: !user.onboardingCompleted && missingSteps.length > 0
        });

    } catch (error) {
        console.error('[Onboarding] Status check error:', error);
        res.status(500).json({ error: 'Failed to check onboarding status' });
    }
});

// ============ GAMIFICATION STATS ============
// @route   GET /api/gamification/stats
// @desc    Get user's gamification stats (level, XP, title, etc.)
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('gamification stats');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize gamification if not exists
        if (!user.gamification) {
            user.gamification = {
                xp: 0,
                level: 1,
                title: 'Rookie Trader',
                nextLevelXp: 100,
                totalXpEarned: 0,
                achievements: [],
                badges: [],
                loginStreak: 0
            };
            await user.save();
        }

        res.json({
            level: user.gamification.level || 1,
            xp: user.gamification.xp || 0,
            totalXpEarned: user.gamification.totalXpEarned || 0,
            title: user.gamification.title || 'Rookie Trader',
            nextLevelXp: user.gamification.nextLevelXp || 100,
            achievements: user.gamification.achievements || [],
            badges: user.gamification.badges || [],
            loginStreak: user.gamification.loginStreak || 0,
            // Include stats too
            rank: user.stats?.rank || 0,
            predictionAccuracy: user.stats?.predictionAccuracy || 0,
            totalPredictions: user.stats?.totalPredictions || 0,
            currentStreak: user.stats?.currentStreak || 0
        });
    } catch (error) {
        console.error('Error fetching gamification stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============ AWARD ACHIEVEMENT ============
// @route   POST /api/gamification/achievement
// @desc    Award an achievement to user
// @access  Private
router.post('/achievement', auth, async (req, res) => {
    try {
        const { achievementId, xpReward = 0 } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize gamification if not exists
        if (!user.gamification) {
            user.gamification = {
                xp: 0,
                level: 1,
                achievements: [],
                badges: []
            };
        }

        // Check if already has achievement
        if (user.gamification.achievements?.includes(achievementId)) {
            return res.json({
                success: true,
                message: 'Achievement already unlocked',
                alreadyUnlocked: true
            });
        }

        // Award achievement
        if (!user.gamification.achievements) {
            user.gamification.achievements = [];
        }
        user.gamification.achievements.push(achievementId);

        // Award XP
        if (xpReward > 0) {
            user.gamification.xp = (user.gamification.xp || 0) + xpReward;
            user.gamification.totalXpEarned = (user.gamification.totalXpEarned || 0) + xpReward;
        }

        await user.save();

        // Send achievement notification
        try {
            await NotificationService.createAchievementNotification(user._id, {
                id: achievementId,
                name: getAchievementName(achievementId),
                icon: getAchievementIcon(achievementId),
                xpReward
            });
        } catch (e) {
            console.error('[Gamification] Achievement notification error:', e);
        }

        console.log(`[Gamification] Awarded achievement ${achievementId} to user ${req.user.id}`);

        res.json({
            success: true,
            achievementId,
            xpAwarded: xpReward,
            totalXp: user.gamification.xp
        });

    } catch (error) {
        console.error('[Gamification] Award achievement error:', error);
        res.status(500).json({ error: 'Failed to award achievement' });
    }
});

// Helper function to get achievement name
function getAchievementName(id) {
    const achievements = {
        'welcome_aboard': 'Welcome Aboard!',
        'first_prediction': 'Oracle in Training',
        'first_trade': 'First Steps',
        'first_follow': 'Social Butterfly',
        'profile_complete': 'Identity Established',
        'streak_3': '3 Day Streak',
        'streak_7': 'Week Warrior',
        'streak_30': 'Month Master',
        'level_5': 'Rising Star',
        'level_10': 'Trading Pro',
        'win_streak_5': 'Hot Hand',
        'win_streak_10': 'On Fire',
        'portfolio_1k': '$1K Portfolio',
        'portfolio_10k': '$10K Portfolio',
        'portfolio_100k': '$100K Portfolio',
        'followers_10': 'Influencer',
        'followers_100': 'Thought Leader',
        'followers_1000': 'Trading Guru'
    };
    return achievements[id] || 'Achievement Unlocked';
}

// Helper function to get achievement icon
function getAchievementIcon(id) {
    const icons = {
        'welcome_aboard': '🎉',
        'first_prediction': '🔮',
        'first_trade': '📈',
        'first_follow': '👥',
        'profile_complete': '✨',
        'streak_3': '🔥',
        'streak_7': '💪',
        'streak_30': '👑',
        'level_5': '⭐',
        'level_10': '🌟',
        'win_streak_5': '🎯',
        'win_streak_10': '💎',
        'portfolio_1k': '💵',
        'portfolio_10k': '💰',
        'portfolio_100k': '🏆',
        'followers_10': '📣',
        'followers_100': '🎙️',
        'followers_1000': '👨‍🏫'
    };
    return icons[id] || '🏅';
}

module.exports = router;