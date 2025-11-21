const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireFeature } = require('../middleware/subscriptionMiddleware');
const crypto = require('crypto');

// API KEY MANAGEMENT - ELITE ONLY

// GET user's API keys
router.get('/keys', 
    auth, 
    requireFeature('hasAPIAccess'), // Elite only
    async (req, res) => {
        try {
            // Your API key fetching logic
            const apiKeys = [
                {
                    id: '1',
                    name: 'Production Key',
                    key: 'sk_live_***************abc123', // Masked
                    created: new Date('2024-01-01'),
                    lastUsed: new Date(),
                    requestsToday: 523,
                    requestsThisMonth: 15670,
                    active: true
                },
                {
                    id: '2',
                    name: 'Development Key',
                    key: 'sk_test_***************xyz789',
                    created: new Date('2024-02-15'),
                    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
                    requestsToday: 89,
                    requestsThisMonth: 2341,
                    active: true
                }
            ];

            res.json(apiKeys);
        } catch (error) {
            console.error('Error fetching API keys:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// POST create new API key
router.post('/keys', 
    auth, 
    requireFeature('hasAPIAccess'),
    async (req, res) => {
        try {
            const { name, environment } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Key name is required' });
            }

            // Generate API key
            const prefix = environment === 'production' ? 'sk_live_' : 'sk_test_';
            const randomBytes = crypto.randomBytes(32).toString('hex');
            const apiKey = prefix + randomBytes;

            // Hash the key for storage (don't store plain text!)
            const hashedKey = crypto
                .createHash('sha256')
                .update(apiKey)
                .digest('hex');

            const newKey = {
                id: Date.now().toString(),
                name,
                keyHash: hashedKey,
                prefix: apiKey.substring(0, 15) + '...',
                environment,
                created: new Date(),
                active: true,
                requestsToday: 0,
                requestsThisMonth: 0
            };

            // IMPORTANT: Return the full key ONLY once!
            res.json({
                success: true,
                apiKey: apiKey, // Show full key only on creation
                keyInfo: newKey,
                warning: 'Save this key now! It will not be shown again.'
            });
        } catch (error) {
            console.error('Error creating API key:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// DELETE revoke API key
router.delete('/keys/:id', 
    auth, 
    requireFeature('hasAPIAccess'),
    async (req, res) => {
        try {
            // Your revoke logic here
            res.json({
                success: true,
                message: 'API key revoked'
            });
        } catch (error) {
            console.error('Error revoking API key:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET API usage statistics
router.get('/usage', 
    auth, 
    requireFeature('hasAPIAccess'),
    async (req, res) => {
        try {
            const { timeframe = 'month' } = req.query;

            const usage = {
                timeframe,
                totalRequests: 18011,
                successfulRequests: 17856,
                failedRequests: 155,
                successRate: 99.14,
                averageResponseTime: 245, // ms
                topEndpoints: [
                    { endpoint: '/api/v1/market/realtime', requests: 8523 },
                    { endpoint: '/api/v1/predictions', requests: 4231 },
                    { endpoint: '/api/v1/portfolio', requests: 3142 },
                    { endpoint: '/api/v1/alerts', requests: 2115 }
                ],
                requestsByDay: [
                    { date: '2024-11-15', requests: 512 },
                    { date: '2024-11-16', requests: 634 },
                    { date: '2024-11-17', requests: 589 },
                    { date: '2024-11-18', requests: 701 },
                    { date: '2024-11-19', requests: 523 }
                ]
            };

            res.json(usage);
        } catch (error) {
            console.error('Error fetching API usage:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// BACKTESTING - ELITE ONLY

// POST create backtest
router.post('/backtest', 
    auth, 
    requireFeature('hasBacktesting'), // Elite only
    async (req, res) => {
        try {
            const {
                strategy,
                symbol,
                startDate,
                endDate,
                initialCapital,
                parameters
            } = req.body;

            // Validate input
            if (!strategy || !symbol || !startDate || !endDate) {
                return res.status(400).json({ 
                    error: 'Strategy, symbol, start date, and end date are required' 
                });
            }

            // Create backtest job (this would run async)
            const backtest = {
                id: Date.now().toString(),
                user: req.user.id,
                strategy,
                symbol: symbol.toUpperCase(),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                initialCapital: initialCapital || 10000,
                parameters,
                status: 'running',
                createdAt: new Date()
            };

            // In reality, you'd queue this for processing
            // and return a job ID that can be polled

            res.json({
                success: true,
                backtest,
                message: 'Backtest started. Check status with GET /api/backtest/:id'
            });
        } catch (error) {
            console.error('Error creating backtest:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET backtest status and results
router.get('/backtest/:id', 
    auth, 
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            // Your backtest result fetching logic
            const backtest = {
                id: req.params.id,
                strategy: 'Moving Average Crossover',
                symbol: 'AAPL',
                startDate: '2024-01-01',
                endDate: '2024-11-19',
                status: 'completed',
                results: {
                    initialCapital: 10000,
                    finalValue: 12450,
                    totalReturn: 24.50,
                    annualizedReturn: 26.85,
                    sharpeRatio: 1.45,
                    maxDrawdown: -8.32,
                    winRate: 58.3,
                    totalTrades: 48,
                    profitableTrades: 28,
                    losingTrades: 20,
                    averageWin: 2.35,
                    averageLoss: -1.82,
                    largestWin: 8.45,
                    largestLoss: -5.23,
                    profitFactor: 1.62
                },
                trades: [
                    {
                        date: '2024-01-15',
                        type: 'buy',
                        price: 185.50,
                        shares: 50
                    },
                    {
                        date: '2024-01-28',
                        type: 'sell',
                        price: 192.30,
                        shares: 50,
                        profit: 340
                    }
                    // ... more trades
                ],
                performanceByMonth: [
                    { month: 'Jan', return: 3.2 },
                    { month: 'Feb', return: -1.5 },
                    { month: 'Mar', return: 4.8 },
                    // ... more months
                ],
                completedAt: new Date()
            };

            res.json(backtest);
        } catch (error) {
            console.error('Error fetching backtest:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET all user's backtests
router.get('/backtests', 
    auth, 
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            const backtests = [
                {
                    id: '1',
                    strategy: 'Moving Average Crossover',
                    symbol: 'AAPL',
                    status: 'completed',
                    totalReturn: 24.50,
                    createdAt: new Date('2024-11-01')
                },
                {
                    id: '2',
                    strategy: 'RSI Reversal',
                    symbol: 'TSLA',
                    status: 'completed',
                    totalReturn: -5.30,
                    createdAt: new Date('2024-11-10')
                },
                {
                    id: '3',
                    strategy: 'Breakout Strategy',
                    symbol: 'MSFT',
                    status: 'running',
                    totalReturn: null,
                    createdAt: new Date()
                }
            ];

            res.json(backtests);
        } catch (error) {
            console.error('Error fetching backtests:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// DELETE backtest
router.delete('/backtest/:id', 
    auth, 
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            // Your delete logic here
            res.json({
                success: true,
                message: 'Backtest deleted'
            });
        } catch (error) {
            console.error('Error deleting backtest:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET available strategies for backtesting
router.get('/strategies', 
    auth, 
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            const strategies = [
                {
                    id: 'ma-crossover',
                    name: 'Moving Average Crossover',
                    description: 'Buy when fast MA crosses above slow MA, sell when it crosses below',
                    parameters: [
                        { name: 'fastPeriod', type: 'number', default: 10 },
                        { name: 'slowPeriod', type: 'number', default: 30 }
                    ]
                },
                {
                    id: 'rsi-reversal',
                    name: 'RSI Reversal',
                    description: 'Buy when RSI is oversold, sell when overbought',
                    parameters: [
                        { name: 'period', type: 'number', default: 14 },
                        { name: 'oversold', type: 'number', default: 30 },
                        { name: 'overbought', type: 'number', default: 70 }
                    ]
                },
                {
                    id: 'breakout',
                    name: 'Breakout Strategy',
                    description: 'Buy on breakout above resistance, sell below support',
                    parameters: [
                        { name: 'lookbackPeriod', type: 'number', default: 20 },
                        { name: 'breakoutThreshold', type: 'number', default: 1.02 }
                    ]
                },
                {
                    id: 'mean-reversion',
                    name: 'Mean Reversion',
                    description: 'Buy when price is far below moving average, sell when above',
                    parameters: [
                        { name: 'period', type: 'number', default: 20 },
                        { name: 'stdDevs', type: 'number', default: 2 }
                    ]
                }
            ];

            res.json(strategies);
        } catch (error) {
            console.error('Error fetching strategies:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// POST optimize strategy parameters
router.post('/optimize', 
    auth, 
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            const { strategy, symbol, startDate, endDate, parameterRanges } = req.body;

            // This would run multiple backtests with different parameters
            // to find optimal values
            
            const optimization = {
                id: Date.now().toString(),
                strategy,
                symbol,
                status: 'running',
                testsToRun: 100,
                testsCompleted: 0,
                createdAt: new Date()
            };

            res.json({
                success: true,
                optimization,
                message: 'Optimization started. This may take several minutes.'
            });
        } catch (error) {
            console.error('Error starting optimization:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;