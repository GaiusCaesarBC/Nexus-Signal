// server/routes/walletRoutes.js - Wallet Connection & Syncing Routes
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const axios = require('axios');
const tokenPriceService = require('../services/tokenPriceService');

// Chain explorer APIs for fetching transactions
const CHAIN_EXPLORERS = {
    1: { // Ethereum Mainnet
        name: 'Etherscan',
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY || ''
    },
    56: { // BSC
        name: 'BscScan',
        apiUrl: 'https://api.bscscan.com/api',
        apiKey: process.env.BSCSCAN_API_KEY || ''
    },
    137: { // Polygon
        name: 'PolygonScan',
        apiUrl: 'https://api.polygonscan.com/api',
        apiKey: process.env.POLYGONSCAN_API_KEY || ''
    }
};

/**
 * GET /api/wallet/linked
 * Get user's linked wallet info
 */
router.get('/linked', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!user.hasLinkedWallet()) {
            return res.json({
                success: true,
                wallet: null
            });
        }

        res.json({
            success: true,
            wallet: {
                address: user.wallet.address,
                chainId: user.wallet.chainId,
                linkedAt: user.wallet.linkedAt,
                lastSyncedAt: user.wallet.lastSyncedAt
            }
        });
    } catch (error) {
        console.error('Error fetching linked wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet info'
        });
    }
});

/**
 * POST /api/wallet/link
 * Link a wallet to user account (one wallet per user)
 */
router.post('/link', authMiddleware, async (req, res) => {
    try {
        const { address, chainId = 1 } = req.body;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }

        // Validate Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address format'
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user already has a linked wallet
        if (user.hasLinkedWallet()) {
            return res.status(400).json({
                success: false,
                error: 'You already have a linked wallet. Unlink it first.'
            });
        }

        // Link the wallet
        const wallet = await user.linkWallet(address, chainId);

        res.json({
            success: true,
            message: 'Wallet linked successfully',
            wallet: {
                address: wallet.address,
                chainId: wallet.chainId,
                linkedAt: wallet.linkedAt
            }
        });
    } catch (error) {
        console.error('Error linking wallet:', error);

        if (error.message.includes('already linked')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to link wallet'
        });
    }
});

/**
 * POST /api/wallet/unlink
 * Unlink wallet from user account
 */
router.post('/unlink', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!user.hasLinkedWallet()) {
            return res.status(400).json({
                success: false,
                error: 'No wallet linked to unlink'
            });
        }

        await user.unlinkWallet();

        res.json({
            success: true,
            message: 'Wallet unlinked successfully'
        });
    } catch (error) {
        console.error('Error unlinking wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unlink wallet'
        });
    }
});

/**
 * GET /api/wallet/trades
 * Get wallet transactions/trades (from blockchain explorers)
 */
router.get('/trades', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user || !user.hasLinkedWallet()) {
            return res.json({
                success: true,
                trades: []
            });
        }

        const { address, chainId } = user.wallet;
        const trades = await fetchWalletTrades(address, chainId);

        res.json({
            success: true,
            trades,
            walletAddress: address,
            chainId
        });
    } catch (error) {
        console.error('Error fetching wallet trades:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet trades',
            trades: []
        });
    }
});

