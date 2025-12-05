// server/services/krakenService.js - Kraken Exchange API Integration
const crypto = require('crypto');
const axios = require('axios');

const KRAKEN_API_URL = 'https://api.kraken.com';

// Cache for balances (1 minute TTL)
const balanceCache = new Map();
const CACHE_TTL = 60 * 1000;

/**
 * Create signature for Kraken API
 * @param {string} path - API path
 * @param {object} data - Request data
 * @param {string} secret - API secret (base64)
 * @returns {string} Signature
 */
function createSignature(path, data, secret) {
    const message = data.nonce + new URLSearchParams(data).toString();
    const secretBuffer = Buffer.from(secret, 'base64');
    const hash = crypto.createHash('sha256').update(message).digest();
    const hmac = crypto.createHmac('sha512', secretBuffer);
    hmac.update(Buffer.concat([Buffer.from(path), hash]));
    return hmac.digest('base64');
}

/**
 * Make authenticated request to Kraken API
 * @param {string} endpoint - API endpoint
 * @param {object} params - Request parameters
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<object>} API response
 */
async function krakenRequest(endpoint, params, apiKey, apiSecret) {
    const path = `/0/private/${endpoint}`;
    const nonce = Date.now() * 1000;

    const data = {
        nonce,
        ...params
    };

    const signature = createSignature(path, data, apiSecret);

    try {
        const response = await axios.post(
            `${KRAKEN_API_URL}${path}`,
            new URLSearchParams(data).toString(),
            {
                headers: {
                    'API-Key': apiKey,
                    'API-Sign': signature,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            }
        );

        if (response.data.error && response.data.error.length > 0) {
            throw new Error(response.data.error.join(', '));
        }

        return response.data.result;
    } catch (error) {
        console.error(`Kraken API error (${endpoint}):`, error.message);
        throw error;
    }
}

/**
 * Make public request to Kraken API
 * @param {string} endpoint - API endpoint
 * @param {object} params - Request parameters
 * @returns {Promise<object>} API response
 */
async function krakenPublicRequest(endpoint, params = {}) {
    try {
        const response = await axios.get(
            `${KRAKEN_API_URL}/0/public/${endpoint}`,
            {
                params,
                timeout: 10000
            }
        );

        if (response.data.error && response.data.error.length > 0) {
            throw new Error(response.data.error.join(', '));
        }

        return response.data.result;
    } catch (error) {
        console.error(`Kraken public API error (${endpoint}):`, error.message);
        throw error;
    }
}

/**
 * Get account balance from Kraken
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<object>} Account balances
 */
async function getBalance(apiKey, apiSecret) {
    const cacheKey = `balance_${apiKey.slice(0, 8)}`;
    const cached = balanceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const balances = await krakenRequest('Balance', {}, apiKey, apiSecret);

    // Filter out zero balances and format
    const formattedBalances = {};
    for (const [asset, balance] of Object.entries(balances)) {
        const numBalance = parseFloat(balance);
        if (numBalance > 0) {
            // Kraken uses different asset codes (XXBT for BTC, ZUSD for USD, etc.)
            const normalizedAsset = normalizeAssetCode(asset);
            formattedBalances[normalizedAsset] = numBalance;
        }
    }

    balanceCache.set(cacheKey, {
        data: formattedBalances,
        timestamp: Date.now()
    });

    return formattedBalances;
}

/**
 * Normalize Kraken asset codes to standard symbols
 * @param {string} asset - Kraken asset code
 * @returns {string} Normalized symbol
 */
function normalizeAssetCode(asset) {
    const assetMap = {
        'XXBT': 'BTC',
        'XBT': 'BTC',
        'XETH': 'ETH',
        'ZUSD': 'USD',
        'ZEUR': 'EUR',
        'ZGBP': 'GBP',
        'ZCAD': 'CAD',
        'ZJPY': 'JPY',
        'XLTC': 'LTC',
        'XXRP': 'XRP',
        'XXLM': 'XLM',
        'XDOGE': 'DOGE',
        'XXMR': 'XMR',
        'XETC': 'ETC',
        'XREP': 'REP',
        'XZEC': 'ZEC'
    };

    // Remove leading X or Z for crypto/fiat
    if (asset.length === 4 && (asset.startsWith('X') || asset.startsWith('Z'))) {
        return assetMap[asset] || asset.slice(1);
    }

    return assetMap[asset] || asset;
}

/**
 * Get trade history from Kraken
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @param {object} options - Query options (start, end, ofs)
 * @returns {Promise<object>} Trade history
 */
async function getTradeHistory(apiKey, apiSecret, options = {}) {
    const params = {
        trades: true,
        ...options
    };

    const result = await krakenRequest('TradesHistory', params, apiKey, apiSecret);

    // Format trades
    const trades = [];
    for (const [txid, trade] of Object.entries(result.trades || {})) {
        trades.push({
            id: txid,
            pair: trade.pair,
            type: trade.type, // 'buy' or 'sell'
            orderType: trade.ordertype,
            price: parseFloat(trade.price),
            cost: parseFloat(trade.cost),
            fee: parseFloat(trade.fee),
            volume: parseFloat(trade.vol),
            time: new Date(trade.time * 1000).toISOString(),
            misc: trade.misc
        });
    }

    return {
        trades: trades.sort((a, b) => new Date(b.time) - new Date(a.time)),
        count: result.count || trades.length
    };
}

/**
 * Get open orders from Kraken
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<array>} Open orders
 */
async function getOpenOrders(apiKey, apiSecret) {
    const result = await krakenRequest('OpenOrders', {}, apiKey, apiSecret);

    const orders = [];
    for (const [orderId, order] of Object.entries(result.open || {})) {
        orders.push({
            id: orderId,
            pair: order.descr.pair,
            type: order.descr.type,
            orderType: order.descr.ordertype,
            price: parseFloat(order.descr.price) || null,
            volume: parseFloat(order.vol),
            volumeExecuted: parseFloat(order.vol_exec),
            status: order.status,
            openTime: new Date(order.opentm * 1000).toISOString()
        });
    }

    return orders;
}

/**
 * Get current ticker prices from Kraken
 * @param {string[]} pairs - Trading pairs to query
 * @returns {Promise<object>} Ticker data
 */
async function getTicker(pairs) {
    const result = await krakenPublicRequest('Ticker', {
        pair: pairs.join(',')
    });

    const tickers = {};
    for (const [pair, data] of Object.entries(result)) {
        tickers[pair] = {
            ask: parseFloat(data.a[0]),
            bid: parseFloat(data.b[0]),
            last: parseFloat(data.c[0]),
            volume24h: parseFloat(data.v[1]),
            vwap24h: parseFloat(data.p[1]),
            trades24h: parseInt(data.t[1]),
            low24h: parseFloat(data.l[1]),
            high24h: parseFloat(data.h[1]),
            open24h: parseFloat(data.o)
        };
    }

    return tickers;
}

/**
 * Get asset info from Kraken
 * @returns {Promise<object>} Asset information
 */
async function getAssets() {
    return await krakenPublicRequest('Assets');
}

/**
 * Validate API credentials
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<boolean>} Whether credentials are valid
 */
async function validateCredentials(apiKey, apiSecret) {
    try {
        await getBalance(apiKey, apiSecret);
        return true;
    } catch (error) {
        console.error('Kraken credential validation failed:', error.message);
        return false;
    }
}

/**
 * Get portfolio with USD values
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<object>} Portfolio with values
 */
async function getPortfolioWithValues(apiKey, apiSecret) {
    const balances = await getBalance(apiKey, apiSecret);

    // Get USD prices for all crypto assets
    const cryptoAssets = Object.keys(balances).filter(asset =>
        !['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF'].includes(asset)
    );

    const holdings = [];
    let totalValue = 0;

    // Add fiat balances directly
    for (const fiat of ['USD', 'EUR', 'GBP', 'CAD']) {
        if (balances[fiat]) {
            // For non-USD fiat, we'd need conversion rates
            const value = fiat === 'USD' ? balances[fiat] : balances[fiat]; // TODO: Convert other fiats
            holdings.push({
                symbol: fiat,
                balance: balances[fiat],
                price: 1,
                value: value,
                type: 'fiat'
            });
            if (fiat === 'USD') totalValue += value;
        }
    }

    // Get crypto prices
    if (cryptoAssets.length > 0) {
        const pairs = cryptoAssets.map(asset => `${asset}USD`);
        try {
            const tickers = await getTicker(pairs);

            for (const asset of cryptoAssets) {
                const balance = balances[asset];
                const tickerKey = Object.keys(tickers).find(k =>
                    k.includes(asset) || k.includes(`X${asset}`)
                );
                const price = tickers[tickerKey]?.last || 0;
                const value = balance * price;

                holdings.push({
                    symbol: asset,
                    balance,
                    price,
                    value,
                    change24h: tickers[tickerKey] ?
                        ((price - tickers[tickerKey].open24h) / tickers[tickerKey].open24h * 100) : 0,
                    type: 'crypto'
                });

                totalValue += value;
            }
        } catch (error) {
            console.error('Error fetching Kraken prices:', error.message);
            // Add holdings without prices
            for (const asset of cryptoAssets) {
                holdings.push({
                    symbol: asset,
                    balance: balances[asset],
                    price: 0,
                    value: 0,
                    type: 'crypto'
                });
            }
        }
    }

    return {
        holdings: holdings.sort((a, b) => b.value - a.value),
        totalValue,
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Clear cache for a user
 * @param {string} apiKey - User's API key
 */
function clearCache(apiKey) {
    const cacheKey = `balance_${apiKey.slice(0, 8)}`;
    balanceCache.delete(cacheKey);
}

module.exports = {
    getBalance,
    getTradeHistory,
    getOpenOrders,
    getTicker,
    getAssets,
    validateCredentials,
    getPortfolioWithValues,
    clearCache,
    normalizeAssetCode
};
