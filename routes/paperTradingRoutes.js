// server/routes/paperTradingRoutes.js - Complete Paper Trading System
// Using centralized price service

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const PaperTradingAccount = require('../models/PaperTradingAccount');

// ✅ USE CENTRALIZED PRICE SERVICE (removes ~50 lines of duplicate code)
const priceService = require('../services/priceService');

// Helper function to safely parse numbers and prevent NaN propagation
function safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

// Calculate portfolio stats with safe number handling
function calculatePortfolioStats(account) {
    let positionsValue = 0;
    
    // Ensure positions array exists
    if (!account.positions) account.positions = [];
    
    account.positions.forEach(pos => {
        const currentPrice = safeNumber(pos.currentPrice, 0);
        const averagePrice = safeNumber(pos.averagePrice, currentPrice);
        const quantity = safeNumber(pos.quantity, 0);
        const positionType = pos.positionType || 'long';
        
        // Calculate position value
        const posValue = safeNumber(currentPrice * quantity, 0);
        positionsValue += posValue;
        
        // Calculate P/L based on position type (long vs short)
        if (positionType === 'short') {
            // Short positions profit when price goes down
            pos.profitLoss = safeNumber((averagePrice - currentPrice) * quantity, 0);
            pos.profitLossPercent = averagePrice > 0 ? 
                safeNumber(((averagePrice - currentPrice) / averagePrice) * 100, 0) : 0;
        } else {
            // Long positions profit when price goes up
            pos.profitLoss = safeNumber((currentPrice - averagePrice) * quantity, 0);
            pos.profitLossPercent = averagePrice > 0 ? 
                safeNumber(((currentPrice - averagePrice) / averagePrice) * 100, 0) : 0;
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

// @route   POST /api/paper-trading/buy
// @desc    Buy stock or crypto (or cover short position)
// @access  Private
router.post('/buy', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes, positionType = 'long' } = req.body;
        
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
        const totalCost = safeNumber(safePrice * safeQuantity, 0);
        
        const safeCashBalance = safeNumber(account.cashBalance, 100000);
        
        if (totalCost > safeCashBalance) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        // Deduct cash
        account.cashBalance = safeNumber(safeCashBalance - totalCost, 0);
        
        // Ensure positions array exists
        if (!account.positions) account.positions = [];
        
        // Add or update position
        const existingPosition = account.positions.find(
            p => p.symbol === symbol.toUpperCase() && p.type === type && (p.positionType || 'long') === positionType
        );
        
        if (existingPosition) {
            const existingQuantity = safeNumber(existingPosition.quantity, 0);
            const existingAvgPrice = safeNumber(existingPosition.averagePrice, safePrice);
            
            const totalQuantity = safeNumber(existingQuantity + safeQuantity, 0);
            const totalCostBasis = safeNumber(
                (existingAvgPrice * existingQuantity) + (safePrice * safeQuantity), 
                0
            );
            
            existingPosition.averagePrice = totalQuantity > 0 ? 
                safeNumber(totalCostBasis / totalQuantity, safePrice) : safePrice;
            existingPosition.quantity = totalQuantity;
            existingPosition.currentPrice = safePrice;
        } else {
            account.positions.push({
                symbol: symbol.toUpperCase(),
                type,
                positionType,
                quantity: safeQuantity,
                averagePrice: safePrice,
                currentPrice: safePrice
            });
        }
        
        // Add order
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'buy',
            positionType,
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: totalCost,
            notes: notes || ''
        });
        
        account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        console.log(`[Paper Trading] BUY: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} (${positionType}) [${priceResult.source}]`);
        
        res.json({
            success: true,
            message: `Bought ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
            account
        });
        
    } catch (error) {
        console.error('[Paper Trading] Buy error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute buy order' });
    }
});

// @route   POST /api/paper-trading/sell
// @desc    Sell stock or crypto (or open short position)
// @access  Private
router.post('/sell', auth, async (req, res) => {
    try {
        let { symbol, type, quantity, notes, positionType = 'long' } = req.body;
        
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
            // Opening a short position - no existing position needed
            const totalRevenue = safeNumber(safePrice * safeQuantity, 0);
            
            // Add cash from short sale
            account.cashBalance = safeNumber(account.cashBalance, 0) + totalRevenue;
            
            // Check for existing short position to add to
            const existingShort = account.positions.find(
                p => p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short'
            );
            
            if (existingShort) {
                const existingQuantity = safeNumber(existingShort.quantity, 0);
                const existingAvgPrice = safeNumber(existingShort.averagePrice, safePrice);
                
                const totalQuantity = safeNumber(existingQuantity + safeQuantity, 0);
                const totalCostBasis = safeNumber(
                    (existingAvgPrice * existingQuantity) + (safePrice * safeQuantity),
                    0
                );
                
                existingShort.averagePrice = totalQuantity > 0 ?
                    safeNumber(totalCostBasis / totalQuantity, safePrice) : safePrice;
                existingShort.quantity = totalQuantity;
                existingShort.currentPrice = safePrice;
            } else {
                account.positions.push({
                    symbol: symbol.toUpperCase(),
                    type,
                    positionType: 'short',
                    quantity: safeQuantity,
                    averagePrice: safePrice,
                    currentPrice: safePrice
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
                totalAmount: totalRevenue,
                notes: notes || ''
            });
            
            account.totalTrades = safeNumber(account.totalTrades, 0) + 1;
            account.lastUpdated = new Date();
            
            calculatePortfolioStats(account);
            await account.save();
            
            console.log(`[Paper Trading] SHORT SELL: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} [${priceResult.source}]`);
            
            return res.json({
                success: true,
                message: `Shorted ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
                account
            });
        }
        
        // Closing a long position
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
        
        const totalRevenue = safeNumber(safePrice * safeQuantity, 0);
        const avgPrice = safeNumber(position.averagePrice, safePrice);
        const costBasis = safeNumber(avgPrice * safeQuantity, 0);
        const profitLoss = safeNumber(totalRevenue - costBasis, 0);
        const profitLossPercent = costBasis > 0 ? 
            safeNumber((profitLoss / costBasis) * 100, 0) : 0;
        
        // Add cash
        account.cashBalance = safeNumber(account.cashBalance, 0) + totalRevenue;
        
        // Update or remove position
        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && (p.positionType || 'long') === 'long')
            );
        } else {
            position.quantity = safeNumber(positionQuantity - safeQuantity, 0);
            position.currentPrice = safePrice;
        }
        
        // Add order
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'sell',
            positionType: 'long',
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: totalRevenue,
            profitLoss,
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
        
        console.log(`[Paper Trading] SELL: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} | P/L: $${profitLoss.toFixed(2)} [${priceResult.source}]`);
        
        res.json({
            success: true,
            message: `Sold ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
            account,
            profitLoss,
            profitLossPercent
        });
        
    } catch (error) {
        console.error('[Paper Trading] Sell error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute sell order' });
    }
});

// @route   POST /api/paper-trading/cover
// @desc    Cover (close) a short position
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
        
        // Cost to cover (buy back)
        const coverCost = safeNumber(safePrice * safeQuantity, 0);
        const avgPrice = safeNumber(position.averagePrice, safePrice);
        const originalSaleValue = safeNumber(avgPrice * safeQuantity, 0);
        
        // Short P/L: profit when price goes down
        const profitLoss = safeNumber(originalSaleValue - coverCost, 0);
        const profitLossPercent = originalSaleValue > 0 ? 
            safeNumber((profitLoss / originalSaleValue) * 100, 0) : 0;
        
        const safeCashBalance = safeNumber(account.cashBalance, 0);
        if (coverCost > safeCashBalance) {
            return res.status(400).json({ error: 'Insufficient funds to cover short position' });
        }
        
        // Deduct cash for cover
        account.cashBalance = safeNumber(safeCashBalance - coverCost, 0);
        
        // Update or remove position
        if (safeQuantity >= positionQuantity) {
            account.positions = account.positions.filter(
                p => !(p.symbol === symbol.toUpperCase() && p.type === type && p.positionType === 'short')
            );
        } else {
            position.quantity = safeNumber(positionQuantity - safeQuantity, 0);
            position.currentPrice = safePrice;
        }
        
        // Add order
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'cover',
            positionType: 'short',
            quantity: safeQuantity,
            price: safePrice,
            totalAmount: coverCost,
            profitLoss,
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
        
        console.log(`[Paper Trading] COVER: ${safeQuantity} ${symbol} @ $${safePrice.toFixed(2)} | P/L: $${profitLoss.toFixed(2)} [${priceResult.source}]`);
        
        res.json({
            success: true,
            message: `Covered ${safeQuantity} ${symbol.toUpperCase()} @ $${safePrice.toFixed(2)}`,
            account,
            profitLoss,
            profitLossPercent
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
        
        // ✅ Use centralized price service
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
        
        // ✅ Auto-detect type
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
        
        // ✅ Batch fetch crypto prices for efficiency
        const cryptoPositions = account.positions.filter(p => 
            p.type === 'crypto' || priceService.isCryptoSymbol(p.symbol)
        );
        
        if (cryptoPositions.length > 0) {
            const cryptoSymbols = cryptoPositions.map(p => p.symbol);
            const batchPrices = await priceService.fetchCoinGeckoPricesBatch(cryptoSymbols);
            
            // Update crypto positions from batch
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
            .populate('user', 'name')
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
        
        // ✅ Auto-detect type if not provided
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

// @route   POST /api/paper-trading/reset
// @desc    Reset account to initial state
// @access  Private
router.post('/reset', auth, async (req, res) => {
    try {
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        const initialBalance = safeNumber(account.initialBalance, 100000);
        
        account.cashBalance = initialBalance;
        account.portfolioValue = initialBalance;
        account.positions = [];
        account.orders = [];
        account.totalTrades = 0;
        account.winningTrades = 0;
        account.losingTrades = 0;
        account.totalProfitLoss = 0;
        account.totalProfitLossPercent = 0;
        account.winRate = 0;
        account.currentStreak = 0;
        account.bestStreak = 0;
        account.biggestWin = 0;
        account.biggestLoss = 0;
        account.lastUpdated = new Date();
        
        await account.save();
        
        console.log(`[Paper Trading] Account reset for user ${req.user.id}`);
        
        res.json({ success: true, message: 'Account reset successfully', account });
    } catch (error) {
        console.error('[Paper Trading] Reset error:', error);
        res.status(500).json({ error: 'Failed to reset account' });
    }
});

module.exports = router;