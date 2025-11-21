const mongoose = require('mongoose');

const WatchlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    assets: [{
        symbol: String,
        type: { type: String, enum: ['stock', 'crypto'] }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Watchlist', WatchlistSchema);