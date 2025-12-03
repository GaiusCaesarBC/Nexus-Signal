// server/models/User.js - COMPLETE with Social Features, Gamification, Vault & Onboarding - FIXED

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
    name: {
        type: String
    },
    // ✅ Existing watchlist field
    watchlist: {
        type: [String],
        default: []
    },

    // ============ 🆕 VAULT SYSTEM ============
    vault: {
        ownedItems: {
            type: [String],
            default: ['border-bronze', 'theme-default'] // Free starter items
        },
        equippedBorder: {
            type: String,
            default: 'border-bronze'
        },
        equippedTheme: {
            type: String,
            default: 'theme-default'
        },
        equippedBadges: {
            type: [String],
            default: []
        },
        activePerks: {
            type: [String],
            default: []
        },
        purchaseHistory: [{
            itemId: String,
            itemName: String,
            cost: Number,
            purchasedAt: {
                type: Date,
                default: Date.now
            }
        }]
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

    // ============ 🆕 ONBOARDING ============
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    onboardingCompletedAt: {
        type: Date
    },

    // ============ 🆕 USER PREFERENCES ============
    preferences: {
        // Trading interests selected during onboarding
        interests: [{
            type: String // stocks, crypto, options, daytrading, swing, longterm, etc.
        }],
        preferredTimeframe: {
            type: String,
            enum: ['intraday', 'daily', 'weekly', 'monthly'],
            default: 'daily'
        },
        theme: {
            type: String,
            enum: ['dark', 'light', 'auto'],
            default: 'dark'
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            priceAlerts: { type: Boolean, default: true },
            socialActivity: { type: Boolean, default: true },
            predictions: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false }
        }
    },

    // ============ 🆕 TRADING PROFILE ============
    bio: {
        type: String,
        maxlength: 160
    },
    riskTolerance: {
        type: String,
        enum: ['conservative', 'moderate', 'aggressive'],
        default: 'moderate'
    },
    tradingExperience: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate'
    },
    favoriteSector: {
        type: String,
        default: 'technology'
    },

    // ============ SOCIAL PROFILE ============
    profile: {
        displayName: { type: String, default: function() { return this.username; } },
        bio: { type: String, maxlength: 500, default: '' },
        avatar: { type: String, default: '' },
        banner: { type: String, default: '' },
        location: { type: String, maxlength: 100 },
        website: { type: String, maxlength: 200 },
        twitter: { type: String, maxlength: 50 },
        isPublic: { type: Boolean, default: true },
        showPortfolio: { type: Boolean, default: true },
        verified: { type: Boolean, default: false },
        badges: [{ type: String }]
    },

    // ============ GAMIFICATION SYSTEM ============
    gamification: {
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        title: { type: String, default: 'Rookie Trader' },
        nextLevelXp: { type: Number, default: 100 },
        totalXpEarned: { type: Number, default: 0 },
        lastLogin: { type: Date, default: null },
        
        // 🆕 NEXUS COINS - Required for Vault purchases!
        nexusCoins: { type: Number, default: 1000 },  // Start with 1000 coins
        totalCoinsEarned: { type: Number, default: 1000 },
        
        // ✅ FIXED: Achievement objects with full data (not just IDs!)
        achievements: [{
            id: { type: String },
            name: { type: String },
            description: { type: String },
            icon: { type: String },
            points: { type: Number },
            rarity: { type: String },
            unlockedAt: { type: Date, default: Date.now }
        }],
        
        // Badge IDs the user has earned
        badges: [{ type: String }],
        
        // Daily/Weekly challenges completed
        challengesCompleted: { type: Number, default: 0 },
        
        // Last time user earned XP (for daily bonus tracking)
        lastXpEarned: { type: Date },
        
        // Daily login streak
        loginStreak: { type: Number, default: 0 },
        maxLoginStreak: { type: Number, default: 0 },
        
        // ✅ ADDED: Profit streak tracking
        profitStreak: { type: Number, default: 0 },
        maxProfitStreak: { type: Number, default: 0 },
        
        // 🆕 Daily reward tracking
        lastRewardClaimed: {
            type: Date,
            default: null
        },
        rewardsClaimedCount: {
            type: Number,
            default: 0
        },
        
        // ✅ ADDED: Last login date tracking
        lastLoginDate: {
            type: Date,
            default: null
        },
        
        // ✅ ADDED: Stats object for achievement tracking
        stats: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        
        // ✅ ADDED: Prediction reset tracking
        predictionResetDate: {
            type: Date,
            default: null
        },
        
        // ✅ ADDED: Daily challenge tracking
        dailyChallenge: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        
        badgesEarned: {
            type: Number,
            default: 0
        },
        
        // Custom badge tracking stats
        earlyTrades: { type: Number, default: 0 },      // For badge-early-bird
        lateTrades: { type: Number, default: 0 },       // For badge-night-owl
        highRiskTrades: { type: Number, default: 0 },   // For badge-risk-taker
        consecutiveProfitableDays: { type: Number, default: 0 }  // For badge-perfect-week
    },  // ← CRITICAL COMMA HERE!

    // ============ SOCIAL CONNECTIONS ============
    social: {
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        followersCount: { type: Number, default: 0 },
        followingCount: { type: Number, default: 0 },
        // Copy trading
        copiedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        copying: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        // Blocked users
        blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    
    // ============ TRADING STATS ============
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

    // ============ ACHIEVEMENTS (Detailed records) ============
    achievements: [{
        achievementId: { type: String },
        type: { type: String },
        name: { type: String },
        description: { type: String },
        icon: { type: String },
        xpReward: { type: Number, default: 0 },
        coinReward: { type: Number, default: 0 },
        earnedAt: { type: Date, default: Date.now }
    }],

    // ============ FOUNDER STATUS (for special vault items) ============
    isFounder: { type: Boolean, default: false },

    date: {
        type: Date,
        default: Date.now
    }
});

