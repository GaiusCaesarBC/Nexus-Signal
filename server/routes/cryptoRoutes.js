// server/routes/cryptoRoutes.js

const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // Assuming you want to protect this route
const { getCryptoHistoricalData } = require('../controllers/cryptoController');

const router = express.Router();

// Route to get historical crypto data
// Protected, so only logged-in users can access
router.get('/historical/:symbol', protect, getCryptoHistoricalData);

module.exports = router;