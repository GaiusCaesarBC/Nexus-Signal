// server/scripts/seedVault.js
const mongoose = require('mongoose');
const VaultItem = require('../models/VaultItem');
require('dotenv').config();

const vaultItems = [
    // PREMIUM FEATURES
    {
        name: 'Advanced Analytics Pro',
        description: 'Unlock advanced charting tools, technical indicators, and historical data analysis',
        category: 'feature',
        price: 500,
        icon: 'BarChart3',
        color: '#3b82f6',
        rarity: 'epic',
        effectType: 'permanent',
        level: 5
    },
    {
        name: 'Premium Alerts',
        description: 'Get real-time price alerts, pattern detection, and news notifications',
        category: 'feature',
        price: 300,
        icon: 'Bell',
        color: '#f59e0b',
        rarity: 'rare',
        effectType: 'permanent',
        level: 3
    },
    {
        name: 'Portfolio Expansion',
        description: 'Add 10 more portfolio slots to track additional stocks',
        category: 'feature',
        price: 200,
        icon: 'Briefcase',
        color: '#10b981',
        rarity: 'rare',
        effectType: 'permanent',
        maxPurchases: 5,
        level: 1
    },
    {
        name: 'AI Prediction Pro',
        description: 'Access advanced AI models with higher accuracy and multiple timeframes',
        category: 'feature',
        price: 750,
        icon: 'Brain',
        color: '#8b5cf6',
        rarity: 'legendary',
        effectType: 'permanent',
        level: 10
    },
    
    // POWER BOOSTS
    {
        name: '2x XP Boost (1 Hour)',
        description: 'Double your XP gains for 1 hour',
        category: 'boost',
        price: 200,
        icon: 'Zap',
        color: '#eab308',
        rarity: 'common',
        effectType: 'temporary',
        effectDuration: 1,
        effectValue: { multiplier: 2 },
        maxPurchases: -1,
        level: 1
    },
    {
        name: '3x XP Boost (1 Hour)',
        description: 'Triple your XP gains for 1 hour',
        category: 'boost',
        price: 350,
        icon: 'Zap',
        color: '#f97316',
        rarity: 'rare',
        effectType: 'temporary',
        effectDuration: 1,
        effectValue: { multiplier: 3 },
        maxPurchases: -1,
        level: 5
    },
    {
        name: 'Daily Challenge Skip',
        description: 'Skip the cooldown on your daily challenges',
        category: 'boost',
        price: 150,
        icon: 'FastForward',
        color: '#06b6d4',
        rarity: 'common',
        effectType: 'consumable',
        maxPurchases: -1,
        level: 1
    },
    {
        name: 'Achievement Hint',
        description: 'Reveal the requirements for a locked achievement',
        category: 'boost',
        price: 100,
        icon: 'Eye',
        color: '#a855f7',
        rarity: 'common',
        effectType: 'consumable',
        maxPurchases: -1,
        level: 1
    },
    
    // COSMETICS
    {
        name: 'Neon Blue Theme',
        description: 'Sleek blue theme with electric accents',
        category: 'cosmetic',
        price: 250,
        icon: 'Palette',
        color: '#0ea5e9',
        rarity: 'rare',
        effectType: 'permanent',
        effectValue: { theme: 'neon-blue' },
        level: 1
    },
    {
        name: 'Emerald Green Theme',
        description: 'Professional green theme perfect for bull markets',
        category: 'cosmetic',
        price: 250,
        icon: 'Palette',
        color: '#10b981',
        rarity: 'rare',
        effectType: 'permanent',
        effectValue: { theme: 'emerald' },
        level: 1
    },
    {
        name: 'Royal Purple Theme',
        description: 'Luxurious purple theme with gold accents',
        category: 'cosmetic',
        price: 500,
        icon: 'Palette',
        color: '#a855f7',
        rarity: 'epic',
        effectType: 'permanent',
        effectValue: { theme: 'royal-purple' },
        level: 5
    },
    {
        name: 'Gold Trader Badge',
        description: 'Show off your trading prowess with a gold badge',
        category: 'cosmetic',
        price: 300,
        icon: 'Award',
        color: '#fbbf24',
        rarity: 'rare',
        effectType: 'permanent',
        effectValue: { badge: 'gold-trader' },
        level: 3
    },
    {
        name: 'Diamond Frame',
        description: 'Premium profile frame that sparkles',
        category: 'cosmetic',
        price: 800,
        icon: 'Frame',
        color: '#60a5fa',
        rarity: 'legendary',
        effectType: 'permanent',
        effectValue: { frame: 'diamond' },
        level: 10
    },
    {
        name: 'Bull Market Icon',
        description: 'Exclusive bull market profile icon',
        category: 'cosmetic',
        price: 400,
        icon: 'TrendingUp',
        color: '#22c55e',
        rarity: 'epic',
        effectType: 'permanent',
        effectValue: { icon: 'bull-market' },
        level: 5
    },
    
    // UTILITY
    {
        name: 'Portfolio Backup',
        description: 'Save and restore your portfolio configurations',
        category: 'utility',
        price: 150,
        icon: 'Save',
        color: '#64748b',
        rarity: 'common',
        effectType: 'permanent',
        level: 1
    },
    {
        name: 'Advanced Watchlist',
        description: 'Increase watchlist capacity to 100 stocks with custom categories',
        category: 'utility',
        price: 350,
        icon: 'Eye',
        color: '#0891b2',
        rarity: 'rare',
        effectType: 'permanent',
        level: 3
    },
    {
        name: 'Export Reports',
        description: 'Export your trading history and analytics to PDF/Excel',
        category: 'utility',
        price: 250,
        icon: 'Download',
        color: '#6366f1',
        rarity: 'rare',
        effectType: 'permanent',
        level: 1
    },
    {
        name: 'Priority Support',
        description: 'Get priority customer support and faster response times',
        category: 'utility',
        price: 500,
        icon: 'Headphones',
        color: '#ec4899',
        rarity: 'epic',
        effectType: 'permanent',
        level: 5
    }
];

const seedVault = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
        
        // Clear existing items
        await VaultItem.deleteMany({});
        console.log('Cleared existing vault items');
        
        // Insert new items
        await VaultItem.insertMany(vaultItems);
        console.log(`✅ Seeded ${vaultItems.length} vault items`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding vault:', error);
        process.exit(1);
    }
};

seedVault();