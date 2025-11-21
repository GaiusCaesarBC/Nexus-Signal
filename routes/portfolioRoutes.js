// server/routes/portfolioRoutes.js - COMPLETE VERSION WITH ADD/DELETE
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Portfolio = require('../models/Portfolio'); // You'll need this model
const axios = require('axios');

/**
 * POST /api/portfolio/migrate
 * One-time migration to fix field names in existing portfolios
 */
router.post('/migrate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔄 Migrating portfolio for user:', userId);

        const portfolio = await Portfolio.findOne({ user: userId });

        if (!portfolio) {
            return res.json({ success: true, message: 'No portfolio to migrate' });
        }

        console.log('📁 Found portfolio with', portfolio.holdings.length, 'holdings');

        // Fix each holding
        portfolio.holdings.forEach((holding, index) => {
            console.log(`Migrating holding ${index}:`, holding.symbol);
            
            // If it has old field names, migrate them
            if (holding.shares !== undefined && holding.quantity === undefined) {
                holding.quantity = holding.shares;
                holding.shares = undefined;
            }
            if (holding.averagePrice !== undefined && holding.purchasePrice === undefined) {
                holding.purchasePrice = holding.averagePrice;
                holding.averagePrice = undefined;
            }
            // Set default currentPrice if missing
            if (!holding.currentPrice) {
                holding.currentPrice = holding.purchasePrice || 0;
            }
            // Set default assetType if missing
            if (!holding.assetType) {
                holding.assetType = 'stock';
            }
        });

        // Save without validation to allow the migration
        await portfolio.save({ validateBeforeSave: false });
        
        console.log('✅ Migration complete');

        res.json({
            success: true,
            message: 'Portfolio migrated successfully',
            holdings: portfolio.holdings.length
        });

    } catch (error) {
        console.error('❌ Migration error:', error);
        res.status(500).json({
            success: false,
            error: 'Migration failed',
            details: error.message
        });
    }
});

/**
 * GET /api/portfolio
 * Get user's portfolio with current prices
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📊 GET Portfolio request for user:', userId);
        
        // Find user's portfolio
        let portfolio = await Portfolio.findOne({ user: userId });
        console.log('📁 Portfolio lookup result:', portfolio ? `Found with ${portfolio.holdings?.length || 0} holdings` : 'Not found');
        
        if (!portfolio) {
            // Create empty portfolio if doesn't exist
            portfolio = await Portfolio.create({
                user: userId,
                holdings: []
            });
        }

        // Fetch current prices for all holdings
        const holdingsWithPrices = await Promise.all(
            portfolio.holdings.map(async (holding) => {
                try {
                    // Fetch current price from your market data source
                    const priceData = await getCurrentPrice(holding.symbol);
                    
                    // Update the holding's current price
                    holding.currentPrice = priceData.price;
                    
                    return {
                        _id: holding._id,
                        symbol: holding.symbol,
                        shares: holding.quantity, // Map to 'shares' for frontend
                        quantity: holding.quantity,
                        averagePrice: holding.purchasePrice, // Map to 'averagePrice' for frontend
                        purchasePrice: holding.purchasePrice,
                        currentPrice: priceData.price,
                        dayChangePercent: priceData.changePercent,
                        sector: priceData.sector
                    };
                } catch (error) {
                    console.error(`Error fetching price for ${holding.symbol}:`, error.message);
                    // Return holding with last known or purchase price
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

        // Calculate metrics manually
        let totalCurrentValue = 0;
        let totalCostBasis = 0;
        
        holdingsWithPrices.forEach(holding => {
            totalCurrentValue += (holding.currentPrice || 0) * (holding.quantity || 0);
            totalCostBasis += (holding.purchasePrice || 0) * (holding.quantity || 0);
        });

        const totalChange = totalCurrentValue - totalCostBasis;
        const totalChangePercent = totalCostBasis > 0 ? (totalChange / totalCostBasis) * 100 : 0;

        // Update portfolio document
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

/**
 * POST /api/portfolio/holdings
 * Add a new holding to portfolio
 */
