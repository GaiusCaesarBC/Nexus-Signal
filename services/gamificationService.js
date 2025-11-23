// server/services/gamificationService.js - WITH FULL NOTIFICATION INTEGRATION
const Gamification = require('../models/Gamification');
const ACHIEVEMENTS = require('../config/achievements');
const NotificationService = require('./notificationService');

class GamificationService {
    // Initialize gamification for new user
    static async initializeUser(userId) {
        try {
            const existing = await Gamification.findOne({ user: userId });
            if (existing) return existing;

            const gamification = new Gamification({
                user: userId,
                xp: 0,
                level: 1,
                rank: 'Rookie Trader',
                nexusCoins: 100, // Welcome bonus
                loginStreak: 1,
                lastLoginDate: new Date()
            });

            await gamification.save();
            console.log(`[Gamification] Initialized for user ${userId}`);
            
            // Welcome notification
            await NotificationService.notifySystem(
                userId,
                'Welcome to Nexus Signal! 🚀',
                'You received 100 Nexus Coins to get started. Start trading and level up!'
            );
            
            return gamification;
        } catch (error) {
            console.error('[Gamification] Init error:', error);
            throw error;
        }
    }

    // Award XP
    static async awardXP(userId, amount, reason = '') {
        try {
            let gamification = await Gamification.findOne({ user: userId });
            if (!gamification) {
                gamification = await this.initializeUser(userId);
            }

            const oldLevel = gamification.level;
            const result = await gamification.addXP(amount, reason);
            
            console.log(`[Gamification] Awarded ${amount} XP to user ${userId} for: ${reason}`);
            
            // Check if leveled up
            if (result.leveledUp) {
                console.log(`[Gamification] 🎉 User ${userId} leveled up to ${result.newLevel}!`);
                
                // Send level up notification
                await NotificationService.notifyLevelUp(userId, {
                    oldLevel,
                    newLevel: result.newLevel,
                    rank: gamification.rank,
                    coinReward: (result.newLevel - oldLevel) * 100
                });
            }
            
            return result;
        } catch (error) {
            console.error('[Gamification] Award XP error:', error);
            throw error;
        }
    }