/**
 * POST /api/wallet/sync
 * Sync wallet transactions to portfolio with real-time prices
 */
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user || !user.hasLinkedWallet()) {
            return res.status(400).json({
                success: false,
                error: 'No wallet linked'
            });
        }

        const { address, chainId } = user.wallet;

        // Fetch trades from blockchain
        const trades = await fetchWalletTrades(address, chainId);

        // Get or create portfolio
        const portfolio = await Portfolio.getOrCreate(user._id);

        // Process trades and update portfolio
        let tradesImported = 0;
        let holdingsUpdated = {};

        for (const trade of trades) {
            if (trade.type === 'transfer' && trade.tokenSymbol) {
                const symbol = trade.tokenSymbol.toUpperCase();

                if (!holdingsUpdated[symbol]) {
                    holdingsUpdated[symbol] = {
                        symbol,
                        contractAddress: trade.contractAddress,
                        quantity: 0,
                        totalCost: 0,
                        trades: []
                    };
                }

                // Track buys (incoming transfers)
                if (trade.to?.toLowerCase() === address.toLowerCase()) {
                    const amount = parseFloat(trade.value) / Math.pow(10, trade.tokenDecimal || 18);
                    holdingsUpdated[symbol].quantity += amount;
                    holdingsUpdated[symbol].trades.push({
                        type: 'buy',
                        amount,
                        timestamp: trade.timestamp,
                        hash: trade.hash
                    });
                    tradesImported++;
                }

                // Track sells (outgoing transfers)
                if (trade.from?.toLowerCase() === address.toLowerCase()) {
                    const amount = parseFloat(trade.value) / Math.pow(10, trade.tokenDecimal || 18);
                    holdingsUpdated[symbol].quantity -= amount;
                    holdingsUpdated[symbol].trades.push({
                        type: 'sell',
                        amount,
                        timestamp: trade.timestamp,
                        hash: trade.hash
                    });
                    tradesImported++;
                }
            }
        }

        // Filter to only positive balances
        const syncedHoldings = Object.values(holdingsUpdated).filter(h => h.quantity > 0.0001);

        // Fetch real-time prices for all tokens
        const tokenSymbols = syncedHoldings.map(h => h.symbol);
        const tokenIds = tokenSymbols.map(s => tokenPriceService.getTokenIdFromSymbol(s)).filter(Boolean);
        const prices = await tokenPriceService.getMultipleTokenPrices(tokenIds);

        // Enrich holdings with prices
        let totalValue = 0;
        const enrichedHoldings = syncedHoldings.map(holding => {
            const tokenId = tokenPriceService.getTokenIdFromSymbol(holding.symbol);
            const priceData = tokenId ? prices[tokenId] : null;
            const currentPrice = priceData?.price || 0;
            const change24h = priceData?.change24h || 0;
            const value = holding.quantity * currentPrice;
            totalValue += value;

            return {
                ...holding,
                currentPrice,
                change24h,
                value
            };
        });

        // Update portfolio with synced holdings
        if (enrichedHoldings.length > 0) {
            // Remove existing wallet-synced holdings
            portfolio.holdings = portfolio.holdings.filter(h => !h.fromWallet);

            // Add synced wallet holdings with prices
            for (const holding of enrichedHoldings) {
                portfolio.holdings.push({
                    symbol: holding.symbol,
                    quantity: holding.quantity,
                    shares: holding.quantity,
                    purchasePrice: 0,
                    averagePrice: 0,
                    currentPrice: holding.currentPrice,
                    value: holding.value,
                    purchaseDate: new Date(),
                    assetType: 'crypto',
                    fromWallet: true,
                    change24h: holding.change24h
                });
            }

            // Update portfolio totals
            portfolio.totalValue = totalValue;
            await portfolio.save();
        }

        // Update user stats for leaderboard
        if (user.calculateStats) {
            await user.calculateStats();
        }

        // Update last sync timestamp
        await user.updateWalletSync();

        res.json({
            success: true,
            message: 'Wallet synced successfully',
            tradesImported,
            holdings: enrichedHoldings,
            totalValue,
            portfolioUpdated: enrichedHoldings.length > 0,
            lastSyncedAt: user.wallet.lastSyncedAt
        });
    } catch (error) {
        console.error('Error syncing wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync wallet'
        });
    }
});

/**
 * GET /api/wallet/balance
 * Get wallet token balances
 */
router.get('/balance', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user || !user.hasLinkedWallet()) {
            return res.json({
                success: true,
                balances: []
            });
        }

        const { address, chainId } = user.wallet;
        const balances = await fetchWalletBalances(address, chainId);

        res.json({
            success: true,
            balances,
            walletAddress: address
        });
    } catch (error) {
        console.error('Error fetching wallet balances:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balances',
            balances: []
        });
    }
});

// ============ HELPER FUNCTIONS ============

/**
 * Fetch wallet transactions from blockchain explorer
 */
async function fetchWalletTrades(address, chainId = 1) {
    const explorer = CHAIN_EXPLORERS[chainId];

    if (!explorer || !explorer.apiKey) {
        console.log(`No explorer API key for chain ${chainId}, returning empty trades`);
        return [];
    }

    try {
        // Fetch ERC-20 token transfers
        const tokenTxUrl = `${explorer.apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorer.apiKey}`;
        const tokenResponse = await axios.get(tokenTxUrl, { timeout: 10000 });

        if (tokenResponse.data.status !== '1') {
            console.log('No token transactions found or API error');
            return [];
        }

        const trades = tokenResponse.data.result.slice(0, 100).map(tx => ({
            type: 'transfer',
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            tokenSymbol: tx.tokenSymbol,
            tokenName: tx.tokenName,
            tokenDecimal: parseInt(tx.tokenDecimal) || 18,
            contractAddress: tx.contractAddress,
            timestamp: new Date(parseInt(tx.timeStamp) * 1000),
            gasUsed: tx.gasUsed,
            gasPrice: tx.gasPrice
        }));

        return trades;
    } catch (error) {
        console.error('Error fetching wallet trades:', error.message);
        return [];
    }
}

/**
 * Fetch wallet token balances
 */
