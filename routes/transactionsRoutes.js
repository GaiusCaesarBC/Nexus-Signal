// routes/transactionsRoutes.js - Recent transactions/trades for crypto and stocks

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting
const transactionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: 'Too many requests, please try again later' }
});

// Known crypto symbols
const KNOWN_CRYPTOS = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
    'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
    'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'FET', 'INJ', 'SUI', 'SEI', 'TIA'
];

// Check if symbol is crypto
const isCrypto = (symbol) => {
    const upper = symbol.toUpperCase();
    if (upper.includes(':')) return true;
    if (upper.includes('-USD') || upper.includes('USDT')) return true;
    const base = upper.replace(/-USD.*$/, '').replace(/USDT$/, '');
    return KNOWN_CRYPTOS.includes(base);
};

// Check if input is a contract address
const isContractAddress = (input) => {
    if (!input) return false;
    const trimmed = input.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) return { type: 'evm', address: trimmed.toLowerCase() };
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return { type: 'solana', address: trimmed };
    return false;
};

// Parse crypto symbol
const parseCryptoSymbol = (symbol) => {
    if (symbol.includes(':')) {
        const [crypto, network] = symbol.split(':');
        return { crypto: crypto.toUpperCase(), network: network.toLowerCase() };
    }
    const base = symbol.toUpperCase().replace(/-USD.*$/, '').replace(/USDT$/, '');
    return { crypto: base, network: null };
};

// Fetch recent trades from Gecko Terminal for a token
const fetchGeckoTerminalTrades = async (symbol, network = null) => {
    try {
        // Search for the token pool
        let searchUrl;
        if (network) {
            searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}&network=${network}`;
        } else {
            searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}`;
        }

        console.log(`[Transactions] Searching pools: ${searchUrl}`);

        const searchResponse = await axios.get(searchUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 8000
        });

        if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
            console.log(`[Transactions] No pools found for ${symbol}`);
            return [];
        }

        const pool = searchResponse.data.data[0];
        const poolAddress = pool.attributes?.address;
        // Extract network from pool ID (format: network_address, e.g., "base_0x...")
        const poolNetwork = pool.id?.split('_')[0] || 'eth';
        const poolName = pool.attributes?.name || symbol;
        const baseTokenPrice = parseFloat(pool.attributes?.base_token_price_usd || 0);

        if (!poolAddress) return [];

        console.log(`[Transactions] Found pool: ${poolName} on ${poolNetwork}`);

        // Try to fetch trades (may not be available on free tier)
        try {
            const tradesUrl = `https://api.geckoterminal.com/api/v2/networks/${poolNetwork}/pools/${poolAddress}/trades`;
            console.log(`[Transactions] Fetching trades: ${tradesUrl}`);

            const tradesResponse = await axios.get(tradesUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
            });

            if (tradesResponse.data?.data && tradesResponse.data.data.length > 0) {
                // Real trades available
                const trades = tradesResponse.data.data.slice(0, 50).map(trade => {
                    const attrs = trade.attributes;
                    return {
                        id: trade.id,
                        type: attrs.kind || 'swap',
                        side: attrs.kind === 'buy' ? 'BUY' : 'SELL',
                        price: parseFloat(attrs.price_to_in_usd || attrs.price_from_in_usd || 0),
                        amount: parseFloat(attrs.volume_in_usd || 0),
                        tokenAmount: parseFloat(attrs.to_token_amount || attrs.from_token_amount || 0),
                        timestamp: new Date(attrs.block_timestamp).getTime(),
                        txHash: attrs.tx_hash,
                        maker: attrs.tx_from_address?.slice(0, 8) + '...' + attrs.tx_from_address?.slice(-6),
                        network: poolNetwork
                    };
                });
                console.log(`[Transactions] Got ${trades.length} real trades`);
                return trades;
            }
        } catch (tradeError) {
            console.log(`[Transactions] Trades endpoint not available: ${tradeError.message}`);
        }

        // No simulated data - return empty if trades endpoint not available
        console.log(`[Transactions] No trades available for ${symbol}`);
        return [];

    } catch (error) {
        console.error(`[Transactions] Gecko Terminal error: ${error.message}`);
        return [];
    }
};