// ============ GAMIFICATION CONSTANTS ============

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
    70000,  // Level 21
    81000,  // Level 22
    93000,  // Level 23
    106000, // Level 24
    120000, // Level 25
    135000, // Level 26
    151000, // Level 27
    168000, // Level 28
    186000, // Level 29
    205000, // Level 30
    225000, // Level 31
    246000, // Level 32
    268000, // Level 33
    291000, // Level 34
    315000, // Level 35
    340000, // Level 36
    366000, // Level 37
    393000, // Level 38
    421000, // Level 39
    450000, // Level 40
    480000, // Level 41
    511000, // Level 42
    543000, // Level 43
    576000, // Level 44
    610000, // Level 45
    645000, // Level 46
    681000, // Level 47
    718000, // Level 48
    756000, // Level 49
    795000, // Level 50
    850000, // Level 51
    910000, // Level 52
    975000, // Level 53
    1045000, // Level 54
    1120000, // Level 55
    1200000, // Level 56
    1285000, // Level 57
    1375000, // Level 58
    1470000, // Level 59
    1570000, // Level 60
    1680000, // Level 61
    1800000, // Level 62
    1930000, // Level 63
    2070000, // Level 64
    2220000, // Level 65
    2380000, // Level 66
    2550000, // Level 67
    2730000, // Level 68
    2920000, // Level 69
    3120000, // Level 70
    3340000, // Level 71
    3580000, // Level 72
    3840000, // Level 73
    4120000, // Level 74
    4420000, // Level 75
    4750000, // Level 76
    5100000, // Level 77
    5480000, // Level 78
    5890000, // Level 79
    6330000, // Level 80
    6810000, // Level 81
    7330000, // Level 82
    7890000, // Level 83
    8500000, // Level 84
    9160000, // Level 85
    9870000, // Level 86
    10640000, // Level 87
    11470000, // Level 88
    12370000, // Level 89
    13340000, // Level 90
    14390000, // Level 91
    15520000, // Level 92
    16740000, // Level 93
    18060000, // Level 94
    19490000, // Level 95
    21030000, // Level 96
    22700000, // Level 97
    24500000, // Level 98
    26450000, // Level 99
    28560000, // Level 100
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
    'Ascended Trader',      // 21
    'Cosmic Trader',        // 22
    'Dimensional Trader',   // 23
    'Eternal Trader',       // 24
    'Infinite Trader',      // 25
    'Nexus Apprentice',     // 26
    'Nexus Adept',          // 27
    'Nexus Expert',         // 28
    'Nexus Master',         // 29
    'Nexus Champion',       // 30
    'Bronze Nexian',        // 31
    'Silver Nexian',        // 32
    'Gold Nexian',          // 33
    'Platinum Nexian',      // 34
    'Diamond Nexian',       // 35
    'Ruby Nexian',          // 36
    'Sapphire Nexian',      // 37
    'Emerald Nexian',       // 38
    'Obsidian Nexian',      // 39
    'Celestial Nexian',     // 40
    'Market Monarch',       // 41
    'Trading Sovereign',    // 42
    'Wealth Architect',     // 43
    'Fortune Weaver',       // 44
    'Destiny Trader',       // 45
    'Fate Bender',          // 46
    'Reality Trader',       // 47
    'Quantum Trader',       // 48
    'Void Trader',          // 49
    'Nexus Legend',         // 50
    'Stellar Trader',       // 51
    'Galactic Trader',      // 52
    'Universal Trader',     // 53
    'Multiversal Trader',   // 54
    'Omniversal Trader',    // 55
    'Transcendent One',     // 56
    'Awakened One',         // 57
    'Enlightened One',      // 58
    'Ascended One',         // 59
    'Nexus Immortal',       // 60
    'Time Lord',            // 61
    'Space Lord',           // 62
    'Reality Lord',         // 63
    'Dimension Lord',       // 64
    'Universe Lord',        // 65
    'Creation Lord',        // 66
    'Existence Lord',       // 67
    'Infinity Lord',        // 68
    'Eternity Lord',        // 69
    'Nexus Eternal',        // 70
    'Alpha Trader',         // 71
    'Omega Trader',         // 72
    'Prime Trader',         // 73
    'Apex Trader',          // 74
    'Ultimate Trader',      // 75
    'Supreme Trader',       // 76
    'Absolute Trader',      // 77
    'Perfect Trader',       // 78
    'Divine Trader',        // 79
    'Nexus Divine',         // 80
    'First Trader',         // 81
    'True Trader',          // 82
    'Pure Trader',          // 83
    'Sacred Trader',        // 84
    'Holy Trader',          // 85
    'Blessed Trader',       // 86
    'Chosen Trader',        // 87
    'Anointed Trader',      // 88
    'Exalted Trader',       // 89
    'Nexus Exalted',        // 90
    'Origin Trader',        // 91
    'Source Trader',        // 92
    'Core Trader',          // 93
    'Essence Trader',       // 94
    'Spirit Trader',        // 95
    'Soul Trader',          // 96
    'Mind Trader',          // 97
    'Heart Trader',         // 98
    'One Trader',           // 99
    'Nexus One',            // 100
];

