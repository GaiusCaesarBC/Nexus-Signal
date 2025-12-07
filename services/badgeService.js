// server/services/badgeService.js - Badge Management Service
// Awards visual badges when achievements are unlocked

const { 
    BADGE_MAPPING, 
    getBadge, 
    getAllBadges,
    getBadgesByAchievement,
    requiresCustomCheck 
} = require('../config/badgeMapping');
const NotificationService = require('./notificationService');

class BadgeService {
    /**
     * Check and award badges when an achievement is unlocked
     * Called automatically by achievement system
     */
    static async checkBadgesForAchievement(userId, achievementId, user) {
        try {
            // Find badges that map to this achievement
            const eligibleBadges = getBadgesByAchievement(achievementId);
            
            if (eligibleBadges.length === 0) {
                return { newBadges: [] };
            }

            const newBadges = [];

            for (const badgeConfig of eligibleBadges) {
                // Check if user already has this badge
                if (user.gamification.badges.includes(badgeConfig.id)) {
                    continue;
                }

                // Award the badge
                const awarded = await this.awardBadge(userId, badgeConfig.id, user);
                if (awarded.success) {
                    newBadges.push(awarded.badge);
                }
            }

            return { newBadges };
        } catch (error) {
            console.error('Error checking badges for achievement:', error);
            return { newBadges: [] };
        }
    }

    /**
     * Check all custom badge criteria for a user
     * Used for badges that don't map directly to achievements
     */
    static async checkCustomBadges(userId, user, stats) {
        try {
            const allBadges = getAllBadges();
            const newBadges = [];

            for (const badgeConfig of allBadges) {
                // Skip if already earned
                if (user.gamification.badges.includes(badgeConfig.id)) {
                    continue;
                }

                // Skip if no custom check
                if (!requiresCustomCheck(badgeConfig.id)) {
                    continue;
                }

                // Run custom check
                try {
                    const meetsRequirements = badgeConfig.customCheck(user, stats);
                    
                    if (meetsRequirements) {
                        const awarded = await this.awardBadge(userId, badgeConfig.id, user);
                        if (awarded.success) {
                            newBadges.push(awarded.badge);
                        }
                    }
                } catch (err) {
                    console.error(`Error in custom check for ${badgeConfig.id}:`, err);
                }
            }

            return { newBadges };
        } catch (error) {
            console.error('Error checking custom badges:', error);
            return { newBadges: [] };
        }
    }

