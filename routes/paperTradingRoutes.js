// server/routes/paperTradingRoutes.js - Complete Paper Trading System
// WITH LEVERAGE TRADING + $100K REFILL CAP
// Using centralized price service + AUTO-UPDATE USER STATS

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const PaperTradingAccount = require('../models/PaperTradingAccount');

// ✅ USE CENTRALIZED PRICE SERVICE (removes ~50 lines of duplicate code)
const priceService = require('../services/priceService');

// ============ CONSTANTS ============
const REFILL_TIERS = [
    { coins: 100, amount: 10000, label: '$10,000' },
    { coins: 250, amount: 25000, label: '$25,000' },
    { coins: 500, amount: 50000, label: '$50,000' },
    { coins: 750, amount: 75000, label: '$75,000' },
    { coins: 1000, amount: 100000, label: '$100,000 (Full Refill)' }
];

const MAX_BALANCE = 100000; // Maximum balance cap - CANNOT EXCEED THIS

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 7, 10, 20]; // Available leverage multipliers


// Helper function to safely parse numbers and prevent NaN propagation
function safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

// Calculate portfolio stats with safe number handling + LEVERAGE SUPPORT
function calculatePortfolioStats(account) {
    let positionsValue = 0;
    let totalMarginUsed = 0;
    
    // Ensure positions array exists
    if (!account.positions) account.positions = [];
    
    account.positions.forEach(pos => {
        const currentPrice = safeNumber(pos.currentPrice, 0);
        const averagePrice = safeNumber(pos.averagePrice, currentPrice);
        const quantity = safeNumber(pos.quantity, 0);
        const positionType = pos.positionType || 'long';
        const leverage = safeNumber(pos.leverage, 1);
        
        // Margin is what they actually paid
        const margin = safeNumber(averagePrice * quantity, 0);
        totalMarginUsed += margin;
        
        // Calculate price change percentage
        const priceChangePercent = averagePrice > 0 
            ? (currentPrice - averagePrice) / averagePrice 
            : 0;
        
        // Calculate P/L based on position type and leverage
        if (positionType === 'short') {
            // Short positions profit when price goes down
            // With leverage, the P/L is multiplied
            const basePnL = (averagePrice - currentPrice) * quantity;
            pos.profitLoss = safeNumber(basePnL * leverage, 0);
            pos.profitLossPercent = safeNumber(-priceChangePercent * leverage * 100, 0);
        } else {
            // Long positions profit when price goes up
            const basePnL = (currentPrice - averagePrice) * quantity;
            pos.profitLoss = safeNumber(basePnL * leverage, 0);
            pos.profitLossPercent = safeNumber(priceChangePercent * leverage * 100, 0);
        }
        
        // Position value = margin + leveraged P/L
        const posValue = safeNumber(margin + pos.profitLoss, margin);
        positionsValue += Math.max(0, posValue); // Can't go below 0 (liquidation)
        
        // Update leveraged value for display
        pos.leveragedValue = safeNumber(margin * leverage, margin);
        
        // Check for liquidation (if loss exceeds 90% of margin)
        if (leverage > 1 && pos.profitLoss < -(margin * 0.9)) {
            pos.isLiquidated = true;
        }
    });
    
    const cashBalance = safeNumber(account.cashBalance, 100000);
    const initialBalance = safeNumber(account.initialBalance, 100000);
    
    account.portfolioValue = safeNumber(cashBalance + positionsValue, initialBalance);
    account.totalProfitLoss = safeNumber(account.portfolioValue - initialBalance, 0);
    account.totalProfitLossPercent = initialBalance > 0 ? 
        safeNumber((account.totalProfitLoss / initialBalance) * 100, 0) : 0;
    account.winRate = safeNumber(account.totalTrades, 0) > 0 ? 
        safeNumber((safeNumber(account.winningTrades, 0) / safeNumber(account.totalTrades, 1)) * 100, 0) : 0;
}

