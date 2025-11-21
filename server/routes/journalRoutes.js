// server/routes/journalRoutes.js - Trading Journal Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Trade = require('../models/Trade');

// @route   GET /api/journal/trades
// @desc    Get all trades for logged-in user
// @access  Private
router.get('/trades', auth, async (req, res) => {
    try {
        const trades = await Trade.find({ user: req.user.id })
            .sort({ date: -1 });

        res.json(trades);
    } catch (error) {
        console.error('[Journal] Error fetching trades:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/journal/trades
// @desc    Add a new trade
// @access  Private
router.post('/trades', auth, async (req, res) => {
    try {
        const {
            symbol,
            type,
            entry,
            exit,
            shares,
            date,
            strategy,
            emotion,
            notes
        } = req.body;

        // Validate required fields
        if (!symbol || !type || !entry || !exit || !shares || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Calculate profit
        const profit = type === 'long' 
            ? (exit - entry) * shares 
            : (entry - exit) * shares;

        const profitPercent = type === 'long'
            ? ((exit - entry) / entry) * 100
            : ((entry - exit) / entry) * 100;

        const trade = new Trade({
            user: req.user.id,
            symbol: symbol.toUpperCase(),
            type,
            entry: parseFloat(entry),
            exit: parseFloat(exit),
            shares: parseFloat(shares),
            profit: parseFloat(profit.toFixed(2)),
            profitPercent: parseFloat(profitPercent.toFixed(2)),
            date: new Date(date),
            strategy: strategy || '',
            emotion: emotion || 'neutral',
            notes: notes || ''
        });

        await trade.save();

        res.json(trade);

    } catch (error) {
        console.error('[Journal] Error creating trade:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/journal/trades/:id
// @desc    Update a trade
// @access  Private
router.put('/trades/:id', auth, async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);

        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        // Verify ownership
        if (trade.user.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const {
            symbol,
            type,
            entry,
            exit,
            shares,
            date,
            strategy,
            emotion,
            notes
        } = req.body;

        // Recalculate profit if trade details changed
        if (entry || exit || shares || type) {
            const newEntry = entry || trade.entry;
            const newExit = exit || trade.exit;
            const newShares = shares || trade.shares;
            const newType = type || trade.type;

            const profit = newType === 'long' 
                ? (newExit - newEntry) * newShares 
                : (newEntry - newExit) * newShares;

            const profitPercent = newType === 'long'
                ? ((newExit - newEntry) / newEntry) * 100
                : ((newEntry - newExit) / newEntry) * 100;

            trade.profit = parseFloat(profit.toFixed(2));
            trade.profitPercent = parseFloat(profitPercent.toFixed(2));
        }

        // Update fields
        if (symbol) trade.symbol = symbol.toUpperCase();
        if (type) trade.type = type;
        if (entry) trade.entry = parseFloat(entry);
        if (exit) trade.exit = parseFloat(exit);
        if (shares) trade.shares = parseFloat(shares);
        if (date) trade.date = new Date(date);
        if (strategy !== undefined) trade.strategy = strategy;
        if (emotion) trade.emotion = emotion;
        if (notes !== undefined) trade.notes = notes;

        await trade.save();

        res.json(trade);

    } catch (error) {
        console.error('[Journal] Error updating trade:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/journal/trades/:id
// @desc    Delete a trade
// @access  Private
router.delete('/trades/:id', auth, async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);

        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        // Verify ownership
        if (trade.user.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await trade.deleteOne();

        res.json({ message: 'Trade deleted successfully' });

    } catch (error) {
        console.error('[Journal] Error deleting trade:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/journal/stats
// @desc    Get trading statistics for user
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const trades = await Trade.find({ user: req.user.id });

        if (trades.length === 0) {
            return res.json({
                totalTrades: 0,
                winRate: 0,
                totalProfit: 0,
                avgProfit: 0,
                bestTrade: null,
                worstTrade: null
            });
        }

        const winningTrades = trades.filter(t => t.profit >= 0).length;
        const winRate = ((winningTrades / trades.length) * 100).toFixed(1);
        const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
        const avgProfit = (totalProfit / trades.length).toFixed(2);
        const bestTrade = trades.reduce((max, t) => t.profit > max.profit ? t : max);
        const worstTrade = trades.reduce((min, t) => t.profit < min.profit ? t : min);

        res.json({
            totalTrades: trades.length,
            winRate: parseFloat(winRate),
            totalProfit: parseFloat(totalProfit.toFixed(2)),
            avgProfit: parseFloat(avgProfit),
            bestTrade,
            worstTrade
        });

    } catch (error) {
        console.error('[Journal] Error fetching stats:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;