// server/routes/portfolioRoutes.js - NO GATES VERSION

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Portfolio = require('../models/Portfolio');
const axios = require('axios');

// GET portfolio
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        let portfolio = await Portfolio.findOne({ user: userId });
        
        if (!portfolio) {
            portfolio = await Portfolio.create({
                user: userId,
                holdings: []
            });
        }

        const holdingsWithPrices = await Promise.all(
            portfolio.holdings.map(async (holding) => {
                try {
                    const priceData = await getCurrentPrice(holding.symbol);
                    holding.currentPrice = priceData.price;
                    
                    return {
                        _id: holding._id,
                        symbol: holding.symbol,
                        shares: holding.quantity,
                        quantity: holding.quantity,
                        averagePrice: holding.purchasePrice,
                        purchasePrice: holding.purchasePrice,
                        currentPrice: priceData.price,
                        dayChangePercent: priceData.changePercent,
                        sector: priceData.sector
                    };
                } catch (error) {
                    return {
                        _id: holding._id,
                        symbol: holding.symbol,
                        shares: holding.quantity,
                        quantity: holding.quantity,
                        averagePrice: holding.purchasePrice,
                        purchasePrice: holding.purchasePrice,
                        currentPrice: holding.currentPrice || holding.purchasePrice,
                        dayChangePercent: 0,
                        sector: null
                    };
                }
            })
        );

        let totalCurrentValue = 0;
        let totalCostBasis = 0;
        
        holdingsWithPrices.forEach(holding => {
            totalCurrentValue += (holding.currentPrice || 0) * (holding.quantity || 0);
            totalCostBasis += (holding.purchasePrice || 0) * (holding.quantity || 0);
        });

        const totalChange = totalCurrentValue - totalCostBasis;
        const totalChangePercent = totalCostBasis > 0 ? (totalChange / totalCostBasis) * 100 : 0;

        portfolio.totalValue = totalCurrentValue + (portfolio.cashBalance || 0);
        portfolio.totalChange = totalChange;
        portfolio.totalChangePercent = totalChangePercent;
        portfolio.lastUpdatedAt = new Date();
        
        await portfolio.save();

        res.json({
            success: true,
            holdings: holdingsWithPrices,
            totalValue: portfolio.totalValue,
            cashBalance: portfolio.cashBalance,
            totalChange: portfolio.totalChange,
            totalChangePercent: portfolio.totalChangePercent
        });

    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio'
        });
    }
});

// POST add holding
router.post('/holdings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { symbol, shares, averagePrice } = req.body;

        if (!symbol || !shares || !averagePrice) {
            return res.status(400).json({
                success: false,
                error: 'Symbol, shares, and average price are required'
            });
        }

        if (shares <= 0 || averagePrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Shares and price must be positive'
            });
        }

        let portfolio = await Portfolio.findOne({ user: userId });
        
        if (!portfolio) {
            portfolio = await Portfolio.create({
                user: userId,
                holdings: []
            });
        }

        const existingHolding = portfolio.holdings.find(
            h => h.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (existingHolding) {
            return res.status(400).json({
                success: false,
                error: `${symbol} already in portfolio`
            });
        }

        let currentPrice = parseFloat(averagePrice);
        try {
            const priceData = await getCurrentPrice(symbol.toUpperCase());
            currentPrice = priceData.price;
        } catch (priceError) {
            console.warn(`Could not fetch price for ${symbol}`);
        }

        const newHolding = {
            symbol: symbol.toUpperCase(),
            quantity: parseFloat(shares),
            purchasePrice: parseFloat(averagePrice),
            currentPrice: currentPrice,
            purchaseDate: new Date(),
            assetType: 'stock'
        };

        portfolio.holdings.push(newHolding);

        let totalCurrentValue = 0;
        let totalCostBasis = 0;
        
        portfolio.holdings.forEach(holding => {
            totalCurrentValue += (holding.currentPrice || 0) * (holding.quantity || 0);
            totalCostBasis += (holding.purchasePrice || 0) * (holding.quantity || 0);
        });

        portfolio.totalValue = totalCurrentValue + (portfolio.cashBalance || 0);
        portfolio.totalChange = totalCurrentValue - totalCostBasis;
        portfolio.totalChangePercent = totalCostBasis > 0 ? (portfolio.totalChange / totalCostBasis) * 100 : 0;
        portfolio.lastUpdatedAt = new Date();

        await portfolio.save();

        res.json({
            success: true,
            message: `${symbol} added to portfolio`,
            portfolio: portfolio.holdings
        });

    } catch (error) {
        console.error('Error adding holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add holding'
        });
    }
});

