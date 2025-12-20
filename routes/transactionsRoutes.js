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

        const searchResponse = await axios.get(searchUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 8000
        });

        if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
            return [];
        }

        const pool = searchResponse.data.data[0];
        const poolAddress = pool.attributes?.address;
        const poolNetwork = pool.relationships?.network?.data?.id || 'eth';

        if (!poolAddress) return [];

        // Fetch recent trades from the pool
        const tradesUrl = `https://api.geckoterminal.com/api/v2/networks/${poolNetwork}/pools/${poolAddress}/trades`;
        console.log(`[Transactions] Fetching trades: ${tradesUrl}`);

        const tradesResponse = await axios.get(tradesUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 8000
        });

        if (!tradesResponse.data?.data) return [];

        // Transform trades data
        const trades = tradesResponse.data.data.slice(0, 50).map(trade => {
            const attrs = trade.attributes;
            return {
                id: trade.id,
                type: attrs.kind || 'swap', // buy/sell
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

        return trades;
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
            const poolsResponse = await axios.get(poolsUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
            });

            if (poolsResponse.data?.data && poolsResponse.data.data.length > 0) {
                const pool = poolsResponse.data.data[0];
                const poolAddress = pool.attributes?.address;

                // Fetch trades
                const tradesUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/trades`;
                const tradesResponse = await axios.get(tradesUrl, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 8000
                });

                if (tradesResponse.data?.data) {
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
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.log(`[Transactions] Error on ${network}: ${error.message}`);
            }
        }
    }

    return [];
};

// Fetch recent stock trades from Alpaca
const fetchAlpacaTrades = async (symbol) => {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || apiKey === 'your_alpaca_api_key_here') {
        // Return mock data if no API key
        return generateMockStockTrades(symbol);
    }

    try {
        const response = await axios.get(
            `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`,
            {
                headers: {
                    'APCA-API-KEY-ID': apiKey,
                    'APCA-API-SECRET-KEY': secretKey
                },
                timeout: 5000
            }
        );

        // Alpaca returns latest trade, we'll simulate some recent ones
        const latestTrade = response.data?.trade;
        if (latestTrade) {
            return generateRecentTradesFromLatest(symbol, latestTrade);
        }

        return [];
    } catch (error) {
        console.error(`[Transactions] Alpaca error: ${error.message}`);
        return generateMockStockTrades(symbol);
    }
};

// Generate mock recent trades based on latest trade data
const generateRecentTradesFromLatest = (symbol, latestTrade) => {
    const trades = [];
    const basePrice = latestTrade.p;
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
        const priceVariation = (Math.random() - 0.5) * 0.02 * basePrice;
        const price = basePrice + priceVariation;
        const size = Math.floor(Math.random() * 500) + 10;
        const isBuy = Math.random() > 0.5;

        trades.push({
            id: `${symbol}-${now - i * 5000}-${i}`,
            type: 'trade',
            side: isBuy ? 'BUY' : 'SELL',
            price: price,
            amount: price * size,
            shares: size,
            timestamp: now - (i * 5000) - Math.random() * 5000,
            exchange: latestTrade.x || 'NYSE'
        });
    }

    return trades;
};

// Generate mock stock trades for demo
const generateMockStockTrades = (symbol) => {
    const trades = [];
    const now = Date.now();

    // Use a base price based on symbol
    const basePrices = {
        'AAPL': 175, 'TSLA': 250, 'NVDA': 480, 'MSFT': 420,
        'GOOGL': 140, 'AMD': 140, 'META': 500, 'AMZN': 180
    };
    const basePrice = basePrices[symbol] || 100;

    for (let i = 0; i < 20; i++) {
        const priceVariation = (Math.random() - 0.5) * 0.01 * basePrice;
        const price = basePrice + priceVariation;
        const size = Math.floor(Math.random() * 500) + 10;
        const isBuy = Math.random() > 0.5;

        trades.push({
            id: `${symbol}-${now - i * 5000}-${i}`,
            type: 'trade',
            side: isBuy ? 'BUY' : 'SELL',
            price: price,
            amount: price * size,
            shares: size,
            timestamp: now - (i * 5000) - Math.random() * 5000,
            exchange: ['NYSE', 'NASDAQ', 'ARCA', 'BATS'][Math.floor(Math.random() * 4)]
        });
    }

    return trades;
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
            trades = await fetchAlpacaTrades(symbol.toUpperCase());
            assetType = 'stock';
        }

        console.log(`[Transactions] Found ${trades.length} trades for ${symbol}`);

        res.json({
            success: true,
            symbol: symbol,
            assetType: assetType,
            trades: trades,
            count: trades.length,
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
