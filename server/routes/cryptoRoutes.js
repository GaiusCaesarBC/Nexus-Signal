// server/routes/cryptoRoutes.js

const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // Ensure this path is correct
const { getCryptoHistoricalData } = require('../controllers/cryptoController'); // Ensure this path is correct AND function is exported

const router = express.Router();

// Route to get historical crypto data
// Protected, so only logged-in users can access
router.get('/historical/:symbol', protect, getCryptoHistoricalData); // This line is causing the error

module.exports = router;