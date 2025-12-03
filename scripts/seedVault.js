// server/scripts/seedVault.js
const mongoose = require('mongoose');
const VaultItem = require('../models/VaultItem');
require('dotenv').config();

const vaultItems = [
    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    💎 PREMIUM FEATURES                        ║
    // ╚══════════════════════════════════════════════════════════════╝
    {
        id: 'feature-advanced-analytics',
        name: 'Advanced Analytics Pro',
        description: 'Unlock advanced charting tools, technical indicators, and historical data analysis',
        type: 'feature',
        category: 'feature',
        price: 500,
        cost: 500,
        icon: 'BarChart3',
        color: '#3b82f6',
        rarity: 'epic',
        effectType: 'permanent',
        level: 5,
        obtainable: true
    },
    {
        id: 'feature-premium-alerts',
        name: 'Premium Alerts',
        description: 'Get real-time price alerts, pattern detection, and news notifications',
        type: 'feature',
        category: 'feature',
        price: 300,
        cost: 300,
        icon: 'Bell',
        color: '#f59e0b',
        rarity: 'rare',
        effectType: 'permanent',
        level: 3,
        obtainable: true
    },
    {
        id: 'feature-portfolio-expansion',
        name: 'Portfolio Expansion',
        description: 'Add 10 more portfolio slots to track additional stocks',
        type: 'feature',
        category: 'feature',
        price: 200,
        cost: 200,
        icon: 'Briefcase',
        color: '#10b981',
        rarity: 'rare',
        effectType: 'permanent',
        maxPurchases: 5,
        level: 1,
        obtainable: true
    },
    {
        id: 'feature-ai-prediction-pro',
        name: 'AI Prediction Pro',
        description: 'Access advanced AI models with higher accuracy and multiple timeframes',
        type: 'feature',
        category: 'feature',
        price: 750,
        cost: 750,
        icon: 'Brain',
        color: '#8b5cf6',
        rarity: 'legendary',
        effectType: 'permanent',
        level: 10,
        obtainable: true
    },
    
    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    ⚡ POWER BOOSTS                            ║
    // ╚══════════════════════════════════════════════════════════════╝
    {
        id: 'boost-2x-xp-1hr',
        name: '2x XP Boost (1 Hour)',
        description: 'Double your XP gains for 1 hour',
        type: 'boost',
        category: 'boost',
        price: 200,
        cost: 200,
        icon: 'Zap',
        color: '#eab308',
        rarity: 'common',
        effectType: 'temporary',
        effectDuration: 1,
        effectValue: { multiplier: 2 },
        maxPurchases: -1,
        level: 1,
        obtainable: true
    },
    {
        id: 'boost-3x-xp-1hr',
        name: '3x XP Boost (1 Hour)',
        description: 'Triple your XP gains for 1 hour',
        type: 'boost',
        category: 'boost',
        price: 350,
        cost: 350,
        icon: 'Zap',
        color: '#f97316',
        rarity: 'rare',
        effectType: 'temporary',
        effectDuration: 1,
        effectValue: { multiplier: 3 },
        maxPurchases: -1,
        level: 5,
        obtainable: true
    },
    {
        id: 'boost-challenge-skip',
        name: 'Daily Challenge Skip',
        description: 'Skip the cooldown on your daily challenges',
        type: 'boost',
        category: 'boost',
        price: 150,
        cost: 150,
        icon: 'FastForward',
        color: '#06b6d4',
        rarity: 'common',
        effectType: 'consumable',
        maxPurchases: -1,
        level: 1,
        obtainable: true
    },
    {
        id: 'boost-achievement-hint',
        name: 'Achievement Hint',
        description: 'Reveal the requirements for a locked achievement',
        type: 'boost',
        category: 'boost',
        price: 100,
        cost: 100,
        icon: 'Eye',
        color: '#a855f7',
        rarity: 'common',
        effectType: 'consumable',
        maxPurchases: -1,
        level: 1,
        obtainable: true
    },
    
    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    🎨 THEMES                                  ║
    // ╚══════════════════════════════════════════════════════════════╝
    {
        id: 'theme-neon-blue',
        name: 'Neon Blue Theme',
        description: 'Sleek blue theme with electric accents',
        type: 'cosmetic',
        category: 'cosmetic',
        price: 250,
        cost: 250,
        icon: 'Palette',
        color: '#0ea5e9',
        rarity: 'rare',
        effectType: 'permanent',
        effectValue: { theme: 'neon-blue' },
        level: 1,
        obtainable: true
    },
    {
        id: 'theme-emerald',
        name: 'Emerald Green Theme',
        description: 'Professional green theme perfect for bull markets',
        type: 'cosmetic',
        category: 'cosmetic',
        price: 250,
        cost: 250,
        icon: 'Palette',
        color: '#10b981',
        rarity: 'rare',
        effectType: 'permanent',
        effectValue: { theme: 'emerald' },
        level: 1,
        obtainable: true
    },
    {
        id: 'theme-royal-purple',
        name: 'Royal Purple Theme',
        description: 'Luxurious purple theme with gold accents',
        type: 'cosmetic',
        category: 'cosmetic',
        price: 500,
        cost: 500,
        icon: 'Palette',
        color: '#a855f7',
        rarity: 'epic',
        effectType: 'permanent',
        effectValue: { theme: 'royal-purple' },
        level: 5,
        obtainable: true
    },
    
    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    🔧 UTILITY                                 ║
    // ╚══════════════════════════════════════════════════════════════╝
    {
        id: 'utility-portfolio-backup',
        name: 'Portfolio Backup',
        description: 'Save and restore your portfolio configurations',
        type: 'utility',
        category: 'utility',
        price: 150,
        cost: 150,
        icon: 'Save',
        color: '#64748b',
        rarity: 'common',
        effectType: 'permanent',
        level: 1,
        obtainable: true
    },
    {
        id: 'utility-advanced-watchlist',
        name: 'Advanced Watchlist',
        description: 'Increase watchlist capacity to 100 stocks with custom categories',
        type: 'utility',
        category: 'utility',
        price: 350,
        cost: 350,
        icon: 'Eye',
        color: '#0891b2',
        rarity: 'rare',
        effectType: 'permanent',
        level: 3,
        obtainable: true
    },
    {
        id: 'utility-export-reports',
        name: 'Export Reports',
        description: 'Export your trading history and analytics to PDF/Excel',
        type: 'utility',
        category: 'utility',
        price: 250,
        cost: 250,
        icon: 'Download',
        color: '#6366f1',
        rarity: 'rare',
        effectType: 'permanent',
        level: 1,
        obtainable: true
    },
    {
        id: 'utility-priority-support',
        name: 'Priority Support',
        description: 'Get priority customer support and faster response times',
        type: 'utility',
        category: 'utility',
        price: 500,
        cost: 500,
        icon: 'Headphones',
        color: '#ec4899',
        rarity: 'epic',
        effectType: 'permanent',
        level: 5,
        obtainable: true
    },

    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    🎨 AVATAR BORDERS                         ║
    // ╚══════════════════════════════════════════════════════════════╝
    {
        id: 'border-bronze',
        name: 'Bronze Ring',
        description: 'A simple bronze border for your avatar',
        type: 'border',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        borderStyle: 'solid',
        color: '#cd7f32',
        glowColor: null,
        animation: null,
        obtainable: true
    },
    {
        id: 'border-silver',
        name: 'Silver Ring',
        description: 'A polished silver border',
        type: 'border',
        category: 'cosmetic',
        rarity: 'common',
        cost: 500,
        price: 500,
        borderStyle: 'solid',
        color: '#c0c0c0',
        glowColor: null,
        animation: null,
        obtainable: true
    },
    {
        id: 'border-gold',
        name: 'Gold Ring',
        description: 'A prestigious gold border',
        type: 'border',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 1500,
        price: 1500,
        borderStyle: 'solid',
        color: '#ffd700',
        glowColor: 'rgba(255, 215, 0, 0.5)',
        animation: null,
        obtainable: true
    },
    {
        id: 'border-platinum',
        name: 'Platinum Ring',
        description: 'An elite platinum border with subtle glow',
        type: 'border',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 3000,
        price: 3000,
        borderStyle: 'solid',
        color: '#e5e4e2',
        glowColor: 'rgba(229, 228, 226, 0.6)',
        animation: null,
        obtainable: true
    },
    {
        id: 'border-diamond',
        name: 'Diamond Ring',
        description: 'A dazzling diamond border that sparkles',
        type: 'border',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 7500,
        price: 7500,
        borderStyle: 'solid',
        color: '#b9f2ff',
        glowColor: 'rgba(185, 242, 255, 0.7)',
        animation: 'sparkle',
        obtainable: true
    },
    {
        id: 'border-emerald',
        name: 'Emerald Ring',
        description: 'A vibrant emerald border with green glow',
        type: 'border',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 7500,
        price: 7500,
        borderStyle: 'solid',
        color: '#50c878',
        glowColor: 'rgba(80, 200, 120, 0.7)',
        animation: 'pulse',
        obtainable: true
    },
    {
        id: 'border-ruby',
        name: 'Ruby Ring',
        description: 'A fiery ruby border that burns bright',
        type: 'border',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 7500,
        price: 7500,
        borderStyle: 'solid',
        color: '#e0115f',
        glowColor: 'rgba(224, 17, 95, 0.7)',
        animation: 'pulse',
        obtainable: true
    },
    {
        id: 'border-sapphire',
        name: 'Sapphire Ring',
        description: 'A deep sapphire border with ocean glow',
        type: 'border',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 7500,
        price: 7500,
        borderStyle: 'solid',
        color: '#0f52ba',
        glowColor: 'rgba(15, 82, 186, 0.7)',
        animation: 'pulse',
        obtainable: true
    },
    {
        id: 'border-neon-blue',
        name: 'Neon Blue',
        description: 'Electric neon blue with intense glow',
        type: 'border',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 15000,
        price: 15000,
        borderStyle: 'solid',
        color: '#00f5ff',
        glowColor: 'rgba(0, 245, 255, 0.9)',
        animation: 'neonPulse',
        obtainable: true
    },
    {
        id: 'border-neon-pink',
        name: 'Neon Pink',
        description: 'Hot neon pink with cyberpunk vibes',
        type: 'border',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 15000,
        price: 15000,
        borderStyle: 'solid',
        color: '#ff00ff',
        glowColor: 'rgba(255, 0, 255, 0.9)',
        animation: 'neonPulse',
        obtainable: true
    },
    {
        id: 'border-rainbow',
        name: 'Rainbow Ring',
        description: 'A mesmerizing rainbow border that shifts colors',
        type: 'border',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 25000,
        price: 25000,
        borderStyle: 'gradient',
        color: 'rainbow',
        glowColor: 'rgba(255, 255, 255, 0.8)',
        animation: 'rainbowShift',
        obtainable: true
    },
    {
        id: 'border-cosmic',
        name: 'Cosmic Ring',
        description: 'A border infused with the power of the cosmos',
        type: 'border',
        category: 'cosmetic',
        rarity: 'mythic',
        cost: 50000,
        price: 50000,
        borderStyle: 'gradient',
        color: 'cosmic',
        glowColor: 'rgba(138, 43, 226, 0.9)',
        animation: 'cosmicPulse',
        obtainable: true
    },
    {
        id: 'border-void',
        name: 'Void Ring',
        description: 'A border from the depths of the void - darkness incarnate',
        type: 'border',
        category: 'cosmetic',
        rarity: 'mythic',
        cost: 50000,
        price: 50000,
        borderStyle: 'gradient',
        color: 'void',
        glowColor: 'rgba(20, 0, 40, 0.9)',
        animation: 'voidPulse',
        obtainable: true
    },
    {
        id: 'border-architects-ring',
        name: "Architect's Ring",
        description: 'The sacred ring of those who built the signal. Unobtainable.',
        type: 'border',
        category: 'cosmetic',
        rarity: 'origin',
        cost: null,
        price: null,
        borderStyle: 'sacred',
        color: 'origin',
        glowColor: 'rgba(212, 175, 55, 1)',
        animation: 'sacredRotate',
        obtainable: false
    },

    // ╔══════════════════════════════════════════════════════════════╗
    // ║                    🏆 BADGES                                  ║
    // ╚══════════════════════════════════════════════════════════════╝

    // ════════════════════════════════════════════════════════════
    // ⬜ COMMON BADGES (5) - First Steps
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-first-trade',
        name: 'First Blood',
        description: 'Completed your first ever trade - the journey begins',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        icon: 'target',
        unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 1 },
        obtainable: true
    },
    {
        id: 'badge-first-profit',
        name: 'Green Candle',
        description: 'Made your first profitable trade',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        icon: 'chart',
        unlockRequirement: { type: 'stats', stat: 'profitableTrades', value: 1 },
        obtainable: true
    },
    {
        id: 'badge-week-warrior',
        name: 'Week Warrior',
        description: '7 day login streak achieved',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        icon: 'star',
        unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 7 },
        obtainable: true
    },
    {
        id: 'badge-early-bird',
        name: 'Early Bird',
        description: 'Executed a trade within 5 minutes of market open',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        icon: 'sun',
        unlockRequirement: { type: 'special', value: 'market_open_trade' },
        obtainable: true
    },
    {
        id: 'badge-night-owl',
        name: 'Night Owl',
        description: 'Made a trade during after-hours (8 PM - 4 AM)',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'common',
        cost: 0,
        price: 0,
        icon: 'moon',
        unlockRequirement: { type: 'special', value: 'after_hours_trade' },
        obtainable: true
    },

    // ════════════════════════════════════════════════════════════
    // 🔵 RARE BADGES (6) - Growing Stronger
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-trade-master',
        name: 'Trade Master',
        description: 'Completed 500+ trades - a true veteran',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'chart',
        unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 500 },
        obtainable: true
    },
    {
        id: 'badge-portfolio-builder',
        name: 'Portfolio Architect',
        description: 'Own 10+ different stocks simultaneously',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'gem',
        unlockRequirement: { type: 'stats', stat: 'stocksOwned', value: 10 },
        obtainable: true
    },
    {
        id: 'badge-streak-lord',
        name: 'Streak Lord',
        description: 'Achieved a 14 day login streak',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'fire',
        unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 14 },
        obtainable: true
    },
    {
        id: 'badge-risk-taker',
        name: 'Risk Taker',
        description: 'Made a single trade worth over $50,000',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'bolt',
        unlockRequirement: { type: 'stats', stat: 'largestTrade', value: 50000 },
        obtainable: true
    },
    {
        id: 'badge-diversified',
        name: 'Diversified',
        description: 'Own stocks in 5+ different sectors',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'compass',
        unlockRequirement: { type: 'stats', stat: 'sectorsOwned', value: 5 },
        obtainable: true
    },
    {
        id: 'badge-comeback-king',
        name: 'Comeback King',
        description: 'Recovered from a 50%+ portfolio loss',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'rare',
        cost: 0,
        price: 0,
        icon: 'crown',
        unlockRequirement: { type: 'special', value: 'comeback_50' },
        obtainable: true
    },

    // ════════════════════════════════════════════════════════════
    // 🟣 EPIC BADGES (6) - Elite Status
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-oracle',
        name: 'Oracle',
        description: '100+ correct predictions - you see the future',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'eye',
        unlockRequirement: { type: 'stats', stat: 'correctPredictions', value: 100 },
        obtainable: true
    },
    {
        id: 'badge-diamond-hands',
        name: 'Diamond Hands',
        description: 'Held a position through a 50%+ drawdown and recovered',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'diamond',
        unlockRequirement: { type: 'special', value: 'diamond_hands' },
        obtainable: true
    },
    {
        id: 'badge-profit-king',
        name: 'Profit King',
        description: 'Earned over $10,000 in total profits',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'crown',
        unlockRequirement: { type: 'stats', stat: 'totalProfit', value: 10000 },
        obtainable: true
    },
    {
        id: 'badge-dedicated',
        name: 'Dedicated',
        description: '30 day login streak achieved - unbreakable',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'fire',
        unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 30 },
        obtainable: true
    },
    {
        id: 'badge-speed-demon',
        name: 'Speed Demon',
        description: 'Executed 10 trades in under 60 seconds',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'speedometer',
        unlockRequirement: { type: 'special', value: 'speed_demon' },
        obtainable: true
    },
    {
        id: 'badge-market-shark',
        name: 'Market Shark',
        description: 'Achieved a 10 win streak on trades',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'epic',
        cost: 0,
        price: 0,
        icon: 'shark',
        unlockRequirement: { type: 'stats', stat: 'maxWinStreak', value: 10 },
        obtainable: true
    },

    // ════════════════════════════════════════════════════════════
    // 🟡 LEGENDARY BADGES (6) - Peak Performance
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-whale',
        name: 'Whale',
        description: 'Own 100,000+ Nexus Coins - massive wealth',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'whale',
        unlockRequirement: { type: 'stats', stat: 'nexusCoins', value: 100000 },
        obtainable: true
    },
    {
        id: 'badge-centurion',
        name: 'Centurion',
        description: 'Reached Level 100 - true dedication',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'shield',
        unlockRequirement: { type: 'level', value: 100 },
        obtainable: true
    },
    {
        id: 'badge-millionaire',
        name: 'Millionaire',
        description: 'Portfolio value exceeds $1,000,000',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'gem',
        unlockRequirement: { type: 'stats', stat: 'portfolioValue', value: 1000000 },
        obtainable: true
    },
    {
        id: 'badge-unstoppable',
        name: 'Unstoppable',
        description: '100 day login streak - legendary commitment',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'infinity',
        unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 100 },
        obtainable: true
    },
    {
        id: 'badge-perfect-week',
        name: 'Perfect Week',
        description: '7 profitable trades in a row - flawless',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'star',
        unlockRequirement: { type: 'stats', stat: 'maxWinStreak', value: 7 },
        obtainable: true
    },
    {
        id: 'badge-trading-god',
        name: 'Trading God',
        description: 'Earned $100,000+ in total profits',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'legendary',
        cost: 0,
        price: 0,
        icon: 'lightning',
        unlockRequirement: { type: 'stats', stat: 'totalProfit', value: 100000 },
        obtainable: true
    },

    // ════════════════════════════════════════════════════════════
    // 💎 MYTHIC BADGES (2) - Beyond Mortal
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-reality-breaker',
        name: 'Reality Breaker',
        description: 'Made $1,000,000+ profit on a single trade - impossible',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'mythic',
        cost: 0,
        price: 0,
        icon: 'atom',
        unlockRequirement: { type: 'stats', stat: 'largestProfit', value: 1000000 },
        obtainable: true
    },
    {
        id: 'badge-eternal-legend',
        name: 'Eternal Legend',
        description: '365 day login streak - one full year of dedication',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'mythic',
        cost: 0,
        price: 0,
        icon: 'skull',
        unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 365 },
        obtainable: true
    },

    // ════════════════════════════════════════════════════════════
    // 🏛️ ORIGIN BADGE (1) - Founders Only
    // ════════════════════════════════════════════════════════════
    {
        id: 'badge-the-architect',
        name: 'The Architect',
        description: 'Those who built the signal from nothing. Unobtainable.',
        type: 'badge',
        category: 'cosmetic',
        rarity: 'origin',
        cost: null,
        price: null,
        icon: 'metatron',
        unlockRequirement: { type: 'founder', value: true },
        obtainable: false
    }
];

