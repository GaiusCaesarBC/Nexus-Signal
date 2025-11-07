// server/routes/stockRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Assuming this path is correct

// Import the controller function
const { getHistoricalData } = require('../controllers/stockController'); 

// NEW: Debugging middleware specific to the stockRoutes router
router.use((req, res, next) => {
    console.log(`[STOCKROUTES DEBUG] Stock Router activated. Base URL: ${req.baseUrl}, Path: ${req.path}`);
    next();
});


// @route   GET /api/stocks/historical/:symbol
// @desc    Get historical stock data for a given symbol and range
// @access  Private
// The controller function now handles all the logic.
router.get('/historical/:symbol', auth, getHistoricalData);


module.exports = router;