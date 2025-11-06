// server/routes/cryptoRoutes.js - COMPLETE & CORRECT IMPORT/USAGE

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Assuming this path is correct

// Import the entire controller object
const cryptoController = require('../controllers/cryptoController');

// Debugging middleware specific to this router (optional, but harmless)
router.use((req, res, next) => {
    console.log(`[CRYPTOROUTES DEBUG] Crypto Router activated. Base URL: ${req.baseUrl}, Path: ${req.path}`);
    next();
});

// @route   GET /api/crypto/historical/:symbol
// @desc    Get historical crypto data
// @access  Private
// Use the imported controller object and access the function by its property name
router.get('/historical/:symbol', auth, cryptoController.getCryptoHistoricalData);

module.exports = router;