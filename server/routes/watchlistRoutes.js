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
// @desc    Add a stock to watchlist
// @access  Private
router.post('/add', auth, async (req, res) => {
  const { symbol } = req.body;
  try {
    const user = await User.findById(req.user.id);
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

// @route   POST api/watchlist/remove
// @desc    Remove a stock from watchlist
// @access  Private
router.post('/remove', auth, async (req, res) => {
  const { symbol } = req.body;
  try {
    const user = await User.findById(req.user.id);
    user.watchlist = user.watchlist.filter((s) => s !== symbol);
    await user.save();
    res.json(user.watchlist);
  } catch (err) {
    console.error('Server Error in POST /api/watchlist/remove:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

