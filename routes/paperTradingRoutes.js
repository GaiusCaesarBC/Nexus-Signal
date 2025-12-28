// server/routes/paperTradingRoutes.js - Complete Paper Trading System
// WITH LEVERAGE TRADING + TAKE PROFIT + STOP LOSS + TRAILING STOP
// $100K REFILL CAP + 🎮 ACHIEVEMENT AUTO-UNLOCKING

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const PaperTradingAccount = require('../models/PaperTradingAccount');

// ✅ USE CENTRALIZED PRICE SERVICE
const priceService = require('../services/priceService');

// 🎮 ACHIEVEMENT SERVICE - Auto-unlock achievements on trades
const AchievementService = require('../services/achievementService');

// ✅ ADD THIS NEW FUNCTION:
// 🏆 BADGE TRACKING HELPER
async function trackTradeForBadges(userId, tradeData, account) {
    try {
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        if (!user) return;
        
        // Initialize gamification if needed
        if (!user.gamification) {
            user.gamification = {
                earlyTrades: 0,
                lateTrades: 0,
                highRiskTrades: 0,
                profitableTrades: 0,
                consecutiveProfitableDays: 0
            };
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1. TRACK TIME-BASED TRADES (Early Bird / Night Owl)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const tradeHour = new Date().getHours();
        
        if (tradeHour < 10) {
            // Early morning trade (before 10 AM)
            user.gamification.earlyTrades = (user.gamification.earlyTrades || 0) + 1;
            console.log(`[Badge Tracking] Early trade for ${user.username}: ${user.gamification.earlyTrades}/10`);
        } else if (tradeHour >= 20) {
            // Late evening trade (after 8 PM)
            user.gamification.lateTrades = (user.gamification.lateTrades || 0) + 1;
            console.log(`[Badge Tracking] Late trade for ${user.username}: ${user.gamification.lateTrades}/10`);
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. TRACK HIGH-RISK TRADES (Risk Taker badge)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (tradeData.side === 'buy') {
            const tradeValue = tradeData.price * tradeData.quantity;
            const portfolioValue = account?.portfolioValue || 100000;
            const tradePercentage = (tradeValue / portfolioValue) * 100;
            
            if (tradePercentage > 50) {
                // High-risk trade (>50% of portfolio)
                user.gamification.highRiskTrades = (user.gamification.highRiskTrades || 0) + 1;
                console.log(`[Badge Tracking] High-risk trade for ${user.username}: ${tradePercentage.toFixed(1)}% of portfolio (${user.gamification.highRiskTrades}/5)`);
            }
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3. TRACK PROFITABLE TRADES (Profit King badge)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if ((tradeData.side === 'sell' || tradeData.side === 'cover') && tradeData.profitLoss > 0) {
            user.gamification.profitableTrades = (user.gamification.profitableTrades || 0) + 1;
            console.log(`[Badge Tracking] Profitable trade for ${user.username}: ${user.gamification.profitableTrades}/50`);
        }
        
        // Save user
        await user.save();
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4. CHECK FOR BADGE UNLOCKS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const BadgeService = require('../services/badgeService');
        const stats = await BadgeService.getUserStats(user);
        const result = await BadgeService.checkCustomBadges(userId, user, stats);
        
        if (result.newBadges && result.newBadges.length > 0) {
            console.log(`[Badge Tracking] 🎉 New badges unlocked for ${user.username}:`, result.newBadges.map(b => b.name).join(', '));
        }
        
    } catch (error) {
        // Don't fail the trade if badge tracking fails
        console.error('[Badge Tracking] Error:', error.message);
    }
}

// 🎮 XP REWARD HELPER
async function awardTradeXP(userId, tradeData, account) {
    try {
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        if (!user) return;
        
        let totalXP = 0;
        let totalCoins = 0;
        const rewards = [];
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1. BASE TRADE XP (Every trade gets this)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const baseXP = 10;
        const baseCoins = 20;
        totalXP += baseXP;
        totalCoins += baseCoins;
        rewards.push(`+${baseXP} XP (Trade)`);
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. FIRST TRADE BONUS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const isFirstTrade = safeNumber(account?.totalTrades, 0) === 1;
        if (isFirstTrade) {
            const firstTradeXP = 50;
            const firstTradeCoins = 100;
            totalXP += firstTradeXP;
            totalCoins += firstTradeCoins;
            rewards.push(`+${firstTradeXP} XP (First Trade!) 🎉`);
            console.log(`[XP] 🎉 FIRST TRADE BONUS for ${user.username}!`);
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3. PROFITABLE TRADE BONUS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if ((tradeData.side === 'sell' || tradeData.side === 'cover') && tradeData.profitLoss > 0) {
            const profitPercent = Math.abs(tradeData.profitLoss / (tradeData.price * tradeData.quantity) * 100);
            
            // Scale XP based on profit (1-100 XP)
            const profitXP = Math.min(Math.floor(profitPercent * 10), 100);
            const profitCoins = Math.min(Math.floor(profitPercent * 5), 200);
            
            if (profitXP > 0) {
                totalXP += profitXP;
                totalCoins += profitCoins;
                rewards.push(`+${profitXP} XP (${profitPercent.toFixed(1)}% Profit) 💰`);
            }
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4. LEVERAGE BONUS (High risk = more XP)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const leverage = safeNumber(tradeData.leverage, 1);
        if (leverage > 1) {
            const leverageXP = Math.floor(leverage * 2); // 2 XP per leverage multiplier
            totalXP += leverageXP;
            rewards.push(`+${leverageXP} XP (${leverage}x Leverage)`);
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 5. AWARD THE XP AND COINS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (totalXP > 0) {
            const xpResult = await user.addXp(totalXP, 'paper_trade');
            console.log(`[XP] ${user.username} earned ${totalXP} XP from trade`);
            
            if (xpResult.leveledUp) {
                rewards.push(`🎊 LEVEL UP! Now Level ${xpResult.newLevel} - ${xpResult.title}`);
                console.log(`[XP] 🎊 ${user.username} leveled up to ${xpResult.newLevel}!`);
            }
        }
        
        if (totalCoins > 0) {
            await user.addCoins(totalCoins, 'paper_trade');
            console.log(`[XP] ${user.username} earned ${totalCoins} coins from trade`);
        }
        
        return {
            xpEarned: totalXP,
            coinsEarned: totalCoins,
            rewards,
            leveledUp: false // Will be updated by addXp if level up occurred
        };
        
    } catch (error) {
        console.error('[XP] Error awarding trade XP:', error.message);
        return { xpEarned: 0, coinsEarned: 0, rewards: [] };
    }
}

// ============ CONSTANTS ============
const REFILL_TIERS = [
    { coins: 100, amount: 10000, label: '$10,000' },
    { coins: 250, amount: 25000, label: '$25,000' },
    { coins: 500, amount: 50000, label: '$50,000' },
    { coins: 750, amount: 75000, label: '$75,000' },
    { coins: 1000, amount: 100000, label: '$100,000 (Full Refill)' }
];

const MAX_BALANCE = 100000;
const LEVERAGE_OPTIONS = [1, 2, 3, 5, 7, 10, 20];

// ============ PRICE SANITY CHECKS ============
// These prevent phantom gains from bad DEX price data
const MAX_PRICE_CHANGE_PERCENT = 500; // Reject if price changed >500% from position avg
const MIN_VALID_PRICE = 0.0000000001; // Reject absurdly low prices
const MAX_VALID_PRICE = 10000000; // Reject absurdly high prices ($10M cap per unit)

/**
 * Validate price sanity for paper trading
 * Prevents phantom gains from bad data (like the $0.000003 -> $9.90 DYOR issue)
 */
function validatePriceSanity(currentPrice, referencePrice = null, symbol = '') {
    const errors = [];

    // Check for invalid/null price
    if (currentPrice === null || currentPrice === undefined || isNaN(currentPrice)) {
        errors.push(`Invalid price received for ${symbol}`);
        return { valid: false, errors, rejected: true };
    }

    // Check for absurdly low prices (likely garbage data)
    if (currentPrice < MIN_VALID_PRICE) {
        errors.push(`Price $${currentPrice} is too low - likely bad data for ${symbol}`);
        return { valid: false, errors, rejected: true };
    }

    // Check for absurdly high prices (likely garbage data)
    if (currentPrice > MAX_VALID_PRICE) {
        errors.push(`Price $${currentPrice} is too high - likely bad data for ${symbol}`);
        return { valid: false, errors, rejected: true };
    }

    // If we have a reference price (position's average), check for extreme changes
    if (referencePrice && referencePrice > 0) {
        const changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;
        const absChange = Math.abs(changePercent);

        if (absChange > MAX_PRICE_CHANGE_PERCENT) {
            console.log(`[Price Sanity] REJECTED ${symbol}: ${changePercent.toFixed(1)}% change | Ref: $${referencePrice} -> Current: $${currentPrice}`);
            errors.push(
                `Price change of ${changePercent.toFixed(1)}% is unrealistic for ${symbol}. ` +
                `This is likely due to bad price data from the API. ` +
                `Original: $${referencePrice.toFixed(8)}, Current: $${currentPrice.toFixed(8)}`
            );
            return {
                valid: false,
                errors,
                changePercent,
                isSuspicious: true,
                rejected: true
            };
        }
    }

    return { valid: true, errors: [], changePercent: referencePrice ? ((currentPrice - referencePrice) / referencePrice) * 100 : 0 };
}

/**
 * Validate that the current price is reasonable for a sell/cover order
 * Compares against the position's average price to catch bad data
 */
function validateSellPrice(currentPrice, position) {
    const avgPrice = safeNumber(position.averagePrice, 0);
    const symbol = position.symbol || 'Unknown';

    // Run sanity check with reference price
    const sanityCheck = validatePriceSanity(currentPrice, avgPrice, symbol);

    if (!sanityCheck.valid) {
        return {
            valid: false,
            error: sanityCheck.errors[0] || 'Price validation failed',
            changePercent: sanityCheck.changePercent,
            currentPrice,
            referencePrice: avgPrice
        };
    }

    return { valid: true, changePercent: sanityCheck.changePercent };
}

// Helper function to safely parse numbers
function safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

// Calculate portfolio stats with leverage support
// Leverage P/L Formula:
//   - margin = entry_price × quantity (what you put up as collateral)
//   - leveraged_exposure = margin × leverage (total market exposure)
//   - base_pnl = (current_price - entry_price) × quantity (unleveraged P/L)
//   - leveraged_pnl = base_pnl × leverage (your actual P/L)
//   - current_value = margin + leveraged_pnl (what your margin is worth now)
//   - P/L % = leveraged_pnl / margin × 100 (return on your margin)
function calculatePortfolioStats(account) {
    let positionsValue = 0;

    if (!account.positions) account.positions = [];

    account.positions.forEach(pos => {
        const currentPrice = safeNumber(pos.currentPrice, 0);
        const averagePrice = safeNumber(pos.averagePrice, currentPrice);
        const quantity = safeNumber(pos.quantity, 0);
        const positionType = pos.positionType || 'long';
        const leverage = safeNumber(pos.leverage, 1);

        // Margin = what you put up as collateral (entry price × quantity)
        const margin = safeNumber(averagePrice * quantity, 0);

        // Percent change in underlying asset price
        const priceChangePercent = averagePrice > 0
            ? (currentPrice - averagePrice) / averagePrice
            : 0;

        if (positionType === 'short') {
            // For shorts: profit when price goes DOWN
            const basePnL = (averagePrice - currentPrice) * quantity;
            pos.profitLoss = safeNumber(basePnL * leverage, 0);
            // Short P/L% is inverted: price down = positive return
            pos.profitLossPercent = safeNumber(-priceChangePercent * leverage * 100, 0);
        } else {
            // For longs: profit when price goes UP
            const basePnL = (currentPrice - averagePrice) * quantity;
            pos.profitLoss = safeNumber(basePnL * leverage, 0);
            pos.profitLossPercent = safeNumber(priceChangePercent * leverage * 100, 0);
        }

        // Current value = margin (what you put in) + P/L (what you gained/lost)
        const currentValue = safeNumber(margin + pos.profitLoss, margin);
        pos.currentValue = Math.max(0, currentValue); // Floor at 0 (can't go negative)
        pos.marginUsed = margin; // Track the margin separately for clarity

        // Add to portfolio value (floored at 0 per position)
        positionsValue += pos.currentValue;

        // Leveraged exposure = total market position size (for display purposes)
        pos.leveragedValue = safeNumber(margin * leverage, margin);

        // Liquidation check: if losses exceed 90% of margin, position is liquidated
        if (leverage > 1 && pos.profitLoss < -(margin * 0.9)) {
            pos.isLiquidated = true;
            pos.currentValue = 0; // Liquidated = lost everything
        }
    });
    
    const cashBalance = safeNumber(account.cashBalance, 100000);
    const initialBalance = safeNumber(account.initialBalance, 100000);
    const totalRefillAmount = safeNumber(account.totalRefillAmount, 0);

    account.portfolioValue = safeNumber(cashBalance + positionsValue, initialBalance);

    // Calculate total P/L from TRADES ONLY (exclude refill amounts)
    // This ensures refilling doesn't artificially inflate the return percentage
    account.totalProfitLoss = safeNumber(account.portfolioValue - initialBalance - totalRefillAmount, 0);
    account.totalProfitLossPercent = initialBalance > 0 ?
        safeNumber((account.totalProfitLoss / initialBalance) * 100, 0) : 0;
    account.winRate = safeNumber(account.totalTrades, 0) > 0 ? 
        safeNumber((safeNumber(account.winningTrades, 0) / safeNumber(account.totalTrades, 1)) * 100, 0) : 0;
}

// Check and execute TP/SL/Liquidation for a position
function checkPositionTriggers(position) {
    const currentPrice = safeNumber(position.currentPrice, 0);
    const positionType = position.positionType || 'long';
    
    const triggers = {
        takeProfit: false,
        stopLoss: false,
        trailingStop: false,
        liquidation: position.isLiquidated || false
    };
    
    if (positionType === 'long') {
        // Long: TP when price >= target, SL when price <= target
        if (position.takeProfit && currentPrice >= position.takeProfit) {
            triggers.takeProfit = true;
        }
        if (position.stopLoss && currentPrice <= position.stopLoss) {
            triggers.stopLoss = true;
        }
        // Trailing stop for longs
        if (position.trailingStopPercent) {
            if (!position.highestPrice || currentPrice > position.highestPrice) {
                position.highestPrice = currentPrice;
                position.trailingStopPrice = currentPrice * (1 - position.trailingStopPercent / 100);
            }
            if (position.trailingStopPrice && currentPrice <= position.trailingStopPrice) {
                triggers.trailingStop = true;
            }
        }
    } else {
        // Short: TP when price <= target (went down), SL when price >= target (went up)
        if (position.takeProfit && currentPrice <= position.takeProfit) {
            triggers.takeProfit = true;
        }
        if (position.stopLoss && currentPrice >= position.stopLoss) {
            triggers.stopLoss = true;
        }
        // Trailing stop for shorts
        if (position.trailingStopPercent) {
            if (!position.lowestPrice || currentPrice < position.lowestPrice) {
                position.lowestPrice = currentPrice;
                position.trailingStopPrice = currentPrice * (1 + position.trailingStopPercent / 100);
            }
            if (position.trailingStopPrice && currentPrice >= position.trailingStopPrice) {
                triggers.trailingStop = true;
            }
        }
    }
    
    return triggers;
}

// Close position helper (used by TP/SL auto-execution)
async function closePosition(account, position, triggerType, currentPrice) {
    const positionType = position.positionType || 'long';
    const leverage = safeNumber(position.leverage, 1);
    const avgPrice = safeNumber(position.averagePrice, currentPrice);
    const quantity = safeNumber(position.quantity, 0);

    // ============ PRICE SANITY CHECK FOR AUTO-CLOSE ============
    // Skip validation for liquidation (must execute) but validate for TP/SL
    if (triggerType !== 'liquidation') {
        const priceValidation = validateSellPrice(currentPrice, position);
        if (!priceValidation.valid) {
            console.log(`[Paper Trading] AUTO-CLOSE SKIPPED (${triggerType}) for ${position.symbol}: Bad price data - ${priceValidation.error}`);
            // Return null to indicate the position should NOT be closed
            return null;
        }
    }

    const margin = safeNumber(avgPrice * quantity, 0);

    let profitLoss, profitLossPercent;
    
    if (positionType === 'short') {
        const priceChange = avgPrice - currentPrice;
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;
        profitLoss = safeNumber(margin * percentChange * leverage, 0);
        profitLossPercent = safeNumber(percentChange * leverage * 100, 0);
    } else {
        const priceChange = currentPrice - avgPrice;
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;
        profitLoss = safeNumber(margin * percentChange * leverage, 0);
        profitLossPercent = safeNumber(percentChange * leverage * 100, 0);
    }
    
    const proceeds = safeNumber(margin + profitLoss, margin);
    
    // Add proceeds to cash
    account.cashBalance = safeNumber(account.cashBalance, 0) + Math.max(0, proceeds);
    
    // Add closing order
    account.orders.unshift({
        symbol: position.symbol,
        type: position.type,
        side: positionType === 'short' ? 'cover' : 'sell',
        positionType,
        quantity,
        price: currentPrice,
        totalAmount: proceeds,
        leverage,
        profitLoss,
        profitLossPercent,
        triggerType,
        notes: `Auto-closed by ${triggerType.replace('_', ' ').toUpperCase()}`
    });
    
    // Update stats
    account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
    
    if (profitLoss > 0) {
        account.winningTrades = safeNumber(account.winningTrades, 0) + 1;
        if (profitLoss > safeNumber(account.biggestWin, 0)) {
            account.biggestWin = profitLoss;
        }
    } else if (profitLoss < 0) {
        account.losingTrades = safeNumber(account.losingTrades, 0) + 1;
        if (profitLoss < safeNumber(account.biggestLoss, 0)) {
            account.biggestLoss = profitLoss;
        }
    }
    
    // Update trigger stats
    if (triggerType === 'take_profit') {
        account.takeProfitHits = safeNumber(account.takeProfitHits, 0) + 1;
    } else if (triggerType === 'stop_loss') {
        account.stopLossHits = safeNumber(account.stopLossHits, 0) + 1;
    } else if (triggerType === 'trailing_stop') {
        account.trailingStopHits = safeNumber(account.trailingStopHits, 0) + 1;
    } else if (triggerType === 'liquidation') {
        account.liquidations = safeNumber(account.liquidations, 0) + 1;
    }
    
    console.log(`[Paper Trading] AUTO-CLOSE (${triggerType}): ${position.symbol} | P/L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(1)}%)`);
    
    // ✅ ADD THIS (before the return statement):
// Track badge for auto-closed positions too

// Track badge for auto-closed positions too
try {
    await trackTradeForBadges(account.user, {
        side: positionType === 'short' ? 'cover' : 'sell',
        symbol: position.symbol,
        type: position.type,
        quantity: quantity,
        price: currentPrice,
        positionType,
        leverage,
        profitLoss
    }, account);
    
    // Award XP for auto-closed profitable positions
    await awardTradeXP(account.user, {
        side: positionType === 'short' ? 'cover' : 'sell',
        symbol: position.symbol,
        type: position.type,
        quantity: quantity,
        price: currentPrice,
        positionType,
        leverage,
        profitLoss
    }, account);
} catch (err) {
    console.error('[Badge Tracking] Error in auto-close:', err.message);
}


    return { profitLoss, profitLossPercent, proceeds };
}

// Auto-update user stats helper
async function updateUserStats(userId) {
    try {
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user && typeof user.calculateStats === 'function') {
            await user.calculateStats();
        }
    } catch (error) {
        console.warn('⚠️ Stats auto-update failed:', error.message);
    }
}

// ============ ROUTES ============

// @route   GET /api/paper-trading/account
router.get('/account', auth, async (req, res) => {
    try {
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id });
            await account.save();
        }
        
        calculatePortfolioStats(account);
        res.json({ success: true, account });
    } catch (error) {
        console.error('[Paper Trading] Get account error:', error);
        res.status(500).json({ success: false, error: 'Failed to load account' });
    }
});

// @route   GET /api/paper-trading/leverage-options
router.get('/leverage-options', auth, (req, res) => {
    res.json({
        success: true,
        options: LEVERAGE_OPTIONS.map(lev => ({
            value: lev,
            label: lev === 1 ? '1x (No Leverage)' : `${lev}x`,
            riskLevel: lev <= 2 ? 'low' : lev <= 5 ? 'medium' : lev <= 10 ? 'high' : 'extreme',
            liquidationThreshold: lev === 1 ? null : (90 / lev).toFixed(1)
        }))
    });
});

// @route   POST /api/paper-trading/buy
// @desc    Buy stock or crypto (WITH LEVERAGE + TP/SL SUPPORT)
router.post('/buy', auth, async (req, res) => {
    try {
        let { 
            symbol, type, quantity, notes, 
            positionType = 'long', 
            leverage = 1,
            takeProfit = null,
            stopLoss = null,
            trailingStopPercent = null
        } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const safeLeverage = safeNumber(leverage, 1);
        if (!LEVERAGE_OPTIONS.includes(safeLeverage)) {
            return res.status(400).json({ 
                error: `Invalid leverage. Choose from: ${LEVERAGE_OPTIONS.join(', ')}`
            });
        }
        
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        }
        
        const safeQuantity = safeNumber(quantity, 0);
        if (safeQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id });
        }
        
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        const safePrice = safeNumber(priceResult.price, 0);
        
        // Validate TP/SL for long positions
        const safeTP = takeProfit ? safeNumber(takeProfit, null) : null;
        const safeSL = stopLoss ? safeNumber(stopLoss, null) : null;
        const safeTrailing = trailingStopPercent ? safeNumber(trailingStopPercent, null) : null;
        
        if (safeTP && safeTP <= safePrice) {
            return res.status(400).json({ 
                error: `Take Profit ($${safeTP}) must be above current price ($${safePrice.toFixed(2)}) for long positions`
            });
        }
        if (safeSL && safeSL >= safePrice) {
            return res.status(400).json({ 
                error: `Stop Loss ($${safeSL}) must be below current price ($${safePrice.toFixed(2)}) for long positions`
            });
        }
        if (safeTrailing && (safeTrailing <= 0 || safeTrailing >= 100)) {
            return res.status(400).json({ error: 'Trailing stop must be between 0 and 100%' });
        }
        
        const margin = safeNumber(safePrice * safeQuantity, 0);
        const leveragedValue = safeNumber(margin * safeLeverage, margin);
        const safeCashBalance = safeNumber(account.cashBalance, 100000);
        
        if (margin > safeCashBalance) {
            return res.status(400).json({ 
                error: `Insufficient funds. Need $${margin.toFixed(2)} margin.`,
                required: margin,
                available: safeCashBalance
            });
        }
        
        let liquidationPrice = null;
        if (safeLeverage > 1) {
            liquidationPrice = safePrice * (1 - (0.9 / safeLeverage));
        }
        
        account.cashBalance = safeNumber(safeCashBalance - margin, 0);
        if (!account.positions) account.positions = [];
        
        const isFirstTrade = safeNumber(account.totalTrades, 0) === 0;
        
        // Check for existing position
        const existingPosition = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && 
                 p.type === type && 
                 (p.positionType || 'long') === positionType &&
                 safeNumber(p.leverage, 1) === safeLeverage
        );
        
        if (existingPosition) {
            const existingQuantity = safeNumber(existingPosition.quantity, 0);
            const existingAvgPrice = safeNumber(existingPosition.averagePrice, safePrice);
            
            const totalQuantity = existingQuantity + safeQuantity;
            const totalCost = (existingAvgPrice * existingQuantity) + margin;
            
            existingPosition.averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : safePrice;
            existingPosition.quantity = totalQuantity;
            existingPosition.currentPrice = safePrice;
            existingPosition.leveragedValue = existingPosition.averagePrice * totalQuantity * safeLeverage;
            
            // Update TP/SL if provided (overwrite existing)
            if (safeTP) existingPosition.takeProfit = safeTP;
            if (safeSL) existingPosition.stopLoss = safeSL;
            if (safeTrailing) {
                existingPosition.trailingStopPercent = safeTrailing;
                existingPosition.highestPrice = safePrice;
                existingPosition.trailingStopPrice = safePrice * (1 - safeTrailing / 100);
            }
            
            if (safeLeverage > 1) {
                existingPosition.liquidationPrice = existingPosition.averagePrice * (1 - (0.9 / safeLeverage));
            }
        } else {
            // Check for same symbol with different leverage
            const sameSymbolDiffLev = account.positions.find(
                p => p.symbol === symbol.toUpperCase() && 
                     p.type === type && 
                     (p.positionType || 'long') === positionType &&
                     safeNumber(p.leverage, 1) !== safeLeverage
            );
            
            if (sameSymbolDiffLev) {
                account.cashBalance = safeCashBalance;
                return res.status(400).json({
                    error: `You have a ${safeNumber(sameSymbolDiffLev.leverage, 1)}x position in ${symbol}. Close it first.`
                });
            }
            
            account.positions.push({
                symbol: symbol.toUpperCase(),
                type,
                positionType,
                quantity: safeQuantity,
                averagePrice: safePrice,
                currentPrice: safePrice,
                leverage: safeLeverage,
                leveragedValue,
                liquidationPrice,
                takeProfit: safeTP,
                stopLoss: safeSL,
                trailingStopPercent: safeTrailing,
                highestPrice: safeTrailing ? safePrice : null,
                trailingStopPrice: safeTrailing ? safePrice * (1 - safeTrailing / 100) : null,
                openedAt: new Date()
            });
        }
        
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'buy',
            positionType,
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: margin,
            leverage: safeLeverage,
            leveragedValue,
            triggerType: 'manual',
            notes: notes || ''
        });
        
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        await updateUserStats(req.user.id);
        
