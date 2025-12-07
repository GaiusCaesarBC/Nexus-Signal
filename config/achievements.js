// server/config/achievements.js - COMPLETE EDITION WITH PAPER TRADING 🔥

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
        icon: '👒',
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
    // 📉 PAPER TRADING - LOSSES & RECOVERY (NEW!)
    // ============================================
    FIRST_LOSS: {
        id: 'first_loss',
        name: 'Learning Experience',
        description: 'Experience your first losing trade',
        icon: '📉',
        category: 'paper_trading',
        rarity: 'common',
        points: 25,
        check: (stats) => stats.losingTrades >= 1
    },

    BLOW_YOUR_ACCOUNT: {
        id: 'blow_your_account',
        name: 'Blown Account',
        description: 'Lose your entire paper trading balance',
        icon: '💀',
        category: 'paper_trading',
        rarity: 'rare',
        points: 100,
        check: (stats) => stats.accountBlown === true
    },

    FIRST_REFILL: {
        id: 'first_refill',
        name: 'Second Chance',
        description: 'Refill your paper trading account for the first time',
        icon: '🔄',
        category: 'paper_trading',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.totalRefills >= 1
    },

    REFILL_VETERAN: {
        id: 'refill_veteran',
        name: 'Refill Veteran',
        description: 'Refill your account 5 times',
        icon: '♻️',
        category: 'paper_trading',
        rarity: 'rare',
        points: 100,
        check: (stats) => stats.totalRefills >= 5
    },

    PHOENIX_RISING: {
        id: 'phoenix_rising',
        name: 'Phoenix Rising',
        description: 'Blow your account and recover to profit',
        icon: '🔥',
        category: 'paper_trading',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.phoenixRecovery === true
    },

    COMEBACK_KING: {
        id: 'comeback_king',
        name: 'Comeback King',
        description: 'Go from -50% to positive returns',
        icon: '👑',
        category: 'paper_trading',
        rarity: 'epic',
        points: 750,
        check: (stats) => stats.comebackKing === true
    },

    LOSS_STREAK_5: {
        id: 'loss_streak_5',
        name: 'Bad Luck Brian',
        description: 'Lose 5 trades in a row',
        icon: '😅',
        category: 'paper_trading',
        rarity: 'rare',
        points: 75,
        check: (stats) => stats.maxLossStreak >= 5
    },

    LOSS_STREAK_10: {
        id: 'loss_streak_10',
        name: 'Rock Bottom',
        description: 'Lose 10 trades in a row',
        icon: '🪨',
        category: 'paper_trading',
        rarity: 'epic',
        points: 150,
        check: (stats) => stats.maxLossStreak >= 10
    },

    // ============================================
    // ⚡ LEVERAGE ACHIEVEMENTS (NEW!)
    // ============================================
    FIRST_LEVERAGE: {
        id: 'first_leverage',
        name: 'Leverage Unlocked',
        description: 'Make your first leveraged trade',
        icon: '⚡',
        category: 'paper_trading',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.leveragedTrades >= 1
    },

    LEVERAGE_ADDICT: {
        id: 'leverage_addict',
        name: 'Leverage Addict',
        description: 'Complete 25 leveraged trades',
        icon: '🎰',
        category: 'paper_trading',
        rarity: 'rare',
        points: 200,
        check: (stats) => stats.leveragedTrades >= 25
    },

    MAX_LEVERAGE: {
        id: 'max_leverage',
        name: 'Full Send',
        description: 'Use maximum leverage (20x) on a trade',
        icon: '🚀',
        category: 'paper_trading',
        rarity: 'rare',
        points: 150,
        check: (stats) => stats.usedMaxLeverage === true
    },

    LEVERAGE_WIN_BIG: {
        id: 'leverage_win_big',
        name: 'High Risk, High Reward',
        description: 'Make $10,000 profit on a single leveraged trade',
        icon: '💎',
        category: 'paper_trading',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.biggestLeverageWin >= 10000
    },

    LEVERAGE_LOSS_BIG: {
        id: 'leverage_loss_big',
        name: 'Liquidated',
        description: 'Lose $10,000 on a single leveraged trade',
        icon: '☠️',
        category: 'paper_trading',
        rarity: 'rare',
        points: 100,
        check: (stats) => stats.biggestLeverageLoss >= 10000
    },

    // ============================================
    // 📈 SHORT SELLING ACHIEVEMENTS (NEW!)
    // ============================================
    FIRST_SHORT: {
        id: 'first_short',
        name: 'Bear Mode',
        description: 'Open your first short position',
        icon: '🐻',
        category: 'paper_trading',
        rarity: 'common',
        points: 75,
        check: (stats) => stats.shortTrades >= 1
    },

    SHORT_MASTER: {
        id: 'short_master',
        name: 'Short Master',
        description: 'Profit from 10 short positions',
        icon: '📉',
        category: 'paper_trading',
        rarity: 'rare',
        points: 250,
        check: (stats) => stats.profitableShorts >= 10
    },

    BEAR_MARKET_KING: {
        id: 'bear_market_king',
        name: 'Bear Market King',
        description: 'Make $25,000 total profit from short positions',
        icon: '🐻‍❄️',
        category: 'paper_trading',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.totalShortProfit >= 25000
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
        check: (stats) => stats.totalTrades >= 20 && stats.winRate >= 60
    },

    SHARP_SHOOTER: {
        id: 'sharp_shooter',
        name: 'Sharp Shooter',
        description: 'Maintain 70% win rate with 50+ trades',
        icon: '🎯',
        category: 'skill',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.totalTrades >= 50 && stats.winRate >= 70
    },

    SNIPER: {
        id: 'sniper',
        name: 'Sniper',
        description: 'Maintain 80% win rate with 100+ trades',
        icon: '🔫',
        category: 'skill',
        rarity: 'epic',
        points: 1000,
        check: (stats) => stats.totalTrades >= 100 && stats.winRate >= 80
    },

    PERFECT_PRECISION: {
        id: 'perfect_precision',
        name: 'Perfect Precision',
        description: 'Maintain 90% win rate with 50+ trades',
        icon: '💫',
        category: 'skill',
        rarity: 'legendary',
        points: 2000,
        check: (stats) => stats.totalTrades >= 50 && stats.winRate >= 90
    },

    // ============================================
    // 🔥 STREAK ACHIEVEMENTS
    // ============================================
    WIN_STREAK_5: {
        id: 'win_streak_5',
        name: 'Hot Streak',
        description: '5 profitable trades in a row',
        icon: '🔥',
        category: 'streaks',
        rarity: 'rare',
        points: 200,
        check: (stats, gamification) => (gamification?.maxProfitStreak || stats.maxProfitStreak || 0) >= 5
    },

    WIN_STREAK_10: {
        id: 'win_streak_10',
        name: 'On Fire',
        description: '10 profitable trades in a row',
        icon: '🔥🔥',
        category: 'streaks',
        rarity: 'epic',
        points: 500,
        check: (stats, gamification) => (gamification?.maxProfitStreak || stats.maxProfitStreak || 0) >= 10
    },

    UNSTOPPABLE: {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: '20 profitable trades in a row',
        icon: '🚀',
        category: 'streaks',
        rarity: 'legendary',
        points: 1500,
        check: (stats, gamification) => (gamification?.maxProfitStreak || stats.maxProfitStreak || 0) >= 20
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
        check: (stats) => stats.predictionsCreated >= 20 && stats.predictionAccuracy >= 75
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

    PORTFOLIO_DOUBLE: {
        id: 'portfolio_double',
        name: 'Double Up',
        description: 'Double your starting portfolio value',
        icon: '2️⃣',
        category: 'portfolio',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.portfolioValue >= 200000
    },

    PORTFOLIO_TRIPLE: {
        id: 'portfolio_triple',
        name: 'Triple Threat',
        description: 'Triple your starting portfolio value',
        icon: '3️⃣',
        category: 'portfolio',
        rarity: 'legendary',
        points: 1000,
        check: (stats) => stats.portfolioValue >= 300000
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
        check: (stats, gamification) => (gamification?.maxLoginStreak || 0) >= 7
    },

    DEDICATED: {
        id: 'dedicated',
        name: 'Dedicated',
        description: 'Login for 30 days in a row',
        icon: '🔥',
        category: 'streaks',
        rarity: 'rare',
        points: 300,
        check: (stats, gamification) => (gamification?.maxLoginStreak || 0) >= 30
    },

    COMMITTED: {
        id: 'committed',
        name: 'Committed',
        description: 'Login for 60 days in a row',
        icon: '💪',
        category: 'streaks',
        rarity: 'epic',
        points: 600,
        check: (stats, gamification) => (gamification?.maxLoginStreak || 0) >= 60
    },

    UNSTOPPABLE_LOGIN: {
        id: 'unstoppable_login',
        name: 'Unstoppable Dedication',
        description: 'Login for 100 days in a row',
        icon: '⚡',
        category: 'streaks',
        rarity: 'epic',
        points: 1000,
        check: (stats, gamification) => (gamification?.maxLoginStreak || 0) >= 100
    },

    YEAR_LONG: {
        id: 'year_long',
        name: 'Year Long Dedication',
        description: 'Login for 365 days in a row',
        icon: '🌟',
        category: 'streaks',
        rarity: 'legendary',
        points: 3650,
        check: (stats, gamification) => (gamification?.maxLoginStreak || 0) >= 365
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
        check: (stats, gamification) => (gamification?.level || 0) >= 5
    },

    LEVEL_10: {
        id: 'level_10',
        name: 'Rising Star',
        description: 'Reach Level 10',
        icon: '🔟',
        category: 'milestones',
        rarity: 'common',
        points: 100,
        check: (stats, gamification) => (gamification?.level || 0) >= 10
    },

    LEVEL_25: {
        id: 'level_25',
        name: 'Veteran Trader',
        description: 'Reach Level 25',
        icon: '💫',
        category: 'milestones',
        rarity: 'rare',
        points: 250,
        check: (stats, gamification) => (gamification?.level || 0) >= 25
    },

    LEVEL_50: {
        id: 'level_50',
        name: 'Elite Trader',
        description: 'Reach Level 50',
        icon: '⭐',
        category: 'milestones',
        rarity: 'epic',
        points: 500,
        check: (stats, gamification) => (gamification?.level || 0) >= 50
    },

    LEVEL_75: {
        id: 'level_75',
        name: 'Master Trader',
        description: 'Reach Level 75',
        icon: '🎖️',
        category: 'milestones',
        rarity: 'epic',
        points: 750,
        check: (stats, gamification) => (gamification?.level || 0) >= 75
    },

    LEVEL_100: {
        id: 'level_100',
        name: 'Century Club',
        description: 'Reach Level 100',
        icon: '💯',
        category: 'milestones',
        rarity: 'legendary',
        points: 1000,
        check: (stats, gamification) => (gamification?.level || 0) >= 100
    },

    // ============================================
    // 💎 COIN ACHIEVEMENTS (RARE-LEGENDARY)
    // ============================================
    COIN_COLLECTOR: {
        id: 'coin_collector',
        name: 'Coin Collector',
        description: 'Earn 1,000 Nexus Coins total',
        icon: '🪙',
        category: 'coins',
        rarity: 'rare',
        points: 100,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 1000
    },

    COIN_HOARDER: {
        id: 'coin_hoarder',
        name: 'Coin Hoarder',
        description: 'Earn 5,000 Nexus Coins total',
        icon: '💰',
        category: 'coins',
        rarity: 'epic',
        points: 250,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 5000
    },

    COIN_TYCOON: {
        id: 'coin_tycoon',
        name: 'Coin Tycoon',
        description: 'Earn 10,000 Nexus Coins total',
        icon: '💎',
        category: 'coins',
        rarity: 'legendary',
        points: 500,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 10000
    },

    COIN_MOGUL: {
        id: 'coin_mogul',
        name: 'Coin Mogul',
        description: 'Earn 50,000 Nexus Coins total',
        icon: '👑',
        category: 'coins',
        rarity: 'legendary',
        points: 1000,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 50000
    },

    COIN_EMPEROR: {
        id: 'coin_emperor',
        name: 'Coin Emperor',
        description: 'Earn 100,000 Nexus Coins total',
        icon: '🏆',
        category: 'coins',
        rarity: 'legendary',
        points: 2500,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 100000
    },

    COIN_LEGEND: {
        id: 'coin_legend',
        name: 'Coin Legend',
        description: 'Earn 500,000 Nexus Coins total',
        icon: '🌟',
        category: 'coins',
        rarity: 'mythic',
        points: 5000,
        check: (stats, gamification) => (gamification?.totalCoinsEarned || 0) >= 500000
    },

    RICH: {
        id: 'rich',
        name: 'Filthy Rich',
        description: 'Have 5,000 Nexus Coins at once',
        icon: '🤑',
        category: 'coins',
        rarity: 'epic',
        points: 500,
        check: (stats, gamification) => (gamification?.nexusCoins || 0) >= 5000
    },

    MEGA_RICH: {
        id: 'mega_rich',
        name: 'Mega Rich',
        description: 'Have 100,000 Nexus Coins at once',
        icon: '💵',
        category: 'coins',
        rarity: 'legendary',
        points: 1500,
        check: (stats, gamification) => (gamification?.nexusCoins || 0) >= 100000
    },

    ULTRA_RICH: {
        id: 'ultra_rich',
        name: 'Ultra Rich',
        description: 'Have 500,000 Nexus Coins at once',
        icon: '💰',
        category: 'coins',
        rarity: 'mythic',
        points: 3000,
        check: (stats, gamification) => (gamification?.nexusCoins || 0) >= 500000
    },

    // ============================================
    // 🏆 SPECIAL & FUN ACHIEVEMENTS
    // ============================================
    SPEED_DEMON: {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Complete 10 trades in one day',
        icon: '⚡',
        category: 'special',
        rarity: 'epic',
        points: 300,
        check: (stats) => stats.maxTradesInDay >= 10
    },

    COMEBACK_KID: {
        id: 'comeback_kid',
        name: 'Comeback Kid',
        description: 'Win a trade after 5 losses in a row',
        icon: '🔄',
        category: 'special',
        rarity: 'epic',
        points: 400,
        check: (stats) => stats.comebackWin === true
    },

    RISK_TAKER: {
        id: 'risk_taker',
        name: 'Risk Taker',
        description: 'Make a single trade worth over $50,000',
        icon: '🎲',
        category: 'special',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.biggestTradeValue >= 50000
    },

    DIAMOND_HANDS: {
        id: 'diamond_hands',
        name: 'Diamond Hands 💎🙌',
        description: 'Hold a losing position for 7+ days without selling',
        icon: '💎',
        category: 'special',
        rarity: 'epic',
        points: 750,
        check: (stats) => stats.diamondHands === true
    },

    PAPER_HANDS: {
        id: 'paper_hands',
        name: 'Paper Hands',
        description: 'Sell a stock within 5 minutes of buying',
        icon: '📄',
        category: 'special',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.paperHands === true
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
        check: (stats) => stats.totalTrades >= 200 && stats.winRate >= 85
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
            return (gamification?.level || 0) >= 100 && 
                   stats.totalTrades >= 100 && 
                   stats.winRate >= 90;
        }
    },

    ACHIEVEMENT_HUNTER: {
        id: 'achievement_hunter',
        name: 'Achievement Hunter',
        description: 'Unlock 25 achievements',
        icon: '🏆',
        category: 'mastery',
        rarity: 'epic',
        points: 1000,
        check: (stats, gamification) => (gamification?.achievements?.length || 0) >= 25
    },

    COMPLETIONIST: {
        id: 'completionist',
        name: 'Completionist',
        description: 'Unlock 50 achievements',
        icon: '👑',
        category: 'mastery',
        rarity: 'legendary',
        points: 5000,
        check: (stats, gamification) => (gamification?.achievements?.length || 0) >= 50
    },

    // ============================================
    // 🌟 TIME-BASED ACHIEVEMENTS
    // ============================================
    VETERAN: {
        id: 'veteran',
        name: 'Veteran',
        description: 'Be active for 180 days',
        icon: '🎖️',
        category: 'milestones',
        rarity: 'epic',
        points: 1000,
        check: (stats) => stats.daysActive >= 180
    },

    OLD_TIMER: {
        id: 'old_timer',
        name: 'Old Timer',
        description: 'Be active for 365 days',
        icon: '⌛',
        category: 'milestones',
        rarity: 'legendary',
        points: 2000,
        check: (stats) => stats.daysActive >= 365
    },

    // ============================================
    // 🎊 MEME / EASTER EGG ACHIEVEMENTS (LEGENDARY)
    // ============================================
    STONKS: {
        id: 'stonks',
        name: 'STONKS 📈',
        description: 'Make a trade at exactly $420.69',
        icon: '🚀',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 420,
        check: (stats) => stats.memeTradePrice === true
    },

    TO_THE_MOON: {
        id: 'to_the_moon',
        name: 'To The Moon! 🚀',
        description: 'Have a single trade gain over 100%',
        icon: '🌙',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 1000,
        check: (stats) => stats.biggestWinPercent >= 100
    },

    WSB_MEMBER: {
        id: 'wsb_member',
        name: 'WSB Member',
        description: 'YOLO your entire balance on a single trade',
        icon: '🦍',
        category: 'easter_egg',
        rarity: 'legendary',
        points: 1000,
        check: (stats) => stats.yoloTrade === true
    },

    HODL: {
        id: 'hodl',
        name: 'HODL',
        description: 'Hold any position for 30+ days',
        icon: '💪',
        category: 'easter_egg',
        rarity: 'rare',
        points: 200,
        check: (stats) => stats.longestHold >= 30
    },

    // ============================================
    // 👥 SOCIAL ACHIEVEMENTS
    // ============================================
    FIRST_FOLLOW: {
        id: 'first_follow',
        name: 'Making Friends',
        description: 'Follow your first trader',
        icon: '👥',
        category: 'social',
        rarity: 'common',
        points: 50,
        check: (stats) => stats.followingCount >= 1
    },

    POPULAR: {
        id: 'popular',
        name: 'Popular',
        description: 'Get 10 followers',
        icon: '⭐',
        category: 'social',
        rarity: 'rare',
        points: 200,
        check: (stats) => stats.followersCount >= 10
    },

    INFLUENCER: {
        id: 'influencer',
        name: 'Influencer',
        description: 'Get 100 followers',
        icon: '📱',
        category: 'social',
        rarity: 'epic',
        points: 500,
        check: (stats) => stats.followersCount >= 100
    },

    CELEBRITY: {
        id: 'celebrity',
        name: 'Celebrity Trader',
        description: 'Get 1,000 followers',
        icon: '🌟',
        category: 'social',
        rarity: 'legendary',
        points: 2000,
        check: (stats) => stats.followersCount >= 1000
    }
};

// Helper function to get achievements by category
const getAchievementsByCategory = (category) => {
    return Object.values(ACHIEVEMENTS).filter(a => a.category === category);
};

// Helper function to get all categories
const getAllCategories = () => {
    const categories = new Set(Object.values(ACHIEVEMENTS).map(a => a.category));
    return Array.from(categories);
};

// Helper to count achievements by rarity
const countByRarity = () => {
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    Object.values(ACHIEVEMENTS).forEach(a => {
        counts[a.rarity]++;
    });
    return counts;
};

module.exports = ACHIEVEMENTS;
module.exports.getAchievementsByCategory = getAchievementsByCategory;
module.exports.getAllCategories = getAllCategories;
module.exports.countByRarity = countByRarity;