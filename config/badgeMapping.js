// server/config/badgeMapping.js - Maps 31 Visual Badges to Achievement Triggers
// This creates the connection between achievements.js and BadgeIcon.js

const BADGE_MAPPING = {
    // ═══════════════════════════════════════════════════════════
    // COMMON BADGES (5)
    // ═══════════════════════════════════════════════════════════
    'badge-first-trade': {
        id: 'badge-first-trade',
        name: 'First Trade',
        description: 'Complete your first trade',
        rarity: 'common',
        category: 'trading',
        // Maps to FIRST_BLOOD achievement
        achievements: ['first_blood'],
        xpReward: 100,
        coinReward: 200,
        // Additional custom criteria if needed
        customCheck: null
    },

    'badge-first-profit': {
        id: 'badge-first-profit',
        name: 'First Profit',
        description: 'Close your first profitable trade',
        rarity: 'common',
        category: 'trading',
        // Maps to SHOW_ME_THE_MONEY achievement
        achievements: ['show_me_the_money'],
        xpReward: 150,
        coinReward: 300
    },

    'badge-week-warrior': {
        id: 'badge-week-warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day login streak',
        rarity: 'common',
        category: 'streak',
        // Maps to CONSISTENT achievement (7-day streak)
        achievements: ['consistent'],
        xpReward: 200,
        coinReward: 400
    },

    'badge-early-bird': {
        id: 'badge-early-bird',
        name: 'Early Bird',
        description: 'Complete 10 trades before 10 AM',
        rarity: 'common',
        category: 'trading',
        // No direct achievement - needs custom tracking
        achievements: [],
        xpReward: 150,
        coinReward: 300,
        customCheck: (user, stats) => {
            // Check if user has 10+ early morning trades
            return stats.earlyTrades >= 10;
        }
    },

    'badge-night-owl': {
        id: 'badge-night-owl',
        name: 'Night Owl',
        description: 'Complete 10 trades after 8 PM',
        rarity: 'common',
        category: 'trading',
        // No direct achievement - needs custom tracking
        achievements: [],
        xpReward: 150,
        coinReward: 300,
        customCheck: (user, stats) => {
            // Check if user has 10+ late evening trades
            return stats.lateTrades >= 10;
        }
    },

    // ═══════════════════════════════════════════════════════════
    // RARE BADGES (6)
    // ═══════════════════════════════════════════════════════════
    'badge-trade-master': {
        id: 'badge-trade-master',
        name: 'Trade Master',
        description: 'Complete 50 trades',
        rarity: 'rare',
        category: 'trading',
        // Maps to ACTIVE_TRADER achievement (50 trades)
        achievements: ['active_trader'],
        xpReward: 500,
        coinReward: 1000
    },

    'badge-portfolio-builder': {
        id: 'badge-portfolio-builder',
        name: 'Portfolio Builder',
        description: 'Trade 5 different stocks',
        rarity: 'rare',
        category: 'portfolio',
        // Maps to DIVERSIFY achievement (5 stocks)
        achievements: ['diversify'],
        xpReward: 400,
        coinReward: 800
    },

    'badge-streak-lord': {
        id: 'badge-streak-lord',
        name: 'Streak Lord',
        description: 'Maintain a 30-day login streak',
        rarity: 'rare',
        category: 'streak',
        // Maps to DEDICATED achievement (30-day streak)
        achievements: ['dedicated'],
        xpReward: 1000,
        coinReward: 2000
    },

    'badge-risk-taker': {
        id: 'badge-risk-taker',
        name: 'Risk Taker',
        description: 'Make 5 high-risk trades (>50% of portfolio)',
        rarity: 'rare',
        category: 'trading',
        // No direct achievement - needs custom tracking
        achievements: [],
        xpReward: 600,
        coinReward: 1200,
        customCheck: (user, stats) => {
            return stats.highRiskTrades >= 5;
        }
    },

    'badge-diversified': {
        id: 'badge-diversified',
        name: 'Diversified',
        description: 'Hold 10+ different stocks simultaneously',
        rarity: 'rare',
        category: 'portfolio',
        // Maps to PORTFOLIO_MANAGER achievement (10 stocks)
        achievements: ['portfolio_manager'],
        xpReward: 800,
        coinReward: 1600
    },

    'badge-comeback-king': {
        id: 'badge-comeback-king',
        name: 'Comeback King',
        description: 'Recover from 20% portfolio loss to profit',
        rarity: 'rare',
        category: 'trading',
        // Maps to COMEBACK_KING achievement
        achievements: ['comeback_king'],
        xpReward: 700,
        coinReward: 1400
    },

    // ═══════════════════════════════════════════════════════════
    // EPIC BADGES (9)
    // ═══════════════════════════════════════════════════════════
    'badge-oracle': {
        id: 'badge-oracle',
        name: 'Oracle',
        description: 'Make 25 correct predictions',
        rarity: 'epic',
        category: 'predictions',
        // Maps to PREDICTION_MASTER achievement (25 correct)
        achievements: ['prediction_master'],
        xpReward: 1500,
        coinReward: 3000
    },

    'badge-diamond-hands': {
        id: 'badge-diamond-hands',
        name: 'Diamond Hands',
        description: 'Hold a position for 30+ days',
        rarity: 'epic',
        category: 'trading',
        // Maps to DIAMOND_HANDS and HODL achievements
        achievements: ['diamond_hands', 'hodl'],
        xpReward: 1600,
        coinReward: 3200
    },

    'badge-profit-king': {
        id: 'badge-profit-king',
        name: 'Profit King',
        description: 'Complete 50 profitable trades',
        rarity: 'epic',
        category: 'trading',
        // No direct achievement - needs custom tracking
        achievements: [],
        xpReward: 2000,
        coinReward: 4000,
        customCheck: (user, stats) => {
            return stats.profitableTrades >= 50;
        }
    },

    'badge-dedicated': {
        id: 'badge-dedicated',
        name: 'Dedicated',
        description: 'Maintain a 60-day login streak',
        rarity: 'epic',
        category: 'streak',
        // Maps to COMMITTED achievement (60-day streak)
        achievements: ['committed'],
        xpReward: 2400,
        coinReward: 4800
    },

    'badge-speed-demon': {
        id: 'badge-speed-demon',
        name: 'Speed Demon',
        description: 'Complete 10 trades in one day',
        rarity: 'epic',
        category: 'trading',
        // Maps to SPEED_DEMON achievement
        achievements: ['speed_demon'],
        xpReward: 1200,
        coinReward: 2400
    },

    'badge-market-shark': {
        id: 'badge-market-shark',
        name: 'Market Shark',
        description: 'Win 10 consecutive profitable trades',
        rarity: 'epic',
        category: 'trading',
        // Maps to WIN_STREAK_10 achievement
        achievements: ['win_streak_10'],
        xpReward: 1800,
        coinReward: 3600
    },

    'badge-half-century': {
        id: 'badge-half-century',
        name: 'Half Century',
        description: 'Reach level 50',
        rarity: 'epic',
        category: 'level',
        // Maps to LEVEL_50 achievement
        achievements: ['level_50'],
        xpReward: 2500,
        coinReward: 5000
    },

    'badge-prediction-master': {
        id: 'badge-prediction-master',
        name: 'Prediction Master',
        description: '70% accuracy over 50 predictions',
        rarity: 'epic',
        category: 'predictions',
        // Maps to PREDICTION_ACCURACY achievement
        achievements: ['prediction_accuracy'],
        xpReward: 2200,
        coinReward: 4400
    },

    'badge-level-50': {
        id: 'badge-level-50',
        name: 'Level 50',
        description: 'Reach level 50',
        rarity: 'epic',
        category: 'level',
        // Duplicate of half-century - same achievement
        achievements: ['level_50'],
        xpReward: 2500,
        coinReward: 5000,
        hidden: true // Hide this one since it's a duplicate
    },

    // ═══════════════════════════════════════════════════════════
    // LEGENDARY BADGES (7)
    // ═══════════════════════════════════════════════════════════
    'badge-whale': {
        id: 'badge-whale',
        name: 'Whale',
        description: 'Achieve $100,000 portfolio value',
        rarity: 'legendary',
        category: 'portfolio',
        // Maps to WHALE achievement
        achievements: ['whale'],
        xpReward: 5000,
        coinReward: 10000
    },

    'badge-centurion': {
        id: 'badge-centurion',
        name: 'Centurion',
        description: 'Complete 100 trades',
        rarity: 'legendary',
        category: 'trading',
        // Maps to TRADING_ADDICT achievement (100 trades)
        achievements: ['trading_addict'],
        xpReward: 4000,
        coinReward: 8000
    },

    'badge-millionaire': {
        id: 'badge-millionaire',
        name: 'Millionaire',
        description: 'Achieve $1,000,000 portfolio value',
        rarity: 'legendary',
        category: 'portfolio',
        // Maps to PORTFOLIO_MILLION achievement
        achievements: ['portfolio_million'],
        xpReward: 10000,
        coinReward: 20000
    },

    'badge-unstoppable': {
        id: 'badge-unstoppable',
        name: 'Unstoppable',
        description: 'Maintain a 90-day login streak',
        rarity: 'legendary',
        category: 'streak',
        // Maps to UNSTOPPABLE_LOGIN achievement (100 days) - close enough
        achievements: ['unstoppable_login'],
        xpReward: 6000,
        coinReward: 12000
    },

    'badge-perfect-week': {
        id: 'badge-perfect-week',
        name: 'Perfect Week',
        description: '7 consecutive profitable trading days',
        rarity: 'legendary',
        category: 'trading',
        // No direct achievement - needs custom tracking
        achievements: [],
        xpReward: 5000,
        coinReward: 10000,
        customCheck: (user, stats) => {
            return stats.consecutiveProfitableDays >= 7;
        }
    },

    'badge-trading-god': {
        id: 'badge-trading-god',
        name: 'Trading God',
        description: 'Complete 500 trades',
        rarity: 'legendary',
        category: 'trading',
        // Maps to PROFESSIONAL achievement (500 trades)
        achievements: ['professional'],
        xpReward: 8000,
        coinReward: 16000
    },

    'badge-founder': {
        id: 'badge-founder',
        name: 'Founder',
        description: 'Early adopter - joined during launch month',
        rarity: 'legendary',
        category: 'special',
        // Manual grant for early adopters
        achievements: [],
        xpReward: 6000,
        coinReward: 12000,
        customCheck: (user) => {
            // Check if user joined before April 1, 2026
            const launchDate = new Date('2026-03-01');
            const cutoffDate = new Date('2026-04-01');
            const userJoinDate = new Date(user.createdAt);
            return userJoinDate >= launchDate && userJoinDate < cutoffDate;
        }
    },

    'badge-level-100': {
        id: 'badge-level-100',
        name: 'Level 100',
        description: 'Reach level 100',
        rarity: 'legendary',
        category: 'level',
        // Maps to LEVEL_100 achievement
        achievements: ['level_100'],
        xpReward: 10000,
        coinReward: 20000
    },

    // ═══════════════════════════════════════════════════════════
    // MYTHIC BADGES (2)
    // ═══════════════════════════════════════════════════════════
    'badge-reality-breaker': {
        id: 'badge-reality-breaker',
        name: 'Reality Breaker',
        description: 'Complete 1000 trades - transcend the ordinary',
        rarity: 'mythic',
        category: 'trading',
        // Maps to TRADING_GOD achievement (1000 trades)
        achievements: ['trading_god'],
        xpReward: 20000,
        coinReward: 40000
    },

    'badge-eternal-legend': {
        id: 'badge-eternal-legend',
        name: 'Eternal Legend',
        description: 'Maintain a 365-day login streak',
        rarity: 'mythic',
        category: 'streak',
        // Maps to YEAR_LONG achievement (365 days)
        achievements: ['year_long'],
        xpReward: 30000,
        coinReward: 60000
    },

    // ═══════════════════════════════════════════════════════════
    // ORIGIN BADGE (1)
    // ═══════════════════════════════════════════════════════════
    'badge-the-architect': {
        id: 'badge-the-architect',
        name: 'The Architect',
        description: 'Creator of Nexus Signal - The one who built the vision',
        rarity: 'origin',
        category: 'special',
        // Manual grant only - for Cody (user ID: 2cody)
        achievements: [],
        xpReward: 100000,
        coinReward: 200000,
        manualGrantOnly: true,
        founderOnly: true
    }
};

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get badge configuration by ID
 */