// ✅ AUTO-UPDATE USER STATS HELPER
async function updateUserStats(userId) {
    try {
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user && typeof user.calculateStats === 'function') {
            await user.calculateStats();
            console.log('✅ User stats auto-updated');
        }
    } catch (error) {
        console.warn('⚠️ Stats auto-update failed:', error.message);
    }
}

// ============ ROUTES ============

// @route   GET /api/paper-trading/account
// @desc    Get or create paper trading account
// @access  Private
router.get('/account', auth, async (req, res) => {
    try {
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id });
            await account.save();
            console.log(`[Paper Trading] Created new account for user ${req.user.id}`);
        }
        
        // Recalculate stats to ensure no NaN values
        calculatePortfolioStats(account);
        
        res.json({ success: true, account });
    } catch (error) {
        console.error('[Paper Trading] Get account error:', error);
        res.status(500).json({ success: false, error: 'Failed to load account' });
    }
});

// @route   GET /api/paper-trading/leverage-options
// @desc    Get available leverage options
// @access  Private
router.get('/leverage-options', auth, (req, res) => {
    res.json({
        success: true,
        options: LEVERAGE_OPTIONS.map(lev => ({
            value: lev,
            label: lev === 1 ? '1x (No Leverage)' : `${lev}x`,
            riskLevel: lev <= 2 ? 'low' : lev <= 5 ? 'medium' : lev <= 10 ? 'high' : 'extreme',
            liquidationThreshold: lev === 1 ? null : (90 / lev).toFixed(1) // % loss before liquidation
        }))
    });
});

// @route   POST /api/paper-trading/buy
// @desc    Buy stock or crypto (WITH LEVERAGE SUPPORT)
// @access  Private
router.post('/buy', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes, positionType = 'long', leverage = 1 } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate leverage
        const safeLeverage = safeNumber(leverage, 1);
        if (!LEVERAGE_OPTIONS.includes(safeLeverage)) {
            return res.status(400).json({ 
                error: `Invalid leverage. Choose from: ${LEVERAGE_OPTIONS.join(', ')}`,
                validOptions: LEVERAGE_OPTIONS
            });
        }
        
        // ✅ Auto-detect type if not provided
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
            console.log(`[Paper Trading] Auto-detected ${symbol} as ${type}`);
        }
        
        const safeQuantity = safeNumber(quantity, 0);
        if (safeQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id });
        }
        
        // ✅ Use centralized price service
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        const safePrice = safeNumber(priceResult.price, 0);
        
        // MARGIN is what the user pays (deducted from cash)
        const margin = safeNumber(safePrice * safeQuantity, 0);
        // LEVERAGED VALUE is the actual position size
        const leveragedValue = safeNumber(margin * safeLeverage, margin);
        
        const safeCashBalance = safeNumber(account.cashBalance, 100000);
        
        if (margin > safeCashBalance) {
            return res.status(400).json({ 
                error: `Insufficient funds. Need $${margin.toFixed(2)} margin for this ${safeLeverage}x position.`,
                required: margin,
                available: safeCashBalance
            });
        }
        
        // Calculate liquidation price (for leveraged positions)
        let liquidationPrice = null;
        if (safeLeverage > 1) {
            // Liquidation when position loses 90% of margin
            // For long: price drops by (90% / leverage)
            liquidationPrice = safePrice * (1 - (0.9 / safeLeverage));
        }
        
        // Deduct margin from cash
        account.cashBalance = safeNumber(safeCashBalance - margin, 0);
        
        // Ensure positions array exists
        if (!account.positions) account.positions = [];
        
        // Check for existing position with same symbol, type, positionType AND leverage
        const existingPosition = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && 
                 p.type === type && 
                 (p.positionType || 'long') === positionType &&
                 safeNumber(p.leverage, 1) === safeLeverage
        );
        
        if (existingPosition) {
            // Adding to existing position with same leverage
            const existingQuantity = safeNumber(existingPosition.quantity, 0);
            const existingAvgPrice = safeNumber(existingPosition.averagePrice, safePrice);
            
            const totalQuantity = safeNumber(existingQuantity + safeQuantity, 0);
            const totalMargin = safeNumber(
                (existingAvgPrice * existingQuantity) + margin, 
                0
            );
            
            existingPosition.averagePrice = totalQuantity > 0 ? 
                safeNumber(totalMargin / totalQuantity, safePrice) : safePrice;
            existingPosition.quantity = totalQuantity;
            existingPosition.currentPrice = safePrice;
            existingPosition.leveragedValue = safeNumber(existingPosition.averagePrice * totalQuantity * safeLeverage, 0);
            
            // Recalculate liquidation price
            if (safeLeverage > 1) {
                existingPosition.liquidationPrice = existingPosition.averagePrice * (1 - (0.9 / safeLeverage));
            }
        } else {
            // Check if position exists with different leverage
            const sameSymbolDiffLeverage = account.positions.find(
                p => p.symbol === symbol.toUpperCase() && 
                     p.type === type && 
                     (p.positionType || 'long') === positionType &&
                     safeNumber(p.leverage, 1) !== safeLeverage
            );
            
            if (sameSymbolDiffLeverage) {
                // Refund the margin since we're rejecting
                account.cashBalance = safeCashBalance;
                return res.status(400).json({
                    error: `You already have a ${safeNumber(sameSymbolDiffLeverage.leverage, 1)}x position in ${symbol}. Close it first or use the same leverage.`,
                    existingLeverage: safeNumber(sameSymbolDiffLeverage.leverage, 1)
                });
            }
            
            // Create new position
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
                openedAt: new Date()
            });
        }
        
        // Add order with leverage info
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
            notes: notes || ''
        });
        
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        // ✅ AUTO-UPDATE USER STATS AFTER TRADE
        await updateUserStats(req.user.id);
        
        const leverageMsg = safeLeverage > 1 ? ` with ${safeLeverage}x leverage (Position: $${leveragedValue.toFixed(2)})` : '';
        console.log(`[Paper Trading] BUY: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} (${positionType})${leverageMsg} [${priceResult.source}]`);
        
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
                liquidationPrice
            }
        });
        
    } catch (error) {
        console.error('[Paper Trading] Buy error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute buy order' });
    }
});

