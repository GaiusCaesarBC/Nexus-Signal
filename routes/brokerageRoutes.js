// server/routes/brokerageRoutes.js - Brokerage Connection Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const BrokerageConnection = require('../models/BrokerageConnection');
const BrokeragePortfolioHistory = require('../models/BrokeragePortfolioHistory');
const krakenService = require('../services/krakenService');
const plaidService = require('../services/plaidService');
const ManualHolding = require('../models/ManualHolding');
const priceService = require('../services/priceService');

// ============================================
// NOTE: Plaid webhook is now defined in app.js with proper signature verification
// It must be before body parsing middleware for raw body access
// ============================================

// All remaining routes require authentication
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
 * POST /api/brokerage/test-schwab
 * Test Charles Schwab connection without saving to database
 * Use this to debug connection issues
 * 
 * Body: { publicToken }
 * 
 * STEP-BY-STEP:
 * 1. Hit POST /api/brokerage/plaid/link-token
 * 2. User completes Plaid Link flow and selects Charles Schwab
 * 3. After selecting Schwab, Plaid returns publicToken
 * 4. Send publicToken here to test the connection
 */
router.post('/test-schwab', async (req, res) => {
    try {
        const { publicToken } = req.body;

        if (!publicToken) {
            return res.status(400).json({
                success: false,
                error: 'publicToken is required',
                instructions: {
                    step_1: 'POST /api/brokerage/plaid/link-token to get link token',
                    step_2: 'Open frontend Plaid Link component and user selects Charles Schwab',
                    step_3: 'After selecting Schwab, Plaid returns publicToken to your app',
                    step_4: 'Call this endpoint with that publicToken to test connection'
                }
            });
        }

        console.log('\n🧪 TESTING CHARLES SCHWAB CONNECTION...\n');

        // Step 1: Exchange token
        console.log('STEP 1: Exchanging Plaid public token...');
        let accessToken, itemId;
        try {
            const result = await plaidService.exchangePublicToken(publicToken);
            accessToken = result.accessToken;
            itemId = result.itemId;
            console.log('✅ Token exchanged successfully');
            console.log('   Item ID:', itemId);
        } catch (tokenErr) {
            console.error('❌ Token exchange failed');
            console.error('   Error:', tokenErr.message);
            return res.status(400).json({
                success: false,
                step: 1,
                stepName: 'Token Exchange',
                error: tokenErr.message,
                details: tokenErr.response?.data || {}
            });
        }

        // Step 2: Get item info
        console.log('\nSTEP 2: Getting Plaid item info (institution details)...');
        let itemInfo;
        try {
            itemInfo = await plaidService.getItemInfo(accessToken);
            console.log('✅ Item info retrieved');
            console.log('   Institution:', itemInfo.institution?.name);
        } catch (infoErr) {
            console.error('❌ Failed to get item info');
            console.error('   Error:', infoErr.message);
            return res.status(400).json({
                success: false,
                step: 2,
                stepName: 'Get Item Info',
                error: infoErr.message,
                details: infoErr.response?.data || {}
            });
        }

        // Step 3: Get holdings - THIS IS WHERE IT USUALLY FAILS FOR SCHWAB
        console.log('\nSTEP 3: Fetching investment holdings from Schwab...');
        let holdings;
        try {
            holdings = await plaidService.getHoldings(accessToken);
            console.log('✅ Holdings retrieved successfully');
            console.log('   Accounts:', holdings.accounts?.length || 0);
            console.log('   Holdings items:', holdings.holdings?.length || 0);
        } catch (holdingsErr) {
            console.error('❌ Failed to get holdings - THIS IS THE ACTUAL ERROR');
            console.error('   Error message:', holdingsErr.message);
            
            if (holdingsErr.response?.data) {
                console.error('   Plaid error details:', JSON.stringify(holdingsErr.response.data, null, 2));
            }
            
            return res.status(400).json({
                success: false,
                step: 3,
                stepName: 'Get Holdings',
                error: holdingsErr.message,
                plaidErrorDetails: holdingsErr.response?.data || {},
                troubleshooting: [
                    'Charles Schwab might not support "Investments" product in your Plaid plan',
                    'You may need to contact Plaid support to enable Schwab access',
                    'Try connecting a different brokerage to verify your Plaid setup works',
                    'Check your Plaid Dashboard to see if Investments product is enabled'
                ]
            });
        }

        // Success!
        console.log('\n✅ ALL STEPS PASSED - CHARLES SCHWAB CONNECTION WORKS!\n');

        res.json({
            success: true,
            message: 'Charles Schwab connection test passed',
            institution: itemInfo.institution,
            accounts: holdings.accounts.map(acc => ({
                id: acc.id,
                name: acc.name,
                type: acc.type,
                subtype: acc.subtype,
                balances: acc.balances,
                totalValue: acc.totalValue
            })),
            totalHoldings: holdings.holdings.length
        });

    } catch (error) {
        console.error('❌ UNEXPECTED ERROR:', error);
        res.status(500).json({
            success: false,
            error: 'Unexpected error during test',
            message: error.message
        });
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
        console.error('❌ ERROR EXCHANGING PLAID TOKEN:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        
        // If Plaid error, show details
        if (error.response?.data) {
            console.error('   Plaid Error Details:', JSON.stringify(error.response.data, null, 2));
        }
        
        // Provide detailed error to frontend
        let errorMessage = error.message;
        let errorCode = 'UNKNOWN_ERROR';
        
        if (error.response?.data?.error_code) {
            errorCode = error.response.data.error_code;
            errorMessage = error.response.data.error_message || error.message;
        }
        
        // Map specific errors to user-friendly messages
        const isSchwab = (institutionName || '').toLowerCase().includes('schwab');
        const schwabHint = isSchwab ? ' Charles Schwab may require additional Plaid configuration — try Robinhood, Webull, or E*TRADE as an alternative.' : '';

        const errorMap = {
            'INVALID_REQUEST': 'Invalid request to Plaid - check that all fields are correct',
            'INVALID_BODY': 'The account connection data format is invalid',
            'INSTITUTION_ERROR': `This institution's connection is not available or requires additional setup.${schwabHint}`,
            'RATE_LIMIT_EXCEEDED': 'Too many connection attempts - please wait and try again',
            'INVALID_CREDENTIALS': 'The provided credentials are invalid',
            'MISSING_FIELDS': 'Missing required fields from Plaid',
            'SOCKET_TIMEOUT': `Connection timed out - please try again.${schwabHint}`,
            'INVALID_ACCOUNT': 'The account could not be verified',
            'INSTITUTION_NOT_FOUND': `This institution is not currently supported.${schwabHint}`,
            'INSTITUTION_DOWN': `This institution is temporarily unavailable. Please try again later.${schwabHint}`,
            'PRODUCT_NOT_READY': `Investment data is not yet available for this institution.${schwabHint}`,
        };

        const friendlyMessage = errorMap[errorCode] || errorMessage;
        
        console.error('   Error code:', errorCode);
        console.error('   User message:', friendlyMessage);
        
        res.status(400).json({ 
            success: false, 
            error: friendlyMessage,
            errorCode: errorCode,
            details: error.response?.data || { message: error.message }
        });
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

        // If Plaid connection, try to remove the item (but don't fail if decryption fails)
        if (connection.plaid?.accessToken) {
            try {
                const accessToken = connection.getPlaidAccessToken();
                await plaidService.removeItem(accessToken);
            } catch (e) {
                console.error('Error removing Plaid item (may be decryption issue):', e.message);
                // Continue with deletion anyway
            }
        }

        // If Kraken, try to clear the cache (but don't fail if decryption fails)
        if (connection.type === 'kraken' && connection.credentials?.apiKey) {
            try {
                const apiKey = connection.getApiKey();
                krakenService.clearCache(apiKey);
            } catch (e) {
                console.error('Error clearing Kraken cache (may be decryption issue):', e.message);
                // Continue with deletion anyway
            }
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

        // After syncing all connections, update portfolio history with fresh total
        const successfulSyncs = results.filter(r => r.status === 'success');
        if (successfulSyncs.length > 0) {
            try {
                // Re-fetch connections to get updated cached values
                const updatedConnections = await BrokerageConnection.getByUser(req.user.id);
                let totalValue = 0;
                let holdingsCount = 0;
                for (const conn of updatedConnections) {
                    if (conn.cachedPortfolio) {
                        totalValue += conn.cachedPortfolio.totalValue || 0;
                        holdingsCount += (conn.cachedPortfolio.holdings || []).length;
                    }
                }
                if (totalValue > 0) {
                    await BrokeragePortfolioHistory.trackValue(req.user.id, totalValue, holdingsCount);
                    console.log(`[Sync] Updated portfolio history for user ${req.user.id}: $${totalValue.toFixed(2)}`);
                }
            } catch (historyErr) {
                console.error('[Sync] Failed to update portfolio history:', historyErr.message);
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

// ============================================
// PORTFOLIO HISTORY TRACKING ROUTES
// ============================================

/**
 * GET /api/brokerage/portfolio-history
 * Get user's portfolio history and gain/loss stats
 */
router.get('/portfolio-history', async (req, res) => {
    try {
        const history = await BrokeragePortfolioHistory.findOne({ user: req.user.id });

        if (!history) {
            return res.json({
                success: true,
                history: null,
                message: 'No portfolio history yet. Connect a brokerage to start tracking.'
            });
        }

        res.json({
            success: true,
            history: history.getSummary()
        });
    } catch (error) {
        console.error('Error fetching portfolio history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/brokerage/portfolio-history/track
 * Track current portfolio value (called by frontend on sync)
 */
router.post('/portfolio-history/track', async (req, res) => {
    try {
        const { totalValue, holdingsCount } = req.body;

        if (totalValue === undefined || totalValue === null) {
            return res.status(400).json({ success: false, error: 'totalValue is required' });
        }

        const history = await BrokeragePortfolioHistory.trackValue(
            req.user.id,
            parseFloat(totalValue),
            holdingsCount || 0
        );

        res.json({
            success: true,
            history: history.getSummary()
        });
    } catch (error) {
        console.error('Error tracking portfolio value:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/brokerage/portfolio-history/reset
 * Reset portfolio history (set current value as new initial value)
 */
router.post('/portfolio-history/reset', async (req, res) => {
    try {
        let history = await BrokeragePortfolioHistory.findOne({ user: req.user.id });

        if (!history) {
            return res.status(404).json({ success: false, error: 'No portfolio history found' });
        }

        // Reset initial value to current value
        history.initialValue = history.currentValue;
        history.initialDate = new Date();
        history.totalGain = 0;
        history.totalGainPercent = 0;
        history.snapshots = [];
        history.allTimeHigh = { value: history.currentValue, date: new Date() };
        history.allTimeLow = { value: history.currentValue, date: new Date() };
        await history.save();

        res.json({
            success: true,
            message: 'Portfolio history reset successfully',
            history: history.getSummary()
        });
    } catch (error) {
        console.error('Error resetting portfolio history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/brokerage/portfolio-history/snapshots
 * Get historical snapshots for charting
 */
router.get('/portfolio-history/snapshots', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const history = await BrokeragePortfolioHistory.findOne({ user: req.user.id });

        if (!history) {
            return res.json({ success: true, snapshots: [] });
        }

        const cutoffDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
        const snapshots = history.snapshots
            .filter(s => s.timestamp > cutoffDate)
            .map(s => ({
                value: s.value,
                holdingsCount: s.holdingsCount,
                timestamp: s.timestamp
            }));

        res.json({
            success: true,
            snapshots,
            initialValue: history.initialValue,
            currentValue: history.currentValue
        });
    } catch (error) {
        console.error('Error fetching portfolio snapshots:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MANUAL PORTFOLIO ROUTES
// ============================================

/**
 * POST /api/brokerage/manual/connect
 * Create a manual portfolio connection
 */
router.post('/manual/connect', async (req, res) => {
    try {
        // Check if user already has a manual connection
        const existing = await BrokerageConnection.findOne({ user: req.user.id, type: 'manual' });
        if (existing) {
            return res.json({ success: true, connection: { id: existing._id, type: 'manual', status: existing.status } });
        }

        const connection = await BrokerageConnection.create({
            user: req.user.id,
            type: 'manual',
            name: 'Manual Portfolio',
            status: 'active',
            cachedPortfolio: { holdings: [], totalValue: 0, lastUpdated: new Date() }
        });

        res.json({
            success: true,
            connection: { id: connection._id, type: 'manual', status: 'active' }
        });
    } catch (error) {
        console.error('Error creating manual connection:', error);
        res.status(500).json({ success: false, error: 'Failed to create manual portfolio' });
    }
});

/**
 * GET /api/brokerage/manual/holdings
 * Get all manual holdings for the user
 */
router.get('/manual/holdings', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({ user: req.user.id, type: 'manual' });
        if (!connection) {
            return res.json({ success: true, holdings: [], totalValue: 0, totalGainLoss: 0, totalGainLossPercent: 0 });
        }

        const holdings = await ManualHolding.getByConnection(connection._id);

        const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
        const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.costBasis), 0);
        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

        res.json({
            success: true,
            connectionId: connection._id,
            holdings: holdings.map(h => ({
                id: h._id,
                symbol: h.symbol,
                name: h.name,
                assetType: h.assetType,
                quantity: h.quantity,
                costBasis: h.costBasis,
                currentPrice: h.currentPrice,
                currentValue: h.currentValue,
                gainLoss: h.gainLoss,
                gainLossPercent: h.gainLossPercent,
                dateAdded: h.dateAdded,
                lastPriceUpdate: h.lastPriceUpdate
            })),
            totalValue,
            totalCost,
            totalGainLoss,
            totalGainLossPercent
        });
    } catch (error) {
        console.error('Error fetching manual holdings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch holdings' });
    }
});

/**
 * POST /api/brokerage/manual/holdings
 * Add a new manual holding
 */
router.post('/manual/holdings', async (req, res) => {
    try {
        const { symbol, name, assetType, quantity, costBasis, dateAdded } = req.body;

        if (!symbol || quantity == null || costBasis == null) {
            return res.status(400).json({ success: false, error: 'Symbol, quantity, and cost basis are required' });
        }
        if (quantity <= 0 || costBasis < 0) {
            return res.status(400).json({ success: false, error: 'Quantity must be positive and cost basis non-negative' });
        }

        // Get or create manual connection
        let connection = await BrokerageConnection.findOne({ user: req.user.id, type: 'manual' });
        if (!connection) {
            connection = await BrokerageConnection.create({
                user: req.user.id,
                type: 'manual',
                name: 'Manual Portfolio',
                status: 'active',
                cachedPortfolio: { holdings: [], totalValue: 0, lastUpdated: new Date() }
            });
        }

        const cleanSymbol = symbol.toUpperCase().trim();

        // Fetch current price
        let currentPrice = 0;
        try {
            const priceResult = await priceService.getCurrentPrice(cleanSymbol, assetType || null);
            currentPrice = priceResult?.price || 0;
        } catch (priceErr) {
            console.warn(`[Manual] Could not fetch price for ${cleanSymbol}:`, priceErr.message);
        }

        const holding = await ManualHolding.create({
            user: req.user.id,
            connection: connection._id,
            symbol: cleanSymbol,
            name: name || cleanSymbol,
            assetType: assetType || 'stock',
            quantity: parseFloat(quantity),
            costBasis: parseFloat(costBasis),
            currentPrice,
            currentValue: parseFloat(quantity) * currentPrice,
            gainLoss: (parseFloat(quantity) * currentPrice) - (parseFloat(quantity) * parseFloat(costBasis)),
            gainLossPercent: parseFloat(costBasis) > 0
                ? (((currentPrice - parseFloat(costBasis)) / parseFloat(costBasis)) * 100)
                : 0,
            dateAdded: dateAdded || new Date(),
            lastPriceUpdate: currentPrice > 0 ? new Date() : null
        });

        // Update cached portfolio on connection
        await _updateManualConnectionCache(connection._id, req.user.id);

        res.json({
            success: true,
            holding: {
                id: holding._id,
                symbol: holding.symbol,
                name: holding.name,
                assetType: holding.assetType,
                quantity: holding.quantity,
                costBasis: holding.costBasis,
                currentPrice: holding.currentPrice,
                currentValue: holding.currentValue,
                gainLoss: holding.gainLoss,
                gainLossPercent: holding.gainLossPercent,
                dateAdded: holding.dateAdded
            }
        });
    } catch (error) {
        console.error('Error adding manual holding:', error);
        res.status(500).json({ success: false, error: 'Failed to add holding' });
    }
});

/**
 * PUT /api/brokerage/manual/holdings/:holdingId
 * Edit a manual holding
 */
router.put('/manual/holdings/:holdingId', async (req, res) => {
    try {
        const { holdingId } = req.params;
        const { quantity, costBasis, name, assetType } = req.body;

        const holding = await ManualHolding.findOne({ _id: holdingId, user: req.user.id });
        if (!holding) {
            return res.status(404).json({ success: false, error: 'Holding not found' });
        }

        if (quantity != null) {
            if (quantity <= 0) return res.status(400).json({ success: false, error: 'Quantity must be positive' });
            holding.quantity = parseFloat(quantity);
        }
        if (costBasis != null) {
            if (costBasis < 0) return res.status(400).json({ success: false, error: 'Cost basis must be non-negative' });
            holding.costBasis = parseFloat(costBasis);
        }
        if (name != null) holding.name = name;
        if (assetType != null) holding.assetType = assetType;

        // Recalculate with existing price
        holding.updatePrice(holding.currentPrice);
        await holding.save();

        // Update cached portfolio
        await _updateManualConnectionCache(holding.connection, req.user.id);

        res.json({
            success: true,
            holding: {
                id: holding._id,
                symbol: holding.symbol,
                name: holding.name,
                assetType: holding.assetType,
                quantity: holding.quantity,
                costBasis: holding.costBasis,
                currentPrice: holding.currentPrice,
                currentValue: holding.currentValue,
                gainLoss: holding.gainLoss,
                gainLossPercent: holding.gainLossPercent,
                dateAdded: holding.dateAdded
            }
        });
    } catch (error) {
        console.error('Error updating manual holding:', error);
        res.status(500).json({ success: false, error: 'Failed to update holding' });
    }
});

/**
 * DELETE /api/brokerage/manual/holdings/:holdingId
 * Remove a manual holding
 */
router.delete('/manual/holdings/:holdingId', async (req, res) => {
    try {
        const { holdingId } = req.params;
        const holding = await ManualHolding.findOne({ _id: holdingId, user: req.user.id });
        if (!holding) {
            return res.status(404).json({ success: false, error: 'Holding not found' });
        }

        const connectionId = holding.connection;
        await ManualHolding.deleteOne({ _id: holdingId });

        // Update cached portfolio
        await _updateManualConnectionCache(connectionId, req.user.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing manual holding:', error);
        res.status(500).json({ success: false, error: 'Failed to remove holding' });
    }
});

/**
 * POST /api/brokerage/manual/sync
 * Refresh prices for all manual holdings
 */
router.post('/manual/sync', async (req, res) => {
    try {
        const connection = await BrokerageConnection.findOne({ user: req.user.id, type: 'manual' });
        if (!connection) {
            return res.status(404).json({ success: false, error: 'No manual portfolio found' });
        }

        const holdings = await ManualHolding.getByConnection(connection._id);
        if (holdings.length === 0) {
            return res.json({ success: true, message: 'No holdings to sync', totalValue: 0 });
        }

        // Batch fetch prices
        const symbols = holdings.map(h => h.symbol);
        const prices = await priceService.getBatchPrices(symbols);

        // Update each holding
        for (const holding of holdings) {
            const price = prices.get(holding.symbol) || prices.get(holding.symbol.toUpperCase());
            if (price && price > 0) {
                holding.updatePrice(price);
                await holding.save();
            }
        }

        // Update connection cache and portfolio history
        const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
        await connection.updateCache({
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                price: h.currentPrice,
                value: h.currentValue,
                costBasis: h.costBasis,
                type: h.assetType
            })),
            totalValue
        });

        // Update portfolio history for leaderboard
        if (totalValue > 0) {
            await BrokeragePortfolioHistory.trackValue(req.user.id, totalValue, holdings.length);
        }

        res.json({
            success: true,
            totalValue,
            holdingsUpdated: holdings.length,
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error syncing manual holdings:', error);
        res.status(500).json({ success: false, error: 'Failed to sync prices' });
    }
});

/**
 * Helper: Update the manual connection's cached portfolio
 */
async function _updateManualConnectionCache(connectionId, userId) {
    try {
        const holdings = await ManualHolding.find({ connection: connectionId });
        const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
        const connection = await BrokerageConnection.findById(connectionId);
        if (connection) {
            await connection.updateCache({
                holdings: holdings.map(h => ({
                    symbol: h.symbol,
                    name: h.name,
                    quantity: h.quantity,
                    price: h.currentPrice,
                    value: h.currentValue,
                    costBasis: h.costBasis,
                    type: h.assetType
                })),
                totalValue
            });
        }
        // Update portfolio history
        if (totalValue > 0) {
            await BrokeragePortfolioHistory.trackValue(userId, totalValue, holdings.length);
        }
    } catch (err) {
        console.error('[Manual] Error updating connection cache:', err.message);
    }
}

module.exports = router;
