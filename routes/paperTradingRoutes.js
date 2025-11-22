// server/routes/paperTradingRoutes.js - Complete Paper Trading System

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const PaperTradingAccount = require('../models/PaperTradingAccount');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
    ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot',
    BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap',
    MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron',
    AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
};

// Get current price for stock or crypto
async function getCurrentPrice(symbol, type) {
    try {
        if (type === 'crypto') {
            const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
            const params = { ids: coinGeckoId, vs_currencies: 'usd' };
            
            if (COINGECKO_API_KEY) {
                params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
            }
            
            const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, { params });
            const price = response.data[coinGeckoId]?.usd;
            
            if (!price) throw new Error('Price not found');
            return price;
            
        } else {
            // Stock price from Alpha Vantage
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await axios.get(url);
            const quote = response.data['Global Quote'];
            
            if (!quote || !quote['05. price']) throw new Error('Price not found');
            return parseFloat(quote['05. price']);
        }
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error.message);
        throw new Error(`Could not fetch price for ${symbol}`);
    }
}

// Calculate portfolio stats
function calculatePortfolioStats(account) {
    let positionsValue = 0;
    account.positions.forEach(pos => {
        positionsValue += pos.currentPrice * pos.quantity;
        pos.profitLoss = (pos.currentPrice - pos.averagePrice) * pos.quantity;
        pos.profitLossPercent = ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100;
    });
    
    account.portfolioValue = account.cashBalance + positionsValue;
    account.totalProfitLoss = account.portfolioValue - account.initialBalance;
    account.totalProfitLossPercent = (account.totalProfitLoss / account.initialBalance) * 100;
    account.winRate = account.totalTrades > 0 ? (account.winningTrades / account.totalTrades) * 100 : 0;
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
        
        res.json({ success: true, account });
    } catch (error) {
        console.error('[Paper Trading] Get account error:', error);
        res.status(500).json({ success: false, error: 'Failed to load account' });
    }
});

// @route   POST /api/paper-trading/buy
// @desc    Buy stock or crypto
// @access  Private
router.post('/buy', auth, async (req, res) => {
    try {
        const { symbol, type, quantity, notes } = req.body;
        
        if (!symbol || !type || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        let account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            account = new PaperTradingAccount({ user: req.user.id });
        }
        
        const price = await getCurrentPrice(symbol, type);
        const totalCost = price * quantity;
        
        if (totalCost > account.cashBalance) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        // Deduct cash
        account.cashBalance -= totalCost;
        
        // Add or update position
        const existingPosition = account.positions.find(p => p.symbol === symbol.toUpperCase() && p.type === type);
        
        if (existingPosition) {
            const totalQuantity = existingPosition.quantity + quantity;
            const totalCost = (existingPosition.averagePrice * existingPosition.quantity) + (price * quantity);
            existingPosition.averagePrice = totalCost / totalQuantity;
            existingPosition.quantity = totalQuantity;
            existingPosition.currentPrice = price;
        } else {
            account.positions.push({
                symbol: symbol.toUpperCase(),
                type,
                quantity,
                averagePrice: price,
                currentPrice: price
            });
        }
        
        // Add order
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'buy',
            quantity,
            price,
            totalAmount: totalCost,
            notes: notes || ''
        });
        
        account.totalTrades += 1;
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        console.log(`[Paper Trading] BUY: ${quantity} ${symbol} @ $${price.toFixed(2)}`);
        
        res.json({
            success: true,
            message: `Bought ${quantity} ${symbol.toUpperCase()} @ $${price.toFixed(2)}`,
            account
        });
        
    } catch (error) {
        console.error('[Paper Trading] Buy error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute buy order' });
    }
});