const seedVault = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
        
        // Upsert each item (update if exists, insert if not)
        let inserted = 0;
        let updated = 0;
        
        for (const item of vaultItems) {
            const result = await VaultItem.findOneAndUpdate(
                { id: item.id },
                item,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            
            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                inserted++;
            } else {
                updated++;
            }
        }
        
        console.log(`\n✅ Vault seeding complete!`);
        console.log(`   📦 Total items: ${vaultItems.length}`);
        console.log(`   ➕ New items: ${inserted}`);
        console.log(`   🔄 Updated items: ${updated}`);
        console.log(`\n   📊 Breakdown:`);
        console.log(`   - Features: ${vaultItems.filter(i => i.type === 'feature').length}`);
        console.log(`   - Boosts: ${vaultItems.filter(i => i.type === 'boost').length}`);
        console.log(`   - Themes: ${vaultItems.filter(i => i.type === 'cosmetic' && i.effectValue?.theme).length}`);
        console.log(`   - Utilities: ${vaultItems.filter(i => i.type === 'utility').length}`);
        console.log(`   - Borders: ${vaultItems.filter(i => i.type === 'border').length}`);
        console.log(`   - Badges: ${vaultItems.filter(i => i.type === 'badge').length}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding vault:', error);
        process.exit(1);
    }
};

seedVault();