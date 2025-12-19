const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
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

            // Hash the key for storage using HMAC with secret (don't store plain text!)
            // Using HMAC instead of plain SHA-256 for better security
            const hmacSecret = process.env.API_KEY_SECRET || process.env.JWT_SECRET;
            const hashedKey = crypto
                .createHmac('sha256', hmacSecret)
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

const Backtest = require('../models/Backtest');
const BacktestEngine = require('../services/backtestEngine');

const STRATEGY_MAP = {
    'ma-crossover': 'Moving Average Crossover',
    'rsi-reversal': 'RSI Reversal',
    'macd-crossover': 'MACD Crossover',
    'bollinger-bands': 'Bollinger Bands',
    'breakout': 'Breakout Strategy',
    'mean-reversion': 'Mean Reversion'
};

// POST create and run backtest
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
                initialCapital = 10000,
                parameters = {}
            } = req.body;

            // Validate input
            if (!strategy || !symbol || !startDate || !endDate) {
                return res.status(400).json({
                    error: 'Strategy, symbol, start date, and end date are required'
                });
            }

            // Validate strategy
            if (!STRATEGY_MAP[strategy]) {
                return res.status(400).json({ error: 'Invalid strategy' });
            }

            // Create backtest record
            const backtest = new Backtest({
                user: req.user.id,
                strategy,
                symbol: symbol.toUpperCase(),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                initialCapital,
                parameters,
                status: 'running'
            });
            await backtest.save();

            // Run backtest asynchronously
            const engine = new BacktestEngine();

            try {
                const result = await engine.runBacktest({
                    symbol: symbol.toUpperCase(),
                    strategy,
                    startDate,
                    endDate,
                    initialCapital,
                    parameters
                });

                // Update backtest with results
                await backtest.complete(
                    result.results,
                    result.trades,
                    result.equityCurve,
                    result.monthlyPerformance
                );

                res.json({
                    success: true,
                    backtest: {
                        _id: backtest._id,
                        strategy: STRATEGY_MAP[strategy],
                        symbol: backtest.symbol,
                        status: 'completed',
                        results: result.results,
                        tradesCount: result.trades.length,
                        dataPoints: result.dataPoints
                    },
                    message: 'Backtest completed successfully'
                });
            } catch (btError) {
                await backtest.fail(btError.message);
                res.status(400).json({
                    success: false,
                    error: btError.message,
                    backtestId: backtest._id
                });
            }
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
            const backtest = await Backtest.findOne({
                _id: req.params.id,
                user: req.user.id
            });

            if (!backtest) {
                return res.status(404).json({ error: 'Backtest not found' });
            }

            res.json({
                _id: backtest._id,
                strategy: STRATEGY_MAP[backtest.strategy] || backtest.strategy,
                strategyId: backtest.strategy,
                symbol: backtest.symbol,
                startDate: backtest.startDate,
                endDate: backtest.endDate,
                initialCapital: backtest.initialCapital,
                parameters: backtest.parameters,
                status: backtest.status,
                error: backtest.error,
                results: backtest.results,
                trades: backtest.trades,
                equityCurve: backtest.equityCurve,
                monthlyPerformance: backtest.monthlyPerformance,
                createdAt: backtest.createdAt,
                completedAt: backtest.completedAt,
                processingTime: backtest.processingTime
            });
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
            const { limit = 20 } = req.query;
            const backtests = await Backtest.getUserBacktests(req.user.id, parseInt(limit));

            res.json(backtests.map(bt => ({
                _id: bt._id,
                strategy: STRATEGY_MAP[bt.strategy] || bt.strategy,
                strategyId: bt.strategy,
                symbol: bt.symbol,
                status: bt.status,
                totalReturn: bt.results?.totalReturnPercent,
                winRate: bt.results?.winRate,
                sharpeRatio: bt.results?.sharpeRatio,
                totalTrades: bt.results?.totalTrades,
                createdAt: bt.createdAt,
                completedAt: bt.completedAt
            })));
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
            const result = await Backtest.deleteOne({
                _id: req.params.id,
                user: req.user.id
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Backtest not found' });
            }

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

// GET best strategies for user
router.get('/strategies/performance',
    auth,
    requireFeature('hasBacktesting'),
    async (req, res) => {
        try {
            const performance = await Backtest.getBestStrategies(req.user.id);
            res.json(performance.map(p => ({
                strategy: STRATEGY_MAP[p._id] || p._id,
                strategyId: p._id,
                avgReturn: Math.round(p.avgReturn * 100) / 100,
                avgSharpe: Math.round(p.avgSharpe * 100) / 100,
                avgWinRate: Math.round(p.avgWinRate * 100) / 100,
                backtestCount: p.count
            })));
        } catch (error) {
            console.error('Error fetching strategy performance:', error);
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