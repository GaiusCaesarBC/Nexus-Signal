// server/routes/watchlistRoutes.js - FIXED: Real CoinGecko Pro + Stock API Integration

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const { checkUsageLimit, requireSubscription } = require('../middleware/subscriptionMiddleware');

// In-memory watchlist storage (replace with database in production)
const watchlists = {};

// CoinGecko Pro API config
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = 'https://pro-api.coingecko.com/api/v3';

// Stock API config (using your existing stock API - adjust as needed)
const STOCK_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || process.env.FINNHUB_API_KEY;

// Crypto symbol to CoinGecko ID mapping
const CRYPTO_ID_MAP = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'USDC': 'usd-coin',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'SOL': 'solana',
    'TRX': 'tron',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'SHIB': 'shiba-inu',
    'LTC': 'litecoin',
    'AVAX': 'avalanche-2',
    'UNI': 'uniswap',
    'LINK': 'chainlink',
    'XLM': 'stellar',
    'ATOM': 'cosmos',
    'ETC': 'ethereum-classic',
    'XMR': 'monero',
    'BCH': 'bitcoin-cash',
    'APT': 'aptos',
    'FIL': 'filecoin',
    'NEAR': 'near',
    'VET': 'vechain',
    'ALGO': 'algorand',
    'ICP': 'internet-computer',
    'HBAR': 'hedera-hashgraph',
    'APE': 'apecoin',
    'QNT': 'quant-network',
    'LDO': 'lido-dao',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'STX': 'blockstack',
    'IMX': 'immutable-x',
    'MKR': 'maker',
    'AAVE': 'aave',
    'GRT': 'the-graph',
    'SNX': 'havven',
    'CRV': 'curve-dao-token',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'FTM': 'fantom',
    'THETA': 'theta-token',
    'EGLD': 'elrond-erd-2',
    'EOS': 'eos',
    'CAKE': 'pancakeswap-token',
    'RUNE': 'thorchain',
    'ZEC': 'zcash',
    'NEO': 'neo',
    'KCS': 'kucoin-shares',
    'KLAY': 'klay-token',
    'XTZ': 'tezos',
    'FLOW': 'flow',
    'CHZ': 'chiliz',
    'ENJ': 'enjincoin',
    'BAT': 'basic-attention-token',
    'ZIL': 'zilliqa',
    'MINA': 'mina-protocol',
    'ONE': 'harmony',
    'HOT': 'holotoken',
    'GALA': 'gala',
    'GMT': 'stepn',
    'PEPE': 'pepe',
    'WLD': 'worldcoin-wld',
    'SUI': 'sui',
    'SEI': 'sei-network',
    'TIA': 'celestia',
    'JUP': 'jupiter-exchange-solana',
    'BONK': 'bonk',
    'WIF': 'dogwifcoin'
};

// Crypto names
const CRYPTO_NAMES = {
    'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'USDT': 'Tether', 'BNB': 'BNB',
    'XRP': 'XRP', 'USDC': 'USD Coin', 'ADA': 'Cardano', 'DOGE': 'Dogecoin',
    'SOL': 'Solana', 'TRX': 'TRON', 'DOT': 'Polkadot', 'MATIC': 'Polygon',
    'SHIB': 'Shiba Inu', 'LTC': 'Litecoin', 'AVAX': 'Avalanche', 'UNI': 'Uniswap',
    'LINK': 'Chainlink', 'XLM': 'Stellar', 'ATOM': 'Cosmos', 'ETC': 'Ethereum Classic',
    'XMR': 'Monero', 'BCH': 'Bitcoin Cash', 'APT': 'Aptos', 'FIL': 'Filecoin',
    'NEAR': 'NEAR Protocol', 'VET': 'VeChain', 'ALGO': 'Algorand', 'ICP': 'Internet Computer',
    'HBAR': 'Hedera', 'APE': 'ApeCoin', 'QNT': 'Quant', 'ARB': 'Arbitrum',
    'OP': 'Optimism', 'MKR': 'Maker', 'AAVE': 'Aave', 'GRT': 'The Graph',
    'SAND': 'The Sandbox', 'MANA': 'Decentraland', 'AXS': 'Axie Infinity',
    'FTM': 'Fantom', 'PEPE': 'Pepe', 'WLD': 'Worldcoin', 'SUI': 'Sui',
    'SEI': 'Sei', 'TIA': 'Celestia', 'JUP': 'Jupiter', 'BONK': 'Bonk', 'WIF': 'dogwifhat'
};

