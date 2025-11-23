// server/config/achievements.js - ULTIMATE BADASS EDITION 🔥

const ACHIEVEMENTS = {
    // ============================================
    // 🎯 GETTING STARTED (COMMON)
    // ============================================
    FIRST_BLOOD: {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Make your first trade',
        icon: '🎯',
        category: 'trading',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.totalTrades >= 1
    },

    BABY_STEPS: {
        id: 'baby_steps',
        name: 'Baby Steps',
        description: 'Complete your first day on the platform',
        icon: '👶',
        category: 'milestones',
        rarity: 'common',
        points: 25,
        check: (stats) => stats.daysActive >= 1
    },

    SHOW_ME_THE_MONEY: {
        id: 'show_me_the_money',
        name: 'Show Me The Money',
        description: 'Make your first profitable trade',
        icon: '💵',
        category: 'trading',
        rarity: 'common',
        points: 75,
        check: (stats) => stats.profitableTrades >= 1
    },

    PORTFOLIO_STARTER: {
        id: 'portfolio_starter',
        name: 'Portfolio Starter',
        description: 'Add your first stock to portfolio',
        icon: '📊',
        category: 'portfolio',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.stocksOwned >= 1
    },

    CRYSTAL_BALL: {
        id: 'crystal_ball',
        name: 'Crystal Ball',
        description: 'Create your first AI prediction',
        icon: '🔮',
        category: 'predictions',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.predictionsCreated >= 1
    },

    // ============================================
    // 💰 PROFIT ACHIEVEMENTS (RARE-LEGENDARY)
    // ============================================
    HUNDRED_CLUB: {
        id: 'hundred_club',
        name: 'Hundred Club',
        description: 'Make $100 in total profit',
        icon: '💯',
        category: 'profit',
        rarity: 'rare',
        points: 100,
        check: (stats) => stats.totalProfit >= 100
    },

    THOUSAND_CLUB: {
        id: 'thousand_club',
        name: 'Thousand Club',
        description: 'Make $1,000 in total profit',
        icon: '💰',
        category: 'profit',
        rarity: 'rare',
        points: 250,
        check: (stats) => stats.totalProfit >= 1000
    },

    TEN_K_CLUB: {
        id: 'ten_k_club',
        name: '10K Club',
        description: 'Make $10,000 in total profit',
        icon: '🏆',
        category: 'profit',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.totalProfit >= 10000
    },

    WHALE: {
        id: 'whale',
        name: 'Whale',
        description: 'Make $50,000 in total profit',
        icon: '🐋',
        category: 'profit',
        rarity: 'epic',
        points: 1000,
        check: (stats) => stats.totalProfit >= 50000
    },

    WALL_STREET_LEGEND: {
        id: 'wall_street_legend',
        name: 'Wall Street Legend',
        description: 'Make $100,000 in total profit',
        icon: '👑',
        category: 'profit',
        rarity: 'legendary',
        points: 2500,
        check: (stats) => stats.totalProfit >= 100000
    },

    BILLIONAIRE: {
        id: 'billionaire',
        name: 'Billionaire Status',
        description: 'Make $1,000,000 in total profit',
        icon: '💎',
        category: 'profit',
        rarity: 'legendary',
        points: 10000,
        check: (stats) => stats.totalProfit >= 1000000
    },

    // ============================================
    // 📈 TRADING VOLUME (COMMON-EPIC)
    // ============================================
    CASUAL_TRADER: {
        id: 'casual_trader',
        name: 'Casual Trader',
        description: 'Complete 10 trades',
        icon: '🎲',
        category: 'trading',
        rarity: 'common',
        points: 100,
        check: (stats) => stats.totalTrades >= 10
    },

    ACTIVE_TRADER: {
        id: 'active_trader',
        name: 'Active Trader',
        description: 'Complete 50 trades',
        icon: '📊',
        category: 'trading',
        rarity: 'rare',
        points: 200,
        check: (stats) => stats.totalTrades >= 50
    },

    TRADING_ADDICT: {
        id: 'trading_addict',
        name: 'Trading Addict',
        description: 'Complete 100 trades',
        icon: '🔥',
        category: 'trading',
        rarity: 'rare',
        points: 300,
        check: (stats) => stats.totalTrades >= 100
    },

    DAY_TRADER: {
        id: 'day_trader',
        name: 'Day Trader',
        description: 'Complete 250 trades',
        icon: '⚡',
        category: 'trading',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.totalTrades >= 250
    },

    PROFESSIONAL: {
        id: 'professional',
        name: 'Professional',
        description: 'Complete 500 trades',
        icon: '💼',
        category: 'trading',
        rarity: 'epic',
        points: 750,
        check: (stats) => stats.totalTrades >= 500
    },

    TRADING_GOD: {
        id: 'trading_god',
        name: 'Trading God',
        description: 'Complete 1,000 trades',
        icon: '⚔️',
        category: 'trading',
        rarity: 'legendary',
        points: 1500,
        check: (stats) => stats.totalTrades >= 1000
    },

    // ============================================
    // 🎯 WIN RATE ACHIEVEMENTS (RARE-LEGENDARY)
    // ============================================
    GETTING_GOOD: {
        id: 'getting_good',
        name: 'Getting Good',
        description: 'Maintain 60% win rate with 20+ trades',
        icon: '📈',
        category: 'skill',
        rarity: 'rare',
        points: 250,
        check: (stats) => {
            if (stats.totalTrades < 20) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 60;
        }
    },

    SHARP_SHOOTER: {
        id: 'sharp_shooter',
        name: 'Sharp Shooter',
        description: 'Maintain 70% win rate with 50+ trades',
        icon: '🎯',
        category: 'skill',
        rarity: 'epic',
        points: 500,
        check: (stats) => {
            if (stats.totalTrades < 50) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 70;
        }
    },

    SNIPER: {
        id: 'sniper',
        name: 'Sniper',
        description: 'Maintain 80% win rate with 100+ trades',
        icon: '🔫',
        category: 'skill',
        rarity: 'epic',
        points: 1000,
        check: (stats) => {
            if (stats.totalTrades < 100) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 80;
        }
    },

    PERFECT_PRECISION: {
        id: 'perfect_precision',
        name: 'Perfect Precision',
        description: 'Maintain 90% win rate with 50+ trades',
        icon: '💫',
        category: 'skill',
        rarity: 'legendary',
        points: 2000,
        check: (stats) => {
            if (stats.totalTrades < 50) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 90;
        }
    },

    UNSTOPPABLE: {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: '10 profitable trades in a row',
        icon: '🚀',
        category: 'streaks',
        rarity: 'legendary',
        points: 1500,
        check: (stats, gamification) => gamification.maxProfitStreak >= 10
    },

    // ============================================
    // 🔮 PREDICTION ACHIEVEMENTS (COMMON-LEGENDARY)
    // ============================================
    FORTUNE_TELLER: {
        id: 'fortune_teller',
        name: 'Fortune Teller',
        description: 'Make 10 predictions',
        icon: '🔮',
        category: 'predictions',
        rarity: 'common',
        points: 100,
        check: (stats) => stats.predictionsCreated >= 10
    },

    ORACLE: {
        id: 'oracle',
        name: 'Oracle',
        description: 'Make 50 predictions',
        icon: '🌟',
        category: 'predictions',
        rarity: 'rare',
        points: 250,
        check: (stats) => stats.predictionsCreated >= 50
    },

    PROPHET: {
        id: 'prophet',
        name: 'Prophet',
        description: 'Make 100 predictions',
        icon: '✨',
        category: 'predictions',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.predictionsCreated >= 100
    },

    FIRST_CORRECT: {
        id: 'first_correct',
        name: 'Nailed It!',
        description: 'Get your first prediction correct',
        icon: '✅',
        category: 'predictions',
        rarity: 'common',
        points: 100,
        check: (stats) => stats.correctPredictions >= 1
    },

    PREDICTION_MASTER: {
        id: 'prediction_master',
        name: 'Prediction Master',
        description: 'Get 25 predictions correct',
        icon: '🎯',
        category: 'predictions',
        rarity: 'rare',
        points: 300,
        check: (stats) => stats.correctPredictions >= 25
    },

    NOSTRADAMUS: {
        id: 'nostradamus',
        name: 'Nostradamus',
        description: 'Get 100 predictions correct',
        icon: '🌠',
        category: 'predictions',
        rarity: 'legendary',
        points: 1500,
        check: (stats) => stats.correctPredictions >= 100
    },

    PREDICTION_ACCURACY: {
        id: 'prediction_accuracy',
        name: 'AI Whisperer',
        description: '75% prediction accuracy with 20+ predictions',
        icon: '🤖',
        category: 'predictions',
        rarity: 'epic',
        points: 750,
        check: (stats) => {
            if (stats.predictionsCreated < 20) return false;
            const accuracy = (stats.correctPredictions / stats.predictionsCreated) * 100;
            return accuracy >= 75;
        }
    },

    // ============================================
    // 📊 PORTFOLIO ACHIEVEMENTS (COMMON-LEGENDARY)
    // ============================================
    DIVERSIFY: {
        id: 'diversify',
        name: 'Diversify',
        description: 'Own 5 different stocks',
        icon: '📊',
        category: 'portfolio',
        rarity: 'common',
        points: 100,
        check: (stats) => stats.stocksOwned >= 5
    },

    PORTFOLIO_MANAGER: {
        id: 'portfolio_manager',
        name: 'Portfolio Manager',
        description: 'Own 10 different stocks',
        icon: '💼',
        category: 'portfolio',
        rarity: 'rare',
        points: 200,
        check: (stats) => stats.stocksOwned >= 10
    },

    HEDGE_FUND: {
        id: 'hedge_fund',
        name: 'Hedge Fund',
        description: 'Own 25 different stocks',
        icon: '🏦',
        category: 'portfolio',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.stocksOwned >= 25
    },

    EMPIRE: {
        id: 'empire',
        name: 'Empire Builder',
        description: 'Own 50 different stocks',
        icon: '🏰',
        category: 'portfolio',
        rarity: 'legendary',
        points: 1000,
        check: (stats) => stats.stocksOwned >= 50
    },

    PORTFOLIO_10K: {
        id: 'portfolio_10k',
        name: 'Five Figure Portfolio',
        description: 'Portfolio value reaches $10,000',
        icon: '💰',
        category: 'portfolio',
        rarity: 'rare',
        points: 250,
        check: (stats) => stats.portfolioValue >= 10000
    },

    PORTFOLIO_50K: {
        id: 'portfolio_50k',
        name: 'Portfolio Whale',
        description: 'Portfolio value reaches $50,000',
        icon: '🐋',
        category: 'portfolio',
        rarity: 'epic',
        points: 750,
        check: (stats) => stats.portfolioValue >= 50000
    },

    PORTFOLIO_100K: {
        id: 'portfolio_100k',
        name: 'Six Figure Portfolio',
        description: 'Portfolio value reaches $100,000',
        icon: '💎',
        category: 'portfolio',
        rarity: 'legendary',
        points: 1500,
        check: (stats) => stats.portfolioValue >= 100000
    },

    PORTFOLIO_MILLION: {
        id: 'portfolio_million',
        name: 'Millionaire',
        description: 'Portfolio value reaches $1,000,000',
        icon: '👑',
        category: 'portfolio',
        rarity: 'legendary',
        points: 5000,
        check: (stats) => stats.portfolioValue >= 1000000
    },

    // ============================================
    // 🔥 LOGIN STREAK ACHIEVEMENTS (COMMON-LEGENDARY)
    // ============================================
    CONSISTENT: {
        id: 'consistent',
        name: 'Consistent',
        description: 'Login for 7 days in a row',
        icon: '📅',
        category: 'streaks',
        rarity: 'common',
        points: 100,
        check: (stats, gamification) => gamification.maxLoginStreak >= 7
    },

    DEDICATED: {
        id: 'dedicated',
        name: 'Dedicated',
        description: 'Login for 30 days in a row',
        icon: '🔥',
        category: 'streaks',
        rarity: 'rare',
        points: 300,
        check: (stats, gamification) => gamification.maxLoginStreak >= 30
    },

    COMMITTED: {
        id: 'committed',
        name: 'Committed',
        description: 'Login for 60 days in a row',
        icon: '💪',
        category: 'streaks',
        rarity: 'epic',
        points: 600,
        check: (stats, gamification) => gamification.maxLoginStreak >= 60
    },

    UNSTOPPABLE_LOGIN: {
        id: 'unstoppable_login',
        name: 'Unstoppable',
        description: 'Login for 100 days in a row',
        icon: '⚡',
        category: 'streaks',
        rarity: 'epic',
        points: 1000,
        check: (stats, gamification) => gamification.maxLoginStreak >= 100
    },

    YEAR_LONG: {
        id: 'year_long',
        name: 'Year Long Dedication',
        description: 'Login for 365 days in a row',
        icon: '🌟',
        category: 'streaks',
        rarity: 'legendary',
        points: 3650,
        check: (stats, gamification) => gamification.maxLoginStreak >= 365
    },

    // ============================================
    // 🎮 LEVEL ACHIEVEMENTS (COMMON-LEGENDARY)
    // ============================================
    LEVEL_5: {
        id: 'level_5',
        name: 'Getting Started',
        description: 'Reach Level 5',
        icon: '5️⃣',
        category: 'milestones',
        rarity: 'common',
        points: 50,
        check: (stats, gamification) => gamification.level >= 5
    },

    LEVEL_10: {
        id: 'level_10',
        name: 'Rising Star',
        description: 'Reach Level 10',
        icon: '🔟',
        category: 'milestones',
        rarity: 'common',
        points: 100,
        check: (stats, gamification) => gamification.level >= 10
    },

    LEVEL_25: {
        id: 'level_25',
        name: 'Veteran Trader',
        description: 'Reach Level 25',
        icon: '💫',
        category: 'milestones',
        rarity: 'rare',
        points: 250,
        check: (stats, gamification) => gamification.level >= 25
    },

    LEVEL_50: {
        id: 'level_50',
        name: 'Elite Trader',
        description: 'Reach Level 50',
        icon: '⭐',
        category: 'milestones',
        rarity: 'epic',
        points: 500,
        check: (stats, gamification) => gamification.level >= 50
    },

    LEVEL_75: {
        id: 'level_75',
        name: 'Master Trader',
        description: 'Reach Level 75',
        icon: '🎖️',
        category: 'milestones',
        rarity: 'epic',
        points: 750,
        check: (stats, gamification) => gamification.level >= 75
    },

    LEVEL_100: {
        id: 'level_100',
        name: 'Century Club',
        description: 'Reach Level 100',
        icon: '💯',
        category: 'milestones',
        rarity: 'legendary',
        points: 1000,
        check: (stats, gamification) => gamification.level >= 100
    },

    // ============================================
    // 💎 COIN ACHIEVEMENTS (RARE-LEGENDARY)
    // ============================================
    COIN_COLLECTOR: {
        id: 'coin_collector',
        name: 'Coin Collector',
        description: 'Earn 1,000 Nexus Coins',
        icon: '🪙',
        category: 'coins',
        rarity: 'rare',
        points: 100,
        check: (stats, gamification) => gamification.totalEarned >= 1000
    },

    COIN_HOARDER: {
        id: 'coin_hoarder',
        name: 'Coin Hoarder',
        description: 'Earn 5,000 Nexus Coins',
        icon: '💰',
        category: 'coins',
        rarity: 'epic',
        points: 250,
        check: (stats, gamification) => gamification.totalEarned >= 5000
    },

    COIN_TYCOON: {
        id: 'coin_tycoon',
        name: 'Coin Tycoon',
        description: 'Earn 10,000 Nexus Coins',
        icon: '💎',
        category: 'coins',
        rarity: 'legendary',
        points: 500,
        check: (stats, gamification) => gamification.totalEarned >= 10000
    },

    RICH: {
        id: 'rich',
        name: 'Filthy Rich',
        description: 'Have 5,000 Nexus Coins at once',
        icon: '🤑',
        category: 'coins',
        rarity: 'epic',
        points: 500,
        check: (stats, gamification) => gamification.nexusCoins >= 5000
    },

    // ============================================
    // 🏆 SPECIAL & FUN ACHIEVEMENTS (RARE-LEGENDARY)
    // ============================================
    EARLY_BIRD: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Make a trade before 9 AM',
        icon: '🌅',
        category: 'special',
        rarity: 'rare',
        points: 150,
        check: () => false // Implement time-based check
    },

    NIGHT_OWL: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Make a trade after midnight',
        icon: '🦉',
        category: 'special',
        rarity: 'rare',
        points: 150,
        check: () => false // Implement time-based check
    },

    SPEED_DEMON: {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Complete 10 trades in one day',
        icon: '⚡',
        category: 'special',
        rarity: 'epic',
        points: 300,
        check: () => false // Implement daily tracking
    },

    COMEBACK_KID: {
        id: 'comeback_kid',
        name: 'Comeback Kid',
        description: 'Recover from 5 losses in a row with a win',
        icon: '🔄',
        category: 'special',
        rarity: 'epic',
        points: 400,
        check: () => false // Implement loss tracking
    },

    RISK_TAKER: {
        id: 'risk_taker',
        name: 'Risk Taker',
        description: 'Make a trade worth over $10,000',
        icon: '🎲',
        category: 'special',
        rarity: 'epic',
        points: 500,
        check: () => false // Implement trade value tracking
    },

    DIAMOND_HANDS: {
        id: 'diamond_hands',
        name: 'Diamond Hands 💎🙌',
        description: 'Hold a stock for 30 days',
        icon: '💎',
        category: 'special',
        rarity: 'epic',
        points: 750,
        check: () => false // Implement holding period tracking
    },

    PAPER_HANDS: {
        id: 'paper_hands',
        name: 'Paper Hands',
        description: 'Sell a stock within 1 hour of buying',
        icon: '📄',
        category: 'special',
        rarity: 'rare',
        points: 50,
        check: () => false // Implement quick sell tracking
    },

    LUCKY_SEVEN: {
        id: 'lucky_seven',
        name: 'Lucky Seven',
        description: 'Make exactly $777 profit on a trade',
        icon: '🎰',
        category: 'special',
        rarity: 'legendary',
        points: 777,
        check: () => false // Implement exact profit tracking
    },

    PENNY_PINCHER: {
        id: 'penny_pincher',
        name: 'Penny Pincher',
        description: 'Make 50 trades with penny stocks',
        icon: '🪙',
        category: 'special',
        rarity: 'rare',
        points: 200,
        check: () => false // Implement penny stock tracking
    },

    BLUE_CHIP: {
        id: 'blue_chip',
        name: 'Blue Chip Investor',
        description: 'Own 5 stocks worth over $100',
        icon: '🔵',
        category: 'special',
        rarity: 'rare',
        points: 250,
        check: () => false // Implement price tracking
    },

    // ============================================
    // 🎯 MASTERY ACHIEVEMENTS (LEGENDARY)
    // ============================================
    TRADING_SENSEI: {
        id: 'trading_sensei',
        name: 'Trading Sensei',
        description: '85% win rate with 200+ trades',
        icon: '🥋',
        category: 'mastery',
        rarity: 'legendary',
        points: 2500,
        check: (stats) => {
            if (stats.totalTrades < 200) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 85;
        }
    },

    GRAND_MASTER: {
        id: 'grand_master',
        name: 'Grand Master',
        description: 'Reach Level 100 with 90% win rate',
        icon: '🏅',
        category: 'mastery',
        rarity: 'legendary',
        points: 5000,
        check: (stats, gamification) => {
            if (gamification.level < 100 || stats.totalTrades < 100) return false;
            const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
            return winRate >= 90;
        }
    },

    ACHIEVEMENT_HUNTER: {
        id: 'achievement_hunter',
        name: 'Achievement Hunter',
        description: 'Unlock 50 achievements',
        icon: '🏆',
        category: 'mastery',
        rarity: 'legendary',
        points: 2500,
        check: (stats, gamification) => gamification.achievements.length >= 50
    },

    COMPLETIONIST: {
        id: 'completionist',
        name: 'Completionist',
        description: 'Unlock 100 achievements',
        icon: '👑',
        category: 'mastery',
        rarity: 'legendary',
        points: 10000,
        check: (stats, gamification) => gamification.achievements.length >= 100
    },

    JACK_OF_ALL_TRADES: {
        id: 'jack_of_all_trades',
        name: 'Jack of All Trades',
        description: 'Unlock at least one achievement in every category',
        icon: '🃏',
        category: 'mastery',
        rarity: 'legendary',
        points: 3000,
        check: (stats, gamification) => {
            const categories = new Set(gamification.achievements.map(a => {
                // Find the category from ACHIEVEMENTS
                const achievement = Object.values(ACHIEVEMENTS).find(ach => ach.id === a.id);
                return achievement?.category;
            }));
            return categories.size >= 8; // Adjust based on total categories
        }
    },

    THE_LEGEND: {
        id: 'the_legend',
        name: 'The Legend',
        description: 'Unlock all legendary achievements',
        icon: '⚡',
        category: 'mastery',
        rarity: 'legendary',
        points: 15000,
        check: (stats, gamification) => {
            const legendaryAchievements = Object.values(ACHIEVEMENTS).filter(a => a.rarity === 'legendary');
            const unlockedLegendary = gamification.achievements.filter(a => {
                const achievement = Object.values(ACHIEVEMENTS).find(ach => ach.id === a.id);
                return achievement?.rarity === 'legendary';
            });
            return unlockedLegendary.length >= legendaryAchievements.length;
        }
    },

    // ============================================
    // 🎊 EASTER EGG ACHIEVEMENTS (LEGENDARY)
    // ============================================
    STONKS: {
        id: 'stonks',
        name: 'STONKS 📈',
        description: 'Buy TSLA at exactly $420.69',
        icon: '🚀',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 420,
        check: () => false // Implement meme price tracking
    },

    TO_THE_MOON: {
        id: 'to_the_moon',
        name: 'To The Moon! 🚀',
        description: 'Have a stock gain over 100% in one day',
        icon: '🌙',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 1000,
        check: () => false // Implement daily gain tracking
    },

    WSB_MEMBER: {
        id: 'wsb_member',
        name: 'WSB Member',
        description: 'YOLO $10,000 on a single trade',
        icon: '🦍',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 1000,
        check: () => false // Implement YOLO tracking
    },

    BUY_THE_DIP: {
        id: 'buy_the_dip',
        name: 'Buy The Dip',
        description: 'Buy a stock at its 52-week low',
        icon: '📉',
        category: 'easter_egg',
        rarity: 'rare',
        points: 300,
        check: () => false // Implement 52-week tracking
    },

    HODL: {
        id: 'hodl',
        name: 'HODL',
        description: 'Hold a losing position for 7 days',
        icon: '💪',
        category: 'easter_egg',
        rarity: 'rare',
        points: 200,
        check: () => false // Implement loss holding tracking
    },

    NUMBER_GO_UP: {
        id: 'number_go_up',
        name: 'Number Go Up',
        description: 'Watch your portfolio gain $1,000 in one day',
        icon: '📊',
        category: 'easter_egg',
        rarity: 'epic',
        points: 500,
        check: () => false // Implement daily portfolio tracking
    },

    // ============================================
    // 🌟 TIME-BASED ACHIEVEMENTS (RARE-EPIC)
    // ============================================
    WEEKEND_WARRIOR: {
        id: 'weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Login on both Saturday and Sunday',
        icon: '🏖️',
        category: 'time_based',
        rarity: 'rare',
        points: 100,
        check: () => false // Implement weekend tracking
    },

    MONTHLY_ACTIVE: {
        id: 'monthly_active',
        name: 'Monthly Active',
        description: 'Login every day for a month',
        icon: '📆',
        category: 'time_based',
        rarity: 'epic',
        points: 500,
        check: () => false // Implement monthly tracking
    },

    VETERAN: {
        id: 'veteran',
        name: 'Veteran',
        description: 'Active for 180 days',
        icon: '🎖️',
        category: 'time_based',
        rarity: 'epic',
        points: 1000,
        check: (stats) => stats.daysActive >= 180
    },

    OLD_TIMER: {
        id: 'old_timer',
        name: 'Old Timer',
        description: 'Active for 365 days',
        icon: '⌛',
        category: 'time_based',
        rarity: 'legendary',
        points: 2000,
        check: (stats) => stats.daysActive >= 365
    },

    // ============================================
    // 💪 CHALLENGE ACHIEVEMENTS (COMMON-EPIC)
    // ============================================
    CHALLENGE_STARTER: {
        id: 'challenge_starter',
        name: 'Challenge Starter',
        description: 'Complete your first daily challenge',
        icon: '🎯',
        category: 'challenges',
        rarity: 'common',
        points: 50,
        check: () => false // Implement challenge tracking
    },

    CHALLENGE_MASTER: {
        id: 'challenge_master',
        name: 'Challenge Master',
        description: 'Complete 30 daily challenges',
        icon: '🏆',
        category: 'challenges',
        rarity: 'rare',
        points: 300,
        check: () => false // Implement challenge tracking
    },

    CHALLENGE_LEGEND: {
        id: 'challenge_legend',
        name: 'Challenge Legend',
        description: 'Complete 100 daily challenges',
        icon: '⚡',
        category: 'challenges',
        rarity: 'epic',
        points: 1000,
        check: () => false // Implement challenge tracking
    },

    PERFECT_WEEK: {
        id: 'perfect_week',
        name: 'Perfect Week',
        description: 'Complete all challenges for 7 days straight',
        icon: '✨',
        category: 'challenges',
        rarity: 'epic',
        points: 750,
        check: () => false // Implement streak tracking
    },

    // ============================================
    // 🎨 SOCIAL ACHIEVEMENTS (COMMON-RARE)
    // ============================================
    FIRST_FRIEND: {
        id: 'first_friend',
        name: 'Making Friends',
        description: 'Follow your first trader',
        icon: '👥',
        category: 'social',
        rarity: 'common',
        points: 50,
        check: () => false // Implement social tracking
    },

    POPULAR: {
        id: 'popular',
        name: 'Popular',
        description: 'Get 10 followers',
        icon: '⭐',
        category: 'social',
        rarity: 'rare',
        points: 200,
        check: () => false // Implement follower tracking
    },

    INFLUENCER: {
        id: 'influencer',
        name: 'Influencer',
        description: 'Get 100 followers',
        icon: '📱',
        category: 'social',
        rarity: 'epic',
        points: 500,
        check: () => false // Implement follower tracking
    },

    CELEBRITY: {
        id: 'celebrity',
        name: 'Celebrity Trader',
        description: 'Get 1,000 followers',
        icon: '🌟',
        category: 'social',
        rarity: 'legendary',
        points: 2000,
        check: () => false // Implement follower tracking
    },

    HELPFUL: {
        id: 'helpful',
        name: 'Helpful',
        description: 'Share 10 trading tips',
        icon: '💡',
        category: 'social',
        rarity: 'rare',
        points: 150,
        check: () => false // Implement sharing tracking
    },

    // ============================================
    // 🏅 LEADERBOARD ACHIEVEMENTS (EPIC-LEGENDARY)
    // ============================================
    TOP_100: {
        id: 'top_100',
        name: 'Top 100',
        description: 'Reach Top 100 on leaderboard',
        icon: '🥉',
        category: 'leaderboard',
        rarity: 'epic',
        points: 500,
        check: () => false // Implement rank tracking
    },

    TOP_50: {
        id: 'top_50',
        name: 'Top 50',
        description: 'Reach Top 50 on leaderboard',
        icon: '🥈',
        category: 'leaderboard',
        rarity: 'epic',
        points: 750,
        check: () => false // Implement rank tracking
    },

    TOP_10: {
        id: 'top_10',
        name: 'Top 10',
        description: 'Reach Top 10 on leaderboard',
        icon: '🥇',
        category: 'leaderboard',
        rarity: 'legendary',
        points: 1500,
        check: () => false // Implement rank tracking
    },

    NUMBER_ONE: {
        id: 'number_one',
        name: '#1',
        description: 'Reach #1 on leaderboard',
        icon: '👑',
        category: 'leaderboard',
        rarity: 'legendary',
        points: 5000,
        check: () => false // Implement rank tracking
    }
};

module.exports = ACHIEVEMENTS;