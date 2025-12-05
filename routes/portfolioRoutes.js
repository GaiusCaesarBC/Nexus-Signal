// server/routes/portfolioRoutes.js - WITH GAMIFICATION INTEGRATION

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Portfolio = require('../models/Portfolio');
const axios = require('axios');
const GamificationService = require('../services/gamificationService');

/**
 * GET /api/portfolio
 * Get user's complete portfolio with current prices
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📊 GET Portfolio request for user:', userId);
        
        // Get or create portfolio
        let portfolio = await Portfolio.getOrCreate(userId);
        
        // Fetch current prices for all holdings
        if (portfolio.holdings.length > 0) {
            const priceUpdates = {};
            
            await Promise.all(
                portfolio.holdings.map(async (holding) => {
                    try {
                        const priceData = await getCurrentPrice(holding.symbol, holding.assetType);
                        priceUpdates[holding.symbol] = priceData.price;
                    } catch (error) {
                        console.warn(`Could not fetch price for ${holding.symbol}:`, error.message);
                        priceUpdates[holding.symbol] = holding.currentPrice || holding.purchasePrice;
                    }
                })
            );
            
            await portfolio.updatePrices(priceUpdates);
        }

        // Get portfolio summary
        const summary = portfolio.getSummary();
        const topHoldings = portfolio.getTopHoldings(5);
        const performers = portfolio.getPerformers();

        // 🎮 Update gamification stats
        try {
            await GamificationService.updatePortfolioStats(
                userId, 
                summary.totalValue || 0, 
                portfolio.holdings.length
            );
        } catch (error) {
            console.warn('Failed to update gamification stats:', error.message);
        }

        res.json({
            success: true,
            portfolio: {
                holdings: portfolio.holdings,
                cashBalance: portfolio.cashBalance,
                ...summary
            },
            analytics: {
                topHoldings,
                performers
            }
        });

    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio',
            message: error.message
        });
    }
});

/**
 * GET /api/portfolio/summary
 * Get quick portfolio summary without full holdings
 */
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const portfolio = await Portfolio.getOrCreate(req.user.id);
        const summary = portfolio.getSummary();
        
        res.json({
            success: true,
            ...summary
        });
    } catch (error) {
        console.error('Error fetching portfolio summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio summary'
        });
    }
});

/**
 * GET /api/portfolio/leaderboard
 * Get top portfolios (public leaderboard)
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const leaderboard = await Portfolio.getLeaderboard(parseInt(limit));
        
        res.json({
            success: true,
            leaderboard
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

/**
 * POST /api/portfolio/buy
 * Buy an asset (stock or crypto)
 */
router.post('/buy', authMiddleware, async (req, res) => {
    try {
        const { symbol, quantity, price, assetType = 'stock' } = req.body;

        if (!symbol || !quantity || !price) {
            return res.status(400).json({
                success: false,
                error: 'Symbol, quantity, and price are required'
            });
        }

        if (quantity <= 0 || price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Quantity and price must be positive numbers'
            });
        }

        const portfolio = await Portfolio.getOrCreate(req.user.id);
        
        // Use the buyAsset method from the model
        await portfolio.buyAsset(symbol.toUpperCase(), parseFloat(quantity), parseFloat(price), assetType);
        
        // 🎮 GAMIFICATION: Track trade (buying is always neutral at start)
        try {
            await GamificationService.trackTrade(req.user.id, null, 0); // neutral trade
            await GamificationService.awardXP(req.user.id, 10, 'Stock purchase');
            await GamificationService.updatePortfolioStats(
                req.user.id, 
                portfolio.totalValue, 
                portfolio.holdings.length
            );
        } catch (error) {
            console.warn('Failed to track trade in gamification:', error.message);
        }

        res.json({
            success: true,
            message: `Bought ${quantity} ${symbol}`,
            portfolio: {
                holdings: portfolio.holdings,
                cashBalance: portfolio.cashBalance,
                totalValue: portfolio.totalValue
            }
        });

    } catch (error) {
        console.error('Error buying asset:', error);
        
        if (error.message === 'Insufficient cash balance') {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to buy asset',
            message: error.message
        });
    }
});

