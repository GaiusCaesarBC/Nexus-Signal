// server/services/achievementService.js - UPDATED TO USE USER.GAMIFICATION

const User = require('../models/User');
const ACHIEVEMENTS = require('../config/achievements');
const Notification = require('../models/Notification');

class AchievementService {
    /**
     * Check all achievements for a user and unlock any new ones
     * @param {string} userId - The user's ID
     * @param {object} additionalStats - Additional stats to merge (from paper trading, etc.)
     * @returns {array} - Array of newly unlocked achievements
     */
    static async checkAllAchievements(userId, additionalStats = {}) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) {
                user.gamification = {};
            }
            if (!user.gamification.stats) {
                user.gamification.stats = {};
            }
            if (!user.gamification.achievements) {
                user.gamification.achievements = [];
            }

            // ✅ FIXED: Track old level BEFORE any XP changes
            const oldLevel = user.gamification.level || 1;

            // Merge stats from different sources
            const stats = {
                ...user.gamification.stats,
                ...additionalStats
            };

            const newlyUnlocked = [];
            const unlockedIds = user.gamification.achievements.map(a => a.id);

            console.log(`[Achievements] Checking achievements for user ${userId}`);
            console.log(`[Achievements] Current stats:`, stats);
            console.log(`[Achievements] Already unlocked: ${unlockedIds.length} achievements`);

            // Check each achievement
            for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
                // Skip if already unlocked
                if (unlockedIds.includes(achievement.id)) {
                    continue;
                }

                // Check if achievement condition is met
                try {
                    const isUnlocked = achievement.check(stats, user.gamification);
                    
                    if (isUnlocked) {
                        console.log(`[Achievements] ✅ UNLOCKED: ${achievement.name} (${achievement.id})`);
                        
                        // Unlock the achievement
                        user.gamification.achievements.push({
                            id: achievement.id,
                            name: achievement.name,
                            description: achievement.description,
                            icon: achievement.icon,
                            points: achievement.points,
                            rarity: achievement.rarity,
                            unlockedAt: new Date()
                        });
                        
                        // Add XP reward using User model method
                        await user.addXp(achievement.points, `Achievement: ${achievement.name}`);
                        
                        // Add coin reward based on rarity
                        const coinReward = this.getCoinReward(achievement.rarity);
                        await user.addCoins(coinReward, `Achievement: ${achievement.name}`);

                        newlyUnlocked.push({
                            ...achievement,
                            coinReward
                        });

                        console.log(`[Achievements] Rewards: ${achievement.points} XP, ${coinReward} coins`);
                    }
                } catch (error) {
                    console.error(`[Achievements] Error checking ${achievement.id}:`, error.message);
                }
            }

            // ✅ FIXED: Check for level up AFTER XP gains
            const newLevel = user.gamification.level || 1;
            const leveledUp = newLevel > oldLevel;
            
            if (leveledUp) {
                console.log(`[Achievements] 🎉 LEVEL UP! ${oldLevel} → ${newLevel}`);
            }
            
            // Save all changes
            await user.save();

            // Create notifications for new achievements
            for (const achievement of newlyUnlocked) {
                try {
                    await this.createAchievementNotification(userId, achievement);
                } catch (error) {
                    console.error('[Achievements] Failed to create notification:', error.message);
                }
            }

            console.log(`[Achievements] Summary: ${newlyUnlocked.length} new achievements unlocked`);

            return {
                newlyUnlocked,
                leveledUp,
                newLevel: leveledUp ? newLevel : null,
                oldLevel: leveledUp ? oldLevel : null,
                newRank: leveledUp ? user.gamification.title : null
            };

        } catch (error) {
            console.error('[Achievements] Error checking achievements:', error);
            throw error;
        }
    }

    /**
     * Get coin reward based on achievement rarity
     */
    static getCoinReward(rarity) {
        const rewards = {
            common: 50,
            rare: 150,
            epic: 500,
            legendary: 1500
        };
        return rewards[rarity] || 50;
    }

    /**
     * Create notification for unlocked achievement
     */
    static async createAchievementNotification(userId, achievement) {
        try {
            const notification = new Notification({
                user: userId,
                type: 'achievement',
                title: 'Achievement Unlocked!',
                message: `You earned "${achievement.name}" - ${achievement.description}`,
                data: {
                    achievementId: achievement.id,
                    achievementName: achievement.name,
                    achievementIcon: achievement.icon,
                    points: achievement.points,
                    rarity: achievement.rarity
                },
                actionUrl: '/achievements/browse'
            });
            
            await notification.save();
        } catch (error) {
            console.error('[Achievements] Notification error:', error);
        }
    }

    /**
     * Update paper trading stats and check achievements
     */
    static async updatePaperTradingStats(userId, paperTradingAccount) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) user.gamification = {};
            if (!user.gamification.stats) user.gamification.stats = {};

            console.log('[Achievements] Updating paper trading stats for user:', userId);
            console.log('[Achievements] Paper trading account data:', {
                totalTrades: paperTradingAccount.totalTrades,
                winningTrades: paperTradingAccount.winningTrades,
                portfolioValue: paperTradingAccount.portfolioValue,
                positions: paperTradingAccount.positions?.length
            });

            // Update stats from paper trading account
            user.gamification.stats.totalTrades = paperTradingAccount.totalTrades || 0;
            user.gamification.stats.profitableTrades = paperTradingAccount.winningTrades || 0;
            user.gamification.stats.losingTrades = paperTradingAccount.losingTrades || 0;
            user.gamification.stats.totalProfit = paperTradingAccount.totalProfitLoss || 0;
            user.gamification.stats.winRate = paperTradingAccount.winRate || 0;
            user.gamification.stats.portfolioValue = paperTradingAccount.portfolioValue || 100000;
            user.gamification.stats.stocksOwned = paperTradingAccount.positions?.length || 0;
            user.gamification.stats.biggestWin = paperTradingAccount.biggestWin || 0;
            user.gamification.stats.biggestLoss = paperTradingAccount.biggestLoss || 0;

            // Update streaks
            if (paperTradingAccount.currentStreak > (user.gamification.maxProfitStreak || 0)) {
                user.gamification.maxProfitStreak = paperTradingAccount.currentStreak;
                user.gamification.stats.maxProfitStreak = paperTradingAccount.currentStreak;
            }
            if (paperTradingAccount.bestStreak > (user.gamification.stats.maxProfitStreak || 0)) {
                user.gamification.stats.maxProfitStreak = paperTradingAccount.bestStreak;
            }

            console.log('[Achievements] Updated stats:', user.gamification.stats);

            await user.save();

            // Check achievements with updated stats
            return await this.checkAllAchievements(userId, user.gamification.stats);

        } catch (error) {
            console.error('[Achievements] Error updating paper trading stats:', error);
            throw error;
        }
    }

    /**
     * Record a trade and check for achievements
     */
    static async recordTradeAndCheck(userId, tradeData) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) user.gamification = {};
            if (!user.gamification.stats) user.gamification.stats = {};
            if (!user.gamification.dailyStats) user.gamification.dailyStats = {};

            console.log('[Achievements] Recording trade for user:', userId);
            console.log('[Achievements] Trade data:', tradeData);

            // Record the trade in stats
            user.gamification.stats.totalTrades = (user.gamification.stats.totalTrades || 0) + 1;
            
            if (tradeData.profitable) {
                user.gamification.stats.profitableTrades = (user.gamification.stats.profitableTrades || 0) + 1;
                console.log('[Achievements] ✅ Profitable trade recorded');
            } else {
                user.gamification.stats.losingTrades = (user.gamification.stats.losingTrades || 0) + 1;
                console.log('[Achievements] ❌ Losing trade recorded');
            }
            
            // Update daily stats
            const today = new Date().toDateString();
            const lastDate = user.gamification.dailyStats.date?.toDateString();
            
            if (today !== lastDate) {
                user.gamification.dailyStats = {
                    date: new Date(),
                    tradesCount: 1,
                    profit: tradeData.profit || 0
                };
                console.log('[Achievements] Started new daily stats');
            } else {
                user.gamification.dailyStats.tradesCount = (user.gamification.dailyStats.tradesCount || 0) + 1;
                user.gamification.dailyStats.profit = (user.gamification.dailyStats.profit || 0) + (tradeData.profit || 0);
                
                // Update max trades in day
                if (user.gamification.dailyStats.tradesCount > (user.gamification.stats.maxTradesInDay || 0)) {
                    user.gamification.stats.maxTradesInDay = user.gamification.dailyStats.tradesCount;
                    console.log('[Achievements] 📈 New max trades in day:', user.gamification.dailyStats.tradesCount);
                }
            }

            console.log('[Achievements] Current stats:', {
                totalTrades: user.gamification.stats.totalTrades,
                profitableTrades: user.gamification.stats.profitableTrades,
                todayTrades: user.gamification.dailyStats.tradesCount
            });

            await user.save();

            // Check achievements
            return await this.checkAllAchievements(userId);

        } catch (error) {
            console.error('[Achievements] Error recording trade:', error);
            throw error;
        }
    }

    /**
     * Record account refill and check achievements
     */
    static async recordRefill(userId, wasAtZero = false) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) user.gamification = {};
            if (!user.gamification.stats) user.gamification.stats = {};

            user.gamification.stats.totalRefills = (user.gamification.stats.totalRefills || 0) + 1;
            
            if (wasAtZero) {
                user.gamification.stats.accountBlown = true;
            }

            await user.save();

            return await this.checkAllAchievements(userId);

        } catch (error) {
            console.error('[Achievements] Error recording refill:', error);
            throw error;
        }
    }

    /**
     * Update social stats (followers/following)
     */
    static async updateSocialStats(userId, followersCount, followingCount) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) user.gamification = {};
            if (!user.gamification.stats) user.gamification.stats = {};

            user.gamification.stats.followersCount = followersCount;
            user.gamification.stats.followingCount = followingCount;

            await user.save();

            return await this.checkAllAchievements(userId);

        } catch (error) {
            console.error('[Achievements] Error updating social stats:', error);
            throw error;
        }
    }

    /**
     * Update prediction stats
     */
    static async updatePredictionStats(userId, predictionsCreated, correctPredictions) {
        try {
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Ensure gamification is initialized
            if (!user.gamification) user.gamification = {};
            if (!user.gamification.stats) user.gamification.stats = {};

            const accuracy = predictionsCreated > 0 
                ? (correctPredictions / predictionsCreated) * 100 
                : 0;

            user.gamification.stats.predictionsCreated = predictionsCreated;
            user.gamification.stats.correctPredictions = correctPredictions;
            user.gamification.stats.predictionAccuracy = accuracy;

            await user.save();

            return await this.checkAllAchievements(userId);

        } catch (error) {
            console.error('[Achievements] Error updating prediction stats:', error);
            throw error;
        }
    }

    /**
     * Get user's achievement progress
     */
    static async getAchievementProgress(userId) {
        try {
            const user = await User.findById(userId).select('gamification').lean();
            
            if (!user || !user.gamification) {
                return {
                    total: Object.keys(ACHIEVEMENTS).length,
                    unlocked: 0,
                    percentage: 0,
                    byRarity: {
                        common: { total: 0, unlocked: 0 },
                        rare: { total: 0, unlocked: 0 },
                        epic: { total: 0, unlocked: 0 },
                        legendary: { total: 0, unlocked: 0 }
                    }
                };
            }

            const total = Object.keys(ACHIEVEMENTS).length;
            const unlocked = user.gamification.achievements?.length || 0;
            const unlockedIds = (user.gamification.achievements || []).map(a => a.id);

            // Count by rarity
            const byRarity = {
                common: { total: 0, unlocked: 0 },
                rare: { total: 0, unlocked: 0 },
                epic: { total: 0, unlocked: 0 },
                legendary: { total: 0, unlocked: 0 }
            };

            for (const achievement of Object.values(ACHIEVEMENTS)) {
                byRarity[achievement.rarity].total++;
                if (unlockedIds.includes(achievement.id)) {
                    byRarity[achievement.rarity].unlocked++;
                }
            }

            return {
                total,
                unlocked,
                percentage: Math.round((unlocked / total) * 100),
                byRarity
            };

        } catch (error) {
            console.error('[Achievements] Error getting progress:', error);
            throw error;
        }
    }
}

module.exports = AchievementService;