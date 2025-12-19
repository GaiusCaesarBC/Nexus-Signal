// server/routes/portfolioRoutes.js - WITH GAMIFICATION INTEGRATION

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Portfolio = require('../models/Portfolio');
const axios = require('axios');
const GamificationService = require('../services/gamificationService');
const { sanitizeSymbol, validateSymbol } = require('../utils/symbolValidation');

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
        const { quantity, price, assetType = 'stock' } = req.body;

        if (!req.body.symbol || !quantity || !price) {
            return res.status(400).json({
                success: false,
                error: 'Symbol, quantity, and price are required'
            });
        }

        // Validate symbol to prevent SSRF/injection attacks
        let symbol;
        try {
            symbol = sanitizeSymbol(req.body.symbol);
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: validationError.message
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
        await portfolio.buyAsset(symbol, parseFloat(quantity), parseFloat(price), assetType);
        
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
        const { quantity } = req.body;

        if (!req.body.symbol || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Symbol and quantity are required'
            });
        }

        // Validate symbol to prevent SSRF/injection attacks
        let symbol;
        try {
            symbol = sanitizeSymbol(req.body.symbol);
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: validationError.message
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Quantity must be a positive number'
            });
        }

        const portfolio = await Portfolio.getOrCreate(req.user.id);

        const holding = portfolio.holdings.find(h => h.symbol === symbol);
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
        await portfolio.sellAsset(symbol, parseFloat(quantity), currentPrice);
        
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
        const { shares, averagePrice, assetType = 'stock' } = req.body;

        if (!req.body.symbol || !shares || !averagePrice) {
            return res.status(400).json({
                success: false,
                error: 'Symbol, shares, and average price are required'
            });
        }

        // Validate symbol to prevent SSRF/injection attacks
        let symbol;
        try {
            symbol = sanitizeSymbol(req.body.symbol);
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: validationError.message
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
            h => h.symbol === symbol
        );

        if (existingHolding) {
            return res.status(400).json({
                success: false,
                error: `You already have ${symbol} in your portfolio. Edit the existing holding instead.`
            });
        }

        let currentPrice = parseFloat(averagePrice);
        try {
            const priceData = await getCurrentPrice(symbol, assetType);
            currentPrice = priceData.price;
        } catch (error) {
            console.warn(`Could not fetch current price for ${symbol}, using purchase price`);
        }

        // Add new holding manually
        portfolio.holdings.push({
            symbol: symbol,
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
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
        const response = await axios.get(url, { timeout: 5000 });
        const result = response.data.chart.result[0];
        const meta = result.meta;
        
        return {
            price: meta.regularMarketPrice || meta.previousClose,
            changePercent: meta.regularMarketPrice && meta.previousClose 
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 
                : 0
        };
    } catch (yahooError) {
        console.log(`Yahoo Finance failed for ${symbol}, trying Alpha Vantage...`);
    }

    const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (ALPHA_VANTAGE_KEY && ALPHA_VANTAGE_KEY !== 'demo') {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await axios.get(url, { timeout: 5000 });
        const quote = response.data['Global Quote'];
        
        if (quote && quote['05. price']) {
            return {
                price: parseFloat(quote['05. price']),
                changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || 0)
            };
        }
    }

    throw new Error('Could not fetch stock price from any source');
}

async function getCryptoPrice(symbol) {
    const cryptoMap = {
        BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
        ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot',
        BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap',
        MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron',
        AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero'
    };

    const coinId = cryptoMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const COINGECKO_KEY = process.env.COINGECKO_API_KEY;
    const baseUrl = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
    
    const params = {
        ids: coinId,
        vs_currencies: 'usd',
        include_24hr_change: true
    };
    
    if (COINGECKO_KEY) {
        params['x_cg_pro_api_key'] = COINGECKO_KEY;
    }
    
    const url = `${baseUrl}/simple/price`;
    const response = await axios.get(url, { params, timeout: 5000 });
    const data = response.data;
    
    if (data[coinId] && data[coinId].usd) {
        return {
            price: data[coinId].usd,
            changePercent: data[coinId].usd_24h_change || 0
        };
    }
    
    throw new Error(`Crypto price not found for ${symbol}`);
}

