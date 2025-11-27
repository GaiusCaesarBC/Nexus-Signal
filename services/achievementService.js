// server/services/achievementService.js - Achievement Checking & Unlocking Service

const Gamification = require('../models/Gamification');
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
            let gamification = await Gamification.findOne({ user: userId });
            
            if (!gamification) {
                // Initialize gamification for new user
                gamification = new Gamification({ user: userId });
                await gamification.save();
            }

            // Merge stats from different sources
            const stats = {
                ...gamification.stats.toObject(),
                ...additionalStats
            };

            const newlyUnlocked = [];

            // Check each achievement
            for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
                // Skip if already unlocked
                if (gamification.hasAchievement(achievement.id)) {
                    continue;
                }

                // Check if achievement condition is met
                try {
                    const isUnlocked = achievement.check(stats, gamification);
                    
                    if (isUnlocked) {
                        // Unlock the achievement
                        gamification.addAchievement(achievement);
                        
                        // Add XP reward
                        gamification.xp += achievement.points;
                        
                        // Add coin reward based on rarity
                        const coinReward = this.getCoinReward(achievement.rarity);
                        gamification.nexusCoins += coinReward;
                        gamification.totalEarned += coinReward;

                        newlyUnlocked.push({
                            ...achievement,
                            coinReward
                        });

                        console.log(`[Achievements] User ${userId} unlocked: ${achievement.name}`);
                    }
                } catch (error) {
                    console.error(`[Achievements] Error checking ${achievement.id}:`, error.message);
                }
            }

            // Check for level up after XP gains
            const oldLevel = gamification.level;
            const newLevel = gamification.calculateLevel();
            
            if (newLevel > oldLevel) {
                gamification.level = newLevel;
                gamification.rank = gamification.getRank();
                
                // Level up coin bonus
                const levelUpBonus = newLevel * 100;
                gamification.nexusCoins += levelUpBonus;
                gamification.totalEarned += levelUpBonus;
            }

            // Save all changes
            await gamification.save();

            // Create notifications for new achievements
            for (const achievement of newlyUnlocked) {
                try {
                    await this.createAchievementNotification(userId, achievement);
                } catch (error) {
                    console.error('[Achievements] Failed to create notification:', error.message);
                }
            }

            return {
                newlyUnlocked,
                leveledUp: newLevel > oldLevel,
                newLevel: newLevel > oldLevel ? newLevel : null,
                newRank: newLevel > oldLevel ? gamification.rank : null
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
            let gamification = await Gamification.findOne({ user: userId });
            
            if (!gamification) {
                gamification = new Gamification({ user: userId });
            }

            // Update stats from paper trading account
            gamification.stats.totalTrades = paperTradingAccount.totalTrades || 0;
            gamification.stats.profitableTrades = paperTradingAccount.winningTrades || 0;
            gamification.stats.losingTrades = paperTradingAccount.losingTrades || 0;
            gamification.stats.totalProfit = paperTradingAccount.totalProfitLoss || 0;
            gamification.stats.winRate = paperTradingAccount.winRate || 0;
            gamification.stats.portfolioValue = paperTradingAccount.portfolioValue || 100000;
            gamification.stats.stocksOwned = paperTradingAccount.positions?.length || 0;
            gamification.stats.biggestWin = paperTradingAccount.biggestWin || 0;
            gamification.stats.biggestLoss = paperTradingAccount.biggestLoss || 0;

            // Update streaks
            if (paperTradingAccount.currentStreak > gamification.maxProfitStreak) {
                gamification.maxProfitStreak = paperTradingAccount.currentStreak;
                gamification.stats.maxProfitStreak = paperTradingAccount.currentStreak;
            }
            if (paperTradingAccount.bestStreak > gamification.stats.maxProfitStreak) {
                gamification.stats.maxProfitStreak = paperTradingAccount.bestStreak;
            }

            await gamification.save();

            // Check achievements with updated stats
            return await this.checkAllAchievements(userId, gamification.stats.toObject());

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
            let gamification = await Gamification.findOne({ user: userId });
            
            if (!gamification) {
                gamification = new Gamification({ user: userId });
            }

            // Record the trade
            gamification.recordTrade(tradeData);
            
            // Update daily stats
            const today = new Date().toDateString();
            const lastDate = gamification.dailyStats.date?.toDateString();
            
            if (today !== lastDate) {
                gamification.dailyStats = {
                    date: new Date(),
                    tradesCount: 1,
                    profit: tradeData.profit
                };
            } else {
                gamification.dailyStats.tradesCount++;
                gamification.dailyStats.profit += tradeData.profit;
                
                // Update max trades in day
                if (gamification.dailyStats.tradesCount > gamification.stats.maxTradesInDay) {
                    gamification.stats.maxTradesInDay = gamification.dailyStats.tradesCount;
                }
            }

            await gamification.save();

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
            let gamification = await Gamification.findOne({ user: userId });
            
            if (!gamification) {
                gamification = new Gamification({ user: userId });
            }

            gamification.stats.totalRefills++;
            
            if (wasAtZero) {
                gamification.stats.accountBlown = true;
            }

            await gamification.save();

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
            await Gamification.findOneAndUpdate(
                { user: userId },
                {
                    $set: {
                        'stats.followersCount': followersCount,
                        'stats.followingCount': followingCount
                    }
                },
                { upsert: true }
            );

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
            const accuracy = predictionsCreated > 0 
                ? (correctPredictions / predictionsCreated) * 100 
                : 0;

            await Gamification.findOneAndUpdate(
                { user: userId },
                {
                    $set: {
                        'stats.predictionsCreated': predictionsCreated,
                        'stats.correctPredictions': correctPredictions,
                        'stats.predictionAccuracy': accuracy
                    }
                },
                { upsert: true }
            );

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
            const gamification = await Gamification.findOne({ user: userId });
            
            if (!gamification) {
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
            const unlocked = gamification.achievements.length;

            // Count by rarity
            const byRarity = {
                common: { total: 0, unlocked: 0 },
                rare: { total: 0, unlocked: 0 },
                epic: { total: 0, unlocked: 0 },
                legendary: { total: 0, unlocked: 0 }
            };

            for (const achievement of Object.values(ACHIEVEMENTS)) {
                byRarity[achievement.rarity].total++;
                if (gamification.hasAchievement(achievement.id)) {
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