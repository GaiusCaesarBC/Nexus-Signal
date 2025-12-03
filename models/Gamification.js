// server/models/Gamification.js - UPDATED WITH PREDICTION RESET DATE
const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    id: String,
    name: String,
    description: String,
    icon: String,
    points: Number,
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    unlockedAt: Date
});

const gamificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    
    // XP & Level System
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    rank: { type: String, default: 'Rookie Trader' },
    
    // Points & Currency
    nexusCoins: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    
    // Streaks
    loginStreak: { type: Number, default: 0 },
    lastLoginDate: Date,
    maxLoginStreak: { type: Number, default: 0 },
    profitStreak: { type: Number, default: 0 },
    maxProfitStreak: { type: Number, default: 0 },
    lossStreak: { type: Number, default: 0 },
    maxLossStreak: { type: Number, default: 0 },
    
    // 🔥 NEW: Prediction Reset Date - only count predictions after this date
    predictionResetDate: { type: Date, default: null },
    
    // Achievements
    achievements: [achievementSchema],
    
    // VAULT ITEMS
    ownedItems: [{
        itemId: String,
        type: {
            type: String,
            enum: ['avatar-border', 'perk', 'profile-theme', 'badge']
        },
        purchasedAt: { type: Date, default: Date.now }
    }],
    
    // EQUIPPED ITEMS
    equippedItems: {
        avatarBorder: { type: String, default: null },
        profileTheme: { type: String, default: 'theme-default' },
        activePerk: { type: String, default: null },
        badges: [{ type: String, maxlength: 3 }]
    },
    
    // Stats for achievements - EXPANDED
    stats: {
        // Basic trading stats
        totalTrades: { type: Number, default: 0 },
        profitableTrades: { type: Number, default: 0 },
        losingTrades: { type: Number, default: 0 },
        totalProfit: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        
        // Prediction stats
        predictionsCreated: { type: Number, default: 0 },
        correctPredictions: { type: Number, default: 0 },
        predictionAccuracy: { type: Number, default: 0 },
        
        // Portfolio stats
        portfolioValue: { type: Number, default: 100000 },
        stocksOwned: { type: Number, default: 0 },
        
        // Time stats
        daysActive: { type: Number, default: 0 },
        
        // ============ PAPER TRADING STATS ============
        // Refill tracking
        totalRefills: { type: Number, default: 0 },
        accountBlown: { type: Boolean, default: false },
        phoenixRecovery: { type: Boolean, default: false },
        comebackKing: { type: Boolean, default: false },
        
        // Streak tracking
        maxProfitStreak: { type: Number, default: 0 },
        maxLossStreak: { type: Number, default: 0 },
        comebackWin: { type: Boolean, default: false },
        
        // Leverage stats
        leveragedTrades: { type: Number, default: 0 },
        usedMaxLeverage: { type: Boolean, default: false },
        biggestLeverageWin: { type: Number, default: 0 },
        biggestLeverageLoss: { type: Number, default: 0 },
        
        // Short selling stats
        shortTrades: { type: Number, default: 0 },
        profitableShorts: { type: Number, default: 0 },
        totalShortProfit: { type: Number, default: 0 },
        
        // Special tracking
        maxTradesInDay: { type: Number, default: 0 },
        biggestTradeValue: { type: Number, default: 0 },
        biggestWinPercent: { type: Number, default: 0 },
        biggestWin: { type: Number, default: 0 },
        biggestLoss: { type: Number, default: 0 },
        
        // Fun stats
        diamondHands: { type: Boolean, default: false },
        paperHands: { type: Boolean, default: false },
        memeTradePrice: { type: Boolean, default: false },
        yoloTrade: { type: Boolean, default: false },
        longestHold: { type: Number, default: 0 },
        
        // Social stats
        followersCount: { type: Number, default: 0 },
        followingCount: { type: Number, default: 0 },
        
        // Legacy
        referrals: { type: Number, default: 0 }
    },
    
    // Daily tracking for achievements
    dailyStats: {
        date: { type: Date, default: Date.now },
        tradesCount: { type: Number, default: 0 },
        profit: { type: Number, default: 0 }
    },
    
    // Challenges
    dailyChallenge: {
        challenge: String,
        progress: Number,
        target: Number,
        reward: Number,
        expiresAt: Date,
        completed: Boolean
    },
    
    weeklyChallenge: {
        challenge: String,
        progress: Number,
        target: Number,
        reward: Number,
        expiresAt: Date,
        completed: Boolean
    },
    
    // Milestones
    milestones: [{
        name: String,
        completedAt: Date,
        reward: Number
    }]
}, {
    timestamps: true
});