// ✅ ADD THIS:
// Track badges
await trackTradeForBadges(req.user.id, {
    side: 'buy',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType,
    leverage: safeLeverage,
    profitLoss: 0
}, account);

// Award XP
const xpReward = await awardTradeXP(req.user.id, {
    side: 'buy',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType,
    leverage: safeLeverage,
    profitLoss: 0
}, account);

console.log(`[Trade Rewards] ${xpReward.rewards.join(', ')}`);


        // Achievement check
        try {
            await AchievementService.recordTradeAndCheck(req.user.id, {
                profit: 0,
                leverage: safeLeverage,
                positionType,
                isFirstTrade,
                usedMaxLeverage: safeLeverage === 20
            });
        } catch (e) { /* ignore */ }
        
        const leverageMsg = safeLeverage > 1 ? ` with ${safeLeverage}x leverage` : '';
        const tpSlMsg = (safeTP || safeSL) ? ` | TP: ${safeTP ? '$' + safeTP : 'None'}, SL: ${safeSL ? '$' + safeSL : 'None'}` : '';
        
        console.log(`[Paper Trading] BUY: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)}${leverageMsg}${tpSlMsg}`);
        
        // ✅ GET UPDATED USER DATA FOR FRONTEND
const User = require('../models/User');
const updatedUser = await User.findById(req.user.id).select('gamification');