// Helper function to detect if symbol is crypto or stock
const detectAssetType = (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Check if it's in our crypto map
    if (CRYPTO_ID_MAP[upperSymbol]) {
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

// Fetch crypto prices from CoinGecko Pro
const fetchCryptoPrices = async (symbols) => {
    try {
        // Convert symbols to CoinGecko IDs
        const ids = symbols
            .map(s => CRYPTO_ID_MAP[s.toUpperCase()])
            .filter(Boolean);
        
        if (ids.length === 0) return {};
        
        const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
            params: {
                ids: ids.join(','),
                vs_currencies: 'usd',
                include_24hr_change: true,
                include_24hr_vol: true,
                include_market_cap: true
            },
            headers: {
                'x-cg-pro-api-key': COINGECKO_API_KEY
            }
        });
        
        // Map back to symbols
        const priceData = {};
        for (const [symbol, geckoId] of Object.entries(CRYPTO_ID_MAP)) {
            if (response.data[geckoId]) {
                const data = response.data[geckoId];
                priceData[symbol] = {
                    currentPrice: data.usd || 0,
                    change: (data.usd * (data.usd_24h_change || 0)) / 100,
                    changePercent: data.usd_24h_change || 0,
                    volume24h: data.usd_24h_vol || 0,
                    marketCap: data.usd_market_cap || 0
                };
            }
        }
        
        return priceData;
    } catch (error) {
        console.error('CoinGecko API error:', error.message);
        return {};
    }
};

// Fetch stock prices (using your existing stock API)
const fetchStockPrices = async (symbols) => {
    try {
        // If you have a stock API configured, use it here
        // For now, we'll use a simple implementation
        // You can replace this with Alpha Vantage, Finnhub, Polygon, etc.
        
        const priceData = {};
        
        // Try to use your existing stock API
        // This is a placeholder - replace with your actual stock API calls
        for (const symbol of symbols) {
            try {
                // Option 1: If you have Finnhub
                if (process.env.FINNHUB_API_KEY) {
                    const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
                        params: {
                            symbol: symbol,
                            token: process.env.FINNHUB_API_KEY
                        }
                    });
                    
                    if (response.data && response.data.c) {
                        priceData[symbol] = {
                            currentPrice: response.data.c,
                            change: response.data.d || 0,
                            changePercent: response.data.dp || 0,
                            high: response.data.h || 0,
                            low: response.data.l || 0,
                            open: response.data.o || 0,
                            previousClose: response.data.pc || 0
                        };
                    }
                }
                // Option 2: If you have Alpha Vantage
                else if (process.env.ALPHA_VANTAGE_API_KEY) {
                    const response = await axios.get(`https://www.alphavantage.co/query`, {
                        params: {
                            function: 'GLOBAL_QUOTE',
                            symbol: symbol,
                            apikey: process.env.ALPHA_VANTAGE_API_KEY
                        }
                    });
                    
                    const quote = response.data['Global Quote'];
                    if (quote) {
                        priceData[symbol] = {
                            currentPrice: parseFloat(quote['05. price']) || 0,
                            change: parseFloat(quote['09. change']) || 0,
                            changePercent: parseFloat(quote['10. change percent']?.replace('%', '')) || 0,
                            high: parseFloat(quote['03. high']) || 0,
                            low: parseFloat(quote['04. low']) || 0,
                            open: parseFloat(quote['02. open']) || 0,
                            previousClose: parseFloat(quote['08. previous close']) || 0
                        };
                    }
                }
                // Option 3: Use your existing /api/stocks/:symbol endpoint
                else {
                    // You can call your own API internally
                    // For now, return placeholder data
                    priceData[symbol] = {
                        currentPrice: 0,
                        change: 0,
                        changePercent: 0,
                        needsRefresh: true
                    };
                }
            } catch (err) {
                console.error(`Error fetching stock ${symbol}:`, err.message);
                priceData[symbol] = {
                    currentPrice: 0,
                    change: 0,
                    changePercent: 0,
                    error: true
                };
            }
        }
        
        return priceData;
    } catch (error) {
        console.error('Stock API error:', error.message);
        return {};
    }
};