/**
 * GET /api/portfolio/analytics
 * Comprehensive portfolio analytics
 * Query params:
 *   - mode: 'paper' (default) or 'real' - switches between paper trading and real portfolio data
 */
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const mode = req.query.mode || 'paper'; // 'paper' or 'real'

        // Get paper trading data
        const PaperTradingAccount = require('../models/PaperTradingAccount');
        const paperAccount = await PaperTradingAccount.findOne({ user: userId });

        // Get prediction data
        const Prediction = require('../models/Prediction');
        const predictions = await Prediction.find({
            user: userId,
            status: { $in: ['correct', 'incorrect'] }
        }).sort({ createdAt: -1 }).limit(50);

        // Determine data source based on mode
        let holdings = [];
        let portfolioValue = 0;
        let totalPL = 0;
        let totalPLPercent = 0;

        if (mode === 'paper') {
            // Use paper trading positions
            holdings = (paperAccount?.positions || []).filter(p => !p.isLiquidated).map(p => ({
                symbol: p.symbol,
                quantity: p.quantity,
                purchasePrice: p.averagePrice,
                currentPrice: p.currentPrice || p.averagePrice,
                assetType: p.type || 'stock',
                profitLossPercent: p.profitLossPercent,
                source: 'paper'
            }));
            portfolioValue = paperAccount?.portfolioValue || 0;
            totalPL = paperAccount?.totalProfitLoss || 0;
            totalPLPercent = paperAccount?.totalProfitLossPercent || 0;
        } else {
            // Use REAL portfolio from brokerage connections and wallet
            const BrokerageConnection = require('../models/BrokerageConnection');

            // Get all active brokerage connections (Plaid, Kraken, etc.)
            const brokerageConnections = await BrokerageConnection.find({
                user: userId,
                status: 'active'
            });

            // Aggregate holdings from all brokerage connections
            for (const conn of brokerageConnections) {
                if (conn.cachedPortfolio?.holdings) {
                    for (const h of conn.cachedPortfolio.holdings) {
                        const costBasis = h.costBasis || (h.quantity * h.price);
                        const currentValue = h.value || (h.quantity * h.price);
                        const gainLoss = currentValue - costBasis;
                        const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

                        holdings.push({
                            symbol: h.symbol,
                            name: h.name,
                            quantity: h.quantity,
                            purchasePrice: costBasis / (h.quantity || 1),
                            currentPrice: h.price,
                            assetType: h.type || 'stock',
                            profitLossPercent: gainLossPercent,
                            source: conn.type,
                            sourceName: conn.name
                        });
                        portfolioValue += currentValue;
                        totalPL += gainLoss;
                    }
                }
            }

            // Also get wallet-synced holdings from Portfolio model
            const realPortfolio = await Portfolio.findOne({ user: userId });
            if (realPortfolio?.holdings) {
                for (const h of realPortfolio.holdings) {
                    if (h.fromWallet) {
                        // Wallet-synced crypto holdings
                        const costBasis = h.totalCost || (h.quantity * (h.purchasePrice || 0));
                        const currentValue = h.currentValue || (h.quantity * (h.currentPrice || 0));
                        const gainLoss = currentValue - costBasis;
                        const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

                        holdings.push({
                            symbol: h.symbol,
                            quantity: h.quantity,
                            purchasePrice: h.purchasePrice || 0,
                            currentPrice: h.currentPrice || 0,
                            assetType: 'crypto',
                            profitLossPercent: gainLossPercent,
                            source: 'wallet',
                            sourceName: 'Linked Wallet'
                        });
                        portfolioValue += currentValue;
                        totalPL += gainLoss;
                    }
                }
            }

            // Calculate total P/L percent based on initial value
            const initialValue = portfolioValue - totalPL;
            totalPLPercent = initialValue > 0 ? (totalPL / initialValue) * 100 : 0;
        }

        // Calculate allocation by asset type
        const allocationByType = {};
        let totalValue = 0;

        for (const holding of holdings) {
            const type = holding.assetType || 'stock';
            const value = (holding.quantity || 0) * (holding.currentPrice || 0);
            totalValue += value;

            if (!allocationByType[type]) {
                allocationByType[type] = { value: 0, count: 0, holdings: [] };
            }
            allocationByType[type].value += value;
            allocationByType[type].count++;
            allocationByType[type].holdings.push({
                symbol: holding.symbol,
                value,
                percent: 0
            });
        }

        // Calculate percentages
        for (const type in allocationByType) {
            allocationByType[type].percent = totalValue > 0
                ? ((allocationByType[type].value / totalValue) * 100).toFixed(2)
                : 0;
            for (const h of allocationByType[type].holdings) {
                h.percent = totalValue > 0
                    ? ((h.value / totalValue) * 100).toFixed(2)
                    : 0;
            }
        }

        // Paper trading stats (always include for the card)
        const paperTradingStats = paperAccount ? {
            totalTrades: paperAccount.totalTrades || 0,
            winningTrades: paperAccount.winningTrades || 0,
            losingTrades: paperAccount.losingTrades || 0,
            winRate: paperAccount.winRate || 0,
            biggestWin: paperAccount.biggestWin || 0,
            biggestLoss: paperAccount.biggestLoss || 0,
            portfolioValue: paperAccount.portfolioValue || 0,
            cashBalance: paperAccount.cashBalance || 0,
            totalPL: paperAccount.totalProfitLoss || 0,
            currentStreak: paperAccount.currentStreak || 0,
            bestStreak: paperAccount.bestStreak || 0
        } : null;

        // Prediction accuracy
        const correctPredictions = predictions.filter(p => p.status === 'correct').length;
        const predictionAccuracy = predictions.length > 0
            ? ((correctPredictions / predictions.length) * 100).toFixed(1)
            : 0;

        // Calculate performance metrics
        const performanceMetrics = {
            totalHoldings: holdings.length,
            portfolioValue: portfolioValue,
            totalGainLoss: totalPL,
            totalGainLossPercent: totalPLPercent,
            topGainer: null,
            topLoser: null
        };

        // Find top gainer and loser
        let maxGain = -Infinity;
        let maxLoss = Infinity;

        for (const holding of holdings) {
            const gainPercent = holding.profitLossPercent ||
                ((holding.currentPrice - holding.purchasePrice) / holding.purchasePrice) * 100;

            if (gainPercent > maxGain && gainPercent > 0) {
                maxGain = gainPercent;
                performanceMetrics.topGainer = {
                    symbol: holding.symbol,
                    gainPercent: gainPercent.toFixed(2)
                };
            }
            if (gainPercent < maxLoss && gainPercent < 0) {
                maxLoss = gainPercent;
                performanceMetrics.topLoser = {
                    symbol: holding.symbol,
                    lossPercent: gainPercent.toFixed(2)
                };
            }
        }

        // Risk metrics
        const riskMetrics = {
            diversificationScore: Math.min(100, holdings.length * 10),
            concentrationRisk: holdings.length > 0 && totalValue > 0
                ? (holdings.reduce((max, h) => {
                    const value = h.quantity * (h.currentPrice || h.purchasePrice);
                    return Math.max(max, value);
                }, 0) / totalValue * 100).toFixed(1)
                : 0,
            assetTypeCount: Object.keys(allocationByType).length
        };

        res.json({
            success: true,
            mode, // Include mode in response
            analytics: {
                overview: performanceMetrics,
                allocation: allocationByType,
                paperTrading: paperTradingStats,
                predictions: {
                    total: predictions.length,
                    correct: correctPredictions,
                    accuracy: predictionAccuracy
                },
                risk: riskMetrics
            }
        });

    } catch (error) {
        console.error('[Portfolio Analytics] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics',
            message: error.message
        });
    }
});

module.exports = router;