// @route   POST /api/paper-trading/sell
// @desc    Sell stock or crypto (WITH LEVERAGE P&L)
// @access  Private
router.post('/sell', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes, positionType = 'long', leverage = 1 } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // ✅ Auto-detect type if not provided
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
            console.log(`[Paper Trading] Auto-detected ${symbol} as ${type}`);
        }
        
        const safeQuantity = safeNumber(quantity, 0);
        if (safeQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(400).json({ error: 'Account not found' });
        }
        
        // Ensure positions array exists
        if (!account.positions) account.positions = [];
        
        // ✅ Use centralized price service
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        const safePrice = safeNumber(priceResult.price, 0);
        
        // Check if this is opening a new short position or closing a long
        if (positionType === 'short') {
            // Opening a short position
            const safeLeverage = safeNumber(leverage, 1);
            if (!LEVERAGE_OPTIONS.includes(safeLeverage)) {
                return res.status(400).json({ 
                    error: `Invalid leverage. Choose from: ${LEVERAGE_OPTIONS.join(', ')}`
                });
            }
            
            const margin = safeNumber(safePrice * safeQuantity, 0);
            const leveragedValue = safeNumber(margin * safeLeverage, margin);
            
            const safeCashBalance = safeNumber(account.cashBalance, 0);
            if (margin > safeCashBalance) {
                return res.status(400).json({ 
                    error: `Insufficient funds for short margin. Need $${margin.toFixed(2)}.`,
                    required: margin,
                    available: safeCashBalance
                });
            }
            
            // Deduct margin for short
            account.cashBalance = safeNumber(safeCashBalance - margin, 0);
            
            // Calculate liquidation price for short (price goes UP)
            let liquidationPrice = null;
            if (safeLeverage > 1) {
                liquidationPrice = safePrice * (1 + (0.9 / safeLeverage));
            }
            
            // Check for existing short position
            const existingShort = account.positions.find(
                p => p.symbol === symbol.toUpperCase() && 
                     p.type === type && 
                     p.positionType === 'short' &&
                     safeNumber(p.leverage, 1) === safeLeverage
            );
            
            if (existingShort) {
                const existingQuantity = safeNumber(existingShort.quantity, 0);
                const existingAvgPrice = safeNumber(existingShort.averagePrice, safePrice);
                
                const totalQuantity = safeNumber(existingQuantity + safeQuantity, 0);
                const totalMargin = safeNumber(
                    (existingAvgPrice * existingQuantity) + margin,
                    0
                );
                
                existingShort.averagePrice = totalQuantity > 0 ?
                    safeNumber(totalMargin / totalQuantity, safePrice) : safePrice;
                existingShort.quantity = totalQuantity;
                existingShort.currentPrice = safePrice;
                existingShort.leveragedValue = safeNumber(existingShort.averagePrice * totalQuantity * safeLeverage, 0);
                
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
                    openedAt: new Date()
                });
            }
            
            // Add order
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
                notes: notes || ''
            });
            
            account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
            account.lastUpdated = new Date();
            
            calculatePortfolioStats(account);
            await account.save();
            
            await updateUserStats(req.user.id);
            
            const leverageMsg = safeLeverage > 1 ? ` with ${safeLeverage}x leverage` : '';
            console.log(`[Paper Trading] SHORT SELL: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)}${leverageMsg} [${priceResult.source}]`);
            
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
                    liquidationPrice
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
        
        const positionLeverage = safeNumber(position.leverage, 1);
        const avgPrice = safeNumber(position.averagePrice, safePrice);
        
        // Calculate leveraged P&L
        const marginUsed = safeNumber(avgPrice * safeQuantity, 0);
        const priceChange = safePrice - avgPrice;
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;
        
        // P&L is amplified by leverage
        const profitLoss = safeNumber(marginUsed * percentChange * positionLeverage, 0);
        const profitLossPercent = safeNumber(percentChange * positionLeverage * 100, 0);
        
        // Proceeds = margin returned + leveraged P&L
        const proceeds = safeNumber(marginUsed + profitLoss, marginUsed);
        
        // Add proceeds to cash
        account.cashBalance = safeNumber(account.cashBalance, 0) + Math.max(0, proceeds);
        
        // Update or remove position
        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && (p.positionType || 'long') === 'long')
            );
        } else {
            position.quantity = safeNumber(positionQuantity - safeQuantity, 0);
            position.currentPrice = safePrice;
            position.leveragedValue = safeNumber(position.quantity * position.averagePrice * positionLeverage, 0);
        }
        
        // Add order with P&L
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
            notes: notes || ''
        });
        
        // Update stats
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        
        if (profitLoss > 0) {
            account.winningTrades = safeNumber(account.winningTrades, 0) + 1;
            const currentStreak = safeNumber(account.currentStreak, 0);
            account.currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
            const biggestWin = safeNumber(account.biggestWin, 0);
            if (profitLoss > biggestWin) account.biggestWin = profitLoss;
        } else if (profitLoss < 0) {
            account.losingTrades = safeNumber(account.losingTrades, 0) + 1;
            const currentStreak = safeNumber(account.currentStreak, 0);
            account.currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
            const biggestLoss = safeNumber(account.biggestLoss, 0);
            if (profitLoss < biggestLoss) account.biggestLoss = profitLoss;
        }
        
        const currentStreak = safeNumber(account.currentStreak, 0);
        const bestStreak = safeNumber(account.bestStreak, 0);
        if (Math.abs(currentStreak) > Math.abs(bestStreak)) {
            account.bestStreak = currentStreak;
        }
        
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        await updateUserStats(req.user.id);
        
        const leverageMsg = positionLeverage > 1 ? ` (${positionLeverage}x leveraged)` : '';
        console.log(`[Paper Trading] SELL: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)}${leverageMsg} | P/L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(1)}%) [${priceResult.source}]`);
        
        res.json({
            success: true,
            message: `Sold ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}${leverageMsg}`,
            account,
            profitLoss,
            profitLossPercent,
            trade: {
                symbol: symbol.toUpperCase(),
                quantity: safeQuantity,
                price: safePrice,
                proceeds,
                leverage: positionLeverage,
                profitLoss,
                profitLossPercent
            }
        });
        
    } catch (error) {
        console.error('[Paper Trading] Sell error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute sell order' });
    }
});

