// server/routes/brokerageRoutes.js - Brokerage Connection Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const BrokerageConnection = require('../models/BrokerageConnection');
const krakenService = require('../services/krakenService');
const plaidService = require('../services/plaidService');

// All routes require authentication
router.use(auth);

/**
 * GET /api/brokerage/connections
 * Get all brokerage connections for the user
 */
router.get('/connections', async (req, res) => {
    try {
        const connections = await BrokerageConnection.getByUser(req.user.id);

        // Don't expose sensitive data
        const safeConnections = connections.map(conn => ({
            id: conn._id,
            type: conn.type,
            name: conn.name,
            institution: conn.institution,
            status: conn.status,
            lastError: conn.lastError,
            lastSync: conn.lastSync,
            cachedPortfolio: conn.cachedPortfolio,
            createdAt: conn.createdAt
        }));

        res.json({
            success: true,
            connections: safeConnections
        });
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch connections' });
    }
});

/**
 * POST /api/brokerage/kraken/connect
 * Connect Kraken account with API credentials
 */
router.post('/kraken/connect', async (req, res) => {
    try {
        const { apiKey, apiSecret, name } = req.body;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({
                success: false,
                error: 'API key and secret are required'
            });
        }

        // Validate credentials
        const isValid = await krakenService.validateCredentials(apiKey, apiSecret);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid API credentials'
            });
        }

        // Check if connection already exists
        const existing = await BrokerageConnection.findOne({
            user: req.user.id,
            type: 'kraken'
        });

        if (existing) {
            // Update existing connection
            existing.credentials = { apiKey, apiSecret };
            existing.name = name || 'Kraken';
            existing.status = 'active';
            existing.lastError = null;
            await existing.save();

            // Fetch initial portfolio
            const portfolio = await krakenService.getPortfolioWithValues(apiKey, apiSecret);
            await existing.updateCache(portfolio);

            return res.json({
                success: true,
                message: 'Kraken connection updated',
                connection: {
                    id: existing._id,
                    type: 'kraken',
                    name: existing.name,
                    status: 'active',
                    cachedPortfolio: portfolio
                }
            });
        }

        // Create new connection
        const connection = new BrokerageConnection({
            user: req.user.id,
            type: 'kraken',
            name: name || 'Kraken',
            credentials: { apiKey, apiSecret },
            status: 'active'
        });

        await connection.save();

        // Fetch initial portfolio
        const portfolio = await krakenService.getPortfolioWithValues(apiKey, apiSecret);
        await connection.updateCache(portfolio);

        res.json({
            success: true,
            message: 'Kraken connected successfully',
            connection: {
                id: connection._id,
                type: 'kraken',
                name: connection.name,
                status: 'active',
                cachedPortfolio: portfolio
            }
        });
    } catch (error) {
        console.error('Error connecting Kraken:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/kraken/sync/:connectionId
 * Sync Kraken portfolio data
 */
router.get('/kraken/sync/:connectionId', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({
            _id: req.params.connectionId,
            user: req.user.id,
            type: 'kraken'
        });

        if (!connection) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }

        const apiKey = connection.getApiKey();
        const apiSecret = connection.getApiSecret();

        const portfolio = await krakenService.getPortfolioWithValues(apiKey, apiSecret);
        await connection.updateCache(portfolio);

        res.json({
            success: true,
            portfolio,
            lastSync: connection.lastSync
        });
    } catch (error) {
        console.error('Error syncing Kraken:', error);

        // Update connection status
        const connection = await BrokerageConnection.findById(req.params.connectionId);
        if (connection) {
            await connection.setError(error.message);
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/kraken/trades/:connectionId
 * Get Kraken trade history
 */
router.get('/kraken/trades/:connectionId', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({
            _id: req.params.connectionId,
            user: req.user.id,
            type: 'kraken'
        });

        if (!connection) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }

        const apiKey = connection.getApiKey();
        const apiSecret = connection.getApiSecret();

        const trades = await krakenService.getTradeHistory(apiKey, apiSecret);

        res.json({
            success: true,
            ...trades
        });
    } catch (error) {
        console.error('Error fetching Kraken trades:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/brokerage/plaid/link-token
 * Create Plaid Link token
 */
router.post('/plaid/link-token', async (req, res) => {
    try {
        const result = await plaidService.createLinkToken(req.user.id);

        res.json({
            success: true,
            linkToken: result.linkToken,
            expiration: result.expiration
        });
    } catch (error) {
        console.error('Error creating Plaid link token:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/brokerage/plaid/exchange
 * Exchange Plaid public token and create connection
 */
router.post('/plaid/exchange', async (req, res) => {
    try {
        const { publicToken, institutionId, institutionName } = req.body;

        if (!publicToken) {
            return res.status(400).json({
                success: false,
                error: 'Public token is required'
            });
        }

        // Exchange token
        const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);

        // Get item info
        const itemInfo = await plaidService.getItemInfo(accessToken);

        // Determine brokerage type from institution
        let brokerageType = 'plaid';
        const instNameLower = (institutionName || itemInfo.institution?.name || '').toLowerCase();
        if (instNameLower.includes('robinhood')) brokerageType = 'robinhood';
        else if (instNameLower.includes('webull')) brokerageType = 'webull';
        else if (instNameLower.includes('schwab')) brokerageType = 'schwab';

        // Create connection
        const connection = new BrokerageConnection({
            user: req.user.id,
            type: brokerageType,
            name: itemInfo.institution?.name || institutionName || 'Investment Account',
            institution: itemInfo.institution || {
                id: institutionId,
                name: institutionName
            },
            plaid: {
                accessToken,
                itemId
            },
            status: 'active'
        });

        await connection.save();

        // Fetch initial holdings
        const holdings = await plaidService.getHoldings(accessToken);

        // Format for cache
        const portfolioData = {
            holdings: holdings.holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                price: h.price,
                value: h.value,
                costBasis: h.costBasis,
                type: h.type
            })),
            totalValue: holdings.accounts.reduce((sum, acc) => sum + acc.totalValue, 0)
        };

        await connection.updateCache(portfolioData);

        res.json({
            success: true,
            message: `${connection.name} connected successfully`,
            connection: {
                id: connection._id,
                type: connection.type,
                name: connection.name,
                institution: connection.institution,
                status: 'active',
                accounts: holdings.accounts
            }
        });
    } catch (error) {
        console.error('Error exchanging Plaid token:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/plaid/sync/:connectionId
 * Sync Plaid connection holdings
 */
router.get('/plaid/sync/:connectionId', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({
            _id: req.params.connectionId,
            user: req.user.id
        });

        if (!connection) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }

        const accessToken = connection.getPlaidAccessToken();
        const holdings = await plaidService.getHoldings(accessToken);

        // Format for cache
        const portfolioData = {
            holdings: holdings.holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                price: h.price,
                value: h.value,
                costBasis: h.costBasis,
                type: h.type
            })),
            totalValue: holdings.accounts.reduce((sum, acc) => sum + acc.totalValue, 0)
        };

        await connection.updateCache(portfolioData);

        res.json({
            success: true,
            holdings: holdings.holdings,
            accounts: holdings.accounts,
            lastSync: connection.lastSync
        });
    } catch (error) {
        console.error('Error syncing Plaid connection:', error);

        const connection = await BrokerageConnection.findById(req.params.connectionId);
        if (connection) {
            await connection.setError(error.message);
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/plaid/transactions/:connectionId
 * Get Plaid investment transactions
 */
router.get('/plaid/transactions/:connectionId', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const connection = await BrokerageConnection.findOne({
            _id: req.params.connectionId,
            user: req.user.id
        });

        if (!connection) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }

        const accessToken = connection.getPlaidAccessToken();
        const transactions = await plaidService.getInvestmentTransactions(
            accessToken,
            startDate,
            endDate
        );

        res.json({
            success: true,
            ...transactions
        });
    } catch (error) {
        console.error('Error fetching Plaid transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/brokerage/disconnect/:connectionId
 * Disconnect a brokerage connection
 */
router.delete('/disconnect/:connectionId', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({
            _id: req.params.connectionId,
            user: req.user.id
        });

        if (!connection) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }

        // If Plaid connection, remove the item
        if (connection.plaid?.accessToken) {
            try {
                const accessToken = connection.getPlaidAccessToken();
                await plaidService.removeItem(accessToken);
            } catch (e) {
                console.error('Error removing Plaid item:', e.message);
            }
        }

        // If Kraken, clear the cache
        if (connection.type === 'kraken' && connection.credentials?.apiKey) {
            const apiKey = connection.getApiKey();
            krakenService.clearCache(apiKey);
        }

        await connection.deleteOne();

        res.json({
            success: true,
            message: 'Connection removed successfully'
        });
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/portfolio
 * Get aggregated portfolio from all connections
 */
router.get('/portfolio', async (req, res) => {
    try {
        const connections = await BrokerageConnection.getActiveByUser(req.user.id);

        const aggregatedHoldings = [];
        let totalValue = 0;

        for (const conn of connections) {
            if (conn.cachedPortfolio?.holdings) {
                for (const holding of conn.cachedPortfolio.holdings) {
                    aggregatedHoldings.push({
                        ...holding,
                        source: conn.type,
                        sourceName: conn.name,
                        connectionId: conn._id
                    });
                    totalValue += holding.value || 0;
                }
            }
        }

        // Group by symbol
        const groupedHoldings = {};
        for (const holding of aggregatedHoldings) {
            const key = holding.symbol;
            if (!groupedHoldings[key]) {
                groupedHoldings[key] = {
                    symbol: holding.symbol,
                    name: holding.name,
                    type: holding.type,
                    totalQuantity: 0,
                    totalValue: 0,
                    avgPrice: 0,
                    sources: []
                };
            }
            groupedHoldings[key].totalQuantity += holding.quantity || 0;
            groupedHoldings[key].totalValue += holding.value || 0;
            groupedHoldings[key].sources.push({
                source: holding.source,
                sourceName: holding.sourceName,
                quantity: holding.quantity,
                value: holding.value
            });
        }

        // Calculate average prices
        for (const symbol in groupedHoldings) {
            const h = groupedHoldings[symbol];
            h.avgPrice = h.totalQuantity > 0 ? h.totalValue / h.totalQuantity : 0;
        }

        res.json({
            success: true,
            holdings: Object.values(groupedHoldings).sort((a, b) => b.totalValue - a.totalValue),
            totalValue,
            connectionCount: connections.length,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching aggregated portfolio:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/brokerage/sync-all
 * Sync all connections
 */
router.post('/sync-all', async (req, res) => {
    try {
        const connections = await BrokerageConnection.getByUser(req.user.id);
        const results = [];

        for (const conn of connections) {
            try {
                if (conn.type === 'kraken') {
                    const apiKey = conn.getApiKey();
                    const apiSecret = conn.getApiSecret();
                    const portfolio = await krakenService.getPortfolioWithValues(apiKey, apiSecret);
                    await conn.updateCache(portfolio);
                    results.push({ id: conn._id, type: conn.type, status: 'success' });
                } else if (conn.plaid?.accessToken) {
                    const accessToken = conn.getPlaidAccessToken();
                    const holdings = await plaidService.getHoldings(accessToken);
                    const portfolioData = {
                        holdings: holdings.holdings.map(h => ({
                            symbol: h.symbol,
                            name: h.name,
                            quantity: h.quantity,
                            price: h.price,
                            value: h.value,
                            costBasis: h.costBasis,
                            type: h.type
                        })),
                        totalValue: holdings.accounts.reduce((sum, acc) => sum + acc.totalValue, 0)
                    };
                    await conn.updateCache(portfolioData);
                    results.push({ id: conn._id, type: conn.type, status: 'success' });
                }
            } catch (err) {
                console.error(`Error syncing ${conn.type}:`, err.message);
                await conn.setError(err.message);
                results.push({ id: conn._id, type: conn.type, status: 'error', error: err.message });
            }
        }

        res.json({
            success: true,
            results,
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error syncing all connections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