const getBadge = (badgeId) => {
    return BADGE_MAPPING[badgeId] || null;
};

/**
 * Get all badges
 */
const getAllBadges = () => {
    return Object.values(BADGE_MAPPING);
};

/**
 * Get badges by rarity
 */
const getBadgesByRarity = (rarity) => {
    return Object.values(BADGE_MAPPING).filter(badge => badge.rarity === rarity);
};

/**
 * Get badges by category
 */
const getBadgesByCategory = (category) => {
    return Object.values(BADGE_MAPPING).filter(badge => badge.category === category);
};

/**
 * Get badges that map to a specific achievement
 */
const getBadgesByAchievement = (achievementId) => {
    return Object.values(BADGE_MAPPING).filter(badge => 
        badge.achievements.includes(achievementId)
    );
};

/**
 * Get visible badges (non-hidden)
 */
const getVisibleBadges = () => {
    return Object.values(BADGE_MAPPING).filter(badge => !badge.hidden);
};

/**
 * Get badge counts by rarity
 */
const getBadgeCountsByRarity = () => {
    const counts = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
        origin: 0
    };
    
    Object.values(BADGE_MAPPING).forEach(badge => {
        if (!badge.hidden) {
            counts[badge.rarity]++;
        }
    });
    
    return counts;
};

/**
 * Check if badge requires custom validation
 */
const requiresCustomCheck = (badgeId) => {
    const badge = BADGE_MAPPING[badgeId];
    return badge && typeof badge.customCheck === 'function';
};

module.exports = {
    BADGE_MAPPING,
    getBadge,
    getAllBadges,
    getBadgesByRarity,
    getBadgesByCategory,
    getBadgesByAchievement,
    getVisibleBadges,
    getBadgeCountsByRarity,
    requiresCustomCheck
};