router.post('/holdings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { symbol, shares, averagePrice } = req.body;

        console.log('➕ Add holding request:', { userId, symbol, shares, averagePrice });

        // Validation
        if (!symbol || !shares || !averagePrice) {
            console.log('❌ Validation failed - missing fields');
            return res.status(400).json({
                success: false,
                error: 'Symbol, shares, and average price are required'
            });
        }

        if (shares <= 0 || averagePrice <= 0) {
            console.log('❌ Validation failed - invalid values');
            return res.status(400).json({
                success: false,
                error: 'Shares and price must be positive numbers'
            });
        }

        // Find or create portfolio
        let portfolio = await Portfolio.findOne({ user: userId });
        
        if (!portfolio) {
            console.log('📁 Creating new portfolio for user:', userId);
            portfolio = await Portfolio.create({
                user: userId,
                holdings: []
            });
        } else {
            console.log('📁 Found existing portfolio with', portfolio.holdings.length, 'holdings');
            console.log('Current holdings:', portfolio.holdings.map(h => h.symbol));
        }

        // Check if symbol already exists
        const existingHolding = portfolio.holdings.find(
            h => h.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (existingHolding) {
            console.log('❌ Symbol already exists:', symbol);
            return res.status(400).json({
                success: false,
                error: `You already have ${symbol} in your portfolio. Edit the existing holding instead.`
            });
        }

        // Fetch current price for the stock
        let currentPrice = parseFloat(averagePrice);
        try {
            const priceData = await getCurrentPrice(symbol.toUpperCase());
            currentPrice = priceData.price;
            console.log('✅ Fetched current price for', symbol, ':', currentPrice);
        } catch (priceError) {
            console.warn(`⚠️ Could not fetch current price for ${symbol}, using purchase price:`, priceError.message);
        }

        // Add new holding (using your model's field names)
        const newHolding = {
            symbol: symbol.toUpperCase(),
            quantity: parseFloat(shares), // Your model uses 'quantity'
            purchasePrice: parseFloat(averagePrice), // Your model uses 'purchasePrice'
            currentPrice: currentPrice,
            purchaseDate: new Date(),
            assetType: 'stock'
        };

        console.log('➕ Adding new holding:', newHolding);
        portfolio.holdings.push(newHolding);

        // Calculate metrics manually instead of using method
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

        console.log('✅ Successfully added', symbol, 'to portfolio');
        console.log('📊 Portfolio now has', portfolio.holdings.length, 'holdings');

        res.json({
            success: true,
            message: `${symbol} added to portfolio`,
            portfolio: portfolio.holdings
        });

    } catch (error) {
        console.error('❌ Error adding holding:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to add holding',
            details: error.message
        });
    }
});

/**
 * DELETE /api/portfolio/holdings/:id
 * Delete a holding from portfolio
 */
router.delete('/holdings/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const holdingId = req.params.id;

        console.log('🗑️ Delete request - User:', userId, 'Holding ID:', holdingId);

        const portfolio = await Portfolio.findOne({ user: userId });

        if (!portfolio) {
            console.log('❌ Portfolio not found for user:', userId);
            return res.status(404).json({
                success: false,
                error: 'Portfolio not found'
            });
        }

        console.log('📋 Portfolio found with', portfolio.holdings.length, 'holdings');
        console.log('🔍 Looking for holding with ID:', holdingId);

        // Find the holding
        const holding = portfolio.holdings.id(holdingId);

        if (!holding) {
            console.log('❌ Holding not found with ID:', holdingId);
            console.log('Available holding IDs:', portfolio.holdings.map(h => h._id.toString()));
            return res.status(404).json({
                success: false,
                error: 'Holding not found'
            });
        }

        const removedSymbol = holding.symbol;
console.log('✅ Found holding:', removedSymbol);

// Remove the holding using pull
portfolio.holdings.pull(holdingId);
        
        // Calculate metrics manually instead of using method
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

        console.log('✅ Successfully deleted', removedSymbol);

        res.json({
            success: true,
            message: `${removedSymbol} removed from portfolio`
        });

    } catch (error) {
        console.error('❌ Error deleting holding:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to delete holding',
            details: error.message
        });
    }
});

/**
 * PUT /api/portfolio/holdings/:id
 * Update a holding (edit shares or average price)
 */
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

        // Update using your model's field names
        if (shares !== undefined) holding.quantity = parseFloat(shares);
        if (averagePrice !== undefined) holding.purchasePrice = parseFloat(averagePrice);

        // Calculate metrics manually instead of using method
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

/**
 * Helper function to get current stock price
 * Replace with your actual market data source
 */
async function getCurrentPrice(symbol) {
    try {
        // Try Yahoo Finance first (free, no API key needed)
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
        } catch (yahooError) {
            console.log(`Yahoo Finance failed for ${symbol}, trying Alpha Vantage...`);
        }

        // Try Alpha Vantage as backup
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (ALPHA_VANTAGE_KEY && ALPHA_VANTAGE_KEY !== 'demo') {
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            const response = await axios.get(url, { timeout: 5000 });
            const quote = response.data['Global Quote'];
            
            if (quote && quote['05. price']) {
                return {
                    price: parseFloat(quote['05. price']),
                    changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || 0),
                    sector: null
                };
            }
        }

        // If both fail, throw error
        throw new Error('Could not fetch price from any source');

    } catch (error) {
        console.error(`❌ Error fetching price for ${symbol}:`, error.message);
        throw error;
    }
}

module.exports = router;