res.json({
    success: true,
    message: `Bought ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}${leverageMsg}`,
    account,
    trade: {
        symbol: symbol.toUpperCase(),
        quantity: safeQuantity,
        price: safePrice,
        margin,
        leverage: safeLeverage,
        leveragedValue,
        liquidationPrice,
        takeProfit: safeTP,
        stopLoss: safeSL,
        trailingStopPercent: safeTrailing
    },
    // ✅ GAMIFICATION DATA FOR UI UPDATE
    gamification: {
        xp: updatedUser.gamification.xp,
        totalXpEarned: updatedUser.gamification.totalXpEarned,
        level: updatedUser.gamification.level,
        title: updatedUser.gamification.title,
        nextLevelXp: updatedUser.gamification.nextLevelXp,
        nexusCoins: updatedUser.gamification.nexusCoins
    },
    xpReward: xpReward  // Rewards breakdown for notification
});
        
    } catch (error) {
        console.error('[Paper Trading] Buy error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute buy order' });
    }
});

// @route   POST /api/paper-trading/sell
// @desc    Sell/Short (WITH TP/SL SUPPORT)
router.post('/sell', auth, async (req, res) => {
    try {
        let { 
            symbol, type, quantity, notes, 
            positionType = 'long', 
            leverage = 1,
            takeProfit = null,
            stopLoss = null,
            trailingStopPercent = null
        } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        }
        
        const safeQuantity = safeNumber(quantity, 0);
        if (safeQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(400).json({ error: 'Account not found' });
        }
        
        if (!account.positions) account.positions = [];
        
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        const safePrice = safeNumber(priceResult.price, 0);
        
        // Opening a SHORT position
        if (positionType === 'short') {
            const safeLeverage = safeNumber(leverage, 1);
            if (!LEVERAGE_OPTIONS.includes(safeLeverage)) {
                return res.status(400).json({ error: `Invalid leverage` });
            }
            
            // Validate TP/SL for SHORT positions (opposite of long)
            const safeTP = takeProfit ? safeNumber(takeProfit, null) : null;
            const safeSL = stopLoss ? safeNumber(stopLoss, null) : null;
            const safeTrailing = trailingStopPercent ? safeNumber(trailingStopPercent, null) : null;
            
            if (safeTP && safeTP >= safePrice) {
                return res.status(400).json({ 
                    error: `Take Profit ($${safeTP}) must be below current price ($${safePrice.toFixed(2)}) for short positions`
                });
            }
            if (safeSL && safeSL <= safePrice) {
                return res.status(400).json({ 
                    error: `Stop Loss ($${safeSL}) must be above current price ($${safePrice.toFixed(2)}) for short positions`
                });
            }
            
            const margin = safeNumber(safePrice * safeQuantity, 0);
            const leveragedValue = safeNumber(margin * safeLeverage, margin);
            const safeCashBalance = safeNumber(account.cashBalance, 0);
            
            if (margin > safeCashBalance) {
                return res.status(400).json({ 
                    error: `Insufficient funds for short margin. Need $${margin.toFixed(2)}.`
                });
            }
            
            account.cashBalance = safeNumber(safeCashBalance - margin, 0);
            
            let liquidationPrice = null;
            if (safeLeverage > 1) {
                liquidationPrice = safePrice * (1 + (0.9 / safeLeverage));
            }
            
            const existingShort = account.positions.find(
                p => p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short'
            );
            
            if (existingShort) {
                const existingQty = safeNumber(existingShort.quantity, 0);
                const existingAvg = safeNumber(existingShort.averagePrice, safePrice);
                
                const totalQty = existingQty + safeQuantity;
                const totalCost = (existingAvg * existingQty) + margin;
                
                existingShort.averagePrice = totalQty > 0 ? totalCost / totalQty : safePrice;
                existingShort.quantity = totalQty;
                existingShort.currentPrice = safePrice;
                existingShort.leveragedValue = existingShort.averagePrice * totalQty * safeLeverage;
                
                if (safeTP) existingShort.takeProfit = safeTP;
                if (safeSL) existingShort.stopLoss = safeSL;
                if (safeTrailing) {
                    existingShort.trailingStopPercent = safeTrailing;
                    existingShort.lowestPrice = safePrice;
                    existingShort.trailingStopPrice = safePrice * (1 + safeTrailing / 100);
                }
                
                if (safeLeverage > 1) {
                    existingShort.liquidationPrice = existingShort.averagePrice * (1 + (0.9 / safeLeverage));
                }
            } else {
                account.positions.push({
                    symbol: symbol.toUpperCase(),
                    type,
                    positionType: 'short',
                    quantity: safeQuantity,
                    averagePrice: safePrice,
                    currentPrice: safePrice,
                    leverage: safeLeverage,
                    leveragedValue,
                    liquidationPrice,
                    takeProfit: safeTP,
                    stopLoss: safeSL,
                    trailingStopPercent: safeTrailing,
                    lowestPrice: safeTrailing ? safePrice : null,
                    trailingStopPrice: safeTrailing ? safePrice * (1 + safeTrailing / 100) : null,
                    openedAt: new Date()
                });
            }
            
            account.orders.unshift({
                symbol: symbol.toUpperCase(),
                type,
                side: 'sell',
                positionType: 'short',
                quantity: safeQuantity,
                price: safePrice,
                totalAmount: margin,
                leverage: safeLeverage,
                leveragedValue,
                triggerType: 'manual',
                notes: notes || ''
            });
            
            account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
            account.lastUpdated = new Date();
            
            calculatePortfolioStats(account);
            await account.save();
            await updateUserStats(req.user.id);
            
            const leverageMsg = safeLeverage > 1 ? ` with ${safeLeverage}x leverage` : '';
            console.log(`[Paper Trading] SHORT: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)}${leverageMsg}`);
            
            return res.json({
                success: true,
                message: `Shorted ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}${leverageMsg}`,
                account,
                trade: {
                    symbol: symbol.toUpperCase(),
                    quantity: safeQuantity,
                    price: safePrice,
                    margin,
                    leverage: safeLeverage,
                    leveragedValue,
                    liquidationPrice,
                    takeProfit: safeTP,
                    stopLoss: safeSL
                }
            });
        }
        
        // ============ CLOSING A LONG POSITION ============
        const position = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && p.type === type && (p.positionType || 'long') === 'long'
        );

        if (!position) {
            return res.status(400).json({ error: `You don't own any ${symbol}` });
        }

        const positionQuantity = safeNumber(position.quantity, 0);
        if (safeQuantity > positionQuantity) {
            return res.status(400).json({ error: `Insufficient shares. You own ${positionQuantity}` });
        }

        // ============ PRICE SANITY CHECK ============
        // Prevent phantom gains from bad DEX price data
        const priceValidation = validateSellPrice(safePrice, position);
        if (!priceValidation.valid) {
            console.log(`[Paper Trading] REJECTED SELL for ${symbol}: ${priceValidation.error}`);
            return res.status(400).json({
                error: priceValidation.error,
                errorType: 'PRICE_SANITY_CHECK',
                details: {
                    currentPrice: priceValidation.currentPrice,
                    positionAvgPrice: priceValidation.referencePrice,
                    changePercent: priceValidation.changePercent,
                    maxAllowedChange: MAX_PRICE_CHANGE_PERCENT
                }
            });
        }

        const positionLeverage = safeNumber(position.leverage, 1);
        const avgPrice = safeNumber(position.averagePrice, safePrice);

        const marginUsed = safeNumber(avgPrice * safeQuantity, 0);
        const priceChange = safePrice - avgPrice;
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;
        
        const profitLoss = safeNumber(marginUsed * percentChange * positionLeverage, 0);
        const profitLossPercent = safeNumber(percentChange * positionLeverage * 100, 0);
        const proceeds = safeNumber(marginUsed + profitLoss, marginUsed);
        
        account.cashBalance = safeNumber(account.cashBalance, 0) + Math.max(0, proceeds);
        
        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && (p.positionType || 'long') === 'long')
            );
        } else {
            position.quantity = positionQuantity - safeQuantity;
            position.currentPrice = safePrice;
        }
        
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'sell',
            positionType: 'long',
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: proceeds,
            leverage: positionLeverage,
            profitLoss,
            profitLossPercent,
            triggerType: 'manual',
            notes: notes || ''
        });
        
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        
        if (profitLoss > 0) {
            account.winningTrades = safeNumber(account.winningTrades, 0) + 1;
            if (profitLoss > safeNumber(account.biggestWin, 0)) account.biggestWin = profitLoss;
        } else if (profitLoss < 0) {
            account.losingTrades = safeNumber(account.losingTrades, 0) + 1;
            if (profitLoss < safeNumber(account.biggestLoss, 0)) account.biggestLoss = profitLoss;
        }
        
        account.lastUpdated = new Date();
        calculatePortfolioStats(account);
        await account.save();
        await updateUserStats(req.user.id);

        // ✅ ADD THIS:
// Track badges
await trackTradeForBadges(req.user.id, {
    side: 'sell',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType: 'long',
    leverage: positionLeverage,
    profitLoss
}, account);

// Award XP (with profit bonus!)
const xpReward = await awardTradeXP(req.user.id, {
    side: 'sell',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType: 'long',
    leverage: positionLeverage,
    profitLoss
}, account);

console.log(`[Trade Rewards] ${xpReward.rewards.join(', ')}`);
        
        console.log(`[Paper Trading] SELL: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} | P/L: $${profitLoss.toFixed(2)}`);
        
        // ✅ GET UPDATED USER DATA FOR FRONTEND
const User = require('../models/User');
const updatedUser = await User.findById(req.user.id).select('gamification');

res.json({
    success: true,
    message: `Sold ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
    account,
    profitLoss,
    profitLossPercent,
    trade: {
        symbol: symbol.toUpperCase(),
        quantity: safeQuantity,
        price: safePrice,
        proceeds,
        profitLoss,
        profitLossPercent
    },
    // ✅ GAMIFICATION DATA FOR UI UPDATE
    gamification: {
        xp: updatedUser.gamification.xp,
        totalXpEarned: updatedUser.gamification.totalXpEarned,
        level: updatedUser.gamification.level,
        title: updatedUser.gamification.title,
        nextLevelXp: updatedUser.gamification.nextLevelXp,
        nexusCoins: updatedUser.gamification.nexusCoins
    },
    xpReward: xpReward  // Rewards breakdown for notification
});
        
    } catch (error) {
        console.error('[Paper Trading] Sell error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute sell order' });
    }
});

// @route   POST /api/paper-trading/cover
// @desc    Cover a short position
router.post('/cover', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        }
        
        const safeQuantity = safeNumber(quantity, 0);
        if (safeQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(400).json({ error: 'Account not found' });
        }
        
        if (!account.positions) account.positions = [];
        
        const position = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short'
        );
        
        if (!position) {
            return res.status(400).json({ error: `No short position in ${symbol}` });
        }
        
        const positionQuantity = safeNumber(position.quantity, 0);
        if (safeQuantity > positionQuantity) {
            return res.status(400).json({ error: `Position only has ${positionQuantity} shares` });
        }
        
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }

        const safePrice = safeNumber(priceResult.price, 0);

        // ============ PRICE SANITY CHECK ============
        // Prevent phantom gains from bad DEX price data
        const priceValidation = validateSellPrice(safePrice, position);
        if (!priceValidation.valid) {
            console.log(`[Paper Trading] REJECTED COVER for ${symbol}: ${priceValidation.error}`);
            return res.status(400).json({
                error: priceValidation.error,
                errorType: 'PRICE_SANITY_CHECK',
                details: {
                    currentPrice: priceValidation.currentPrice,
                    positionAvgPrice: priceValidation.referencePrice,
                    changePercent: priceValidation.changePercent,
                    maxAllowedChange: MAX_PRICE_CHANGE_PERCENT
                }
            });
        }

        const positionLeverage = safeNumber(position.leverage, 1);
        const avgPrice = safeNumber(position.averagePrice, safePrice);

        const marginUsed = safeNumber(avgPrice * safeQuantity, 0);
        const priceChange = avgPrice - safePrice;
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;

        const profitLoss = safeNumber(marginUsed * percentChange * positionLeverage, 0);
        const profitLossPercent = safeNumber(percentChange * positionLeverage * 100, 0);
        const proceeds = safeNumber(marginUsed + profitLoss, marginUsed);

        account.cashBalance = safeNumber(account.cashBalance, 0) + Math.max(0, proceeds);

        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short')
            );
        } else {
            position.quantity = positionQuantity - safeQuantity;
            position.currentPrice = safePrice;
        }
        
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'cover',
            positionType: 'short',
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: proceeds,
            leverage: positionLeverage,
            profitLoss,
            profitLossPercent,
            triggerType: 'manual',
            notes: notes || ''
        });
        
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        
        if (profitLoss > 0) {
            account.winningTrades = safeNumber(account.winningTrades, 0) + 1;
            if (profitLoss > safeNumber(account.biggestWin, 0)) account.biggestWin = profitLoss;
        } else if (profitLoss < 0) {
            account.losingTrades = safeNumber(account.losingTrades, 0) + 1;
            if (profitLoss < safeNumber(account.biggestLoss, 0)) account.biggestLoss = profitLoss;
        }
        
        account.lastUpdated = new Date();
        calculatePortfolioStats(account);
        await account.save();
        await updateUserStats(req.user.id);
        // ✅ ADD THIS:
// Track badges
await trackTradeForBadges(req.user.id, {
    side: 'cover',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType: 'short',
    leverage: positionLeverage,
    profitLoss
}, account);

// Award XP (with profit bonus!)
const xpReward = await awardTradeXP(req.user.id, {
    side: 'cover',
    symbol: symbol.toUpperCase(),
    type,
    quantity: safeQuantity,
    price: safePrice,
    positionType: 'short',
    leverage: positionLeverage,
    profitLoss
}, account);

console.log(`[Trade Rewards] ${xpReward.rewards.join(', ')}`);
        
        console.log(`[Paper Trading] COVER: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} | P/L: $${profitLoss.toFixed(2)}`);
        
      // ✅ GET UPDATED USER DATA FOR FRONTEND
const User = require('../models/User');
const updatedUser = await User.findById(req.user.id).select('gamification');

res.json({
    success: true,
    message: `Covered ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
    account,
    profitLoss,
    profitLossPercent,
    trade: {
        symbol: symbol.toUpperCase(),
        quantity: safeQuantity,
        price: safePrice,
        profitLoss,
        profitLossPercent
    },
    // ✅ GAMIFICATION DATA FOR UI UPDATE
    gamification: {
        xp: updatedUser.gamification.xp,
        totalXpEarned: updatedUser.gamification.totalXpEarned,
        level: updatedUser.gamification.level,
        title: updatedUser.gamification.title,
        nextLevelXp: updatedUser.gamification.nextLevelXp,
        nexusCoins: updatedUser.gamification.nexusCoins
    },
    xpReward: xpReward  // Rewards breakdown for notification
});
    } catch (error) {
        console.error('[Paper Trading] Cover error:', error);
        res.status(500).json({ error: error.message || 'Failed to cover short' });
    }
});