// ============ ONBOARDING METHODS ============

// Check if user should see onboarding
UserSchema.methods.shouldShowOnboarding = function() {
    return !this.onboardingCompleted;
};

// Get display name with fallback
UserSchema.methods.getDisplayName = function() {
    return this.profile?.displayName || this.name || this.username || 'Trader';
};

// Get initials for avatar placeholder
UserSchema.methods.getInitials = function() {
    const name = this.getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

// ============ GAMIFICATION METHODS ============

// Initialize gamification if needed
UserSchema.methods.initializeGamification = function() {
    if (!this.gamification) {
        this.gamification = {
            xp: 0,
            level: 1,
            title: 'Rookie Trader',
            nextLevelXp: 100,
            totalXpEarned: 0,
            nexusCoins: 1000,
            totalCoinsEarned: 1000,
            achievements: [],
            badges: [],
            challengesCompleted: 0,
            loginStreak: 0,
            maxLoginStreak: 0,
            profitStreak: 0,
            maxProfitStreak: 0,
            stats: {}
        };
    }
    
    // Ensure nexusCoins exists for existing users
    if (this.gamification.nexusCoins === undefined) {
        this.gamification.nexusCoins = 1000;
        this.gamification.totalCoinsEarned = 1000;
    }
    
    // Ensure stats object exists
    if (!this.gamification.stats) {
        this.gamification.stats = {};
    }
    
    return this.gamification;
};

// Add XP to user and handle leveling
UserSchema.methods.addXp = async function(amount, reason = 'activity') {
    this.initializeGamification();

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
        
        // Award coins for leveling up (100 coins per level)
        const levelUpBonus = 100 * (newLevel - oldLevel);
        this.gamification.nexusCoins += levelUpBonus;
        this.gamification.totalCoinsEarned += levelUpBonus;
        
        console.log(`[User] ${this.username} leveled up to ${newLevel}! Bonus: ${levelUpBonus} coins`);
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
        nextLevelXp: this.gamification.nextLevelXp,
        coinsEarned: leveledUp ? 100 * (newLevel - oldLevel) : 0
    };
};