// @route   POST /api/paper-trading/cover
// @desc    Cover (close) a short position (WITH LEVERAGE P&L)
// @access  Private
router.post('/cover', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes } = req.body;
        
        if (!symbol || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // ✅ Auto-detect type if not provided
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
            return res.status(400).json({ error: `You don't have a short position in ${symbol}` });
        }
        
        const positionQuantity = safeNumber(position.quantity, 0);
        if (safeQuantity > positionQuantity) {
            return res.status(400).json({ error: `Cannot cover more than you shorted. Position: ${positionQuantity}` });
        }
        
        // ✅ Use centralized price service
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        if (priceResult.price === null) {
            return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        const safePrice = safeNumber(priceResult.price, 0);
        const positionLeverage = safeNumber(position.leverage, 1);
        const avgPrice = safeNumber(position.averagePrice, safePrice);
        
        // Calculate leveraged P&L for short
        const marginUsed = safeNumber(avgPrice * safeQuantity, 0);
        const priceChange = avgPrice - safePrice; // Shorts profit when price goes DOWN
        const percentChange = avgPrice > 0 ? priceChange / avgPrice : 0;
        
        // P&L is amplified by leverage
        const profitLoss = safeNumber(marginUsed * percentChange * positionLeverage, 0);
        const profitLossPercent = safeNumber(percentChange * positionLeverage * 100, 0);
        
        // Proceeds = margin returned + leveraged P&L
        const proceeds = safeNumber(marginUsed + profitLoss, marginUsed);
        
        // Check if user can afford to cover (in case of loss)
        if (proceeds < 0) {
            const safeCashBalance = safeNumber(account.cashBalance, 0);
            if (Math.abs(proceeds) > safeCashBalance + marginUsed) {
                return res.status(400).json({ 
                    error: 'Insufficient funds to cover short position at current loss level'
                });
            }
        }
        
        // Add proceeds to cash (can be negative if loss exceeds margin)
        account.cashBalance = safeNumber(account.cashBalance, 0) + Math.max(0, proceeds);
        
        // Update or remove position
        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short')
            );
        } else {
            position.quantity = safeNumber(positionQuantity - safeQuantity, 0);
            position.currentPrice = safePrice;
            position.leveragedValue = safeNumber(position.quantity * position.averagePrice * positionLeverage, 0);
        }
        
        // Add order
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
            notes: notes || ''
        });
        
        // Update stats
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        
        if (profitLoss > 0) {
            account.winningTrades = safeNumber(account.winningTrades, 0) + 1;
            const currentStreak = safeNumber(account.currentStreak, 0);
            account.currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
            const biggestWin = safeNumber(account.biggestWin, 0);
            if (profitLoss > biggestWin) account.biggestWin = profitLoss;
        } else if (profitLoss < 0) {
            account.losingTrades = safeNumber(account.losingTrades, 0) + 1;
            const currentStreak = safeNumber(account.currentStreak, 0);
            account.currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
            const biggestLoss = safeNumber(account.biggestLoss, 0);
            if (profitLoss < biggestLoss) account.biggestLoss = profitLoss;
        }
        
        const currentStreak = safeNumber(account.currentStreak, 0);
        const bestStreak = safeNumber(account.bestStreak, 0);
        if (Math.abs(currentStreak) > Math.abs(bestStreak)) {
            account.bestStreak = currentStreak;
        }
        
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        await updateUserStats(req.user.id);
        
        const leverageMsg = positionLeverage > 1 ? ` (${positionLeverage}x leveraged)` : '';
        console.log(`[Paper Trading] COVER: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)}${leverageMsg} | P/L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(1)}%) [${priceResult.source}]`);
        
        res.json({
            success: true,
            message: `Covered ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}${leverageMsg}`,
            account,
            profitLoss,
            profitLossPercent,
            trade: {
                symbol: symbol.toUpperCase(),
                quantity: safeQuantity,
                price: safePrice,
                proceeds,
                leverage: positionLeverage,
                profitLoss,
                profitLossPercent
            }
        });
        
    } catch (error) {
        console.error('[Paper Trading] Cover error:', error);
        res.status(500).json({ error: error.message || 'Failed to cover short position' });
    }
});