async function fetchWalletBalances(address, chainId = 1) {
    const explorer = CHAIN_EXPLORERS[chainId];

    if (!explorer || !explorer.apiKey) {
        return [];
    }

    try {
        // Fetch native balance
        const balanceUrl = `${explorer.apiUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${explorer.apiKey}`;
        const balanceResponse = await axios.get(balanceUrl, { timeout: 10000 });

        const balances = [];

        if (balanceResponse.data.status === '1') {
            const nativeBalance = parseFloat(balanceResponse.data.result) / 1e18;
            balances.push({
                symbol: chainId === 56 ? 'BNB' : 'ETH',
                balance: nativeBalance,
                isNative: true
            });
        }

        return balances;
    } catch (error) {
        console.error('Error fetching wallet balances:', error.message);
        return [];
    }
}

// ============ ANALYTICS ENDPOINTS ============

/**
 * GET /api/wallet/analytics
 * Get comprehensive wallet analytics
 */
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user || !user.hasLinkedWallet()) {
            return res.json({
                success: true,
                analytics: null,
                message: 'No wallet linked'
            });
        }

        const { address, chainId } = user.wallet;

        // Fetch all trades
        const trades = await fetchWalletTrades(address, chainId);

        // Fetch native balance with price
        const balances = await fetchWalletBalances(address, chainId);
        const nativeSymbol = chainId === 56 ? 'BNB' : 'ETH';
        const nativeTokenId = tokenPriceService.getTokenIdFromSymbol(nativeSymbol);
        const nativePrices = await tokenPriceService.getMultipleTokenPrices([nativeTokenId]);
        const nativePrice = nativePrices[nativeTokenId]?.price || 0;
        const nativeBalance = balances.find(b => b.isNative)?.balance || 0;
        const nativeValue = nativeBalance * nativePrice;

        // Calculate analytics
        const analytics = {
            wallet: {
                address,
                chainId,
                linkedAt: user.wallet.linkedAt,
                lastSyncedAt: user.wallet.lastSyncedAt
            },
            overview: {
                totalTransactions: trades.length,
                uniqueTokens: new Set(trades.map(t => t.tokenSymbol)).size,
                nativeBalance,
                nativeValue,
                nativeSymbol
            },
            activity: {
                incoming: trades.filter(t => t.to?.toLowerCase() === address.toLowerCase()).length,
                outgoing: trades.filter(t => t.from?.toLowerCase() === address.toLowerCase()).length
            },
            tokens: {},
            recentTransactions: [],
            gasSpent: { total: 0, usd: 0 }
        };

        // Process each trade for token-level analytics
        let totalGasUsed = 0;
        for (const trade of trades) {
            const symbol = trade.tokenSymbol?.toUpperCase();
            if (!symbol) continue;

            if (!analytics.tokens[symbol]) {
                analytics.tokens[symbol] = {
                    symbol,
                    name: trade.tokenName,
                    contractAddress: trade.contractAddress,
                    buys: 0,
                    sells: 0,
                    buyVolume: 0,
                    sellVolume: 0,
                    netPosition: 0,
                    lastTx: null,
                    currentPrice: 0,
                    value: 0
                };
            }

            const amount = parseFloat(trade.value) / Math.pow(10, trade.tokenDecimal || 18);
            const isIncoming = trade.to?.toLowerCase() === address.toLowerCase();

            if (isIncoming) {
                analytics.tokens[symbol].buys++;
                analytics.tokens[symbol].buyVolume += amount;
                analytics.tokens[symbol].netPosition += amount;
            } else {
                analytics.tokens[symbol].sells++;
                analytics.tokens[symbol].sellVolume += amount;
                analytics.tokens[symbol].netPosition -= amount;
            }

            analytics.tokens[symbol].lastTx = trade.timestamp;

            // Sum gas used
            if (trade.gasUsed && trade.gasPrice) {
                totalGasUsed += (parseInt(trade.gasUsed) * parseInt(trade.gasPrice)) / 1e18;
            }
        }

        // Fetch current prices for all tokens
        const tokenSymbols = Object.keys(analytics.tokens);
        const tokenIds = tokenSymbols.map(s => tokenPriceService.getTokenIdFromSymbol(s)).filter(Boolean);
        const prices = await tokenPriceService.getMultipleTokenPrices(tokenIds);

        // Calculate total portfolio value and enrich token data
        let totalTokenValue = 0;
        for (const symbol of tokenSymbols) {
            const tokenId = tokenPriceService.getTokenIdFromSymbol(symbol);
            const priceData = tokenId ? prices[tokenId] : null;
            const currentPrice = priceData?.price || 0;
            const change24h = priceData?.change24h || 0;
            const netPosition = analytics.tokens[symbol].netPosition;
            const value = netPosition > 0 ? netPosition * currentPrice : 0;

            analytics.tokens[symbol].currentPrice = currentPrice;
            analytics.tokens[symbol].change24h = change24h;
            analytics.tokens[symbol].value = value;

            if (value > 0) {
                totalTokenValue += value;
            }
        }

        // Sort tokens by value
        analytics.tokensList = Object.values(analytics.tokens)
            .filter(t => t.netPosition > 0.0001)
            .sort((a, b) => b.value - a.value);

        analytics.overview.totalTokenValue = totalTokenValue;
        analytics.overview.totalValue = totalTokenValue + nativeValue;

        // Gas spent calculation
        analytics.gasSpent.total = totalGasUsed;
        analytics.gasSpent.usd = totalGasUsed * nativePrice;

        // Recent transactions (last 20)
        analytics.recentTransactions = trades.slice(0, 20).map(trade => {
            const amount = parseFloat(trade.value) / Math.pow(10, trade.tokenDecimal || 18);
            const isIncoming = trade.to?.toLowerCase() === address.toLowerCase();
            return {
                type: isIncoming ? 'receive' : 'send',
                symbol: trade.tokenSymbol,
                amount,
                hash: trade.hash,
                timestamp: trade.timestamp,
                from: trade.from,
                to: trade.to
            };
        });

        // Token distribution for charts
        analytics.distribution = analytics.tokensList
            .filter(t => t.value > 0)
            .slice(0, 10)
            .map(t => ({
                symbol: t.symbol,
                value: t.value,
                percentage: (t.value / analytics.overview.totalValue) * 100
            }));

        // Add native token to distribution if has value
        if (nativeValue > 0) {
            analytics.distribution.unshift({
                symbol: nativeSymbol,
                value: nativeValue,
                percentage: (nativeValue / analytics.overview.totalValue) * 100
            });
        }

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        console.error('Error fetching wallet analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet analytics'
        });
    }
});