// Fetch recent trades by contract address
const fetchTradesByContract = async (contractInfo) => {
    const { type, address } = contractInfo;
    const evmNetworks = ['eth', 'bsc', 'base', 'arbitrum', 'polygon_pos', 'avalanche', 'optimism'];
    const networksToSearch = type === 'solana' ? ['solana'] : evmNetworks;

    for (const network of networksToSearch) {
        try {
            // Get token pools
            const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools?page=1`;
            console.log(`[Transactions] Checking contract on ${network}: ${poolsUrl}`);

            const poolsResponse = await axios.get(poolsUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
            });

            if (poolsResponse.data?.data && poolsResponse.data.data.length > 0) {
                const pool = poolsResponse.data.data[0];
                const poolAddress = pool.attributes?.address;
                const baseTokenPrice = parseFloat(pool.attributes?.base_token_price_usd || 0);
                const tokenSymbol = pool.attributes?.name?.split('/')[0] || 'TOKEN';

                console.log(`[Transactions] Found pool for contract on ${network}`);

                // Try to fetch real trades
                try {
                    const tradesUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/trades`;
                    const tradesResponse = await axios.get(tradesUrl, {
                        headers: { 'Accept': 'application/json' },
                        timeout: 8000
                    });

                    if (tradesResponse.data?.data && tradesResponse.data.data.length > 0) {
                        return tradesResponse.data.data.slice(0, 50).map(trade => {
                            const attrs = trade.attributes;
                            return {
                                id: trade.id,
                                type: attrs.kind || 'swap',
                                side: attrs.kind === 'buy' ? 'BUY' : 'SELL',
                                price: parseFloat(attrs.price_to_in_usd || attrs.price_from_in_usd || 0),
                                amount: parseFloat(attrs.volume_in_usd || 0),
                                tokenAmount: parseFloat(attrs.to_token_amount || attrs.from_token_amount || 0),
                                timestamp: new Date(attrs.block_timestamp).getTime(),
                                txHash: attrs.tx_hash,
                                maker: attrs.tx_from_address?.slice(0, 8) + '...' + attrs.tx_from_address?.slice(-6),
                                network: network
                            };
                        });
                    }
                } catch (tradeError) {
                    console.log(`[Transactions] Trades not available for contract: ${tradeError.message}`);
                }

                // No simulated data - return empty if trades not available
                return [];
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.log(`[Transactions] Error on ${network}: ${error.message}`);
            }
        }
    }

    return [];
};

// Check if US stock market is currently open
const isMarketOpen = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Weekend check
    if (day === 0 || day === 6) return false;

    // Get current time in Eastern Time
    const etOptions = { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false };
    const etTime = new Intl.DateTimeFormat('en-US', etOptions).format(now);
    const [hours, minutes] = etTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30;  // 9:30 AM = 570 minutes
    const marketClose = 16 * 60;      // 4:00 PM = 960 minutes

    return totalMinutes >= marketOpen && totalMinutes < marketClose;
};

// Fetch recent stock trades from Alpaca (real data only)
const fetchAlpacaTrades = async (symbol) => {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    // No mock data - return empty if no API key or market closed
    if (!apiKey || apiKey === 'your_alpaca_api_key_here') {
        console.log(`[Transactions] No Alpaca API key configured`);
        return { trades: [], marketClosed: !isMarketOpen() };
    }

    try {
        // Fetch actual recent trades from Alpaca
        const response = await axios.get(
            `https://data.alpaca.markets/v2/stocks/${symbol}/trades?limit=25`,
            {
                headers: {
                    'APCA-API-KEY-ID': apiKey,
                    'APCA-API-SECRET-KEY': secretKey
                },
                timeout: 5000
            }
        );

        const rawTrades = response.data?.trades || [];

        if (rawTrades.length === 0) {
            return { trades: [], marketClosed: !isMarketOpen() };
        }

        // Transform Alpaca trades to our format
        const trades = rawTrades.map((trade, index) => ({
            id: `${symbol}-${trade.t}-${index}`,
            type: 'trade',
            side: trade.c?.includes('B') ? 'BUY' : 'SELL', // Alpaca condition codes
            price: trade.p,
            amount: trade.p * trade.s,
            shares: trade.s,
            timestamp: new Date(trade.t).getTime(),
            exchange: trade.x || 'NYSE'
        }));

        console.log(`[Transactions] Got ${trades.length} real trades for ${symbol}`);
        return { trades, marketClosed: false };

    } catch (error) {
        console.error(`[Transactions] Alpaca error: ${error.message}`);
        return { trades: [], marketClosed: !isMarketOpen(), error: error.message };
    }
};

// @route   GET /api/transactions/:symbol
// @desc    Get recent transactions for a symbol (crypto or stock)
// @access  Private
router.get('/:symbol', auth, transactionLimiter, async (req, res) => {
    try {
        const { symbol } = req.params;

        if (!symbol) {
            return res.status(400).json({ success: false, error: 'Symbol is required' });
        }

        console.log(`[Transactions] Fetching recent trades for: ${symbol}`);

        let trades = [];
        let assetType = 'stock';
        let marketClosed = false;

        // Check if it's a contract address
        const contractInfo = isContractAddress(symbol);
        if (contractInfo) {
            console.log(`[Transactions] Contract address detected: ${contractInfo.address}`);
            trades = await fetchTradesByContract(contractInfo);
            assetType = 'crypto';
        }
        // Check if it's a crypto symbol
        else if (isCrypto(symbol)) {
            const { crypto, network } = parseCryptoSymbol(symbol);
            console.log(`[Transactions] Crypto detected: ${crypto}${network ? ` on ${network}` : ''}`);
            trades = await fetchGeckoTerminalTrades(crypto, network);
            assetType = 'crypto';
        }
        // Otherwise treat as stock
        else {
            console.log(`[Transactions] Stock detected: ${symbol}`);
            const result = await fetchAlpacaTrades(symbol.toUpperCase());
            trades = result.trades;
            marketClosed = result.marketClosed;
            assetType = 'stock';
        }

        console.log(`[Transactions] Found ${trades.length} trades for ${symbol}${marketClosed ? ' (market closed)' : ''}`);

        res.json({
            success: true,
            symbol: symbol,
            assetType: assetType,
            trades: trades,
            count: trades.length,
            marketClosed: marketClosed,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error(`[Transactions] Error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions',
            message: error.message
        });
    }
});

module.exports = router;