// @route   PUT /api/paper-trading/position/:symbol/tpsl
// @desc    Update Take Profit / Stop Loss for existing position
router.put('/position/:symbol/tpsl', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { takeProfit, stopLoss, trailingStopPercent, positionType = 'long', type } = req.body;
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        const detectedType = type || (priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock');
        
        const position = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && 
                 p.type === detectedType && 
                 (p.positionType || 'long') === positionType
        );
        
        if (!position) {
            return res.status(404).json({ error: `No ${positionType} position found for ${symbol}` });
        }
        
        const currentPrice = safeNumber(position.currentPrice, position.averagePrice);
        const safeTP = takeProfit !== undefined ? (takeProfit === null ? null : safeNumber(takeProfit, null)) : position.takeProfit;
        const safeSL = stopLoss !== undefined ? (stopLoss === null ? null : safeNumber(stopLoss, null)) : position.stopLoss;
        const safeTrailing = trailingStopPercent !== undefined ? (trailingStopPercent === null ? null : safeNumber(trailingStopPercent, null)) : position.trailingStopPercent;
        
        // Validate based on position type
        if (positionType === 'long') {
            if (safeTP && safeTP <= currentPrice) {
                return res.status(400).json({ error: 'Take Profit must be above current price for long positions' });
            }
            if (safeSL && safeSL >= currentPrice) {
                return res.status(400).json({ error: 'Stop Loss must be below current price for long positions' });
            }
        } else {
            if (safeTP && safeTP >= currentPrice) {
                return res.status(400).json({ error: 'Take Profit must be below current price for short positions' });
            }
            if (safeSL && safeSL <= currentPrice) {
                return res.status(400).json({ error: 'Stop Loss must be above current price for short positions' });
            }
        }
        
        // Update position
        position.takeProfit = safeTP;
        position.stopLoss = safeSL;
        position.trailingStopPercent = safeTrailing;
        
        if (safeTrailing) {
            if (positionType === 'long') {
                position.highestPrice = currentPrice;
                position.trailingStopPrice = currentPrice * (1 - safeTrailing / 100);
            } else {
                position.lowestPrice = currentPrice;
                position.trailingStopPrice = currentPrice * (1 + safeTrailing / 100);
            }
        } else {
            position.trailingStopPrice = null;
            position.highestPrice = null;
            position.lowestPrice = null;
        }
        
        account.lastUpdated = new Date();
        await account.save();
        
        console.log(`[Paper Trading] Updated TP/SL for ${symbol}: TP=$${safeTP || 'None'}, SL=$${safeSL || 'None'}, Trailing=${safeTrailing || 'None'}%`);
        
        res.json({
            success: true,
            message: `Updated TP/SL for ${symbol.toUpperCase()}`,
            position: {
                symbol: position.symbol,
                positionType: position.positionType,
                takeProfit: position.takeProfit,
                stopLoss: position.stopLoss,
                trailingStopPercent: position.trailingStopPercent,
                trailingStopPrice: position.trailingStopPrice
            }
        });
        
    } catch (error) {
        console.error('[Paper Trading] Update TP/SL error:', error);
        res.status(500).json({ error: 'Failed to update TP/SL' });
    }
});

