// server/services/gamificationService.js - UPDATED TO USE USER.GAMIFICATION
const User = require('../models/User');
const ACHIEVEMENTS = require('../config/achievements');
const NotificationService = require('./notificationService');

class GamificationService {
    // Initialize gamification for new user (User model does this automatically)
    static async initializeUser(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // User model automatically initializes gamification on save
            if (!user.gamification || !user.gamification.nexusCoins) {
                user.gamification = user.gamification || {};
                user.gamification.nexusCoins = 100; // Welcome bonus
                user.gamification.loginStreak = 1;
                user.gamification.lastLoginDate = new Date();
                await user.save();
                
                console.log(`[Gamification] Initialized for user ${userId}`);
                
                // Welcome notification
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Welcome to Nexus Signal! 🚀',
                        'You received 100 Nexus Coins to get started. Start trading and level up!'
                    );
                } catch (e) { /* ignore notification errors */ }
            }
            
            return user.gamification;
        } catch (error) {
            console.error('[Gamification] Init error:', error);
            throw error;
        }
    }

    // Award XP
    static async awardXP(userId, amount, reason = '') {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const oldLevel = user.gamification.level || 1;
            
            // Use User model's addXp method
            await user.addXp(amount, reason);
            
            console.log(`[Gamification] Awarded ${amount} XP to user ${userId} for: ${reason}`);
            
            const newLevel = user.gamification.level || 1;
            
            // Check if leveled up
            if (newLevel > oldLevel) {
                console.log(`[Gamification] 🎉 User ${userId} leveled up to ${newLevel}!`);
                
                // Send level up notification
                try {
                    await NotificationService.notifyLevelUp(userId, {
                        oldLevel,
                        newLevel: newLevel,
                        rank: user.gamification.title,
                        coinReward: (newLevel - oldLevel) * 100
                    });
                } catch (e) { /* ignore notification errors */ }
            }
            
            return {
                xp: user.gamification.xp,
                level: newLevel,
                leveledUp: newLevel > oldLevel,
                newLevel: newLevel > oldLevel ? newLevel : null
            };
        } catch (error) {
            console.error('[Gamification] Award XP error:', error);
            throw error;
        }
    }

    // Award coins
    static async awardCoins(userId, amount, reason = '') {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            // Use User model's addCoins method
            await user.addCoins(amount, reason);

            console.log(`[Gamification] Awarded ${amount} coins to user ${userId} for: ${reason}`);
            
            // Notify about coin reward
            if (amount >= 100) {
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Nexus Coins Earned! 💰',
                        `You earned ${amount} Nexus Coins for: ${reason}`
                    );
                } catch (e) { /* ignore notification errors */ }
            }
            
            return user.gamification;
        } catch (error) {
            console.error('[Gamification] Award coins error:', error);
            throw error;
        }
    }

    // Check and award achievements
    static async checkAchievements(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return [];

            const newAchievements = [];
            const unlockedIds = (user.gamification.achievements || []).map(a => a.id);

            // Check each achievement
            for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
                try {
                    // Skip if not a valid achievement object
                    if (!achievement || typeof achievement !== 'object') continue;
                    if (typeof achievement === 'function') continue;
                    if (!achievement.id || !achievement.check) continue;
                    
                    // Skip if already unlocked
                    if (unlockedIds.includes(achievement.id)) continue;

                    // Check if requirements met
                    const unlocked = achievement.check(user.gamification.stats || {}, user.gamification);
                    
                    if (unlocked) {
                        // Award achievement
                        if (!user.gamification.achievements) user.gamification.achievements = [];
                        
                        user.gamification.achievements.push({
                            id: achievement.id,
                            name: achievement.name,
                            description: achievement.description,
                            icon: achievement.icon,
                            points: achievement.points,
                            rarity: achievement.rarity,
                            unlockedAt: new Date()
                        });

                        // Award XP and coins using User model methods
                        await user.addXp(achievement.points, `Achievement: ${achievement.name}`);
                        await user.addCoins(achievement.points, `Achievement: ${achievement.name}`);

                        newAchievements.push(achievement);
                        
                        console.log(`[Gamification] 🏆 Achievement unlocked for user ${userId}: ${achievement.name}`);
                        
                        // Send achievement notification
                        try {
                            await NotificationService.notifyAchievementUnlocked(userId, {
                                name: achievement.name,
                                description: achievement.description,
                                icon: achievement.icon,
                                points: achievement.points,
                                rarity: achievement.rarity
                            });
                        } catch (e) { /* ignore notification errors */ }
                    }
                } catch (achievementError) {
                    console.error(`[Gamification] Error checking achievement ${key}:`, achievementError.message);
                }
            }

            if (newAchievements.length > 0) {
                await user.save();
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
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Use User model's checkLoginStreak method
            const result = await user.checkLoginStreak();
            
            const streak = user.gamification.loginStreak || 1;
            
            console.log(`[Gamification] Login streak for ${userId}: ${streak} days`);
            
            // Award XP for streak
            if (result.isNewDay) {
                const xpReward = streak * 10;
                await this.awardXP(userId, xpReward, `${streak} day login streak`);
                
                // Send streak notification
                if (streak % 7 === 0) {
                    try {
                        await NotificationService.notifySystem(
                            userId,
                            `${streak} Day Streak! 🔥`,
                            `Amazing! You've logged in for ${streak} consecutive days. Keep it up!`
                        );
                    } catch (e) { /* ignore */ }
                }
                
                // Check for streak achievements
                await this.checkAchievements(userId);
            }
            
            // Notify about broken streak
            if (result.broken && result.oldStreak > 7) {
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Streak Reset 💔',
                        `Your ${result.oldStreak} day login streak was broken. Start a new streak today!`
                    );
                } catch (e) { /* ignore */ }
            }
            
            return {
                streak,
                isNew: result.isNewDay,
                broken: result.broken || false
            };
        } catch (error) {
            console.error('[Gamification] Update streak error:', error);
            throw error;
        }
    }

    // Track trade
    static async trackTrade(userId, profitable, profit) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            // Initialize stats if needed
            if (!user.gamification.stats) user.gamification.stats = {};
            
            // Update stats
            user.gamification.stats.totalTrades = (user.gamification.stats.totalTrades || 0) + 1;
            
            if (profitable !== null) {
                if (profitable) {
                    user.gamification.stats.profitableTrades = (user.gamification.stats.profitableTrades || 0) + 1;
                    user.gamification.stats.totalProfit = (user.gamification.stats.totalProfit || 0) + profit;
                    user.gamification.profitStreak = (user.gamification.profitStreak || 0) + 1;
                    
                    if (user.gamification.profitStreak > (user.gamification.maxProfitStreak || 0)) {
                        user.gamification.maxProfitStreak = user.gamification.profitStreak;
                    }
                    
                    // Send profitable trade notification
                    if (profit >= 100) {
                        try {
                            await NotificationService.notifyTradeProfitable(userId, {
                                symbol: 'Stock',
                                profit
                            });
                        } catch (e) { /* ignore */ }
                    }
                } else {
                    user.gamification.profitStreak = 0;
                    user.gamification.stats.losingTrades = (user.gamification.stats.losingTrades || 0) + 1;
                    
                    // Send loss notification (only for significant losses)
                    if (profit <= -100) {
                        try {
                            await NotificationService.notifyTradeLoss(userId, {
                                symbol: 'Stock',
                                profit
                            });
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            await user.save();

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
            const user = await User.findById(userId);
            if (!user) return;

            // Initialize stats if needed
            if (!user.gamification.stats) user.gamification.stats = {};
            
            user.gamification.stats.predictionsCreated = (user.gamification.stats.predictionsCreated || 0) + 1;
            
            if (correct === true) {
                user.gamification.stats.correctPredictions = (user.gamification.stats.correctPredictions || 0) + 1;
                
                // Send correct prediction notification
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Prediction Correct! 🎯',
                        'Your AI prediction was accurate! Great call!'
                    );
                } catch (e) { /* ignore */ }
            } else if (correct === false) {
                // Send incorrect prediction notification (optional)
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Prediction Missed',
                        "This prediction didn't hit the mark. Better luck next time!"
                    );
                } catch (e) { /* ignore */ }
            }

            await user.save();

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
            const user = await User.findById(userId);
            if (!user) return;

            // Initialize stats if needed
            if (!user.gamification.stats) user.gamification.stats = {};
            
            const oldValue = user.gamification.stats.portfolioValue || 0;
            user.gamification.stats.portfolioValue = portfolioValue;
            user.gamification.stats.stocksOwned = stocksOwned;
            await user.save();

            // Check for significant portfolio changes
            if (oldValue > 0) {
                const percentChange = ((portfolioValue - oldValue) / oldValue) * 100;
                
                // Notify about significant gains
                if (percentChange >= 10) {
                    try {
                        await NotificationService.notifyPortfolioGain(userId, {
                            percentChange: percentChange.toFixed(2),
                            oldValue,
                            newValue: portfolioValue
                        });
                    } catch (e) { /* ignore */ }
                }
                // Notify about significant losses
                else if (percentChange <= -10) {
                    try {
                        await NotificationService.notifyPortfolioLoss(userId, {
                            percentChange: Math.abs(percentChange).toFixed(2),
                            oldValue,
                            newValue: portfolioValue
                        });
                    } catch (e) { /* ignore */ }
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
            const user = await User.findById(userId);
            if (!user) return;

            // Check if current challenge is still valid
            if (user.gamification.dailyChallenge && 
                user.gamification.dailyChallenge.expiresAt > new Date() &&
                !user.gamification.dailyChallenge.completed) {
                return user.gamification.dailyChallenge;
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
            
            user.gamification.dailyChallenge = {
                challenge: selected.challenge,
                progress: 0,
                target: selected.target,
                reward: selected.reward,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                completed: false
            };

            await user.save();
            
            // Notify about new daily challenge
            try {
                await NotificationService.notifySystem(
                    userId,
                    'New Daily Challenge! 🎯',
                    `${selected.challenge} - Reward: ${selected.reward} Nexus Coins`
                );
            } catch (e) { /* ignore */ }
            
            return user.gamification.dailyChallenge;

        } catch (error) {
            console.error('[Gamification] Generate challenge error:', error);
        }
    }

    // Complete daily challenge
    static async checkDailyChallenge(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.gamification.dailyChallenge) return;

            const challenge = user.gamification.dailyChallenge;
            
            // Check if already completed or expired
            if (challenge.completed || challenge.expiresAt < new Date()) {
                return;
            }

            // Update progress based on current stats
            const currentProgress = (user.gamification.stats && user.gamification.stats[challenge.trackField]) || 0;
            
            if (currentProgress >= challenge.target) {
                challenge.completed = true;
                challenge.progress = challenge.target;
                
                // Award coins
                await user.addCoins(challenge.reward, 'Daily challenge completed');
                
                await user.save();
                
                // Send completion notification
                try {
                    await NotificationService.notifySystem(
                        userId,
                        'Challenge Completed! 🎉',
                        `You completed "${challenge.challenge}" and earned ${challenge.reward} Nexus Coins!`
                    );
                } catch (e) { /* ignore */ }
                
                console.log(`[Gamification] User ${userId} completed daily challenge!`);
            }

        } catch (error) {
            console.error('[Gamification] Check daily challenge error:', error);
        }
    }

    // Get leaderboard
    static async getLeaderboard(type = 'xp', limit = 10) {
        try {
            let sortField = 'gamification.totalXpEarned';
            
            switch (type) {
                case 'xp':
                    sortField = 'gamification.totalXpEarned';
                    break;
                case 'coins':
                    sortField = 'gamification.nexusCoins';
                    break;
                case 'streak':
                    sortField = 'gamification.loginStreak';
                    break;
                case 'trades':
                    sortField = 'gamification.stats.totalTrades';
                    break;
                case 'profit':
                    sortField = 'gamification.stats.totalProfit';
                    break;
                default:
                    sortField = 'gamification.totalXpEarned';
            }

            const users = await User.find()
                .sort({ [sortField]: -1 })
                .limit(limit)
                .select('username email profile.avatar gamification vault')
                .lean();

            return users.map(user => ({
                user: user._id,
                username: user.username,
                email: user.email,
                avatar: user.profile?.avatar,
                xp: user.gamification?.totalXpEarned || 0,
                level: user.gamification?.level || 1,
                nexusCoins: user.gamification?.nexusCoins || 0,
                loginStreak: user.gamification?.loginStreak || 0,
                stats: user.gamification?.stats || {},
                equippedBorder: user.vault?.equippedBorder || 'border-bronze',
                equippedBadges: user.vault?.equippedBadges || []
            }));

        } catch (error) {
            console.error('[Gamification] Get leaderboard error:', error);
            return [];
        }
    }
}

module.exports = GamificationService;