/**
 * POST /api/portfolio/sell
 * Sell an asset
 */
router.post('/sell', authMiddleware, async (req, res) => {
    try {
        const { symbol, quantity } = req.body;

        if (!symbol || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Symbol and quantity are required'
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Quantity must be a positive number'
            });
        }

        const portfolio = await Portfolio.getOrCreate(req.user.id);
        
        const holding = portfolio.holdings.find(h => h.symbol === symbol.toUpperCase());
        if (!holding) {
            return res.status(404).json({
                success: false,
                error: `You don't own ${symbol}`
            });
        }

        let currentPrice = holding.currentPrice;
        try {
            const priceData = await getCurrentPrice(symbol, holding.assetType);
            currentPrice = priceData.price;
        } catch (error) {
            console.warn(`Could not fetch current price for ${symbol}, using last known price`);
        }

        // Calculate profit BEFORE selling
        const purchasePrice = holding.purchasePrice;
        const profit = (currentPrice - purchasePrice) * parseFloat(quantity);
        const profitable = profit > 0;

        // Sell the asset
        await portfolio.sellAsset(symbol.toUpperCase(), parseFloat(quantity), currentPrice);
        
        // 🎮 GAMIFICATION: Track profitable/unprofitable trade
        try {
            await GamificationService.trackTrade(req.user.id, profitable, profit);
            
            // Award extra XP for profitable trades
            if (profitable) {
                const xpBonus = Math.floor(profit / 10);
                await GamificationService.awardXP(req.user.id, 20 + xpBonus, 'Profitable sale');
            } else {
                await GamificationService.awardXP(req.user.id, 5, 'Trade completed');
            }
            
            await GamificationService.updatePortfolioStats(
                req.user.id, 
                portfolio.totalValue, 
                portfolio.holdings.length
            );
        } catch (error) {
            console.warn('Failed to track trade in gamification:', error.message);
        }

        res.json({
            success: true,
            message: `Sold ${quantity} ${symbol}`,
            profit: {
                amount: profit,
                profitable
            },
            portfolio: {
                holdings: portfolio.holdings,
                cashBalance: portfolio.cashBalance,
                totalValue: portfolio.totalValue
            }
        });

    } catch (error) {
        console.error('Error selling asset:', error);
        
        if (error.message.includes("don't own") || error.message.includes('Insufficient quantity')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to sell asset',
            message: error.message
        });
    }
});

/**
 * POST /api/portfolio/holdings
 * Add a new holding (manual entry - for existing positions)
 */