// Calculate level from XP
gamificationSchema.methods.calculateLevel = function() {
    const level = Math.floor(Math.sqrt(this.xp / 100)) + 1;
    return level;
};

// Get XP needed for next level
gamificationSchema.methods.getXPForNextLevel = function() {
    const nextLevel = this.level + 1;
    return Math.pow(nextLevel - 1, 2) * 100;
};

// Get rank based on level
gamificationSchema.methods.getRank = function() {
    const level = this.level;
    
    if (level < 5) return 'Rookie Trader';
    if (level < 10) return 'Apprentice Investor';
    if (level < 20) return 'Skilled Trader';
    if (level < 30) return 'Expert Analyst';
    if (level < 50) return 'Master Trader';
    if (level < 75) return 'Elite Investor';
    if (level < 100) return 'Legendary Mogul';
    return 'Wall Street Titan';
};

// Add XP and check for level up
gamificationSchema.methods.addXP = async function(amount, reason = '') {
    this.xp += amount;
    const oldLevel = this.level;
    const newLevel = this.calculateLevel();
    
    if (newLevel > oldLevel) {
        this.level = newLevel;
        this.rank = this.getRank();
        
        const coinReward = newLevel * 100;
        this.nexusCoins += coinReward;
        this.totalEarned += coinReward;
        
        await this.save();
        
        return {
            leveledUp: true,
            oldLevel,
            newLevel,
            rank: this.rank,
            coinReward
        };
    }
    
    await this.save();
    return { leveledUp: false };
};

// Update win rate
gamificationSchema.methods.updateWinRate = function() {
    if (this.stats.totalTrades > 0) {
        this.stats.winRate = (this.stats.profitableTrades / this.stats.totalTrades) * 100;
    }
};

// Update prediction accuracy
gamificationSchema.methods.updatePredictionAccuracy = function() {
    if (this.stats.predictionsCreated > 0) {
        this.stats.predictionAccuracy = (this.stats.correctPredictions / this.stats.predictionsCreated) * 100;
    }
};