// @route   GET /api/paper-trading/price/:symbol/:type
// @desc    Get current price for a symbol
// @access  Private
router.get('/price/:symbol/:type', auth, async (req, res) => {
    try {
        const { symbol, type } = req.params;
        
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        
        if (priceResult.price === null) {
            return res.status(404).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        res.json({ 
            success: true, 
            price: safeNumber(priceResult.price, 0), 
            symbol: symbol.toUpperCase(),
            source: priceResult.source,
            isCrypto: priceService.isCryptoSymbol(symbol)
        });
    } catch (error) {
        console.error('[Paper Trading] Get price error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch price' });
    }
});

// @route   GET /api/paper-trading/price/:symbol
// @desc    Get current price with auto-detection
// @access  Private
router.get('/price/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        
        const type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        const priceResult = await priceService.getCurrentPrice(symbol, type);
        
        if (priceResult.price === null) {
            return res.status(404).json({ error: `Could not fetch price for ${symbol}` });
        }
        
        res.json({ 
            success: true, 
            price: safeNumber(priceResult.price, 0), 
            symbol: symbol.toUpperCase(),
            type,
            source: priceResult.source
        });
    } catch (error) {
        console.error('[Paper Trading] Get price error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch price' });
    }
});

// @route   POST /api/paper-trading/refresh-prices
// @desc    Refresh all position prices
// @access  Private
router.post('/refresh-prices', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        if (!account.positions) account.positions = [];
        
        // Batch fetch crypto prices for efficiency
        const cryptoPositions = account.positions.filter(p => 
            p.type === 'crypto' || priceService.isCryptoSymbol(p.symbol)
        );
        
        if (cryptoPositions.length > 0) {
            const cryptoSymbols = cryptoPositions.map(p => p.symbol);
            const batchPrices = await priceService.fetchCoinGeckoPricesBatch(cryptoSymbols);
            
            for (const position of cryptoPositions) {
                if (batchPrices[position.symbol]) {
                    position.currentPrice = safeNumber(batchPrices[position.symbol], position.currentPrice || 0);
                }
            }
        }
        
        // Fetch stock prices individually
        const stockPositions = account.positions.filter(p => 
            p.type === 'stock' && !priceService.isCryptoSymbol(p.symbol)
        );
        
        for (const position of stockPositions) {
            try {
                const priceResult = await priceService.getCurrentPrice(position.symbol, 'stock');
                if (priceResult.price !== null) {
                    position.currentPrice = safeNumber(priceResult.price, position.currentPrice || 0);
                }
            } catch (error) {
                console.error(`Failed to update price for ${position.symbol}:`, error.message);
            }
        }
        
        calculatePortfolioStats(account);
        account.lastUpdated = new Date();
        await account.save();
        
        console.log(`[Paper Trading] Refreshed prices for ${account.positions.length} positions`);
        
        res.json({ success: true, account });
    } catch (error) {
        console.error('[Paper Trading] Refresh prices error:', error);
        res.status(500).json({ error: 'Failed to refresh prices' });
    }
});