router.post('/holdings', authMiddleware, async (req, res) => {
    try {
        const { symbol, shares, averagePrice, assetType = 'stock' } = req.body;

        if (!symbol || !shares || !averagePrice) {
            return res.status(400).json({
                success: false,
                error: 'Symbol, shares, and average price are required'
            });
        }

        if (shares <= 0 || averagePrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Shares and price must be positive numbers'
            });
        }

        const portfolio = await Portfolio.getOrCreate(req.user.id);
        
        const existingHolding = portfolio.holdings.find(
            h => h.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (existingHolding) {
            return res.status(400).json({
                success: false,
                error: `You already have ${symbol} in your portfolio. Edit the existing holding instead.`
            });
        }

        let currentPrice = parseFloat(averagePrice);
        try {
            const priceData = await getCurrentPrice(symbol.toUpperCase(), assetType);
            currentPrice = priceData.price;
        } catch (error) {
            console.warn(`Could not fetch current price for ${symbol}, using purchase price`);
        }

        // Add new holding manually
        portfolio.holdings.push({
            symbol: symbol.toUpperCase(),
            quantity: parseFloat(shares),
            purchasePrice: parseFloat(averagePrice),
            currentPrice: currentPrice,
            purchaseDate: new Date(),
            assetType
        });

        portfolio.calculateTotals();
        await portfolio.save();
        
        // 🎮 GAMIFICATION: Track adding holding
        try {
            await GamificationService.awardXP(req.user.id, 15, `Added ${symbol} to portfolio`);
            await GamificationService.updatePortfolioStats(
                req.user.id, 
                portfolio.totalValue, 
                portfolio.holdings.length
            );
            
            // Check if this is their first holding
            if (portfolio.holdings.length === 1) {
                await GamificationService.awardXP(req.user.id, 50, 'First stock added!');
            }
        } catch (error) {
            console.warn('Failed to update gamification:', error.message);
        }

        res.json({
            success: true,
            message: `${symbol} added to portfolio`,
            portfolio: {
                holdings: portfolio.holdings,
                totalValue: portfolio.totalValue
            }
        });

    } catch (error) {
        console.error('Error adding holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add holding',
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolio/holdings/:id
 * Update a holding
 */
router.put('/holdings/:id', authMiddleware, async (req, res) => {
    try {
        const holdingId = req.params.id;
        const { quantity, purchasePrice } = req.body;

        const portfolio = await Portfolio.getOrCreate(req.user.id);
        const holding = portfolio.holdings.id(holdingId);

        if (!holding) {
            return res.status(404).json({
                success: false,
                error: 'Holding not found'
            });
        }

        if (quantity !== undefined) {
            if (quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Quantity must be positive'
                });
            }
            holding.quantity = parseFloat(quantity);
        }
        
        if (purchasePrice !== undefined) {
            if (purchasePrice <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Purchase price must be positive'
                });
            }
            holding.purchasePrice = parseFloat(purchasePrice);
        }

        portfolio.calculateTotals();
        await portfolio.save();
        
        // 🎮 GAMIFICATION: Update stats
        try {
            await GamificationService.updatePortfolioStats(
                req.user.id, 
                portfolio.totalValue, 
                portfolio.holdings.length
            );
        } catch (error) {
            console.warn('Failed to update gamification:', error.message);
        }

        res.json({
            success: true,
            message: 'Holding updated',
            holding
        });

    } catch (error) {
        console.error('Error updating holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update holding',
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolio/holdings/:id
 * Delete a holding
 */
router.delete('/holdings/:id', authMiddleware, async (req, res) => {
    try {
        const holdingId = req.params.id;
        const portfolio = await Portfolio.getOrCreate(req.user.id);

        const holding = portfolio.holdings.id(holdingId);
        if (!holding) {
            return res.status(404).json({
                success: false,
                error: 'Holding not found'
            });
        }

        const removedSymbol = holding.symbol;
        
        portfolio.holdings.pull(holdingId);
        portfolio.calculateTotals();
        await portfolio.save();
        
        // 🎮 GAMIFICATION: Update stats
        try {
            await GamificationService.updatePortfolioStats(
                req.user.id, 
                portfolio.totalValue, 
                portfolio.holdings.length
            );
        } catch (error) {
            console.warn('Failed to update gamification:', error.message);
        }

        res.json({
            success: true,
            message: `${removedSymbol} removed from portfolio`
        });

    } catch (error) {
        console.error('Error deleting holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete holding',
            message: error.message
        });
    }
});

/**
 * POST /api/portfolio/refresh-prices
 * Manually refresh all prices
 */
router.post('/refresh-prices', authMiddleware, async (req, res) => {
    try {
        const portfolio = await Portfolio.getOrCreate(req.user.id);
        
        if (portfolio.holdings.length === 0) {
            return res.json({
                success: true,
                message: 'No holdings to refresh'
            });
        }

        const priceUpdates = {};
        const errors = [];
        
        await Promise.all(
            portfolio.holdings.map(async (holding) => {
                try {
                    const priceData = await getCurrentPrice(holding.symbol, holding.assetType);
                    priceUpdates[holding.symbol] = priceData.price;
                } catch (error) {
                    errors.push({ symbol: holding.symbol, error: error.message });
                    priceUpdates[holding.symbol] = holding.currentPrice || holding.purchasePrice;
                }
            })
        );
        
        await portfolio.updatePrices(priceUpdates);
        
        // 🎮 GAMIFICATION: Award XP for refreshing
        try {
            await GamificationService.awardXP(req.user.id, 5, 'Portfolio refresh');
        } catch (error) {
            console.warn('Failed to award XP:', error.message);
        }
        
        res.json({
            success: true,
            message: 'Prices refreshed',
            updated: Object.keys(priceUpdates).length,
            errors: errors.length > 0 ? errors : undefined,
            portfolio: {
                totalValue: portfolio.totalValue,
                totalChange: portfolio.totalChange,
                totalChangePercent: portfolio.totalChangePercent
            }
        });

    } catch (error) {
        console.error('Error refreshing prices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh prices',
            message: error.message
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCurrentPrice(symbol, assetType = 'stock') {
    try {
        if (assetType === 'crypto') {
            return await getCryptoPrice(symbol);
        } else {
            return await getStockPrice(symbol);
        }
    } catch (error) {
        throw new Error(`Failed to fetch price for ${symbol}: ${error.message}`);
    }
}

async function getStockPrice(symbol) {
    // Try Yahoo Finance first
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
        const response = await axios.get(url, { timeout: 10000 });
        const result = response.data?.chart?.result?.[0];
        const meta = result?.meta;

        if (meta && (meta.regularMarketPrice || meta.previousClose)) {
            const price = meta.regularMarketPrice || meta.previousClose;
            console.log(`[Portfolio] Yahoo price for ${symbol}: $${price}`);
            return {
                price: price,
                changePercent: meta.regularMarketPrice && meta.previousClose
                    ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
                    : 0
            };
        }
    } catch (yahooError) {
        console.log(`[Portfolio] Yahoo Finance failed for ${symbol}: ${yahooError.message}`);
    }

    // Fallback to Alpha Vantage
    const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (ALPHA_VANTAGE_KEY && ALPHA_VANTAGE_KEY !== 'demo') {
        try {
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            const response = await axios.get(url, { timeout: 10000 });
            const quote = response.data['Global Quote'];

            if (quote && quote['05. price']) {
                const price = parseFloat(quote['05. price']);
                console.log(`[Portfolio] Alpha Vantage price for ${symbol}: $${price}`);
                return {
                    price: price,
                    changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || 0)
                };
            }
        } catch (avError) {
            console.log(`[Portfolio] Alpha Vantage failed for ${symbol}: ${avError.message}`);
        }
    }

    throw new Error(`Could not fetch stock price for ${symbol} from any source`);
}

async function getCryptoPrice(symbol) {
    const cryptoMap = {
        BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
        ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot',
        BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap',
        MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron',
        AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
        PEPE: 'pepe', ARB: 'arbitrum', OP: 'optimism'
    };

    const coinId = cryptoMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const COINGECKO_KEY = process.env.COINGECKO_API_KEY;
    const baseUrl = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

    try {
        const params = {
            ids: coinId,
            vs_currencies: 'usd',
            include_24hr_change: true
        };

        if (COINGECKO_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_KEY;
        }

        const url = `${baseUrl}/simple/price`;
        const response = await axios.get(url, { params, timeout: 10000 });
        const data = response.data;

        if (data[coinId] && data[coinId].usd) {
            const price = data[coinId].usd;
            console.log(`[Portfolio] CoinGecko price for ${symbol}: $${price}`);
            return {
                price: price,
                changePercent: data[coinId].usd_24h_change || 0
            };
        }
    } catch (error) {
        console.log(`[Portfolio] CoinGecko failed for ${symbol}: ${error.message}`);
    }

    throw new Error(`Crypto price not found for ${symbol}`);
}

module.exports = router;