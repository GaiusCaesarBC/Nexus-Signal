// server/routes/watchlistRoutes.js - UPDATED: Supports Stocks AND Crypto

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// In-memory watchlist storage (you can replace with database later)
// Format: { userId: [{ symbol, type, addedAt, name }] }
const watchlists = {};

// Helper function to detect if symbol is crypto or stock
const detectAssetType = (symbol) => {
    const cryptoSymbols = [
        'BTC', 'BITCOIN', 'ETH', 'ETHEREUM', 'USDT', 'BNB', 'XRP', 'USDC', 
        'ADA', 'CARDANO', 'DOGE', 'DOGECOIN', 'SOL', 'SOLANA', 'TRX', 'TRON',
        'DOT', 'POLKADOT', 'MATIC', 'POLYGON', 'SHIB', 'LTC', 'LITECOIN',
        'AVAX', 'AVALANCHE', 'UNI', 'UNISWAP', 'LINK', 'CHAINLINK', 'XLM',
        'ATOM', 'COSMOS', 'ETC', 'XMR', 'MONERO', 'BCH', 'APT', 'FIL',
        'NEAR', 'VET', 'ALGO', 'ALGORAND', 'ICP', 'HBAR', 'APE', 'QNT',
        'LDO', 'ARB', 'ARBITRUM', 'OP', 'OPTIMISM', 'STX', 'IMX', 'MKR'
    ];
    
    const upperSymbol = symbol.toUpperCase();
    
    // Check if it's a known crypto
    if (cryptoSymbols.includes(upperSymbol)) {
        return 'crypto';
    }
    
    // Check for common crypto suffixes
    if (upperSymbol.endsWith('USD') || upperSymbol.endsWith('USDT') || 
        upperSymbol.endsWith('BTC') || upperSymbol.endsWith('ETH')) {
        return 'crypto';
    }
    
    // Default to stock
    return 'stock';
};

// @route   GET /api/watchlist
// @desc    Get user's watchlist (stocks AND crypto)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get watchlist for this user
        const userWatchlist = watchlists[userId] || [];
        
        // In a real app, you'd fetch live data from APIs
        // For now, return mock data
        const watchlistWithData = userWatchlist.map(item => {
            const isStock = item.type === 'stock';
            const isCrypto = item.type === 'crypto';
            
            return {
                symbol: item.symbol,
                type: item.type,
                name: item.name || `${item.symbol} ${isCrypto ? 'Token' : 'Inc.'}`,
                currentPrice: isCrypto ? 
                    Math.random() * 50000 + 100 :  // Crypto prices (higher)
                    Math.random() * 500 + 50,       // Stock prices
                change: (Math.random() - 0.5) * (isCrypto ? 1000 : 20),
                changePercent: (Math.random() - 0.5) * 10,
                addedAt: item.addedAt,
                // Crypto-specific fields
                ...(isCrypto && {
                    marketCap: Math.random() * 1000000000000,
                    volume24h: Math.random() * 10000000000,
                    circulatingSupply: Math.random() * 1000000000
                }),
                // Stock-specific fields
                ...(isStock && {
                    marketCap: Math.random() * 1000000000000,
                    pe: Math.random() * 30 + 5,
                    eps: Math.random() * 10
                })
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

// @route   POST /api/watchlist
// @desc    Add stock OR crypto to watchlist
// @access  Private
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
        
        // Auto-detect type if not provided
        if (!type) {
            type = detectAssetType(upperSymbol);
        }
        
        // Validate symbol
        if (upperSymbol.length > 10 || !/^[A-Z0-9]+$/.test(upperSymbol)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol'
            });
        }
        
        // Initialize watchlist for user if doesn't exist
        if (!watchlists[userId]) {
            watchlists[userId] = [];
        }
        
        // Check if already in watchlist
        const alreadyExists = watchlists[userId].some(
            item => item.symbol === upperSymbol
        );
        
        if (alreadyExists) {
            return res.status(409).json({
                success: false,
                error: `${upperSymbol} is already in your watchlist`
            });
        }
        
        // Add to watchlist
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

// @route   DELETE /api/watchlist/:symbol
// @desc    Remove stock or crypto from watchlist
// @access  Private
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
        
        // Find the item to get its type
        const item = watchlists[userId].find(i => i.symbol === upperSymbol);
        const itemType = item ? item.type : 'asset';
        
        // Find and remove
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

// @route   DELETE /api/watchlist
// @desc    Clear entire watchlist
// @access  Private
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

// @route   GET /api/watchlist/stocks
// @desc    Get only stocks from watchlist
// @access  Private
router.get('/stocks', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userWatchlist = watchlists[userId] || [];
        
        const stocks = userWatchlist.filter(item => item.type === 'stock');
        
        res.json({
            success: true,
            watchlist: stocks
        });
    } catch (error) {
        console.error('Get stocks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stocks'
        });
    }
});

// @route   GET /api/watchlist/crypto
// @desc    Get only crypto from watchlist
// @access  Private
router.get('/crypto', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userWatchlist = watchlists[userId] || [];
        
        const crypto = userWatchlist.filter(item => item.type === 'crypto');
        
        res.json({
            success: true,
            watchlist: crypto
        });
    } catch (error) {
        console.error('Get crypto error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch crypto'
        });
    }
});

module.exports = router;