// @route   GET /api/paper-trading/orders
// @desc    Get order history
// @access  Private
router.get('/orders', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.json({ success: true, orders: [] });
        }
        
        const orders = account.orders.slice(0, limit);
        res.json({ success: true, orders });
    } catch (error) {
        console.error('[Paper Trading] Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// @route   GET /api/paper-trading/leaderboard
// @desc    Get top traders
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const accounts = await PaperTradingAccount.find()
            .populate('user', 'name username profile.displayName profile.avatar')
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

// @route   POST /api/paper-trading/alerts
// @desc    Create price alert
// @access  Private
router.post('/alerts', auth, async (req, res) => {
    try {
        let { symbol, type, targetPrice, condition } = req.body;
        
        if (!symbol || !targetPrice || !condition) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!type) {
            type = priceService.isCryptoSymbol(symbol) ? 'crypto' : 'stock';
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        const alert = {
            symbol: symbol.toUpperCase(),
            type,
            targetPrice: safeNumber(targetPrice, 0),
            condition
        };
        
        account.alerts.push(alert);
        await account.save();
        
        res.json({ success: true, alert: account.alerts[account.alerts.length - 1] });
    } catch (error) {
        console.error('[Paper Trading] Create alert error:', error);
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// @route   GET /api/paper-trading/alerts
// @desc    Get all alerts
// @access  Private
router.get('/alerts', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.json({ success: true, alerts: [] });
        }
        
        res.json({ success: true, alerts: account.alerts.filter(a => !a.triggered) });
    } catch (error) {
        console.error('[Paper Trading] Get alerts error:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// @route   DELETE /api/paper-trading/alerts/:alertId
// @desc    Delete alert
// @access  Private
router.delete('/alerts/:alertId', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        account.alerts = account.alerts.filter(a => a._id.toString() !== req.params.alertId);
        await account.save();
        
        res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
        console.error('[Paper Trading] Delete alert error:', error);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

// @route   GET /api/paper-trading/refill-tiers
// @desc    Get available refill tiers WITH CAP INFO
// @access  Private
router.get('/refill-tiers', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        const currentBalance = account ? safeNumber(account.cashBalance, 0) : 0;
        const roomToFill = Math.max(0, MAX_BALANCE - currentBalance);
        
        // Get user's coins
        const Gamification = require('../models/Gamification');
        const gamification = await Gamification.findOne({ user: req.user.id });
        const nexusCoins = gamification ? safeNumber(gamification.nexusCoins, 0) : 0;
        
        // Add availability info to each tier
        const tiersWithInfo = REFILL_TIERS.map((tier, index) => {
            const isFullRefill = tier.coins === 1000;
            const wouldExceedCap = !isFullRefill && (currentBalance + tier.amount) > MAX_BALANCE;
            const effectiveAmount = isFullRefill 
                ? roomToFill
                : Math.min(tier.amount, roomToFill);
            
            return {
                ...tier,
                index,
                isFullRefill,
                canAfford: nexusCoins >= tier.coins,
                wouldExceedCap,
                effectiveAmount
            };
        });
        
        res.json({ 
            success: true, 
            tiers: tiersWithInfo,
            userInfo: {
                nexusCoins,
                currentBalance,
                maxBalance: MAX_BALANCE,
                roomToFill,
                atMaximum: currentBalance >= MAX_BALANCE,
                percentFull: Math.min(100, (currentBalance / MAX_BALANCE) * 100).toFixed(1)
            }
        });
    } catch (error) {
        console.error('[Paper Trading] Get refill tiers error:', error);
        res.status(500).json({ error: 'Failed to fetch refill tiers' });
    }
});

// @route   POST /api/paper-trading/refill
// @desc    Refill paper trading balance (WITH $100K CAP)
// @access  Private
router.post('/refill', auth, async (req, res) => {
    try {
        const { tier, tierIndex } = req.body;
        
        // Find the selected tier (support both 'tier' and 'tierIndex')
        let selectedTier;
        const tierValue = tierIndex !== undefined ? tierIndex : tier;
        
        if (typeof tierValue === 'number' && tierValue >= 0 && tierValue < REFILL_TIERS.length) {
            selectedTier = REFILL_TIERS[tierValue];
        } else {
            selectedTier = REFILL_TIERS.find(t => t.coins === tierValue);
        }
        
        if (!selectedTier) {
            return res.status(400).json({ 
                error: 'Invalid refill tier selected',
                availableTiers: REFILL_TIERS
            });
        }
        
        // Get user's gamification data
        const Gamification = require('../models/Gamification');
        const gamification = await Gamification.findOne({ user: req.user.id });
        
        if (!gamification) {
            return res.status(400).json({ 
                error: 'Gamification data not found.',
                required: selectedTier.coins,
                current: 0
            });
        }
        
        const currentCoins = safeNumber(gamification.nexusCoins, 0);
        
        if (currentCoins < selectedTier.coins) {
            return res.status(400).json({ 
                error: `Insufficient Nexus Coins. You need ${selectedTier.coins} coins. You have ${currentCoins}.`,
                required: selectedTier.coins,
                current: currentCoins
            });
        }
        
        // Get paper trading account
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id, cashBalance: 0 });
        }
        
        const currentBalance = safeNumber(account.cashBalance, 0);
        const isFullRefill = selectedTier.coins === 1000;
        
        // ========== $100,000 CAP ENFORCEMENT ==========
        
        if (currentBalance >= MAX_BALANCE) {
            return res.status(400).json({
                success: false,
                error: `Your balance is already at the maximum of $${MAX_BALANCE.toLocaleString()}. You cannot refill further.`,
                currentBalance,
                maxBalance: MAX_BALANCE,
                atMaximum: true
            });
        }
        
        const roomToFill = MAX_BALANCE - currentBalance;
        
        let amountToAdd;
        let newBalance;
        let wasCapped = false;
        
        if (isFullRefill) {
            // Full refill - sets balance to exactly $100,000
            amountToAdd = roomToFill;
            newBalance = MAX_BALANCE;
        } else {
            if (selectedTier.amount > roomToFill) {
                // Cap the amount
                amountToAdd = roomToFill;
                newBalance = MAX_BALANCE;
                wasCapped = true;
            } else {
                amountToAdd = selectedTier.amount;
                newBalance = currentBalance + amountToAdd;
            }
        }
        
        if (amountToAdd <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Your balance is already at the maximum. No refill needed.',
                currentBalance,
                maxBalance: MAX_BALANCE
            });
        }
        
        // Deduct coins
        gamification.nexusCoins = currentCoins - selectedTier.coins;
        await gamification.save();
        
        // Update account
        account.cashBalance = newBalance;
        account.refillCount = (account.refillCount || 0) + 1;
        account.totalRefillAmount = (account.totalRefillAmount || 0) + amountToAdd;
        account.lastRefillDate = new Date();
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        // Build message
        let message;
        if (isFullRefill) {
            message = `Full refill complete! Balance set to $${MAX_BALANCE.toLocaleString()}`;
        } else if (wasCapped) {
            message = `Refill successful! Added $${amountToAdd.toLocaleString()} (capped at $${MAX_BALANCE.toLocaleString()} maximum)`;
        } else {
            message = `Refill successful! Added $${amountToAdd.toLocaleString()} to your account`;
        }
        
        console.log(`[Paper Trading] Refill: ${selectedTier.label} | Cost: ${selectedTier.coins} coins | Added: $${amountToAdd} | New Balance: $${newBalance}${wasCapped ? ' (CAPPED)' : ''}`);
        
        res.json({ 
            success: true, 
            message,
            account,
            refillDetails: {
                tier: selectedTier.label,
                coinsUsed: selectedTier.coins,
                requestedAmount: selectedTier.amount,
                amountAdded: amountToAdd,
                previousBalance: currentBalance,
                newBalance: account.cashBalance,
                wasCapped,
                maxBalance: MAX_BALANCE
            },
            gamification: {
                nexusCoins: gamification.nexusCoins
            },
            refillCount: account.refillCount
        });
    } catch (error) {
        console.error('[Paper Trading] Refill error:', error);
        res.status(500).json({ error: 'Failed to refill account' });
    }
});


module.exports = router;