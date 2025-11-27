// server/data/vaultItems.js - VAULT ITEMS DATABASE
// Place this file at: server/data/vaultItems.js

const VAULT_ITEMS = {
    // ===== AVATAR BORDERS (11 items) =====
    avatarBorders: [
        {
            id: 'border-bronze',
            name: 'Bronze Frame',
            description: 'A classic bronze border for beginners',
            type: 'avatar-border',
            rarity: 'common',
            cost: 0,
            gradient: 'linear-gradient(135deg, #CD7F32 0%, #8B5A2B 100%)',
            glowColor: 'rgba(205, 127, 50, 0.5)',
            unlockRequirement: null
        },
        {
            id: 'border-silver',
            name: 'Silver Frame',
            description: 'Sleek silver border for rising traders',
            type: 'avatar-border',
            rarity: 'common',
            cost: 500,
            gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
            glowColor: 'rgba(192, 192, 192, 0.5)',
            unlockRequirement: { type: 'level', value: 5 }
        },
        {
            id: 'border-gold',
            name: 'Gold Frame',
            description: 'Luxurious gold border for skilled traders',
            type: 'avatar-border',
            rarity: 'rare',
            cost: 2000,
            gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            glowColor: 'rgba(255, 215, 0, 0.6)',
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'border-emerald',
            name: 'Emerald Frame',
            description: 'Vibrant green border for profit masters',
            type: 'avatar-border',
            rarity: 'rare',
            cost: 3000,
            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            glowColor: 'rgba(16, 185, 129, 0.6)',
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'border-ruby',
            name: 'Ruby Frame',
            description: 'Fiery red border for aggressive traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 4000,
            gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            glowColor: 'rgba(239, 68, 68, 0.7)',
            unlockRequirement: { type: 'level', value: 18 }
        },
        {
            id: 'border-platinum',
            name: 'Platinum Frame',
            description: 'Prestigious platinum border for elite traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 5000,
            gradient: 'linear-gradient(135deg, #E5E4E2 0%, #B9B8B5 100%)',
            glowColor: 'rgba(229, 228, 226, 0.7)',
            unlockRequirement: { type: 'level', value: 20 }
        },
        {
            id: 'border-sapphire',
            name: 'Sapphire Frame',
            description: 'Deep blue border for analytical minds',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 6000,
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            glowColor: 'rgba(59, 130, 246, 0.7)',
            unlockRequirement: { type: 'level', value: 25 }
        },
        {
            id: 'border-amethyst',
            name: 'Amethyst Frame',
            description: 'Royal purple border for strategic traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 7000,
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            glowColor: 'rgba(139, 92, 246, 0.7)',
            unlockRequirement: { type: 'level', value: 30 }
        },
        {
            id: 'border-diamond',
            name: 'Diamond Frame',
            description: 'Radiant diamond border for master traders',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 10000,
            gradient: 'linear-gradient(135deg, #B9F2FF 0%, #00D4FF 50%, #B9F2FF 100%)',
            glowColor: 'rgba(0, 212, 255, 0.8)',
            animation: 'shimmer',
            unlockRequirement: { type: 'level', value: 50 }
        },
        {
            id: 'border-rainbow',
            name: 'Rainbow Frame',
            description: 'Multicolor animated border - extremely rare',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 15000,
            gradient: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #10b981 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)',
            glowColor: 'rgba(139, 92, 246, 0.9)',
            animation: 'shimmer',
            unlockRequirement: { type: 'level', value: 60 }
        },
        {
            id: 'border-nexus',
            name: 'Nexus Frame',
            description: 'The legendary Nexus border - ultimate prestige',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 25000,
            gradient: 'linear-gradient(135deg, #00adef 0%, #8b5cf6 50%, #00adef 100%)',
            glowColor: 'rgba(0, 173, 237, 1)',
            animation: 'pulse-glow',
            unlockRequirement: { type: 'level', value: 100 }
        }
    ],

    // ===== PERKS (6 items) =====
    perks: [
        {
            id: 'perk-fast-learner',
            name: 'Fast Learner',
            description: '+5% XP from all sources',
            type: 'perk',
            rarity: 'rare',
            cost: 2500,
            effect: { type: 'xp_bonus', value: 0.05 },
            icon: '📚',
            duration: null,
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'perk-lucky-trader',
            name: 'Lucky Trader',
            description: '+10% bonus XP on all trades',
            type: 'perk',
            rarity: 'rare',
            cost: 3000,
            effect: { type: 'xp_bonus', value: 0.10 },
            icon: '🍀',
            duration: null,
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'perk-coin-magnet',
            name: 'Coin Magnet',
            description: '+5% bonus Nexus Coins from all activities',
            type: 'perk',
            rarity: 'epic',
            cost: 5000,
            effect: { type: 'coin_bonus', value: 0.05 },
            icon: '🧲',
            duration: null,
            unlockRequirement: { type: 'level', value: 25 }
        },
        {
            id: 'perk-profit-boost',
            name: 'Profit Boost',
            description: '+3% bonus on profitable trades',
            type: 'perk',
            rarity: 'epic',
            cost: 8000,
            effect: { type: 'profit_bonus', value: 0.03 },
            icon: '💎',
            duration: null,
            unlockRequirement: { type: 'level', value: 35 }
        },
        {
            id: 'perk-streak-master',
            name: 'Streak Master',
            description: 'Login streak never breaks (1 day grace period)',
            type: 'perk',
            rarity: 'legendary',
            cost: 15000,
            effect: { type: 'streak_protection', value: 1 },
            icon: '🔥',
            duration: null,
            unlockRequirement: { type: 'level', value: 40 }
        },
        {
            id: 'perk-double-daily',
            name: 'Double Daily',
            description: 'Complete 2 daily challenges per day',
            type: 'perk',
            rarity: 'legendary',
            cost: 20000,
            effect: { type: 'extra_daily', value: 1 },
            icon: '⚡',
            duration: null,
            unlockRequirement: { type: 'level', value: 50 }
        }
    ],

    // ===== PROFILE THEMES (12 items) =====
    profileThemes: [
        {
            id: 'theme-default',
            name: 'Default Theme',
            description: 'Classic Nexus blue theme',
            type: 'profile-theme',
            rarity: 'common',
            cost: 0,
            colors: {
                primary: '#00adef',
                secondary: '#0891b2',
                accent: '#06b6d4',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)'
            },
            unlockRequirement: null
        },
        {
            id: 'theme-emerald',
            name: 'Emerald Dreams',
            description: 'Vibrant green theme for profit enthusiasts',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 2500,
            colors: {
                primary: '#10b981',
                secondary: '#059669',
                accent: '#34d399',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'theme-crimson',
            name: 'Crimson Fire',
            description: 'Bold red theme for aggressive traders',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 2500,
            colors: {
                primary: '#ef4444',
                secondary: '#dc2626',
                accent: '#f87171',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 12 }
        },
        {
            id: 'theme-ocean',
            name: 'Ocean Depths',
            description: 'Deep blue theme inspired by the ocean',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 3000,
            colors: {
                primary: '#0ea5e9',
                secondary: '#0284c7',
                accent: '#38bdf8',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'theme-forest',
            name: 'Forest Canopy',
            description: 'Natural green theme for organic growth',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 3000,
            colors: {
                primary: '#22c55e',
                secondary: '#16a34a',
                accent: '#4ade80',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 18 }
        },
        {
            id: 'theme-royal',
            name: 'Royal Purple',
            description: 'Majestic purple theme for royalty',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 4000,
            colors: {
                primary: '#8b5cf6',
                secondary: '#7c3aed',
                accent: '#a78bfa',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 30 }
        },
        {
            id: 'theme-midnight',
            name: 'Midnight Shadow',
            description: 'Dark indigo theme for night traders',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 4500,
            colors: {
                primary: '#6366f1',
                secondary: '#4f46e5',
                accent: '#818cf8',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 35 }
        },
        {
            id: 'theme-sunset',
            name: 'Sunset Blaze',
            description: 'Warm orange and pink gradient',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 6000,
            colors: {
                primary: '#f59e0b',
                secondary: '#ec4899',
                accent: '#fb923c',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 40 }
        },
        {
            id: 'theme-aurora',
            name: 'Aurora Borealis',
            description: 'Mystical teal and purple theme',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 7000,
            colors: {
                primary: '#14b8a6',
                secondary: '#a855f7',
                accent: '#2dd4bf',
                background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)'
            },
            unlockRequirement: { type: 'level', value: 45 }
        },
        {
            id: 'theme-cyber',
            name: 'Cyberpunk Neon',
            description: 'Neon cyan and magenta theme',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 12000,
            colors: {
                primary: '#06b6d4',
                secondary: '#d946ef',
                accent: '#22d3ee',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(217, 70, 239, 0.2) 100%)'
            },
            unlockRequirement: { type: 'level', value: 75 }
        },
        {
            id: 'theme-gold-rush',
            name: 'Gold Rush',
            description: 'Luxurious gold and amber theme',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 15000,
            colors: {
                primary: '#fbbf24',
                secondary: '#f59e0b',
                accent: '#fcd34d',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)'
            },
            unlockRequirement: { type: 'level', value: 80 }
        },
        {
            id: 'theme-cosmic',
            name: 'Cosmic Void',
            description: 'Deep space theme with stars',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 18000,
            colors: {
                primary: '#6366f1',
                secondary: '#0f172a',
                accent: '#a78bfa',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 6, 39, 0.95) 100%)'
            },
            unlockRequirement: { type: 'level', value: 90 }
        }
    ],

    // ===== BADGES (12 items) =====
    badges: [
        {
            id: 'badge-founder',
            name: 'Founder',
            description: 'Early adopter of Nexus Signal',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: '👑',
            color: '#fbbf24',
            unlockRequirement: { type: 'special', value: 'founder' }
        },
        {
            id: 'badge-first-trade',
            name: 'First Trade',
            description: 'Completed your first trade',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: '🎯',
            color: '#3b82f6',
            unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 1 }
        },
        {
            id: 'badge-week-warrior',
            name: 'Week Warrior',
            description: '7 day login streak achieved',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: '⭐',
            color: '#f59e0b',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 7 }
        },
        {
            id: 'badge-trade-master',
            name: 'Trade Master',
            description: 'Completed 500+ trades',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: '📊',
            color: '#3b82f6',
            unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 500 }
        },
        {
            id: 'badge-portfolio-builder',
            name: 'Portfolio Builder',
            description: 'Own 10+ different stocks',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: '🏗️',
            color: '#0ea5e9',
            unlockRequirement: { type: 'stats', stat: 'stocksOwned', value: 10 }
        },
        {
            id: 'badge-profit-king',
            name: 'Profit King',
            description: 'Earned over $10,000 in profits',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: '💰',
            color: '#10b981',
            unlockRequirement: { type: 'stats', stat: 'totalProfit', value: 10000 }
        },
        {
            id: 'badge-dedicated',
            name: 'Dedicated',
            description: '30 day login streak achieved',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: '🔥',
            color: '#ef4444',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 30 }
        },
        {
            id: 'badge-prediction-master',
            name: 'Oracle',
            description: '100+ correct predictions',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: '🔮',
            color: '#8b5cf6',
            unlockRequirement: { type: 'stats', stat: 'correctPredictions', value: 100 }
        },
        {
            id: 'badge-level-50',
            name: 'Half Century',
            description: 'Reached Level 50',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: '5️⃣0️⃣',
            color: '#a855f7',
            unlockRequirement: { type: 'level', value: 50 }
        },
        {
            id: 'badge-whale',
            name: 'Whale',
            description: 'Own 100,000+ Nexus Coins',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: '🐋',
            color: '#8b5cf6',
            unlockRequirement: { type: 'stats', stat: 'nexusCoins', value: 100000 }
        },
        {
            id: 'badge-level-100',
            name: 'Centurion',
            description: 'Reached Level 100',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: '💯',
            color: '#f59e0b',
            unlockRequirement: { type: 'level', value: 100 }
        },
        {
            id: 'badge-millionaire',
            name: 'Millionaire',
            description: 'Portfolio value exceeds $1,000,000',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: '💵',
            color: '#10b981',
            unlockRequirement: { type: 'stats', stat: 'portfolioValue', value: 1000000 }
        }
    ]
};

module.exports = { VAULT_ITEMS };