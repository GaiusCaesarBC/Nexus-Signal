// server/models/Gamification.js
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
    
    // Achievements
    achievements: [achievementSchema],
    
    // ✅ NEW: VAULT ITEMS
    ownedItems: [{
        itemId: String,
        type: {
            type: String,
            enum: ['avatar-border', 'perk', 'profile-theme', 'badge']
        },
        purchasedAt: { type: Date, default: Date.now }
    }],
    
    // ✅ NEW: EQUIPPED ITEMS
    equippedItems: {
        avatarBorder: { type: String, default: null },
        profileTheme: { type: String, default: 'theme-default' },
        activePerk: { type: String, default: null },
        badges: [{ type: String, maxlength: 3 }] // Max 3 badges
    },
    
    // Stats for achievements
    stats: {
        totalTrades: { type: Number, default: 0 },
        profitableTrades: { type: Number, default: 0 },
        totalProfit: { type: Number, default: 0 },
        predictionsCreated: { type: Number, default: 0 },
        correctPredictions: { type: Number, default: 0 },
        portfolioValue: { type: Number, default: 0 },
        daysActive: { type: Number, default: 0 },
        stocksOwned: { type: Number, default: 0 },
        referrals: { type: Number, default: 0 }
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
    // Level formula: level = floor(sqrt(xp / 100)) + 1
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
        
        // Reward coins for leveling up
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

// ✅ NEW: Get active perk bonuses
gamificationSchema.methods.getActivePerkBonuses = function() {
    if (!this.equippedItems.activePerk) {
        return null;
    }
    
    // This will be used to apply bonuses in trade/XP calculations
    const perkEffects = {
        'perk-lucky-trader': { xpBonus: 0.10 },
        'perk-coin-magnet': { coinBonus: 0.05 },
        'perk-streak-master': { streakProtection: true },
        'perk-double-daily': { extraDaily: true }
    };
    
    return perkEffects[this.equippedItems.activePerk] || null;
};

module.exports = mongoose.model('Gamification', gamificationSchema);