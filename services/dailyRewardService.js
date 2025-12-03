// server/services/dailyRewardService.js - UPDATED TO USE ONLY USER.GAMIFICATION

const User = require('../models/User');
const {
    REWARD_TIERS,
    JACKPOT_REWARDS,
    getRewardTier,
    getMilestone,
    getRewardWeights,
    weightedRandom,
    randomItem,
    randomInRange,
    isJackpotDay
} = require('../config/dailyRewards');
const GamificationService = require('./gamificationService');
const NotificationService = require('./notificationService');

class DailyRewardService {
    
    // Check if user can claim daily reward
    static async canClaimReward(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return { canClaim: false, reason: 'User not found' };
            
            user.initializeGamification();
            
            // Check if already claimed today
            if (!user.gamification.lastRewardClaimed) {
                return { canClaim: true, isFirstClaim: true };
            }
            
            const lastClaim = new Date(user.gamification.lastRewardClaimed);
            const now = new Date();
            
            // Check if it's a new day
            const isNewDay = now.toDateString() !== lastClaim.toDateString();
            
            if (!isNewDay) {
                const nextClaimTime = new Date(lastClaim);
                nextClaimTime.setDate(nextClaimTime.getDate() + 1);
                nextClaimTime.setHours(0, 0, 0, 0);
                
                return {
                    canClaim: false,
                    reason: 'Already claimed today',
                    nextClaimTime,
                    hoursUntilNext: Math.ceil((nextClaimTime - now) / (1000 * 60 * 60))
                };
            }
            
            return { canClaim: true, isFirstClaim: false };
            
        } catch (error) {
            console.error('[DailyReward] Error checking claim status:', error);
            throw error;
        }
    }
    
    // Generate reward based on streak
    static generateReward(user) {
        const streak = user.gamification.loginStreak || 1;
        
        console.log(`[DailyReward] Generating reward for streak: ${streak}`);
        
        // Check if this is a milestone day
        const milestone = getMilestone(streak);
        if (milestone) {
            return this.generateMilestoneReward(streak, milestone);
        }
        
        // Check for jackpot
        if (isJackpotDay()) {
            console.log('[DailyReward] 🎰 JACKPOT DAY!');
            return this.generateJackpotReward(streak);
        }
        
        // Generate regular daily reward
        return this.generateRegularReward(streak);
    }
    
    // Generate regular daily reward
    static generateRegularReward(streak) {
        const tier = getRewardTier(streak);
        const weights = getRewardWeights(streak);
        const rewardType = weightedRandom(weights);
        
        console.log(`[DailyReward] Tier: ${tier}, Type: ${rewardType}`);
        
        const tierData = REWARD_TIERS[tier];
        const reward = {
            type: 'daily',
            streak,
            tier,
            items: []
        };
        
        // Streak multiplier (increases reward value)
        const multiplier = Math.min(1 + (streak * 0.02), 2.5); // Max 2.5x
        
        switch (rewardType) {
            case 'xp':
                const baseXp = randomInRange(tierData.xp.min, tierData.xp.max);
                reward.xp = Math.floor(baseXp * multiplier);
                reward.primaryReward = 'xp';
                break;
                
            case 'coins':
                const baseCoins = randomInRange(tierData.coins.min, tierData.coins.max);
                reward.coins = Math.floor(baseCoins * multiplier);
                reward.primaryReward = 'coins';
                break;
                
            case 'item':
                // Give item + some coins
                const item = randomItem(tierData.items);
                reward.items.push(item);
                reward.coins = Math.floor(randomInRange(50, 150) * multiplier);
                reward.primaryReward = 'item';
                break;
        }
        
        // Small bonus XP/coins on every claim
        if (!reward.xp) reward.xp = randomInRange(10, 30);
        if (!reward.coins) reward.coins = randomInRange(20, 50);
        
        return reward;
    }
    
    // Generate milestone reward
    static generateMilestoneReward(streak, milestone) {
        console.log(`[DailyReward] 🎉 MILESTONE: ${milestone.name}`);
        
        const tierData = REWARD_TIERS[milestone.tier];
        const guaranteed = tierData.guaranteed;
        
        const reward = {
            type: 'milestone',
            streak,
            milestoneName: milestone.name,
            tier: milestone.tier,
            items: [],
            xp: guaranteed.xp,
            coins: guaranteed.coins
        };
        
        // Add guaranteed items
        if (guaranteed.badge) reward.items.push(guaranteed.badge);
        if (guaranteed.theme) reward.items.push(guaranteed.theme);
        if (guaranteed.border) reward.items.push(guaranteed.border);
        
        // Add bonus item from pool
        if (tierData.bonusPool && tierData.bonusPool.length > 0) {
            const bonusItem = randomItem(tierData.bonusPool);
            reward.items.push(bonusItem);
        }
        
        reward.primaryReward = 'milestone';
        
        return reward;
    }
    
    // Generate jackpot reward
    static generateJackpotReward(streak) {
        const tierData = JACKPOT_REWARDS;
        
        const reward = {
            type: 'jackpot',
            streak,
            tier: 'JACKPOT',
            items: [],
            xp: randomInRange(tierData.xp.min, tierData.xp.max),
            coins: randomInRange(tierData.coins.min, tierData.coins.max),
            primaryReward: 'jackpot'
        };
        
        // Add special jackpot item
        const specialItem = randomItem(tierData.specialItems);
        reward.items.push(specialItem);
        
        // Bonus: add another random item
        if (Math.random() < 0.5) {
            const bonusItem = randomItem(tierData.specialItems);
            if (bonusItem !== specialItem) {
                reward.items.push(bonusItem);
            }
        }
        
        return reward;
    }
    
    // Claim daily reward
    static async claimReward(userId) {
        try {
            console.log(`[DailyReward] Claiming reward for user: ${userId}`);
            
            // Check if can claim
            const claimStatus = await this.canClaimReward(userId);
            if (!claimStatus.canClaim) {
                return {
                    success: false,
                    error: claimStatus.reason,
                    nextClaimTime: claimStatus.nextClaimTime
                };
            }
            
            const user = await User.findById(userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }
            
            // Update login streak first
            const streakResult = await user.checkLoginStreak();
            console.log('[DailyReward] Streak updated:', streakResult);
            
            // Generate reward
            const reward = this.generateReward(user);
            console.log('[DailyReward] Generated reward:', reward);
            
            // Award XP
            if (reward.xp) {
                await user.addXp(reward.xp, `Daily Reward (Day ${reward.streak})`);
                console.log(`[DailyReward] Awarded ${reward.xp} XP`);
            }
            
            // Award Coins
            if (reward.coins) {
                await user.addCoins(reward.coins, `Daily Reward (Day ${reward.streak})`);
                console.log(`[DailyReward] Awarded ${reward.coins} coins`);
            }
            
            // Award Vault Items
            const newItems = [];
            if (reward.items && reward.items.length > 0) {
                user.initializeVault();
                
                for (const itemId of reward.items) {
                    if (!user.vault.ownedItems.includes(itemId)) {
                        user.vault.ownedItems.push(itemId);
                        newItems.push(itemId);
                        console.log(`[DailyReward] Unlocked vault item: ${itemId}`);
                    } else {
                        console.log(`[DailyReward] User already owns: ${itemId}, converting to coins`);
                        // Give bonus coins for duplicate items
                        const bonusCoins = 100;
                        user.gamification.nexusCoins += bonusCoins;
                        user.gamification.totalCoinsEarned += bonusCoins;
                        reward.coins = (reward.coins || 0) + bonusCoins;
                    }
                }
            }
            
            // Update last reward claimed
            user.gamification.lastRewardClaimed = new Date();
            user.gamification.rewardsClaimedCount = (user.gamification.rewardsClaimedCount || 0) + 1;
            
            await user.save();
            
            // Check for new achievements
            try {
                await GamificationService.checkAchievements(userId);
            } catch (achError) {
                console.warn('[DailyReward] Could not check achievements:', achError.message);
            }
            
            // Send notification
            try {
                const message = reward.type === 'milestone' 
                    ? `🎉 ${reward.milestoneName} Milestone! You earned ${reward.xp} XP, ${reward.coins} coins, and ${newItems.length} new items!`
                    : reward.type === 'jackpot'
                    ? `🎰 JACKPOT! You hit the jackpot and earned ${reward.xp} XP, ${reward.coins} coins, and special items!`
                    : `Daily Reward Claimed! +${reward.xp} XP, +${reward.coins} coins`;
                
                await NotificationService.notifySystem(userId, 'Daily Reward', message);
            } catch (notifError) {
                console.warn('[DailyReward] Could not send notification:', notifError.message);
            }
            
            // Calculate next milestone
            const nextMilestone = this.getNextMilestone(reward.streak);
            
            return {
                success: true,
                reward: {
                    ...reward,
                    newItems,
                    totalXp: user.gamification.totalXpEarned,
                    totalCoins: user.gamification.nexusCoins,
                    level: user.gamification.level,
                    streak: user.gamification.loginStreak,
                    nextMilestone
                },
                streakUpdated: streakResult.isNewDay
            };
            
        } catch (error) {
            console.error('[DailyReward] Error claiming reward:', error);
            throw error;
        }
    }
    
    // Get reward preview (without claiming)
    static async getRewardPreview(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return null;
            
            user.initializeGamification();
            
            const claimStatus = await this.canClaimReward(userId);
            const currentStreak = user.gamification.loginStreak || 0;
            const nextStreak = currentStreak + 1;
            
            // Preview what they would get
            const previewUser = { 
                gamification: { 
                    loginStreak: nextStreak 
                } 
            };
            const previewReward = this.generateReward(previewUser);
            
            const nextMilestone = this.getNextMilestone(currentStreak);
            
            return {
                canClaim: claimStatus.canClaim,
                currentStreak,
                nextStreak,
                preview: previewReward,
                nextMilestone,
                nextClaimTime: claimStatus.nextClaimTime,
                hoursUntilNext: claimStatus.hoursUntilNext
            };
            
        } catch (error) {
            console.error('[DailyReward] Error getting preview:', error);
            return null;
        }
    }
    
    // Get next milestone info
    static getNextMilestone(currentStreak) {
        const milestones = [7, 14, 30, 60, 90, 180, 365];
        const nextMilestone = milestones.find(m => m > currentStreak);
        
        if (nextMilestone) {
            const daysUntil = nextMilestone - currentStreak;
            return {
                day: nextMilestone,
                daysUntil,
                name: this.getMilestoneName(nextMilestone)
            };
        }
        
        return null;
    }
    
    // Get milestone name
    static getMilestoneName(day) {
        const names = {
            7: '1 Week Streak',
            14: '2 Week Streak',
            30: '1 Month Streak',
            60: '2 Month Streak',
            90: '3 Month Streak',
            180: '6 Month Streak',
            365: '1 Year Streak'
        };
        return names[day] || `${day} Day Streak`;
    }
    
    // Get reward history
    static async getRewardHistory(userId, limit = 30) {
        try {
            const user = await User.findById(userId);
            if (!user) return [];
            
            // This would require a separate RewardHistory model to track
            // For now, return basic info
            return {
                totalClaimed: user.gamification.rewardsClaimedCount || 0,
                lastClaimed: user.gamification.lastRewardClaimed,
                currentStreak: user.gamification.loginStreak || 0,
                maxStreak: user.gamification.maxLoginStreak || 0
            };
            
        } catch (error) {
            console.error('[DailyReward] Error getting history:', error);
            return [];
        }
    }
}

module.exports = DailyRewardService;