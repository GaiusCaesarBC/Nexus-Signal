// server/models/User.js - COMPLETE with Social Features & Gamification

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    // ✅ Existing watchlist field
    watchlist: {
        type: [String],
        default: []
    },
    // ✅ Existing notification/preferences
    notifications: {
        type: Object,
        default: {}
    },
    appPreferences: {
        type: Object,
        default: {}
    },
    // 🆕 SOCIAL PROFILE
    profile: {
        displayName: { type: String, default: function() { return this.username; } },
        bio: { type: String, maxlength: 500, default: '' },
        avatar: { type: String, default: '' },
        isPublic: { type: Boolean, default: true },
        showPortfolio: { type: Boolean, default: true },
        badges: [{ type: String }]
    },
    // 🆕 GAMIFICATION SYSTEM
    gamification: {
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        title: { type: String, default: 'Rookie Trader' },
        nextLevelXp: { type: Number, default: 100 },
        totalXpEarned: { type: Number, default: 0 },
        // Achievement IDs the user has earned
        achievements: [{ type: String }],
        // Badge IDs the user has earned
        badges: [{ type: String }],
        // Daily/Weekly challenges completed
        challengesCompleted: { type: Number, default: 0 },
        // Last time user earned XP (for daily bonus tracking)
        lastXpEarned: { type: Date },
        // Daily login streak
        loginStreak: { type: Number, default: 0 },
        lastLogin: { type: Date }
    },
    // 🆕 SOCIAL CONNECTIONS
    social: {
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        followersCount: { type: Number, default: 0 },
        followingCount: { type: Number, default: 0 },
        // Copy trading
        copiedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        copying: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    // 🆕 TRADING STATS
    stats: {
        // Portfolio stats
        totalTrades: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        totalReturn: { type: Number, default: 0 },
        totalReturnPercent: { type: Number, default: 0 },
        bestTrade: { type: Number, default: 0 },
        worstTrade: { type: Number, default: 0 },
        avgTradeReturn: { type: Number, default: 0 },
        
        // Streak tracking
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        
        // Prediction stats
        totalPredictions: { type: Number, default: 0 },
        correctPredictions: { type: Number, default: 0 },
        predictionAccuracy: { type: Number, default: 0 },
        
        // Time tracking for leaderboard filtering
        lastTradeDate: { type: Date },
        lastPredictionDate: { type: Date },
        
        // Rankings
        rank: { type: Number, default: 0 },
        previousRank: { type: Number, default: 0 },
        rankChange: { type: Number, default: 0 },
        
        // Meta
        lastUpdated: { type: Date, default: Date.now }
    },
    // 🆕 ACHIEVEMENTS (Detailed records)
    achievements: [{
        achievementId: { type: String },
        type: { type: String },
        name: { type: String },
        description: { type: String },
        icon: { type: String },
        xpReward: { type: Number, default: 0 },
        earnedAt: { type: Date, default: Date.now }
    }],
    date: {
        type: Date,
        default: Date.now
    }
});

// ============ GAMIFICATION METHODS ============

// XP thresholds for each level
const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    1000,   // Level 5
    1750,   // Level 6
    2750,   // Level 7
    4000,   // Level 8
    5500,   // Level 9
    7500,   // Level 10
    10000,  // Level 11
    13000,  // Level 12
    16500,  // Level 13
    20500,  // Level 14
    25000,  // Level 15
    30000,  // Level 16
    36000,  // Level 17
    43000,  // Level 18
    51000,  // Level 19
    60000,  // Level 20
];

// Titles for each level
const LEVEL_TITLES = [
    'Rookie Trader',        // 1
    'Apprentice',           // 2
    'Junior Trader',        // 3
    'Trader',               // 4
    'Senior Trader',        // 5
    'Expert Trader',        // 6
    'Master Trader',        // 7
    'Elite Trader',         // 8
    'Pro Trader',           // 9
    'Market Wizard',        // 10
    'Trading Legend',       // 11
    'Market Master',        // 12
    'Trading Virtuoso',     // 13
    'Market Sage',          // 14
    'Trading Titan',        // 15
    'Market Oracle',        // 16
    'Trading Overlord',     // 17
    'Market Emperor',       // 18
    'Trading Deity',        // 19
    'Market God',           // 20
];

