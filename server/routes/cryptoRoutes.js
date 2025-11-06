// server/routes/cryptoRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Assuming this path is correct

// CRITICAL FIX: Import the controller object and access the function by name
const cryptoController = require('../controllers/cryptoController'); 

// NEW: Debugging middleware specific to the stockRoutes router
router.use((req, res, next) => {
    console.log(`[STOCKROUTES DEBUG] Stock Router activated. Base URL: ${req.baseUrl}, Path: ${req.path}`);
    next();
});


// @route   GET /api/crypto/historical/:symbol
// @desc    Get historical crypto data
// @access  Private
// Ensure you use the imported controller object and the function name:
router.get('/historical/:symbol', auth, cryptoController.getCryptoHistoricalData); 


module.exports = router;