    // Award coins
    static async awardCoins(userId, amount, reason = '') {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return;

            gamification.nexusCoins += amount;
            gamification.totalEarned += amount;
            await gamification.save();

            console.log(`[Gamification] Awarded ${amount} coins to user ${userId} for: ${reason}`);
            
            // Notify about coin reward
            if (amount >= 100) {
                await NotificationService.notifySystem(
                    userId,
                    'Nexus Coins Earned! 💰',
                    `You earned ${amount} Nexus Coins for: ${reason}`
                );
            }
            
            return gamification;
        } catch (error) {
            console.error('[Gamification] Award coins error:', error);
            throw error;
        }
    }

    // Check and award achievements
    static async checkAchievements(userId) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return [];

            const newAchievements = [];
            const unlockedIds = gamification.achievements.map(a => a.id);

            // Check each achievement
            for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
                // Skip if already unlocked
                if (unlockedIds.includes(achievement.id)) continue;

                // Check if requirements met
                const unlocked = achievement.check(gamification.stats, gamification);
                
                if (unlocked) {
                    // Award achievement
                    gamification.achievements.push({
                        id: achievement.id,
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        points: achievement.points,
                        rarity: achievement.rarity,
                        unlockedAt: new Date()
                    });

                    // Award XP and coins
                    await gamification.addXP(achievement.points, `Achievement: ${achievement.name}`);
                    gamification.nexusCoins += achievement.points;
                    gamification.totalEarned += achievement.points;

                    newAchievements.push(achievement);
                    
                    console.log(`[Gamification] 🏆 Achievement unlocked for user ${userId}: ${achievement.name}`);
                    
                    // Send achievement notification
                    await NotificationService.notifyAchievementUnlocked(userId, {
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        points: achievement.points,
                        rarity: achievement.rarity
                    });
                }
            }

            if (newAchievements.length > 0) {
                await gamification.save();
            }

            return newAchievements;
        } catch (error) {
            console.error('[Gamification] Check achievements error:', error);
            return [];
        }
    }

    // Update login streak
    static async updateLoginStreak(userId) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return await this.initializeUser(userId);

            const now = new Date();
            const lastLogin = gamification.lastLoginDate;
            
            if (!lastLogin) {
                // First login
                gamification.loginStreak = 1;
                gamification.lastLoginDate = now;
                gamification.stats.daysActive += 1;
                await gamification.save();
                return { streak: 1, isNew: true };
            }

            const hoursSinceLastLogin = (now - lastLogin) / (1000 * 60 * 60);
            
            if (hoursSinceLastLogin < 24) {
                // Same day, no change
                return { streak: gamification.loginStreak, isNew: false };
            } else if (hoursSinceLastLogin < 48) {
                // Next day, increment streak
                gamification.loginStreak += 1;
                gamification.lastLoginDate = now;
                gamification.stats.daysActive += 1;
                
                if (gamification.loginStreak > gamification.maxLoginStreak) {
                    gamification.maxLoginStreak = gamification.loginStreak;
                }
                
                await gamification.save();
                
                // Award XP for streak
                const xpReward = gamification.loginStreak * 10;
                await this.awardXP(userId, xpReward, `${gamification.loginStreak} day login streak`);
                
                // Send streak notification
                if (gamification.loginStreak % 7 === 0) {
                    await NotificationService.notifySystem(
                        userId,
                        `${gamification.loginStreak} Day Streak! 🔥`,
                        `Amazing! You've logged in for ${gamification.loginStreak} consecutive days. Keep it up!`
                    );
                }
                
                // Check for streak achievements
                await this.checkAchievements(userId);
                
                return { streak: gamification.loginStreak, isNew: true };
            } else {
                // Streak broken
                const oldStreak = gamification.loginStreak;
                gamification.loginStreak = 1;
                gamification.lastLoginDate = now;
                gamification.stats.daysActive += 1;
                await gamification.save();
                
                // Notify about broken streak
                if (oldStreak > 7) {
                    await NotificationService.notifySystem(
                        userId,
                        'Streak Reset 💔',
                        `Your ${oldStreak} day login streak was broken. Start a new streak today!`
                    );
                }
                
                return { streak: 1, isNew: true, broken: true };
            }
        } catch (error) {
            console.error('[Gamification] Update streak error:', error);
            throw error;
        }
    }

    // Track trade
    static async trackTrade(userId, profitable, profit) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return;

            // Update stats
            gamification.stats.totalTrades += 1;
            
            if (profitable !== null) {
                if (profitable) {
                    gamification.stats.profitableTrades += 1;
                    gamification.stats.totalProfit += profit;
                    gamification.profitStreak += 1;
                    
                    if (gamification.profitStreak > gamification.maxProfitStreak) {
                        gamification.maxProfitStreak = gamification.profitStreak;
                    }
                    
                    // Send profitable trade notification
                    if (profit >= 100) {
                        await NotificationService.notifyTradeProfitable(userId, {
                            symbol: 'Stock',
                            profit
                        });
                    }
                } else {
                    gamification.profitStreak = 0;
                    
                    // Send loss notification (only for significant losses)
                    if (profit <= -100) {
                        await NotificationService.notifyTradeLoss(userId, {
                            symbol: 'Stock',
                            profit
                        });
                    }
                }
            }

            await gamification.save();

            // Award XP
            let xpAmount = 10; // Base XP for any trade
            if (profitable) {
                xpAmount += 20; // Bonus for profitable trade
                xpAmount += Math.floor(Math.abs(profit) / 10); // Bonus based on profit
            }
            
            await this.awardXP(userId, xpAmount, profitable ? 'Profitable trade' : 'Trade completed');

            // Check achievements
            await this.checkAchievements(userId);

        } catch (error) {
            console.error('[Gamification] Track trade error:', error);
        }
    }

    // Track prediction
    static async trackPrediction(userId, correct = null) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return;

            gamification.stats.predictionsCreated += 1;
            
            if (correct === true) {
                gamification.stats.correctPredictions += 1;
                
                // Send correct prediction notification
                await NotificationService.notifySystem(
                    userId,
                    'Prediction Correct! 🎯',
                    'Your AI prediction was accurate! Great call!'
                );
            } else if (correct === false) {
                // Send incorrect prediction notification (optional)
                await NotificationService.notifySystem(
                    userId,
                    'Prediction Missed',
                    "This prediction didn't hit the mark. Better luck next time!"
                );
            }

            await gamification.save();

            // Award XP
            let xpAmount = 15; // Base XP for creating prediction
            if (correct === true) {
                xpAmount += 35; // Bonus for correct prediction
            }
            
            await this.awardXP(userId, xpAmount, correct === true ? 'Correct prediction' : 'Prediction created');

            // Check achievements
            await this.checkAchievements(userId);

        } catch (error) {
            console.error('[Gamification] Track prediction error:', error);
        }
    }

    // Update portfolio stats
    static async updatePortfolioStats(userId, portfolioValue, stocksOwned) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return;

            const oldValue = gamification.stats.portfolioValue || 0;
            gamification.stats.portfolioValue = portfolioValue;
            gamification.stats.stocksOwned = stocksOwned;
            await gamification.save();

            // Check for significant portfolio changes
            if (oldValue > 0) {
                const percentChange = ((portfolioValue - oldValue) / oldValue) * 100;
                
                // Notify about significant gains
                if (percentChange >= 10) {
                    await NotificationService.notifyPortfolioGain(userId, {
                        percentChange: percentChange.toFixed(2),
                        oldValue,
                        newValue: portfolioValue
                    });
                }
                // Notify about significant losses
                else if (percentChange <= -10) {
                    await NotificationService.notifyPortfolioLoss(userId, {
                        percentChange: Math.abs(percentChange).toFixed(2),
                        oldValue,
                        newValue: portfolioValue
                    });
                }
            }

            // Check achievements
            await this.checkAchievements(userId);

        } catch (error) {
            console.error('[Gamification] Update portfolio stats error:', error);
        }
    }

    // Generate daily challenge
    static async generateDailyChallenge(userId) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification) return;

            // Check if current challenge is still valid
            if (gamification.dailyChallenge && 
                gamification.dailyChallenge.expiresAt > new Date() &&
                !gamification.dailyChallenge.completed) {
                return gamification.dailyChallenge;
            }

            // Generate new challenge
            const challenges = [
                { challenge: 'Make 3 trades today', target: 3, reward: 100, trackField: 'totalTrades' },
                { challenge: 'Make 1 profitable trade', target: 1, reward: 150, trackField: 'profitableTrades' },
                { challenge: 'Create 2 predictions', target: 2, reward: 100, trackField: 'predictionsCreated' },
                { challenge: 'Add a new stock to portfolio', target: 1, reward: 75, trackField: 'stocksOwned' },
                { challenge: 'Earn $100 in profit', target: 100, reward: 200, trackField: 'totalProfit' }
            ];

            const selected = challenges[Math.floor(Math.random() * challenges.length)];
            
            gamification.dailyChallenge = {
                challenge: selected.challenge,
                progress: 0,
                target: selected.target,
                reward: selected.reward,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                completed: false
            };

            await gamification.save();
            
            // Notify about new daily challenge
            await NotificationService.notifySystem(
                userId,
                'New Daily Challenge! 🎯',
                `${selected.challenge} - Reward: ${selected.reward} Nexus Coins`
            );
            
            return gamification.dailyChallenge;

        } catch (error) {
            console.error('[Gamification] Generate challenge error:', error);
        }
    }

    // Complete daily challenge
    static async checkDailyChallenge(userId) {
        try {
            const gamification = await Gamification.findOne({ user: userId });
            if (!gamification || !gamification.dailyChallenge) return;

            const challenge = gamification.dailyChallenge;
            
            // Check if already completed or expired
            if (challenge.completed || challenge.expiresAt < new Date()) {
                return;
            }

            // Update progress based on current stats
            // This is a simplified version - you'd want to track progress more precisely
            const currentProgress = gamification.stats[challenge.trackField] || 0;
            
            if (currentProgress >= challenge.target) {
                challenge.completed = true;
                challenge.progress = challenge.target;
                
                // Award coins
                gamification.nexusCoins += challenge.reward;
                gamification.totalEarned += challenge.reward;
                
                await gamification.save();
                
                // Send completion notification
                await NotificationService.notifySystem(
                    userId,
                    'Challenge Completed! 🎉',
                    `You completed "${challenge.challenge}" and earned ${challenge.reward} Nexus Coins!`
                );
                
                console.log(`[Gamification] User ${userId} completed daily challenge!`);
            }

        } catch (error) {
            console.error('[Gamification] Check daily challenge error:', error);
        }
    }

    // Get leaderboard
    static async getLeaderboard(type = 'xp', limit = 10) {
        try {
            let sortField = {};
            
            switch (type) {
                case 'xp':
                    sortField = { xp: -1 };
                    break;
                case 'coins':
                    sortField = { nexusCoins: -1 };
                    break;
                case 'streak':
                    sortField = { loginStreak: -1 };
                    break;
                case 'trades':
                    sortField = { 'stats.totalTrades': -1 };
                    break;
                case 'profit':
                    sortField = { 'stats.totalProfit': -1 };
                    break;
                default:
                    sortField = { xp: -1 };
            }

            const leaderboard = await Gamification.find()
                .sort(sortField)
                .limit(limit)
                .populate('user', 'username email profile.avatar')
                .lean();

            return leaderboard;

        } catch (error) {
            console.error('[Gamification] Get leaderboard error:', error);
            return [];
        }
    }
}

module.exports = GamificationService;