// Add XP to user and handle leveling
UserSchema.methods.addXp = async function(amount, reason = 'activity') {
    if (!this.gamification) {
        this.gamification = {
            xp: 0,
            level: 1,
            title: 'Rookie Trader',
            nextLevelXp: 100,
            totalXpEarned: 0,
            achievements: [],
            badges: []
        };
    }

    const oldLevel = this.gamification.level;
    this.gamification.xp += amount;
    this.gamification.totalXpEarned += amount;
    this.gamification.lastXpEarned = new Date();

    // Check for level up
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (this.gamification.totalXpEarned >= LEVEL_THRESHOLDS[i]) {
            newLevel = i + 1;
            break;
        }
    }

    const leveledUp = newLevel > oldLevel;
    
    if (leveledUp) {
        this.gamification.level = newLevel;
        this.gamification.title = LEVEL_TITLES[Math.min(newLevel - 1, LEVEL_TITLES.length - 1)];
    }

    // Calculate XP needed for next level
    const nextLevelIndex = Math.min(newLevel, LEVEL_THRESHOLDS.length - 1);
    this.gamification.nextLevelXp = LEVEL_THRESHOLDS[nextLevelIndex] - this.gamification.totalXpEarned;

    await this.save();

    return {
        xpEarned: amount,
        totalXp: this.gamification.totalXpEarned,
        currentXp: this.gamification.xp,
        level: this.gamification.level,
        title: this.gamification.title,
        leveledUp,
        oldLevel,
        newLevel,
        nextLevelXp: this.gamification.nextLevelXp
    };
};

// Award achievement to user
UserSchema.methods.awardAchievement = async function(achievement) {
    // Check if already has achievement
    const hasAchievement = this.achievements.some(a => a.achievementId === achievement.id);
    if (hasAchievement) {
        return { awarded: false, reason: 'Already has achievement' };
    }

    // Add to achievements array
    this.achievements.push({
        achievementId: achievement.id,
        type: achievement.type,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward || 0,
        earnedAt: new Date()
    });

    // Add to gamification achievements list
    if (!this.gamification.achievements.includes(achievement.id)) {
        this.gamification.achievements.push(achievement.id);
    }

    // Award XP for achievement
    let xpResult = null;
    if (achievement.xpReward) {
        xpResult = await this.addXp(achievement.xpReward, `achievement:${achievement.id}`);
    } else {
        await this.save();
    }

    return {
        awarded: true,
        achievement,
        xpResult
    };
};

// Update streak
UserSchema.methods.updateStreak = async function(won) {
    if (!this.stats) {
        this.stats = { currentStreak: 0, longestStreak: 0 };
    }

    if (won) {
        this.stats.currentStreak = (this.stats.currentStreak || 0) + 1;
        if (this.stats.currentStreak > (this.stats.longestStreak || 0)) {
            this.stats.longestStreak = this.stats.currentStreak;
        }
    } else {
        this.stats.currentStreak = 0;
    }

    await this.save();
    return {
        currentStreak: this.stats.currentStreak,
        longestStreak: this.stats.longestStreak
    };
};

