// server/routes/portfolioRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authMiddleware'); // Your authentication middleware

const Portfolio = require('../models/Portfolio'); // Portfolio model

// Helper to fetch current prices (reusing existing logic or a new dedicated service)
// For now, this is a placeholder. In a real app, you'd integrate Alpha Vantage, CoinGecko, etc.
const getMarketPrice = async (symbol) => {
    // This is a placeholder. You need to integrate your actual API calls here.
    // For demonstration, let's return a simple mock price.
    // In a real application, you would call Alpha Vantage for stocks, CoinGecko for crypto.
    // You might also cache these prices to avoid hitting API limits.

    // Example mock logic:
    const mockPrices = {
        'AAPL': 175.00,
        'MSFT': 420.00,
        'GOOG': 150.00,
        'BTC': 65000.00,
        'ETH': 3200.00,
        'AMZN': 180.00,
        'NVDA': 900.00,
        'TSLA': 170.00,
        // Add more mock prices as needed
    };
    return mockPrices[symbol.toUpperCase()] || (Math.random() * 100 + 10); // Random price if not found
};


// @route   GET api/portfolio
// @desc    Get user's entire portfolio with calculated current values
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let portfolio = await Portfolio.findOne({ user: req.user.id });

        if (!portfolio) {
            // If no portfolio exists, return an empty one
            return res.json({ holdings: [], totalValue: 0, totalProfitLoss: 0, totalProfitLossPercentage: 0 });
        }

        let totalValue = 0;
        let totalCost = 0;

        // Calculate current value and P&L for each holding
        const updatedHoldings = await Promise.all(
            portfolio.holdings.map(async (holding) => {
                const currentPrice = await getMarketPrice(holding.symbol);
                const currentValue = holding.quantity * currentPrice;
                const costBasis = holding.quantity * holding.purchasePrice;
                const profitLoss = currentValue - costBasis;
                const profitLossPercentage = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                totalValue += currentValue;
                totalCost += costBasis;

                return {
                    ...holding.toObject(), // Convert Mongoose sub-document to plain object
                    currentPrice: parseFloat(currentPrice.toFixed(2)),
                    currentValue: parseFloat(currentValue.toFixed(2)),
                    profitLoss: parseFloat(profitLoss.toFixed(2)),
                    profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
                };
            })
        );

        const totalProfitLoss = totalValue - totalCost;
        const totalProfitLossPercentage = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

        res.json({
            holdings: updatedHoldings,
            totalValue: parseFloat(totalValue.toFixed(2)),
            totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
            totalProfitLossPercentage: parseFloat(totalProfitLossPercentage.toFixed(2))
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
                // Mark holdings array as modified for Mongoose change tracking
                portfolio.markModified('holdings');
            } else {
                // No portfolio, create a new one with this holding
                portfolio = new Portfolio({
                    user: req.user.id,
                    holdings: [newHolding]
                });
            }

            await portfolio.save();
            // Respond with the full portfolio including calculations
            const response = await (await Portfolio.findOne({ user: req.user.id })).populate('holdings'); // Re-fetch to apply calculations
            res.json(response); // We'll re-calculate on the client side after this for simplicity

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

            // Mark holdings array as modified
            portfolio.markModified('holdings');
            await portfolio.save();

            // Respond with the full portfolio including calculations
            res.json(portfolio); // We'll re-calculate on the client side after this for simplicity

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

        // Filter out the holding to be removed
        const initialLength = portfolio.holdings.length;
        portfolio.holdings = portfolio.holdings.filter(
            (holding) => holding._id.toString() !== req.params.holding_id
        );

        if (portfolio.holdings.length === initialLength) {
            return res.status(404).json({ msg: 'Holding not found in portfolio' });
        }

        portfolio.markModified('holdings'); // Mark as modified
        await portfolio.save();

        res.json({ msg: 'Holding removed from portfolio', portfolio }); // Return updated portfolio

    } catch (err) {
        console.error('Server Error in DELETE /api/portfolio/remove:', err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;