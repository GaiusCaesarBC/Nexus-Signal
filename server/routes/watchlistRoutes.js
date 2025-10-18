const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET api/watchlist
// @desc    Get user's watchlist
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('watchlist');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user.watchlist);
    } catch (err) {
        console.error('Server Error in GET /api/watchlist:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/watchlist/add
// @desc    Add a stock to user's watchlist
// @access  Private
router.post('/add', auth, async (req, res) => {
    const { symbol } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Ensure watchlist is an array before checking includes
        if (!Array.isArray(user.watchlist)) {
            user.watchlist = [];
        }

        if (!user.watchlist.includes(symbol)) {
            user.watchlist.push(symbol);
            await user.save();
        }
        res.json(user.watchlist);
    } catch (err) {
        console.error('Server Error in POST /api/watchlist/add:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/watchlist/remove/:symbol
// @desc    Remove a stock from user's watchlist
// @access  Private
router.delete('/remove/:symbol', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Ensure watchlist is an array
        if (Array.isArray(user.watchlist)) {
            user.watchlist = user.watchlist.filter(
                (stock) => stock !== req.params.symbol
            );
            await user.save();
        }
        
        res.json(user.watchlist);
    } catch (err) {
        console.error('Server Error in DELETE /api/watchlist/remove:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