/**
 * GET /api/wallet/token/:symbol
 * Get detailed info for a specific token
 */
router.get('/token/:symbol', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;

        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Token symbol required'
            });
        }

        const tokenInfo = await tokenPriceService.getTokenInfo(symbol);

        if (!tokenInfo) {
            return res.status(404).json({
                success: false,
                error: 'Token not found'
            });
        }

        // Get detailed market data
        const marketData = await tokenPriceService.getTokenMarketData(tokenInfo.id);

        res.json({
            success: true,
            token: {
                ...tokenInfo,
                marketData
            }
        });
    } catch (error) {
        console.error('Error fetching token info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch token info'
        });
    }
});

/**
 * GET /api/wallet/history
 * Get transaction history with pagination
 */
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const { page = 1, limit = 20, type = 'all' } = req.query;

        if (!user || !user.hasLinkedWallet()) {
            return res.json({
                success: true,
                transactions: [],
                total: 0
            });
        }

        const { address, chainId } = user.wallet;
        let trades = await fetchWalletTrades(address, chainId);

        // Filter by type
        if (type === 'incoming') {
            trades = trades.filter(t => t.to?.toLowerCase() === address.toLowerCase());
        } else if (type === 'outgoing') {
            trades = trades.filter(t => t.from?.toLowerCase() === address.toLowerCase());
        }

        // Paginate
        const total = trades.length;
        const startIdx = (parseInt(page) - 1) * parseInt(limit);
        const paginatedTrades = trades.slice(startIdx, startIdx + parseInt(limit));

        // Enrich with formatted data
        const transactions = paginatedTrades.map(trade => {
            const amount = parseFloat(trade.value) / Math.pow(10, trade.tokenDecimal || 18);
            const isIncoming = trade.to?.toLowerCase() === address.toLowerCase();
            return {
                id: trade.hash,
                type: isIncoming ? 'receive' : 'send',
                symbol: trade.tokenSymbol,
                name: trade.tokenName,
                amount,
                hash: trade.hash,
                timestamp: trade.timestamp,
                from: trade.from,
                to: trade.to,
                explorer: getExplorerLink(chainId, trade.hash)
            };
        });

        res.json({
            success: true,
            transactions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Error fetching wallet history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet history'
        });
    }
});

/**
 * Get block explorer link for transaction
 */
function getExplorerLink(chainId, hash) {
    const explorers = {
        1: 'https://etherscan.io/tx/',
        56: 'https://bscscan.com/tx/',
        137: 'https://polygonscan.com/tx/',
        42161: 'https://arbiscan.io/tx/',
        10: 'https://optimistic.etherscan.io/tx/',
        43114: 'https://snowtrace.io/tx/',
        8453: 'https://basescan.org/tx/'
    };
    return (explorers[chainId] || explorers[1]) + hash;
}

module.exports = router;