// 🆕 Add Nexus Coins to user
UserSchema.methods.addCoins = async function(amount, reason = 'reward') {
    this.initializeGamification();
    
    this.gamification.nexusCoins += amount;
    this.gamification.totalCoinsEarned += amount;
    
    console.log(`[User] ${this.username} earned ${amount} coins (${reason}). Total: ${this.gamification.nexusCoins}`);
    
    await this.save();
    
    return {
        coinsEarned: amount,
        totalCoins: this.gamification.nexusCoins,
        reason
    };
};

// 🆕 Deduct Nexus Coins from user
UserSchema.methods.deductCoins = async function(amount, reason = 'purchase') {
    this.initializeGamification();
    
    if (this.gamification.nexusCoins < amount) {
        throw new Error('Insufficient Nexus Coins');
    }
    
    this.gamification.nexusCoins -= amount;
    
    console.log(`[User] ${this.username} spent ${amount} coins (${reason}). Remaining: ${this.gamification.nexusCoins}`);
    
    await this.save();
    
    return {
        coinsSpent: amount,
        remainingCoins: this.gamification.nexusCoins,
        reason
    };
};

// 🆕 Get active perk effects
UserSchema.methods.getActivePerkEffects = function() {
    const effects = {
        xp_bonus: 0,
        coin_bonus: 0,
        profit_bonus: 0,
        streak_protection: 0,
        extra_daily: 0
    };
    
    // This would need access to VAULT_ITEMS to calculate effects
    // For now, return empty effects - the vaultRoutes handles this
    return effects;
};

// Check level up (without saving - for use in other methods)
UserSchema.methods.checkLevelUp = function() {
    if (!this.gamification) return { leveledUp: false };

    const currentXp = this.gamification.totalXpEarned || 0;
    let newLevel = 1;

    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (currentXp >= LEVEL_THRESHOLDS[i]) {
            newLevel = i + 1;
            break;
        }
    }

    const oldLevel = this.gamification.level || 1;
    
    if (newLevel > oldLevel) {
        this.gamification.level = newLevel;
        this.gamification.title = LEVEL_TITLES[newLevel - 1] || 'Nexus One';
        this.gamification.nextLevelXp = LEVEL_THRESHOLDS[newLevel] || 999999999;
        return { leveledUp: true, oldLevel, newLevel, title: this.gamification.title };
    }

    return { leveledUp: false };
};