// @route   POST /api/paper-trading/sell
// @desc    Sell stock or crypto
// @access  Private
router.post('/sell', auth, async (req, res) => {
    try {
        const { symbol, type, quantity, notes } = req.body;
        
        if (!symbol || !type || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(400).json({ error: 'Account not found' });
        }
        
        const position = account.positions.find(p => p.symbol === symbol.toUpperCase() && p.type === type);
        
        if (!position) {
            return res.status(400).json({ error: `You don't own any ${symbol}` });
        }
        
        if (quantity > position.quantity) {
            return res.status(400).json({ error: `Insufficient shares. You own ${position.quantity}` });
        }
        
        const price = await getCurrentPrice(symbol, type);
        const totalRevenue = price * quantity;
        const costBasis = position.averagePrice * quantity;
        const profitLoss = totalRevenue - costBasis;
        const profitLossPercent = (profitLoss / costBasis) * 100;
        
        // Add cash
        account.cashBalance += totalRevenue;
        
        // Update or remove position
        if (quantity === position.quantity) {
            account.positions = account.positions.filter(p => !(p.symbol === symbol.toUpperCase() && p.type === type));
        } else {
            position.quantity -= quantity;
            position.currentPrice = price;
        }
        
        // Add order
        account.orders.unshift({
            symbol: symbol.toUpperCase(),
            type,
            side: 'sell',
            quantity,
            price,
            totalAmount: totalRevenue,
            profitLoss,
            notes: notes || ''
        });
        
        // Update stats
        account.totalTrades += 1;
        
        if (profitLoss > 0) {
            account.winningTrades += 1;
            account.currentStreak = account.currentStreak >= 0 ? account.currentStreak + 1 : 1;
            if (profitLoss > account.biggestWin) account.biggestWin = profitLoss;
        } else if (profitLoss < 0) {
            account.losingTrades += 1;
            account.currentStreak = account.currentStreak <= 0 ? account.currentStreak - 1 : -1;
            if (profitLoss < account.biggestLoss) account.biggestLoss = profitLoss;
        }
        
        if (Math.abs(account.currentStreak) > Math.abs(account.bestStreak)) {
            account.bestStreak = account.currentStreak;
        }
        
        account.lastUpdated = new Date();
        
        calculatePortfolioStats(account);
        await account.save();
        
        console.log(`[Paper Trading] SELL: ${quantity} ${symbol} @ $${price.toFixed(2)} | P/L: $${profitLoss.toFixed(2)}`);
        
        res.json({
            success: true,
            message: `Sold ${quantity} ${symbol.toUpperCase()} @ $${price.toFixed(2)}`,
            account,
            profitLoss,
            profitLossPercent
        });
        
    } catch (error) {
        console.error('[Paper Trading] Sell error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute sell order' });
    }
});

// @route   GET /api/paper-trading/price/:symbol/:type
// @desc    Get current price for a symbol
// @access  Private
router.get('/price/:symbol/:type', auth, async (req, res) => {
    try {
        const { symbol, type } = req.params;
        const price = await getCurrentPrice(symbol, type);
        
        res.json({ success: true, price, symbol: symbol.toUpperCase() });
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
        
        for (const position of account.positions) {
            try {
                const price = await getCurrentPrice(position.symbol, position.type);
                position.currentPrice = price;
            } catch (error) {
                console.error(`Failed to update price for ${position.symbol}:`, error.message);
            }
        }
        
        calculatePortfolioStats(account);
        account.lastUpdated = new Date();
        await account.save();
        
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
            portfolioValue: account.portfolioValue,
            profitLoss: account.totalProfitLoss,
            profitLossPercent: account.totalProfitLossPercent,
            winRate: account.winRate,
            totalTrades: account.totalTrades
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
        const { symbol, type, targetPrice, condition } = req.body;
        
        if (!symbol || !type || !targetPrice || !condition) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const account = await PaperTradingAccount.findOne({ user: req.user.id });
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        const alert = {
            symbol: symbol.toUpperCase(),
            type,
            targetPrice,
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
        
        account.cashBalance = account.initialBalance;
        account.portfolioValue = account.initialBalance;
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
        
        res.json({ success: true, message: 'Account reset successfully', account });
    } catch (error) {
        console.error('[Paper Trading] Reset error:', error);
        res.status(500).json({ error: 'Failed to reset account' });
    }
});

module.exports = router;