// @route   POST /api/paper-trading/refresh-prices
// @desc    Refresh prices and AUTO-EXECUTE TP/SL
router.post('/refresh-prices', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        if (!account.positions) account.positions = [];
        
        const triggeredPositions = [];
        const positionsToRemove = [];
        
        // Fetch all prices using the correct method name
        const allSymbols = account.positions.map(p => p.symbol.toUpperCase());
        const batchPrices = await priceService.getBatchPrices(allSymbols);

        console.log(`[Paper Trading] Fetched prices for ${batchPrices.size} symbols:`, Object.fromEntries(batchPrices));

        // Update prices and check triggers
        for (const position of account.positions) {
            // getBatchPrices returns a Map with UPPERCASE keys
            const symbolKey = position.symbol.toUpperCase();
            const price = batchPrices.get(symbolKey);
            const oldPrice = position.currentPrice;

            if (price && price > 0) {
                position.currentPrice = safeNumber(price, position.currentPrice);
                position.lastUpdated = new Date();
                console.log(`[Paper Trading] ${position.symbol}: $${oldPrice} → $${position.currentPrice}`);
            } else {
                console.log(`[Paper Trading] No price found for ${position.symbol} (key: ${symbolKey})`);
            }
            
            // Check for TP/SL/Trailing/Liquidation triggers
            const triggers = checkPositionTriggers(position);

            if (triggers.liquidation) {
                const result = await closePosition(account, position, 'liquidation', position.currentPrice);
                if (result) { // Only add if closePosition succeeded (not null due to bad price)
                    triggeredPositions.push({
                        symbol: position.symbol,
                        type: 'liquidation',
                        ...result
                    });
                    positionsToRemove.push(position._id);
                }
            } else if (triggers.takeProfit) {
                const result = await closePosition(account, position, 'take_profit', position.currentPrice);
                if (result) { // Only add if closePosition succeeded
                    triggeredPositions.push({
                        symbol: position.symbol,
                        type: 'take_profit',
                        targetPrice: position.takeProfit,
                        ...result
                    });
                    positionsToRemove.push(position._id);
                }
            } else if (triggers.stopLoss) {
                const result = await closePosition(account, position, 'stop_loss', position.currentPrice);
                if (result) { // Only add if closePosition succeeded
                    triggeredPositions.push({
                        symbol: position.symbol,
                        type: 'stop_loss',
                        targetPrice: position.stopLoss,
                        ...result
                    });
                    positionsToRemove.push(position._id);
                }
            } else if (triggers.trailingStop) {
                const result = await closePosition(account, position, 'trailing_stop', position.currentPrice);
                if (result) { // Only add if closePosition succeeded
                    triggeredPositions.push({
                        symbol: position.symbol,
                        type: 'trailing_stop',
                        trailingStopPrice: position.trailingStopPrice,
                        ...result
                    });
                    positionsToRemove.push(position._id);
                }
            }
        }
        
        // Remove closed positions
        if (positionsToRemove.length > 0) {
            account.positions = account.positions.filter(
                p => !positionsToRemove.includes(p._id)
            );
        }
        
        calculatePortfolioStats(account);
        account.lastUpdated = new Date();
        await account.save();

        // Log P/L for each position after calculation
        account.positions.forEach(pos => {
            console.log(`[Paper Trading] ${pos.symbol} P/L: $${pos.profitLoss?.toFixed(2)} (${pos.profitLossPercent?.toFixed(2)}%) | Entry: $${pos.averagePrice} → Current: $${pos.currentPrice}`);
        });
        console.log(`[Paper Trading] Total Portfolio P/L: $${account.totalProfitLoss?.toFixed(2)} (${account.totalProfitLossPercent?.toFixed(2)}%)`);

        if (triggeredPositions.length > 0) {
            await updateUserStats(req.user.id);
        }

        console.log(`[Paper Trading] Refreshed ${account.positions.length} positions | ${triggeredPositions.length} auto-closed`);
        
        res.json({ 
            success: true, 
            account,
            triggered: triggeredPositions,
            triggeredCount: triggeredPositions.length
        });
        
    } catch (error) {
        console.error('[Paper Trading] Refresh prices error:', error);
        res.status(500).json({ error: 'Failed to refresh prices' });
    }
});

