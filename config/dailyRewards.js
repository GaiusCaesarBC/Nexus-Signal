// server/config/dailyRewards.js - Daily Login Reward Configuration

// Reward tiers based on login streak
const REWARD_TIERS = {
    // Days 1-6: Base rewards
    BASE: {
        xp: { min: 50, max: 100 },
        coins: { min: 100, max: 200 },
        items: [
            'theme-ocean',
            'theme-forest',
            'border-bronze',
            'border-copper'
        ]
    },
    
    // Day 7: Weekly milestone
    WEEK: {
        guaranteed: {
            xp: 200,
            coins: 300,
            badge: 'badge-week-warrior'
        },
        bonusPool: [
            'theme-sunset',
            'border-silver',
            'perk-xp-boost-1h'
        ]
    },
    
    // Day 14: Two-week milestone
    TWO_WEEKS: {
        guaranteed: {
            xp: 400,
            coins: 500,
            badge: 'badge-dedication'
        },
        bonusPool: [
            'theme-midnight',
            'theme-aurora',
            'border-gold',
            'perk-coin-boost-1h'
        ]
    },
    
    // Days 15-29: Improved daily rewards
    IMPROVED: {
        xp: { min: 100, max: 200 },
        coins: { min: 200, max: 400 },
        items: [
            'theme-twilight',
            'theme-volcano',
            'border-silver',
            'border-gold'
        ]
    },
    
    // Day 30: Monthly milestone
    MONTH: {
        guaranteed: {
            xp: 1000,
            coins: 1500,
            badge: 'badge-monthly-champion',
            theme: 'theme-galaxy'
        },
        bonusPool: [
            'border-platinum',
            'border-cosmic',
            'perk-streak-insurance',
            'perk-double-xp-24h'
        ]
    },
    
    // Day 60: Two-month milestone
    TWO_MONTHS: {
        guaranteed: {
            xp: 2000,
            coins: 3000,
            badge: 'badge-unstoppable',
            border: 'border-diamond'
        },
        bonusPool: [
            'theme-legendary',
            'border-mythic',
            'perk-triple-coins-24h'
        ]
    },
    
    // Day 90: Three-month milestone
    THREE_MONTHS: {
        guaranteed: {
            xp: 3000,
            coins: 5000,
            badge: 'badge-nexus-legend',
            theme: 'theme-nexus-elite',
            border: 'border-eternal'
        },
        bonusPool: [
            'perk-permanent-xp-boost',
            'badge-founder-tribute'
        ]
    },
    
    // Days 31+: Premium daily rewards
    PREMIUM: {
        xp: { min: 150, max: 300 },
        coins: { min: 300, max: 600 },
        items: [
            'theme-nebula',
            'theme-quantum',
            'border-platinum',
            'border-diamond',
            'perk-lucky-day'
        ]
    },
    
    // Days 91+: Elite rewards
    ELITE: {
        xp: { min: 200, max: 400 },
        coins: { min: 400, max: 800 },
        items: [
            'theme-infinity',
            'theme-void',
            'border-legendary',
            'border-transcendent',
            'perk-mega-multiplier'
        ]
    }
};

// Reward type weights based on streak
const REWARD_WEIGHTS = {
    // Days 1-6
    BASE: {
        xp: 50,
        coins: 40,
        item: 10
    },
    // Days 7-13
    EARLY: {
        xp: 40,
        coins: 40,
        item: 20
    },
    // Days 14-29
    MID: {
        xp: 35,
        coins: 35,
        item: 30
    },
    // Days 30+
    LATE: {
        xp: 30,
        coins: 30,
        item: 40
    }
};

// Special "jackpot" days - random chance for extra rewards
const JACKPOT_CHANCE = 0.05; // 5% chance each day
const JACKPOT_REWARDS = {
    coins: { min: 500, max: 1000 },
    xp: { min: 300, max: 500 },
    specialItems: [
        'theme-jackpot',
        'border-lucky',
        'badge-fortune-favored',
        'perk-jackpot-winner'
    ]
};

// Milestone configurations
const MILESTONES = [
    { day: 7, name: '1 Week Streak', tier: 'WEEK' },
    { day: 14, name: '2 Week Streak', tier: 'TWO_WEEKS' },
    { day: 30, name: '1 Month Streak', tier: 'MONTH' },
    { day: 60, name: '2 Month Streak', tier: 'TWO_MONTHS' },
    { day: 90, name: '3 Month Streak', tier: 'THREE_MONTHS' },
    { day: 180, name: '6 Month Streak', tier: 'THREE_MONTHS' }, // Reuse THREE_MONTHS
    { day: 365, name: '1 Year Streak', tier: 'THREE_MONTHS' }
];

// Get reward tier based on streak
function getRewardTier(streak) {
    // Check for major milestones
    if (streak >= 91) return 'ELITE';
    if (streak >= 31) return 'PREMIUM';
    if (streak >= 15) return 'IMPROVED';
    return 'BASE';
}

// Get milestone for specific day
function getMilestone(streak) {
    return MILESTONES.find(m => m.day === streak);
}

// Get reward weights based on streak
function getRewardWeights(streak) {
    if (streak <= 6) return REWARD_WEIGHTS.BASE;
    if (streak <= 13) return REWARD_WEIGHTS.EARLY;
    if (streak <= 29) return REWARD_WEIGHTS.MID;
    return REWARD_WEIGHTS.LATE;
}

// Random weighted selection
function weightedRandom(weights) {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (const [key, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return key;
    }
    
    return Object.keys(weights)[0];
}

// Random item from array
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Random number in range
function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if today is a jackpot day
function isJackpotDay() {
    return Math.random() < JACKPOT_CHANCE;
}

module.exports = {
    REWARD_TIERS,
    REWARD_WEIGHTS,
    JACKPOT_CHANCE,
    JACKPOT_REWARDS,
    MILESTONES,
    getRewardTier,
    getMilestone,
    getRewardWeights,
    weightedRandom,
    randomItem,
    randomInRange,
    isJackpotDay
};