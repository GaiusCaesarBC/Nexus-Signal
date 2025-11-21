// server/routes/watchlistRoutes.js - NO GATES VERSION

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// In-memory storage
const watchlists = {};

// Helper function
const detectAssetType = (symbol) => {
    const cryptoSymbols = [
        'BTC', 'BITCOIN', 'ETH', 'ETHEREUM', 'USDT', 'BNB', 'XRP', 'USDC', 
        'ADA', 'CARDANO', 'DOGE', 'DOGECOIN', 'SOL', 'SOLANA', 'TRX', 'TRON',
        'DOT', 'POLKADOT', 'MATIC', 'POLYGON', 'SHIB', 'LTC', 'LITECOIN',
        'AVAX', 'AVALANCHE', 'UNI', 'UNISWAP', 'LINK', 'CHAINLINK'
    ];
    
    return cryptoSymbols.includes(symbol.toUpperCase()) ? 'crypto' : 'stock';
};

// GET watchlist
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userWatchlist = watchlists[userId] || [];
        
        const watchlistWithData = userWatchlist.map(item => {
            const isCrypto = item.type === 'crypto';
            
            return {
                symbol: item.symbol,
                type: item.type,
                name: item.name || `${item.symbol} ${isCrypto ? 'Token' : 'Inc.'}`,
                currentPrice: isCrypto ? 
                    Math.random() * 50000 + 100 :
                    Math.random() * 500 + 50,
                change: (Math.random() - 0.5) * (isCrypto ? 1000 : 20),
                changePercent: (Math.random() - 0.5) * 10,
                addedAt: item.addedAt
            };
        });
        
        res.json({
            success: true,
            watchlist: watchlistWithData,
            totalStocks: watchlistWithData.filter(w => w.type === 'stock').length,
            totalCrypto: watchlistWithData.filter(w => w.type === 'crypto').length
        });
    } catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch watchlist'
        });
    }
});

// POST add to watchlist
router.post('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        let { symbol, type } = req.body;
        
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Symbol is required'
            });
        }
        
        const upperSymbol = symbol.toUpperCase().trim();
        
        if (!type) {
            type = detectAssetType(upperSymbol);
        }
        
        if (upperSymbol.length > 10 || !/^[A-Z0-9]+$/.test(upperSymbol)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol'
            });
        }
        
        if (!watchlists[userId]) {
            watchlists[userId] = [];
        }
        
        const alreadyExists = watchlists[userId].some(
            item => item.symbol === upperSymbol
        );
        
        if (alreadyExists) {
            return res.status(409).json({
                success: false,
                error: `${upperSymbol} is already in your watchlist`
            });
        }
        
        const assetType = type.toLowerCase() === 'crypto' ? 'crypto' : 'stock';
        watchlists[userId].push({
            symbol: upperSymbol,
            type: assetType,
            name: assetType === 'crypto' ? 
                `${upperSymbol} Token` : 
                `${upperSymbol} Inc.`,
            addedAt: new Date()
        });
        
        res.json({
            success: true,
            message: `${upperSymbol} (${assetType}) added to watchlist`,
            type: assetType,
            watchlist: watchlists[userId]
        });
    } catch (error) {
        console.error('Add to watchlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to watchlist'
        });
    }
});

// DELETE from watchlist
router.delete('/:symbol', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { symbol } = req.params;
        
        const upperSymbol = symbol.toUpperCase();
        
        if (!watchlists[userId]) {
            return res.status(404).json({
                success: false,
                error: 'Watchlist not found'
            });
        }
        
        const item = watchlists[userId].find(i => i.symbol === upperSymbol);
        const itemType = item ? item.type : 'asset';
        
        const initialLength = watchlists[userId].length;
        watchlists[userId] = watchlists[userId].filter(
            item => item.symbol !== upperSymbol
        );
        
        if (watchlists[userId].length === initialLength) {
            return res.status(404).json({
                success: false,
                error: `${upperSymbol} not found in watchlist`
            });
        }
        
        res.json({
            success: true,
            message: `${upperSymbol} (${itemType}) removed from watchlist`,
            watchlist: watchlists[userId]
        });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove from watchlist'
        });
    }
});

// DELETE clear watchlist
router.delete('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        watchlists[userId] = [];
        
        res.json({
            success: true,
            message: 'Watchlist cleared'
        });
    } catch (error) {
        console.error('Clear watchlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear watchlist'
        });
    }
});

module.exports = router;