// @route   GET /api/paper-trading/price/:symbol/:type?
router.get('/price/:symbol/:type?', auth, async (req, res) => {
    try {
        const { symbol, type } = req.params;
        const detectedType = type || (priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock');

        const priceResult = await priceService.getCurrentPrice(symbol, detectedType);

        if (priceResult.price === null) {
            return res.status(404).json({ error: `Could not fetch price for ${symbol}` });
        }

        res.json({
            success: true,
            price: safeNumber(priceResult.price, 0),
            symbol: symbol.toUpperCase(),
            type: detectedType,
            source: priceResult.source
        });
    } catch (error) {
        console.error('[Paper Trading] Get price error:', error);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// @route   GET /api/paper-trading/validate/:symbol/:type?
// @desc    Quick check if a symbol is tradeable (has available price)
// @query   coinGeckoId - Optional: CoinGecko ID for crypto (improves accuracy)
router.get('/validate/:symbol/:type?', auth, async (req, res) => {
    try {
        const { symbol, type } = req.params;
        const { coinGeckoId } = req.query;
        const detectedType = type || (priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock');

        // Pass coinGeckoId for crypto to improve price lookup accuracy
        const options = coinGeckoId ? { coinGeckoId } : {};
        const priceResult = await priceService.getCurrentPrice(symbol, detectedType, options);

        if (priceResult.price === null) {
            return res.json({
                success: true,
                tradeable: false,
                symbol: symbol.toUpperCase(),
                type: detectedType,
                message: `${symbol.toUpperCase()} is not available for paper trading. Price data unavailable.`
            });
        }

        res.json({
            success: true,
            tradeable: true,
            symbol: symbol.toUpperCase(),
            type: detectedType,
            price: safeNumber(priceResult.price, 0),
            source: priceResult.source,
            coinGeckoId: priceResult.coinGeckoId || coinGeckoId
        });
    } catch (error) {
        console.error('[Paper Trading] Validate error:', error);
        res.json({
            success: false,
            tradeable: false,
            error: 'Validation failed'
        });
    }
});

// @route   GET /api/paper-trading/orders
router.get('/orders', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.json({ success: true, orders: [] });
        }
        
        res.json({ success: true, orders: account.orders.slice(0, limit) });
    } catch (error) {
        console.error('[Paper Trading] Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// @route   GET /api/paper-trading/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const accounts = await PaperTradingAccount.find()
            .populate('user', 'name username profile.displayName profile.avatar vault.equippedBorder')
            .sort({ totalProfitLossPercent: -1 })
            .limit(limit);
        
        const leaderboard = accounts.map((account, index) => ({
            rank: index + 1,
            user: account.user,
            portfolioValue: safeNumber(account.portfolioValue, 100000),
            profitLoss: safeNumber(account.totalProfitLoss, 0),
            profitLossPercent: safeNumber(account.totalProfitLossPercent, 0),
            winRate: safeNumber(account.winRate, 0),
            totalTrades: safeNumber(account.totalTrades, 0)
        }));
        
        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('[Paper Trading] Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// @route   GET /api/paper-trading/stats
// @desc    Get TP/SL statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.json({ success: true, stats: {} });
        }
        
        res.json({
            success: true,
            stats: {
                totalTrades: account.totalTrades,
                winningTrades: account.winningTrades,
                losingTrades: account.losingTrades,
                winRate: account.winRate,
                biggestWin: account.biggestWin,
                biggestLoss: account.biggestLoss,
                takeProfitHits: account.takeProfitHits || 0,
                stopLossHits: account.stopLossHits || 0,
                trailingStopHits: account.trailingStopHits || 0,
                liquidations: account.liquidations || 0,
                currentStreak: account.currentStreak,
                bestStreak: account.bestStreak
            }
        });
    } catch (error) {
        console.error('[Paper Trading] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// @route   GET /api/paper-trading/refill-tiers
router.get('/refill-tiers', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        const currentBalance = account ? safeNumber(account.cashBalance, 0) : 0;
        const roomToFill = Math.max(0, MAX_BALANCE - currentBalance);

        // ✅ FIX: Use User.gamification.nexusCoins, not the separate Gamification model
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        const nexusCoins = user?.gamification?.nexusCoins ?? 0;
        
        const tiersWithInfo = REFILL_TIERS.map((tier, index) => ({
            ...tier,
            index,
            isFullRefill: tier.coins === 1000,
            canAfford: nexusCoins >= tier.coins,
            wouldExceedCap: tier.coins !== 1000 && (currentBalance + tier.amount) > MAX_BALANCE,
            effectiveAmount: tier.coins === 1000 ? roomToFill : Math.min(tier.amount, roomToFill)
        }));
        
        res.json({ 
            success: true, 
            tiers: tiersWithInfo,
            userInfo: {
                nexusCoins,
                currentBalance,
                maxBalance: MAX_BALANCE,
                roomToFill,
                atMaximum: currentBalance >= MAX_BALANCE
            }
        });
    } catch (error) {
        console.error('[Paper Trading] Get refill tiers error:', error);
        res.status(500).json({ error: 'Failed to fetch refill tiers' });
    }
});

// @route   POST /api/paper-trading/refill
router.post('/refill', auth, async (req, res) => {
    try {
        const { tier, tierIndex } = req.body;

        let selectedTier;
        const tierValue = tierIndex !== undefined ? tierIndex : tier;

        if (typeof tierValue === 'number' && tierValue >= 0 && tierValue < REFILL_TIERS.length) {
            selectedTier = REFILL_TIERS[tierValue];
        } else {
            selectedTier = REFILL_TIERS.find(t => t.coins === tierValue);
        }

        if (!selectedTier) {
            return res.status(400).json({ error: 'Invalid refill tier' });
        }

        // ✅ FIX: Use User.gamification.nexusCoins, not the separate Gamification model
        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Initialize gamification if needed
        if (!user.gamification) {
            user.gamification = {
                xp: 0,
                level: 1,
                title: 'Rookie Trader',
                nextLevelXp: 100,
                totalXpEarned: 0,
                nexusCoins: 1000,
                totalCoinsEarned: 1000,
                achievements: [],
                badges: []
            };
        }

        const currentCoins = safeNumber(user.gamification.nexusCoins, 0);

        if (currentCoins < selectedTier.coins) {
            return res.status(400).json({
                error: `Insufficient Nexus Coins. Need ${selectedTier.coins}, have ${currentCoins}.`
            });
        }

        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id, cashBalance: 0 });
        }

        const currentBalance = safeNumber(account.cashBalance, 0);

        if (currentBalance >= MAX_BALANCE) {
            return res.status(400).json({ error: `Balance already at maximum $${MAX_BALANCE.toLocaleString()}` });
        }

        const roomToFill = MAX_BALANCE - currentBalance;
        const isFullRefill = selectedTier.coins === 1000;

        let amountToAdd = isFullRefill ? roomToFill : Math.min(selectedTier.amount, roomToFill);

        // Deduct coins from User.gamification
        user.gamification.nexusCoins = currentCoins - selectedTier.coins;
        await user.save();
        
        account.cashBalance = currentBalance + amountToAdd;
        account.refillCount = (account.refillCount || 0) + 1;
        account.totalRefillAmount = (account.totalRefillAmount || 0) + amountToAdd;
        account.lastRefillDate = new Date();
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        console.log(`[Paper Trading] Refill: +$${amountToAdd} | New Balance: $${account.cashBalance} | Coins left: ${user.gamification.nexusCoins}`);

        res.json({
            success: true,
            message: `Added $${amountToAdd.toLocaleString()} to your account`,
            account,
            refillDetails: {
                coinsUsed: selectedTier.coins,
                amountAdded: amountToAdd,
                newBalance: account.cashBalance
            },
            // Include gamification data for client UI update
            gamification: {
                nexusCoins: user.gamification.nexusCoins,
                level: user.gamification.level,
                xp: user.gamification.xp,
                title: user.gamification.title
            }
        });
    } catch (error) {
        console.error('[Paper Trading] Refill error:', error);
        res.status(500).json({ error: 'Failed to refill account' });
    }
});

// Alerts routes
router.post('/alerts', auth, async (req, res) => {
    try {
        let { symbol, type, targetPrice, condition } = req.body;
        
        if (!symbol || !targetPrice || !condition) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!type) type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        
        account.alerts.push({
            symbol: symbol.toUpperCase(),
            type,
            targetPrice: safeNumber(targetPrice, 0),
            condition
        });
        await account.save();
        
        res.json({ success: true, alert: account.alerts[account.alerts.length - 1] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

router.get('/alerts', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) return res.json({ success: true, alerts: [] });
        res.json({ success: true, alerts: account.alerts.filter(a => !a.triggered) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

router.delete('/alerts/:alertId', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        
        account.alerts = account.alerts.filter(a => a._id.toString() !== req.params.alertId);
        await account.save();
        
        res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

// @route   POST /api/paper-trading/reset
// @desc    Reset paper trading account to initial state
router.post('/reset', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Reset all fields to defaults
        account.cashBalance = 100000;
        account.initialBalance = 100000;
        account.portfolioValue = 100000;
        account.totalProfitLoss = 0;
        account.totalProfitLossPercent = 0;
        account.totalTrades = 0;
        account.winningTrades = 0;
        account.losingTrades = 0;
        account.winRate = 0;
        account.currentStreak = 0;
        account.bestStreak = 0;
        account.biggestWin = 0;
        account.biggestLoss = 0;
        account.takeProfitHits = 0;
        account.stopLossHits = 0;
        account.trailingStopHits = 0;
        account.liquidations = 0;
        account.refillCount = 0;
        account.totalRefillAmount = 0;
        account.lastRefillDate = null;

        // Clear arrays
        account.positions = [];
        account.orders = [];
        account.alerts = [];

        account.lastUpdated = new Date();

        await account.save();

        console.log(`[Paper Trading] Account RESET for user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Paper trading account has been reset to $100,000',
            account
        });

    } catch (error) {
        console.error('[Paper Trading] Reset error:', error);
        res.status(500).json({ error: 'Failed to reset account' });
    }
});

// @route   GET /api/paper-trading/badge-progress
// @desc    Check badge tracking progress (for testing)
router.get('/badge-progress', auth, async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const progress = {
            // Badge tracking stats
            earlyTrades: user.gamification?.earlyTrades || 0,
            lateTrades: user.gamification?.lateTrades || 0,
            highRiskTrades: user.gamification?.highRiskTrades || 0,
            profitableTrades: user.gamification?.profitableTrades || 0,
            consecutiveProfitableDays: user.gamification?.consecutiveProfitableDays || 0,
            
            // Badge status
            badges: user.gamification?.badges || [],
            badgesEarned: user.gamification?.badgesEarned || 0,
            
            // Progress toward badges
            earlyBirdProgress: `${user.gamification?.earlyTrades || 0}/10`,
            nightOwlProgress: `${user.gamification?.lateTrades || 0}/10`,
            riskTakerProgress: `${user.gamification?.highRiskTrades || 0}/5`,
            profitKingProgress: `${user.gamification?.profitableTrades || 0}/50`
        };
        
        res.json({ success: true, progress });
    } catch (error) {
        console.error('[Badge Progress] Error:', error);
        res.status(500).json({ error: 'Failed to fetch badge progress' });
    }
});
module.exports = router;