// Record a trade for achievement tracking
gamificationSchema.methods.recordTrade = function(tradeData) {
    this.stats.totalTrades++;
    
    if (tradeData.profit > 0) {
        this.stats.profitableTrades++;
        this.profitStreak++;
        this.lossStreak = 0;
        
        // Check for comeback win (win after 5+ losses)
        if (this.lossStreak >= 5) {
            this.stats.comebackWin = true;
        }
        
        if (this.profitStreak > this.maxProfitStreak) {
            this.maxProfitStreak = this.profitStreak;
            this.stats.maxProfitStreak = this.profitStreak;
        }
        
        // Track biggest win
        if (tradeData.profit > this.stats.biggestWin) {
            this.stats.biggestWin = tradeData.profit;
        }
        if (tradeData.profitPercent > this.stats.biggestWinPercent) {
            this.stats.biggestWinPercent = tradeData.profitPercent;
        }
    } else {
        this.stats.losingTrades++;
        this.lossStreak++;
        this.profitStreak = 0;
        
        if (this.lossStreak > this.maxLossStreak) {
            this.maxLossStreak = this.lossStreak;
            this.stats.maxLossStreak = this.lossStreak;
        }
        
        // Track biggest loss
        if (Math.abs(tradeData.profit) > this.stats.biggestLoss) {
            this.stats.biggestLoss = Math.abs(tradeData.profit);
        }
    }
    
    this.stats.totalProfit += tradeData.profit;
    
    // Track leverage trades
    if (tradeData.leverage && tradeData.leverage > 1) {
        this.stats.leveragedTrades++;
        if (tradeData.leverage >= 20) {
            this.stats.usedMaxLeverage = true;
        }
        if (tradeData.profit > 0 && tradeData.profit > this.stats.biggestLeverageWin) {
            this.stats.biggestLeverageWin = tradeData.profit;
        }
        if (tradeData.profit < 0 && Math.abs(tradeData.profit) > this.stats.biggestLeverageLoss) {
            this.stats.biggestLeverageLoss = Math.abs(tradeData.profit);
        }
    }
    
    // Track short trades
    if (tradeData.positionType === 'short') {
        this.stats.shortTrades++;
        if (tradeData.profit > 0) {
            this.stats.profitableShorts++;
            this.stats.totalShortProfit += tradeData.profit;
        }
    }
    
    // Track biggest trade value
    if (tradeData.totalValue > this.stats.biggestTradeValue) {
        this.stats.biggestTradeValue = tradeData.totalValue;
    }
    
    // Check for meme price
    if (tradeData.price === 420.69 || tradeData.price === 69.42) {
        this.stats.memeTradePrice = true;
    }
    
    // Check for YOLO trade (using entire balance)
    if (tradeData.percentOfBalance >= 95) {
        this.stats.yoloTrade = true;
    }
    
    this.updateWinRate();
};

// Record account refill
gamificationSchema.methods.recordRefill = function() {
    this.stats.totalRefills++;
    
    // If they were at 0 and refilled, mark account blown
    if (this.stats.portfolioValue <= 0) {
        this.stats.accountBlown = true;
    }
};

// Check for phoenix recovery (blow account then profit)
gamificationSchema.methods.checkPhoenixRecovery = function(currentPortfolioValue, startingBalance) {
    if (this.stats.accountBlown && currentPortfolioValue > startingBalance) {
        this.stats.phoenixRecovery = true;
    }
};

// Check for comeback king (from -50% to positive)
gamificationSchema.methods.checkComebackKing = function(totalReturnPercent, wasAtMinus50) {
    if (wasAtMinus50 && totalReturnPercent > 0) {
        this.stats.comebackKing = true;
    }
};

// Get active perk bonuses
gamificationSchema.methods.getActivePerkBonuses = function() {
    if (!this.equippedItems.activePerk) {
        return null;
    }
    
    const perkEffects = {
        'perk-lucky-trader': { xpBonus: 0.10 },
        'perk-coin-magnet': { coinBonus: 0.05 },
        'perk-streak-master': { streakProtection: true },
        'perk-double-daily': { extraDaily: true }
    };
    
    return perkEffects[this.equippedItems.activePerk] || null;
};

// Check if user has achievement
gamificationSchema.methods.hasAchievement = function(achievementId) {
    return this.achievements.some(a => a.id === achievementId);
};

// Add achievement
gamificationSchema.methods.addAchievement = function(achievement) {
    if (!this.hasAchievement(achievement.id)) {
        this.achievements.push({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            points: achievement.points,
            rarity: achievement.rarity,
            unlockedAt: new Date()
        });
        return true;
    }
    return false;
};

// 🔥 NEW: Reset prediction tracking
gamificationSchema.methods.resetPredictionTracking = function(resetDate = new Date()) {
    this.predictionResetDate = resetDate;
    this.stats.predictionsCreated = 0;
    this.stats.correctPredictions = 0;
    this.stats.predictionAccuracy = 0;
};

module.exports = mongoose.model('Gamification', gamificationSchema);