// DELETE holding
router.delete('/holdings/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const holdingId = req.params.id;

        const portfolio = await Portfolio.findOne({ user: userId });

        if (!portfolio) {
            return res.status(404).json({
                success: false,
                error: 'Portfolio not found'
            });
        }

        const holding = portfolio.holdings.id(holdingId);

        if (!holding) {
            return res.status(404).json({
                success: false,
                error: 'Holding not found'
            });
        }

        const removedSymbol = holding.symbol;
        portfolio.holdings.pull(holdingId);
        
        let totalCurrentValue = 0;
        let totalCostBasis = 0;
        
        portfolio.holdings.forEach(h => {
            totalCurrentValue += (h.currentPrice || 0) * (h.quantity || 0);
            totalCostBasis += (h.purchasePrice || 0) * (h.quantity || 0);
        });

        portfolio.totalValue = totalCurrentValue + (portfolio.cashBalance || 0);
        portfolio.totalChange = totalCurrentValue - totalCostBasis;
        portfolio.totalChangePercent = totalCostBasis > 0 ? (portfolio.totalChange / totalCostBasis) * 100 : 0;
        portfolio.lastUpdatedAt = new Date();

        await portfolio.save();

        res.json({
            success: true,
            message: `${removedSymbol} removed from portfolio`
        });

    } catch (error) {
        console.error('Error deleting holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete holding'
        });
    }
});

// PUT update holding
router.put('/holdings/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const holdingId = req.params.id;
        const { shares, averagePrice } = req.body;

        const portfolio = await Portfolio.findOne({ user: userId });

        if (!portfolio) {
            return res.status(404).json({
                success: false,
                error: 'Portfolio not found'
            });
        }

        const holding = portfolio.holdings.id(holdingId);

        if (!holding) {
            return res.status(404).json({
                success: false,
                error: 'Holding not found'
            });
        }

        if (shares !== undefined) holding.quantity = parseFloat(shares);
        if (averagePrice !== undefined) holding.purchasePrice = parseFloat(averagePrice);

        let totalCurrentValue = 0;
        let totalCostBasis = 0;
        
        portfolio.holdings.forEach(h => {
            totalCurrentValue += (h.currentPrice || 0) * (h.quantity || 0);
            totalCostBasis += (h.purchasePrice || 0) * (h.quantity || 0);
        });

        portfolio.totalValue = totalCurrentValue + (portfolio.cashBalance || 0);
        portfolio.totalChange = totalCurrentValue - totalCostBasis;
        portfolio.totalChangePercent = totalCostBasis > 0 ? (portfolio.totalChange / totalCostBasis) * 100 : 0;
        portfolio.lastUpdatedAt = new Date();

        await portfolio.save();

        res.json({
            success: true,
            message: 'Holding updated',
            holding
        });

    } catch (error) {
        console.error('Error updating holding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update holding'
        });
    }
});

async function getCurrentPrice(symbol) {
    try {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
        const yahooResponse = await axios.get(yahooUrl, { timeout: 5000 });
        const result = yahooResponse.data.chart.result[0];
        const meta = result.meta;
        
        return {
            price: meta.regularMarketPrice || meta.previousClose,
            changePercent: meta.regularMarketPrice && meta.previousClose 
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 
                : 0,
            sector: null
        };
    } catch (error) {
        throw error;
    }
}

module.exports = router;