// Award achievement to user
UserSchema.methods.awardAchievement = async function(achievement) {
    this.initializeGamification();
    
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
        coinReward: achievement.coinReward || 0,
        earnedAt: new Date()
    });

    // Add to gamification achievements list
    if (!this.gamification.achievements.some(a => a.id === achievement.id)) {
        this.gamification.achievements.push({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            points: achievement.xpReward || 0,
            rarity: achievement.rarity || 'common',
            unlockedAt: new Date()
        });
    }

    // Award XP for achievement
    let xpResult = null;
    if (achievement.xpReward) {
        xpResult = await this.addXp(achievement.xpReward, `achievement:${achievement.id}`);
    }
    
    // Award coins for achievement
    let coinResult = null;
    if (achievement.coinReward) {
        this.gamification.nexusCoins += achievement.coinReward;
        this.gamification.totalCoinsEarned += achievement.coinReward;
        coinResult = { coinsEarned: achievement.coinReward };
    }
    
    if (!xpResult) {
        await this.save();
    }

    return {
        awarded: true,
        achievement,
        xpResult,
        coinResult
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
    this.initializeGamification();
    
    const lastLogin = this.gamification.lastLogin;

    if (!lastLogin) {
        this.gamification.loginStreak = 1;
        this.gamification.maxLoginStreak = 1;
        this.gamification.lastLogin = now;
        await this.save();
        return { streak: 1, isNewDay: true, bonusXp: 10, bonusCoins: 50 };
    }

    // Check if it's a new day
    const lastLoginDate = new Date(lastLogin);
    const isNewDay = now.toDateString() !== lastLoginDate.toDateString();
    
    if (!isNewDay) {
        return { streak: this.gamification.loginStreak, isNewDay: false, bonusXp: 0, bonusCoins: 0 };
    }

    // Check if consecutive day
    const dayDiff = Math.floor((now - lastLoginDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
        // Consecutive day - increase streak
        this.gamification.loginStreak = (this.gamification.loginStreak || 0) + 1;
    } else {
        // Streak broken (unless they have streak protection perk)
        // Check for streak protection in vault
        if (this.vault?.activePerks?.includes('perk-streak-master') && dayDiff <= 2) {
            // Grace period - maintain streak
            this.gamification.loginStreak = (this.gamification.loginStreak || 0) + 1;
            console.log(`[User] ${this.username} streak protected by Streak Master perk!`);
        } else {
            this.gamification.loginStreak = 1;
        }
    }
    
    // Update max streak
    if (this.gamification.loginStreak > (this.gamification.maxLoginStreak || 0)) {
        this.gamification.maxLoginStreak = this.gamification.loginStreak;
    }

    this.gamification.lastLogin = now;
    
    // Calculate bonus XP and coins based on streak
    const streak = this.gamification.loginStreak;
    const bonusXp = Math.min(10 + (streak * 5), 200);  // Max 200 XP
    const bonusCoins = Math.min(50 + (streak * 10), 500);  // Max 500 coins
    
    // Apply coin bonus perk if active
    let finalCoins = bonusCoins;
    if (this.vault?.activePerks?.includes('perk-coin-magnet')) {
        finalCoins = Math.floor(bonusCoins * 1.05);  // +5% coins
    }
    
    // Award the bonuses
    this.gamification.nexusCoins += finalCoins;
    this.gamification.totalCoinsEarned += finalCoins;
    
    await this.save();
    
    return { 
        streak: this.gamification.loginStreak,
        maxStreak: this.gamification.maxLoginStreak,
        isNewDay: true, 
        bonusXp,
        bonusCoins: finalCoins
    };
};

// ============ VAULT HELPER METHODS ============

// Initialize vault if needed
UserSchema.methods.initializeVault = function() {
    if (!this.vault) {
        this.vault = {
            ownedItems: ['border-bronze', 'theme-default'],
            equippedBorder: 'border-bronze',
            equippedTheme: 'theme-default',
            equippedBadges: [],
            activePerks: [],
            purchaseHistory: []
        };
    }
    return this.vault;
};

// Check if user owns a vault item
UserSchema.methods.ownsVaultItem = function(itemId) {
    this.initializeVault();
    return this.vault.ownedItems.includes(itemId);
};

// Get equipped items
UserSchema.methods.getEquippedItems = function() {
    this.initializeVault();
    return {
        border: this.vault.equippedBorder,
        theme: this.vault.equippedTheme,
        badges: this.vault.equippedBadges || [],
        perks: this.vault.activePerks || []
    };
};

// ============ STATS CALCULATION ============

UserSchema.methods.calculateStats = async function() {
    try {
        console.log('[User] Calculating stats for user:', this.email);

        // ✅ Declare all variables at the top
        let holdings = [];
        let totalInvested = 0;
        let currentValue = 0;
        let totalReturn = 0;
        let totalReturnPercent = 0;
        let totalTrades = 0;
        let wins = 0;
        let losses = 0;
        let bestTrade = 0;
        let worstTrade = 0;

        // Initialize stats object
        if (!this.stats) {
            this.stats = {};
        }

        // Get paper trading account
        try {
            const PaperTradingAccount = mongoose.model('PaperTradingAccount');
            const account = await PaperTradingAccount.findOne({ user: this._id });
            
            if (account) {
                console.log('[User] Found paper trading account');
                console.log('[User] Portfolio Value:', account.portfolioValue);
                console.log('[User] Starting Balance:', account.startingBalance);
                console.log('[User] Total P/L %:', account.totalProfitLossPercent);
                
                // Use account-level stats
                totalInvested = account.startingBalance;
                currentValue = account.portfolioValue;
                totalReturn = account.totalProfitLoss;
                totalReturnPercent = account.totalProfitLossPercent || 0;
                totalTrades = account.totalTrades || 0;
                wins = account.winningTrades || 0;
                losses = account.losingTrades || 0;
                
                console.log('[User] Using account stats - Return %:', totalReturnPercent);
            }
        } catch (error) {
            console.error('[User] Error fetching paper trading data:', error.message);
        }

        // Handle empty portfolio
        if (!holdings || holdings.length === 0) {
            console.log('[User] No holdings found, checking predictions only');
        }

        // Only calculate from holdings if we don't have account-level stats
        if (totalReturnPercent === 0 && holdings.length > 0) {
            console.log('[User] No account stats, calculating from holdings...');
            
            let holdingsInvested = 0;
            let holdingsValue = 0;
            let totalGainPercent = 0;

            for (const holding of holdings) {
                const invested = (holding.averagePrice || 0) * (holding.shares || holding.quantity || 0);
                const current = (holding.currentPrice || 0) * (holding.shares || holding.quantity || 0);
                const gainLoss = current - invested;
                const gainLossPercent = invested > 0 ? (gainLoss / invested) * 100 : 0;

                holdingsInvested += invested;
                holdingsValue += current;
                totalGainPercent += gainLossPercent;

                if (gainLoss > 0) wins++;
                if (gainLoss < 0) losses++;

                if (gainLossPercent > bestTrade) bestTrade = gainLossPercent;
                if (gainLossPercent < worstTrade) worstTrade = gainLossPercent;
            }

            totalInvested = holdingsInvested;
            currentValue = holdingsValue;
            totalReturn = holdingsValue - holdingsInvested;
            totalReturnPercent = holdingsInvested > 0 
                ? (totalReturn / holdingsInvested) * 100 
                : 0;
            totalTrades = holdings.length;
        } else {
            console.log('[User] Using account-level stats');
        }

        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const avgTradeReturn = totalTrades > 0 ? totalReturnPercent : 0;

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
UserSchema.index({ 'gamification.nexusCoins': -1 });
UserSchema.index({ 'stats.lastTradeDate': -1 });

// Index for onboarding queries
UserSchema.index({ onboardingCompleted: 1 });
UserSchema.index({ 'preferences.interests': 1 });

// Index for user search
UserSchema.index({ username: 'text', 'profile.displayName': 'text' });

// Index for vault queries
UserSchema.index({ 'vault.equippedBorder': 1 });
UserSchema.index({ 'vault.equippedTheme': 1 });

module.exports = mongoose.model('User', UserSchema);