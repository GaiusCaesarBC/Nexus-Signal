// server/routes/portfolioRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authMiddleware'); // Your authentication middleware

const Portfolio = require('../models/Portfolio'); // Portfolio model
const axios = require('axios'); // Import axios for market data calls

// Helper to fetch current prices (reusing existing logic or a new dedicated service)
// For now, this is a placeholder. In a real app, you'd integrate Alpha Vantage, CoinGecko, etc.
const getMarketPrice = async (symbol) => {
    try {
        const type = symbol.length > 5 && (symbol.endsWith('USD') || symbol.endsWith('USDT')) ? 'crypto' : 'stock';
        const marketDataApiKey = type === 'stock' ? process.env.ALPHA_VANTAGE_API_KEY : process.env.COINGECKO_API_KEY;

        if (!marketDataApiKey) {
            console.error(`Missing API key for ${type} market data.`);
            // Fallback to mock price if no API key
            const mockPrices = {
                'AAPL': 175.00, 'MSFT': 420.00, 'GOOG': 150.00,
                'BTC': 65000.00, 'ETH': 3200.00, 'AMZN': 180.00,
                'NVDA': 900.00, 'TSLA': 170.00,
            };
            return mockPrices[symbol.toUpperCase()] || (Math.random() * 100 + 10);
        }

        // Call your actual marketData endpoint to get the price
        // This is a simplified direct call for demonstration.
        // Ideally, you'd import and use a function from marketDataController here.
        // Make sure your backend PORT is set in .env
        const response = await axios.get(`http://localhost:${process.env.PORT}/api/market-data/single/${symbol}?type=${type}`);
        return response.data.price;
    } catch (error) {
        console.error(`Error fetching real market price for ${symbol}:`, error.message);
        // Fallback to mock price or return null/throw error if external API fails
        const mockPrices = {
            'AAPL': 175.00, 'MSFT': 420.00, 'GOOG': 150.00,
            'BTC': 65000.00, 'ETH': 3200.00, 'AMZN': 180.00,
            'NVDA': 900.00, 'TSLA': 170.00,
        };
        return mockPrices[symbol.toUpperCase()] || (Math.random() * 100 + 10);
    }
};