// Check and update daily login streak
UserSchema.methods.checkLoginStreak = async function() {
    const now = new Date();
    const lastLogin = this.gamification?.lastLogin;
    
    if (!this.gamification) {
        this.gamification = {
            xp: 0,
            level: 1,
            title: 'Rookie Trader',
            loginStreak: 1,
            lastLogin: now
        };
        await this.save();
        return { streak: 1, isNewDay: true, bonusXp: 10 };
    }

    if (!lastLogin) {
        this.gamification.loginStreak = 1;
        this.gamification.lastLogin = now;
        await this.save();
        return { streak: 1, isNewDay: true, bonusXp: 10 };
    }

    // Check if it's a new day
    const lastLoginDate = new Date(lastLogin);
    const isNewDay = now.toDateString() !== lastLoginDate.toDateString();
    
    if (!isNewDay) {
        return { streak: this.gamification.loginStreak, isNewDay: false, bonusXp: 0 };
    }

    // Check if consecutive day
    const dayDiff = Math.floor((now - lastLoginDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
        // Consecutive day - increase streak
        this.gamification.loginStreak = (this.gamification.loginStreak || 0) + 1;
    } else {
        // Streak broken
        this.gamification.loginStreak = 1;
    }

    this.gamification.lastLogin = now;
    
    // Calculate bonus XP based on streak
    const bonusXp = Math.min(10 + (this.gamification.loginStreak * 5), 100);
    
    await this.save();
    
    return { 
        streak: this.gamification.loginStreak, 
        isNewDay: true, 
        bonusXp 
    };
};

// ============ STATS CALCULATION ============

// Method to calculate stats from portfolio and predictions
UserSchema.methods.calculateStats = async function() {
    try {
        console.log('[User] Calculating stats for user:', this.email);

        // Get all portfolio holdings
        const Portfolio = mongoose.model('Portfolio');
        const holdings = await Portfolio.find({ userId: this._id });

        console.log('[User] Found holdings:', holdings.length);

        // Initialize stats object
        if (!this.stats) {
            this.stats = {};
        }

        // Handle empty portfolio
        if (!holdings || holdings.length === 0) {
            console.log('[User] No holdings found, checking predictions only');
        }

        // Calculate portfolio value
        let totalInvested = 0;
        let currentValue = 0;
        let wins = 0;
        let losses = 0;
        let bestTrade = 0;
        let worstTrade = 0;
        let totalGainPercent = 0;

        for (const holding of holdings) {
            const invested = (holding.averagePrice || 0) * (holding.shares || 0);
            const current = (holding.currentPrice || 0) * (holding.shares || 0);
            const gainLoss = current - invested;
            const gainLossPercent = invested > 0 ? (gainLoss / invested) * 100 : 0;

            totalInvested += invested;
            currentValue += current;
            totalGainPercent += gainLossPercent;

            if (gainLoss > 0) wins++;
            if (gainLoss < 0) losses++;

            if (gainLossPercent > bestTrade) bestTrade = gainLossPercent;
            if (gainLossPercent < worstTrade) worstTrade = gainLossPercent;
        }

        // Safe calculations
        const totalReturn = currentValue - totalInvested;
        const totalReturnPercent = totalInvested > 0 
            ? (totalReturn / totalInvested) * 100 
            : 0;

        const totalTrades = holdings.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const avgTradeReturn = totalTrades > 0 ? totalGainPercent / totalTrades : 0;

        // Get prediction stats
        const Prediction = mongoose.model('Prediction');
        const predictions = await Prediction.find({ userId: this._id });
        const expiredPredictions = predictions.filter(p => p.status === 'expired');
        const correctPredictions = expiredPredictions.filter(p => p.wasCorrect);

        // Calculate prediction accuracy
        const totalPredictions = predictions.length;
        const predictionAccuracy = expiredPredictions.length > 0 
            ? (correctPredictions.length / expiredPredictions.length) * 100 
            : 0;

        // Calculate streaks from predictions
        const sortedPredictions = expiredPredictions.sort((a, b) => 
            new Date(b.expiresAt) - new Date(a.expiresAt)
        );

        let currentStreak = 0;
        let longestStreak = this.stats.longestStreak || 0;
        let tempStreak = 0;

        for (const pred of sortedPredictions) {
            if (pred.wasCorrect) {
                tempStreak++;
                if (tempStreak > longestStreak) longestStreak = tempStreak;
            } else {
                if (currentStreak === 0 && tempStreak > 0) {
                    currentStreak = tempStreak;
                }
                tempStreak = 0;
            }
        }

        if (tempStreak > 0 && currentStreak === 0) {
            currentStreak = tempStreak;
        }

        // Find most recent activity dates
        const lastTrade = holdings.length > 0 
            ? holdings.reduce((latest, h) => {
                const date = h.updatedAt || h.createdAt;
                return date > latest ? date : latest;
            }, new Date(0))
            : null;

        const lastPrediction = predictions.length > 0
            ? predictions.reduce((latest, p) => {
                const date = p.createdAt;
                return date > latest ? date : latest;
            }, new Date(0))
            : null;

        // Update stats
        this.stats = {
            ...this.stats,
            totalInvested: totalInvested || 0,
            currentValue: currentValue || 0,
            totalReturn: totalReturn || 0,
            totalReturnPercent: totalReturnPercent || 0,
            winRate: winRate || 0,
            totalTrades: totalTrades || 0,
            profitableTrades: wins || 0,
            losingTrades: losses || 0,
            avgTradeReturn: avgTradeReturn || 0,
            bestTrade: bestTrade || 0,
            worstTrade: worstTrade || 0,
            currentStreak: currentStreak || 0,
            longestStreak: longestStreak || 0,
            totalPredictions: totalPredictions || 0,
            correctPredictions: correctPredictions.length || 0,
            predictionAccuracy: predictionAccuracy || 0,
            lastTradeDate: lastTrade,
            lastPredictionDate: lastPrediction,
            rank: this.stats.rank || 0,
            previousRank: this.stats.previousRank || 0,
            lastUpdated: new Date()
        };

        console.log('[User] Stats calculated successfully:', {
            totalTrades,
            winRate,
            totalReturnPercent,
            currentStreak,
            predictionAccuracy
        });

        await this.save();
        return this.stats;

    } catch (error) {
        console.error('[User] Error calculating stats:', error);
        return this.stats;
    }
};

// ============ INDEXES ============

// Index for leaderboard queries
UserSchema.index({ 'stats.totalReturnPercent': -1 });
UserSchema.index({ 'stats.winRate': -1 });
UserSchema.index({ 'stats.currentStreak': -1 });
UserSchema.index({ 'stats.totalTrades': -1 });
UserSchema.index({ 'gamification.xp': -1 });
UserSchema.index({ 'gamification.level': -1 });
UserSchema.index({ 'stats.lastTradeDate': -1 });

// Index for user search
UserSchema.index({ username: 'text', 'profile.displayName': 'text' });

module.exports = mongoose.model('User', UserSchema);