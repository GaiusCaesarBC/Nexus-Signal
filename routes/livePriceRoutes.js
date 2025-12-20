// routes/livePriceRoutes.js - SSE endpoint for real-time price streaming

const express = require('express');
const router = express.Router();
const { subscribeSSE, unsubscribeSSE, getCurrentPrice } = require('../services/websocketPriceService');

// @route   GET /api/live-price/:symbol
// @desc    SSE endpoint for live price streaming
// @access  Public
router.get('/:symbol', (req, res) => {
    const { symbol } = req.params;

    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    const upperSymbol = symbol.toUpperCase();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', symbol: upperSymbol })}\n\n`);

    // Subscribe to price updates
    subscribeSSE(upperSymbol, res);

    // Handle client disconnect
    req.on('close', () => {
        unsubscribeSSE(upperSymbol, res);
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch (error) {
            clearInterval(heartbeat);
        }
    }, 30000); // Every 30 seconds

    // Clear heartbeat on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
    });
});

// @route   GET /api/live-price/current/:symbol
// @desc    Get current cached price (non-streaming)
// @access  Public
router.get('/current/:symbol', (req, res) => {
    const { symbol } = req.params;

    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    const price = getCurrentPrice(symbol.toUpperCase());

    if (price) {
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            price,
            timestamp: Date.now()
        });
    } else {
        res.json({
            success: false,
            symbol: symbol.toUpperCase(),
            price: null,
            message: 'No cached price available'
        });
    }
});

module.exports = router;