// @route   GET /api/watchlist
// @desc    Get user's watchlist with REAL prices
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userWatchlist = watchlists[userId] || [];
        
        if (userWatchlist.length === 0) {
            return res.json({
                success: true,
                watchlist: [],
                totalStocks: 0,
                totalCrypto: 0
            });
        }
        
        // Separate crypto and stocks
        const cryptoItems = userWatchlist.filter(item => item.type === 'crypto');
        const stockItems = userWatchlist.filter(item => item.type === 'stock');
        
        // Fetch real prices
        const cryptoSymbols = cryptoItems.map(item => item.symbol);
        const stockSymbols = stockItems.map(item => item.symbol);
        
        const [cryptoPrices, stockPrices] = await Promise.all([
            cryptoSymbols.length > 0 ? fetchCryptoPrices(cryptoSymbols) : {},
            stockSymbols.length > 0 ? fetchStockPrices(stockSymbols) : {}
        ]);
        
        // Build response with real data
        const watchlistWithData = userWatchlist.map(item => {
            const isCrypto = item.type === 'crypto';
            const priceData = isCrypto ? cryptoPrices[item.symbol] : stockPrices[item.symbol];
            
            return {
                symbol: item.symbol,
                type: item.type,
                name: isCrypto ? 
                    (CRYPTO_NAMES[item.symbol] || `${item.symbol} Token`) : 
                    (item.name || `${item.symbol}`),
                currentPrice: priceData?.currentPrice || 0,
                change: priceData?.change || 0,
                changePercent: priceData?.changePercent || 0,
                addedAt: item.addedAt,
                // Additional data if available
                ...(isCrypto && {
                    marketCap: priceData?.marketCap || 0,
                    volume24h: priceData?.volume24h || 0
                }),
                ...((!isCrypto) && {
                    high: priceData?.high || 0,
                    low: priceData?.low || 0,
                    open: priceData?.open || 0
                })
            };
        });
        
        res.json({
            success: true,
            watchlist: watchlistWithData,
            totalStocks: stockItems.length,
            totalCrypto: cryptoItems.length
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
// @access  Private (Starter+ required, limited by plan)
router.post('/', auth, requireSubscription('starter'), checkUsageLimit('watchlistAssets'), async (req, res) => {
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
        
        // Get the proper name
        const assetType = type.toLowerCase() === 'crypto' ? 'crypto' : 'stock';
        const name = assetType === 'crypto' ? 
            (CRYPTO_NAMES[upperSymbol] || `${upperSymbol} Token`) : 
            `${upperSymbol}`;
        
        // Add to watchlist
        watchlists[userId].push({
            symbol: upperSymbol,
            type: assetType,
            name: name,
            addedAt: new Date()
        });
        
        res.json({
            success: true,
            message: `${upperSymbol} (${assetType}) added to watchlist`,
            type: assetType,
            name: name,
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

// @route   GET /api/watchlist/refresh
// @desc    Force refresh all prices
// @access  Private
router.get('/refresh', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userWatchlist = watchlists[userId] || [];
        
        if (userWatchlist.length === 0) {
            return res.json({
                success: true,
                message: 'No items to refresh',
                watchlist: []
            });
        }
        
        // Separate crypto and stocks
        const cryptoItems = userWatchlist.filter(item => item.type === 'crypto');
        const stockItems = userWatchlist.filter(item => item.type === 'stock');
        
        // Fetch fresh prices
        const cryptoSymbols = cryptoItems.map(item => item.symbol);
        const stockSymbols = stockItems.map(item => item.symbol);
        
        const [cryptoPrices, stockPrices] = await Promise.all([
            cryptoSymbols.length > 0 ? fetchCryptoPrices(cryptoSymbols) : {},
            stockSymbols.length > 0 ? fetchStockPrices(stockSymbols) : {}
        ]);
        
        // Build response
        const watchlistWithData = userWatchlist.map(item => {
            const isCrypto = item.type === 'crypto';
            const priceData = isCrypto ? cryptoPrices[item.symbol] : stockPrices[item.symbol];
            
            return {
                symbol: item.symbol,
                type: item.type,
                name: isCrypto ? 
                    (CRYPTO_NAMES[item.symbol] || `${item.symbol} Token`) : 
                    (item.name || `${item.symbol}`),
                currentPrice: priceData?.currentPrice || 0,
                change: priceData?.change || 0,
                changePercent: priceData?.changePercent || 0,
                addedAt: item.addedAt,
                refreshedAt: new Date()
            };
        });
        
        res.json({
            success: true,
            message: 'Prices refreshed',
            watchlist: watchlistWithData,
            refreshedAt: new Date()
        });
    } catch (error) {
        console.error('Refresh watchlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh prices'
        });
    }
});

module.exports = router;