    /**
     * Award a specific badge to a user
     */
    static async awardBadge(userId, badgeId, user = null) {
        try {
            // Get badge configuration
            const badgeConfig = getBadge(badgeId);
            if (!badgeConfig) {
                return { success: false, error: 'Badge not found' };
            }

            // Load user if not provided
            if (!user) {
                const User = require('../models/User');
                user = await User.findById(userId);
                if (!user) {
                    return { success: false, error: 'User not found' };
                }
            }

            // Check if user already has badge
            if (user.gamification.badges.includes(badgeId)) {
                return { success: false, error: 'Badge already earned' };
            }

            // Check if manual grant only
            if (badgeConfig.manualGrantOnly) {
                return { success: false, error: 'Badge requires manual grant' };
            }

            // Award badge
            user.gamification.badges.push(badgeId);
            user.gamification.badgesEarned = (user.gamification.badgesEarned || 0) + 1;

            // ALSO add to vault.ownedItems so it shows as "owned" in EquippedItemsPage
            if (!user.vault) {
                user.vault = {
                    ownedItems: ['border-bronze', 'theme-default'],
                    equippedBorder: 'border-bronze',
                    equippedTheme: 'theme-default',
                    equippedBadges: [],
                    activePerks: []
                };
            }
            if (!user.vault.ownedItems) {
                user.vault.ownedItems = ['border-bronze', 'theme-default'];
            }
            if (!user.vault.ownedItems.includes(badgeId)) {
                user.vault.ownedItems.push(badgeId);
            }

            // Award XP and Coins
            if (badgeConfig.xpReward) {
                const GamificationService = require('./gamificationService');
                await GamificationService.addXP(user, badgeConfig.xpReward, 'Badge Earned');
            }

            if (badgeConfig.coinReward) {
                user.gamification.nexusCoins += badgeConfig.coinReward;
                user.gamification.totalEarned += badgeConfig.coinReward;
            }

            // Save user
            await user.save();

            // Send notification
            await NotificationService.create({
                userId: user._id,
                type: 'badge_unlocked',
                title: `Badge Unlocked: ${badgeConfig.name}!`,
                message: badgeConfig.description,
                data: {
                    badgeId: badgeId,
                    rarity: badgeConfig.rarity,
                    xpReward: badgeConfig.xpReward,
                    coinReward: badgeConfig.coinReward
                }
            });

            return {
                success: true,
                badge: {
                    id: badgeId,
                    name: badgeConfig.name,
                    description: badgeConfig.description,
                    rarity: badgeConfig.rarity,
                    category: badgeConfig.category,
                    xpReward: badgeConfig.xpReward,
                    coinReward: badgeConfig.coinReward
                }
            };
        } catch (error) {
            console.error('Error awarding badge:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Manually grant a badge (for special badges like The Architect)
     */
    static async manualGrantBadge(userId, badgeId, grantedBy) {
        try {
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const badgeConfig = getBadge(badgeId);
            if (!badgeConfig) {
                return { success: false, error: 'Badge not found' };
            }

            // Check if already has badge
            if (user.gamification.badges.includes(badgeId)) {
                return { success: false, error: 'Badge already earned' };
            }

            // Grant badge
            user.gamification.badges.push(badgeId);
            user.gamification.badgesEarned = (user.gamification.badgesEarned || 0) + 1;

            // ALSO add to vault.ownedItems so it shows as "owned" in EquippedItemsPage
            if (!user.vault) {
                user.vault = {
                    ownedItems: ['border-bronze', 'theme-default'],
                    equippedBorder: 'border-bronze',
                    equippedTheme: 'theme-default',
                    equippedBadges: [],
                    activePerks: []
                };
            }
            if (!user.vault.ownedItems) {
                user.vault.ownedItems = ['border-bronze', 'theme-default'];
            }
            if (!user.vault.ownedItems.includes(badgeId)) {
                user.vault.ownedItems.push(badgeId);
            }

            // Award XP and Coins
            if (badgeConfig.xpReward) {
                const GamificationService = require('./gamificationService');
                await GamificationService.addXP(user, badgeConfig.xpReward, 'Badge Granted');
            }

            if (badgeConfig.coinReward) {
                user.gamification.nexusCoins += badgeConfig.coinReward;
                user.gamification.totalEarned += badgeConfig.coinReward;
            }

            await user.save();

            // Log the manual grant
            console.log(`Badge ${badgeId} manually granted to user ${userId} by ${grantedBy}`);

            // Send notification
            await NotificationService.create({
                userId: user._id,
                type: 'badge_unlocked',
                title: `Special Badge Granted: ${badgeConfig.name}!`,
                message: badgeConfig.description,
                data: {
                    badgeId: badgeId,
                    rarity: badgeConfig.rarity,
                    manualGrant: true,
                    grantedBy: grantedBy
                }
            });

            return {
                success: true,
                badge: {
                    id: badgeId,
                    name: badgeConfig.name,
                    description: badgeConfig.description,
                    rarity: badgeConfig.rarity
                }
            };
        } catch (error) {
            console.error('Error manually granting badge:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all badges for a user (earned and locked)
     */
    static async getUserBadges(userId) {
        try {
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const allBadges = getAllBadges();
            const earnedBadgeIds = user.gamification.badges || [];

            const badges = allBadges
                .filter(badge => !badge.hidden)
                .map(badgeConfig => ({
                    id: badgeConfig.id,
                    name: badgeConfig.name,
                    description: badgeConfig.description,
                    rarity: badgeConfig.rarity,
                    category: badgeConfig.category,
                    earned: earnedBadgeIds.includes(badgeConfig.id),
                    earnedDate: earnedBadgeIds.includes(badgeConfig.id) 
                        ? this.getBadgeEarnedDate(user, badgeConfig.id) 
                        : null,
                    xpReward: badgeConfig.xpReward,
                    coinReward: badgeConfig.coinReward
                }));

            return {
                success: true,
                badges: badges,
                totalBadges: badges.length,
                earnedCount: earnedBadgeIds.length
            };
        } catch (error) {
            console.error('Error getting user badges:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get only earned badges for a user
     */
    static async getEarnedBadges(userId) {
        try {
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const earnedBadgeIds = user.gamification.badges || [];
            const earnedBadges = earnedBadgeIds
                .map(badgeId => {
                    const config = getBadge(badgeId);
                    if (!config) return null;
                    
                    return {
                        id: config.id,
                        name: config.name,
                        description: config.description,
                        rarity: config.rarity,
                        category: config.category,
                        earnedDate: this.getBadgeEarnedDate(user, badgeId)
                    };
                })
                .filter(badge => badge !== null);

            return {
                success: true,
                badges: earnedBadges,
                count: earnedBadges.length
            };
        } catch (error) {
            console.error('Error getting earned badges:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get badge progress for badges with custom checks
     */
    static async getBadgeProgress(userId) {
        try {
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Get trading stats for progress calculation
            const stats = await this.getUserStats(user);

            const allBadges = getAllBadges();
            const earnedBadgeIds = user.gamification.badges || [];
            
            const progress = [];

            for (const badgeConfig of allBadges) {
                // Skip earned badges
                if (earnedBadgeIds.includes(badgeConfig.id)) {
                    continue;
                }

                // Skip hidden badges
                if (badgeConfig.hidden) {
                    continue;
                }

                // Calculate progress
                const progressData = await this.calculateBadgeProgress(
                    badgeConfig, 
                    user, 
                    stats
                );

                if (progressData) {
                    progress.push({
                        id: badgeConfig.id,
                        name: badgeConfig.name,
                        description: badgeConfig.description,
                        rarity: badgeConfig.rarity,
                        category: badgeConfig.category,
                        ...progressData
                    });
                }
            }

            return {
                success: true,
                progress: progress
            };
        } catch (error) {
            console.error('Error getting badge progress:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate progress toward a specific badge
     */
    static async calculateBadgeProgress(badgeConfig, user, stats) {
        try {
            // If badge maps to achievements, check achievement progress
            if (badgeConfig.achievements && badgeConfig.achievements.length > 0) {
                // Badge will be awarded when achievement unlocks
                // Return basic info
                return {
                    type: 'achievement',
                    requirementsMet: false,
                    hint: `Unlock the ${badgeConfig.achievements[0]} achievement`
                };
            }

            // For custom badges, calculate specific progress
            if (requiresCustomCheck(badgeConfig.id)) {
                return this.calculateCustomProgress(badgeConfig, stats);
            }

            return null;
        } catch (error) {
            console.error('Error calculating badge progress:', error);
            return null;
        }
    }

    /**
     * Calculate progress for custom badges
     */
    static calculateCustomProgress(badgeConfig, stats) {
        const badgeId = badgeConfig.id;

        switch (badgeId) {
            case 'badge-early-bird':
                return {
                    current: stats.earlyTrades || 0,
                    required: 10,
                    percentage: Math.min(((stats.earlyTrades || 0) / 10) * 100, 100)
                };

            case 'badge-night-owl':
                return {
                    current: stats.lateTrades || 0,
                    required: 10,
                    percentage: Math.min(((stats.lateTrades || 0) / 10) * 100, 100)
                };

            case 'badge-risk-taker':
                return {
                    current: stats.highRiskTrades || 0,
                    required: 5,
                    percentage: Math.min(((stats.highRiskTrades || 0) / 5) * 100, 100)
                };

            case 'badge-profit-king':
                return {
                    current: stats.profitableTrades || 0,
                    required: 50,
                    percentage: Math.min(((stats.profitableTrades || 0) / 50) * 100, 100)
                };

            case 'badge-perfect-week':
                return {
                    current: stats.consecutiveProfitableDays || 0,
                    required: 7,
                    percentage: Math.min(((stats.consecutiveProfitableDays || 0) / 7) * 100, 100)
                };

            default:
                return null;
        }
    }

    /**
     * Get user stats for badge calculation
     */
    static async getUserStats(user) {
        // This should aggregate data from trades, streaks, etc.
        // For now, return basic stats from user object
        return {
            totalTrades: user.gamification?.totalTrades || 0,
            profitableTrades: user.gamification?.profitableTrades || 0,
            earlyTrades: user.gamification?.earlyTrades || 0,
            lateTrades: user.gamification?.lateTrades || 0,
            highRiskTrades: user.gamification?.highRiskTrades || 0,
            consecutiveProfitableDays: user.gamification?.consecutiveProfitableDays || 0,
            loginStreak: user.gamification?.loginStreak || 0,
            maxLoginStreak: user.gamification?.maxLoginStreak || 0
        };
    }

    /**
     * Get when a badge was earned (placeholder - needs activity log)
     */
    static getBadgeEarnedDate(user, badgeId) {
        // TODO: Implement activity log to track exact earn dates
        // For now, return null or user's last activity date
        return user.lastActivity || user.updatedAt;
    }
}

module.exports = BadgeService;