// @route   GET api/portfolio
// @desc    Get user's entire portfolio with calculated current values and cash balance
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let portfolio = await Portfolio.findOne({ user: req.user.id });

        if (!portfolio) {
            // If no portfolio exists, return a default empty portfolio with cashBalance
            return res.json({
                cashBalance: 10000.00, // Default starting cash
                holdings: [],
                totalValue: 10000.00,
                totalChange: 0.00,
                totalChangePercent: 0.00
            });
        }

        let totalHoldingsValue = 0;
        let totalHoldingsCost = 0;

        const updatedHoldings = await Promise.all(
            portfolio.holdings.map(async (holding) => {
                const currentPrice = await getMarketPrice(holding.symbol);
                if (currentPrice === null) {
                    // Handle case where price could not be fetched
                    console.warn(`Could not fetch current price for ${holding.symbol}. Using purchase price as fallback.`);
                }
                const effectivePrice = currentPrice !== null ? currentPrice : holding.purchasePrice; // Fallback
                const currentValue = holding.quantity * effectivePrice;
                const costBasis = holding.quantity * holding.purchasePrice;
                const profitLoss = currentValue - costBasis;
                const profitLossPercentage = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                totalHoldingsValue += currentValue;
                totalHoldingsCost += costBasis;

                return {
                    ...holding.toObject(), // Convert Mongoose sub-document to plain object
                    currentPrice: parseFloat(effectivePrice.toFixed(2)),
                    currentValue: parseFloat(currentValue.toFixed(2)),
                    profitLoss: parseFloat(profitLoss.toFixed(2)),
                    profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
                };
            })
        );

        // Calculate portfolio-wide change
        const totalChange = totalHoldingsValue - totalHoldingsCost;
        const totalChangePercent = totalHoldingsCost === 0 ? 0 : (totalChange / totalHoldingsCost) * 100;

        // Assuming cashBalance is stored directly on the Portfolio model, or default it.
        // If cashBalance is not on your Portfolio model, you'll need to decide where it lives.
        const cashBalance = portfolio.cashBalance !== undefined ? portfolio.cashBalance : 10000.00; // Use actual or default

        res.json({
            cashBalance: parseFloat(cashBalance.toFixed(2)),
            totalValue: parseFloat((totalHoldingsValue + cashBalance).toFixed(2)), // Total value includes cash
            totalChange: parseFloat(totalChange.toFixed(2)),
            totalChangePercent: parseFloat(totalChangePercent.toFixed(2)),
            holdings: updatedHoldings,
        });

    } catch (err) {
        console.error('Server Error in GET /api/portfolio:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/portfolio/add
// @desc    Add a new holding to user's portfolio
// @access  Private
router.post(
    '/add',
    auth,
    [
        body('symbol', 'Symbol is required').not().isEmpty(),
        body('quantity', 'Quantity must be a positive number').isFloat({ gt: 0 }),
        body('purchasePrice', 'Purchase price must be a positive number').isFloat({ gt: 0 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { symbol, quantity, purchasePrice, purchaseDate } = req.body;
        const newHolding = {
            symbol: symbol.toUpperCase(),
            quantity: parseFloat(quantity),
            purchasePrice: parseFloat(purchasePrice),
            purchaseDate: purchaseDate || Date.now() // Use provided date or default to now
        };

        try {
            let portfolio = await Portfolio.findOne({ user: req.user.id });

            if (portfolio) {
                // Portfolio exists, add new holding
                portfolio.holdings.push(newHolding);
                portfolio.markModified('holdings'); // Mark holdings array as modified for Mongoose change tracking
            } else {
                // No portfolio, create a new one with this holding and default cash
                portfolio = new Portfolio({
                    user: req.user.id,
                    cashBalance: 10000.00, // Initialize cash balance for new portfolios
                    holdings: [newHolding]
                });
            }

            await portfolio.save();

            // Re-fetch the portfolio to ensure all calculations are fresh for the response
            // This is a bit inefficient, but ensures the response is consistent.
            // A more optimized approach would recalculate directly here.
            // const updatedPortfolio = await Portfolio.findOne({ user: req.user.id }); // No need to re-fetch, 'portfolio' object is already updated

            // Now, apply the same calculations as in the GET /api/portfolio route
            let totalHoldingsValue = 0;
            let totalHoldingsCost = 0;
            const holdingsWithPrices = await Promise.all(
                portfolio.holdings.map(async (holding) => {
                    const currentPrice = await getMarketPrice(holding.symbol);
                    const effectivePrice = currentPrice !== null ? currentPrice : holding.purchasePrice;
                    const currentValue = holding.quantity * effectivePrice;
                    const costBasis = holding.quantity * holding.purchasePrice;
                    const profitLoss = currentValue - costBasis;
                    const profitLossPercentage = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                    totalHoldingsValue += currentValue;
                    totalHoldingsCost += costBasis;

                    return {
                        ...holding.toObject(),
                        currentPrice: parseFloat(effectivePrice.toFixed(2)),
                        currentValue: parseFloat(currentValue.toFixed(2)),
                        profitLoss: parseFloat(profitLoss.toFixed(2)),
                        profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
                    };
                })
            );

            const totalChange = totalHoldingsValue - totalHoldingsCost;
            const totalChangePercent = totalHoldingsCost === 0 ? 0 : (totalChange / totalHoldingsCost) * 100;
            const currentCashBalance = portfolio.cashBalance !== undefined ? portfolio.cashBalance : 10000.00;


            res.json({
                cashBalance: parseFloat(currentCashBalance.toFixed(2)),
                totalValue: parseFloat((totalHoldingsValue + currentCashBalance).toFixed(2)),
                totalChange: parseFloat(totalChange.toFixed(2)),
                totalChangePercent: parseFloat(totalChangePercent.toFixed(2)),
                holdings: holdingsWithPrices,
            });

        } catch (err) {
            console.error('Server Error in POST /api/portfolio/add:', err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   PUT api/portfolio/update/:holding_id
// @desc    Update an existing holding in user's portfolio
// @access  Private
router.put(
    '/update/:holding_id',
    auth,
    [
        body('quantity', 'Quantity must be a positive number').optional().isFloat({ gt: 0 }),
        body('purchasePrice', 'Purchase price must be a positive number').optional().isFloat({ gt: 0 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { quantity, purchasePrice, purchaseDate } = req.body;
        const holdingId = req.params.holding_id;

        try {
            let portfolio = await Portfolio.findOne({ user: req.user.id });

            if (!portfolio) {
                return res.status(404).json({ msg: 'Portfolio not found' });
            }

            const holdingToUpdate = portfolio.holdings.id(holdingId); // Mongoose method to find sub-document by ID

            if (!holdingToUpdate) {
                return res.status(404).json({ msg: 'Holding not found in portfolio' });
            }

            // Update fields if provided
            if (quantity !== undefined) holdingToUpdate.quantity = parseFloat(quantity);
            if (purchasePrice !== undefined) holdingToUpdate.purchasePrice = parseFloat(purchasePrice);
            if (purchaseDate !== undefined) holdingToUpdate.purchaseDate = purchaseDate;

            portfolio.markModified('holdings'); // Mark holdings array as modified
            await portfolio.save();

            // Re-fetch and recalculate the full portfolio for the response
            // const updatedPortfolio = await Portfolio.findOne({ user: req.user.id }); // No need to re-fetch, 'portfolio' object is already updated
            let totalHoldingsValue = 0;
            let totalHoldingsCost = 0;
            const holdingsWithPrices = await Promise.all(
                portfolio.holdings.map(async (holding) => {
                    const currentPrice = await getMarketPrice(holding.symbol);
                    const effectivePrice = currentPrice !== null ? currentPrice : holding.purchasePrice;
                    const currentValue = holding.quantity * effectivePrice;
                    const costBasis = holding.quantity * holding.purchasePrice;
                    const profitLoss = currentValue - costBasis;
                    const profitLossPercentage = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                    totalHoldingsValue += currentValue;
                    totalHoldingsCost += costBasis;

                    return {
                        ...holding.toObject(),
                        currentPrice: parseFloat(effectivePrice.toFixed(2)),
                        currentValue: parseFloat(currentValue.toFixed(2)),
                        profitLoss: parseFloat(profitLoss.toFixed(2)),
                        profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
                    };
                })
            );

            const totalChange = totalHoldingsValue - totalHoldingsCost;
            const totalChangePercent = totalHoldingsCost === 0 ? 0 : (totalChange / totalHoldingsCost) * 100;
            const currentCashBalance = portfolio.cashBalance !== undefined ? portfolio.cashBalance : 10000.00;

            res.json({
                cashBalance: parseFloat(currentCashBalance.toFixed(2)),
                totalValue: parseFloat((totalHoldingsValue + currentCashBalance).toFixed(2)),
                totalChange: parseFloat(totalChange.toFixed(2)),
                totalChangePercent: parseFloat(totalChangePercent.toFixed(2)),
                holdings: holdingsWithPrices,
            });

        } catch (err) {
            console.error('Server Error in PUT /api/portfolio/update:', err.message);
            res.status(500).send('Server Error');
        }
    }
);


// @route   DELETE api/portfolio/remove/:holding_id
// @desc    Remove a holding from user's portfolio
// @access  Private
router.delete('/remove/:holding_id', auth, async (req, res) => {
    try {
        let portfolio = await Portfolio.findOne({ user: req.user.id });

        if (!portfolio) {
            return res.status(404).json({ msg: 'Portfolio not found' });
        }

        const initialLength = portfolio.holdings.length;
        portfolio.holdings = portfolio.holdings.filter(
            (holding) => holding._id.toString() !== req.params.holding_id
        );

        if (portfolio.holdings.length === initialLength) {
            return res.status(404).json({ msg: 'Holding not found in portfolio' });
        }

        portfolio.markModified('holdings'); // Mark as modified
        await portfolio.save();

        // Re-fetch and recalculate the full portfolio for the response
        // const updatedPortfolio = await Portfolio.findOne({ user: req.user.id }); // No need to re-fetch, 'portfolio' object is already updated
        let totalHoldingsValue = 0;
        let totalHoldingsCost = 0;
        const holdingsWithPrices = await Promise.all(
            portfolio.holdings.map(async (holding) => {
                const currentPrice = await getMarketPrice(holding.symbol);
                const effectivePrice = currentPrice !== null ? currentPrice : holding.purchasePrice;
                const currentValue = holding.quantity * effectivePrice;
                const costBasis = holding.quantity * holding.purchasePrice;
                const profitLoss = currentValue - costBasis;
                const profitLossPercentage = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                totalHoldingsValue += currentValue;
                totalHoldingsCost += costBasis;

                return {
                    ...holding.toObject(),
                    currentPrice: parseFloat(effectivePrice.toFixed(2)),
                    currentValue: parseFloat(currentValue.toFixed(2)),
                    profitLoss: parseFloat(profitLoss.toFixed(2)),
                    profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
                };
            })
        );

        const totalChange = totalHoldingsValue - totalHoldingsCost;
        const totalChangePercent = totalHoldingsCost === 0 ? 0 : (totalChange / totalHoldingsCost) * 100;
        const currentCashBalance = portfolio.cashBalance !== undefined ? portfolio.cashBalance : 10000.00;


        res.json({
            cashBalance: parseFloat(currentCashBalance.toFixed(2)),
            totalValue: parseFloat((totalHoldingsValue + currentCashBalance).toFixed(2)),
            totalChange: parseFloat(totalChange.toFixed(2)),
            totalChangePercent: parseFloat(totalChangePercent.toFixed(2)),
            holdings: holdingsWithPrices,
        });

    } catch (err) {
        console.error('Server Error in DELETE /api/portfolio/remove:', err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;