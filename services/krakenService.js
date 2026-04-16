// server/services/krakenService.js - Kraken Exchange API Integration
const crypto = require('crypto');
const axios = require('axios');

const KRAKEN_API_URL = 'https://api.kraken.com';

// Cache for balances (1 minute TTL)
const balanceCache = new Map();
const CACHE_TTL = 60 * 1000;

// Cache for forex rates (5 minute TTL)
const forexCache = { rates: null, timestamp: 0 };
const FOREX_CACHE_TTL = 5 * 60 * 1000;

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

    // Remove leading X or Z for 4-char codes
    if (asset.length === 4 && (asset.startsWith('X') || asset.startsWith('Z'))) {
        return assetMap[asset] || asset.slice(1);
    }

    return assetMap[asset] || asset;
}

// Known stablecoins pegged ~$1
const STABLECOINS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'PYUSD']);

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
 * Convert normalized symbol to Kraken ticker pair format
 * Note: Kraken Ticker API uses different format than Balance API
 * @param {string} asset - Normalized asset code (BTC, ETH, etc.)
 * @returns {string} Kraken ticker pair format
 */
function getKrakenTickerPair(asset) {
    // Kraken Ticker API uses simpler format - XBTUSD, ETHUSD, etc.
    // NOT the XX/XZ prefixes from the balance API
    const tickerPairs = {
        'BTC': 'XBTUSD',    // Bitcoin uses XBT, not BTC
        'ETH': 'ETHUSD',
        'LTC': 'LTCUSD',
        'XRP': 'XRPUSD',
        'XLM': 'XLMUSD',
        'DOGE': 'DOGEUSD',
        'XMR': 'XMRUSD',
        'ETC': 'ETCUSD',
        'ZEC': 'ZECUSD',
        'ADA': 'ADAUSD',
        'DOT': 'DOTUSD',
        'SOL': 'SOLUSD',
        'LINK': 'LINKUSD',
        'MATIC': 'MATICUSD',
        'AVAX': 'AVAXUSD',
        'ATOM': 'ATOMUSD',
        'UNI': 'UNIUSD',
        'AAVE': 'AAVEUSD'
    };
    return tickerPairs[asset] || `${asset}USD`;
}

/**
 * Get USD conversion rates for non-USD fiat currencies via Kraken's public API
 * @returns {Promise<object>} Map of currency to USD rate (e.g., { EUR: 1.08, GBP: 1.27 })
 */
async function getForexRates() {
    if (forexCache.rates && Date.now() - forexCache.timestamp < FOREX_CACHE_TTL) {
        return forexCache.rates;
    }

    const forexPairs = {
        'EUR': 'EURUSD',
        'GBP': 'GBPUSD',
        'CAD': 'USDCAD',  // Inverted — USD per CAD
        'JPY': 'USDJPY',  // Inverted — USD per JPY
        'AUD': 'AUDUSD',
        'CHF': 'USDCHF'   // Inverted — USD per CHF
    };

    const invertedPairs = ['CAD', 'JPY', 'CHF'];
    const rates = { USD: 1 };

    try {
        const pairString = Object.values(forexPairs).join(',');
        const tickers = await krakenPublicRequest('Ticker', { pair: pairString });

        for (const [currency, pair] of Object.entries(forexPairs)) {
            const tickerKey = Object.keys(tickers).find(k => k.includes(pair) || k.includes(pair.replace('USD', '')));
            if (tickerKey && tickers[tickerKey]) {
                const price = parseFloat(tickers[tickerKey].c[0]);
                rates[currency] = invertedPairs.includes(currency) ? (1 / price) : price;
            }
        }

        console.log('[Kraken] Forex rates:', rates);
        forexCache.rates = rates;
        forexCache.timestamp = Date.now();
    } catch (error) {
        console.error('[Kraken] Error fetching forex rates:', error.message);
        // Fallback: treat non-USD fiat at face value (better than 0)
        for (const currency of Object.keys(forexPairs)) {
            if (!rates[currency]) rates[currency] = 1;
        }
    }

    return rates;
}

/**
 * Get portfolio with USD values
 * @param {string} apiKey - User's API key
 * @param {string} apiSecret - User's API secret
 * @returns {Promise<object>} Portfolio with values
 */
async function getPortfolioWithValues(apiKey, apiSecret) {
    const balances = await getBalance(apiKey, apiSecret);

    // Classify assets: fiat, stablecoin, equity (.EQ suffix), crypto
    const fiatCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF'];
    const cryptoAssets = [];
    const equityAssets = [];
    const stablecoinAssets = [];

    for (const asset of Object.keys(balances)) {
        if (fiatCurrencies.includes(asset)) continue; // handled separately
        if (STABLECOINS.has(asset)) { stablecoinAssets.push(asset); continue; }
        if (asset.endsWith('.EQ') || asset.endsWith('.S')) { equityAssets.push(asset); continue; }
        cryptoAssets.push(asset);
    }

    const holdings = [];
    let totalValue = 0;

    // Fetch forex rates for non-USD fiat conversion
    const forexRates = await getForexRates();

    // Add fiat balances converted to USD
    for (const fiat of fiatCurrencies) {
        if (balances[fiat]) {
            const rate = forexRates[fiat] || 1;
            const valueInUsd = balances[fiat] * rate;
            holdings.push({
                symbol: fiat,
                name: fiat,
                quantity: balances[fiat],
                price: rate,
                value: valueInUsd,
                type: 'fiat'
            });
            totalValue += valueInUsd;
        }
    }

    // Add stablecoins at $1.00
    for (const coin of stablecoinAssets) {
        const balance = balances[coin];
        const value = balance * 1.0;
        holdings.push({
            symbol: coin,
            name: coin,
            quantity: balance,
            price: 1.0,
            value,
            change24h: 0,
            type: 'stablecoin'
        });
        totalValue += value;
    }

    // Price equity tokens (.EQ) via Kraken ticker individually, then
    // fall back to priceService for the underlying stock symbol
    if (equityAssets.length > 0) {
        const priceService = require('./priceService');
        for (const asset of equityAssets) {
            const balance = balances[asset];
            let price = 0;
            let change24h = 0;

            // Try Kraken ticker first (pair = asset + USD, e.g. NVD.EQUSD)
            try {
                const pair = `${asset}USD`;
                const tickers = await getTicker([pair]);
                const tickerKey = Object.keys(tickers).find(k => k.includes(asset));
                if (tickerKey && tickers[tickerKey]) {
                    price = parseFloat(tickers[tickerKey].c?.[0] || tickers[tickerKey].last || 0);
                    const open24h = parseFloat(tickers[tickerKey].o || tickers[tickerKey].open24h || price);
                    if (open24h > 0) change24h = ((price - open24h) / open24h * 100);
                }
            } catch (e) {
                console.log(`[Kraken] Ticker failed for equity ${asset}:`, e.message);
            }

            // Fallback: strip .EQ/.S suffix and look up stock price
            if (!price || price <= 0) {
                const stockSymbol = asset.replace(/\.(EQ|S)$/, '');
                // Kraken may abbreviate: NVD→NVDA, TZA stays TZA, etc.
                // Try the raw symbol first, then common expansions
                const candidates = [stockSymbol];
                // Kraken truncates some tickers: NVD=NVDA, MSF=MSFT, etc.
                const expansions = { 'NVD': 'NVDA', 'MSF': 'MSFT', 'AMZ': 'AMZN', 'GOO': 'GOOGL', 'TSL': 'TSLA', 'MET': 'META', 'AMD': 'AMD' };
                if (expansions[stockSymbol]) candidates.push(expansions[stockSymbol]);
                
                for (const sym of candidates) {
                    try {
                        const result = await priceService.getCurrentPrice(sym, 'stock');
                        if (result.price && result.price > 0) {
                            price = result.price;
                            console.log(`[Kraken] Equity ${asset} priced via stock ${sym}: $${price}`);
                            break;
                        }
                    } catch (e) { /* next candidate */ }
                }
            }

            const value = balance * price;
            const stockSym = asset.replace(/\.(EQ|S)$/, '');
            holdings.push({
                symbol: asset,
                name: getCryptoName(stockSym) || asset,
                quantity: balance,
                price,
                value,
                change24h,
                type: 'equity'
            });
            totalValue += value;
        }
    }

    // Get crypto prices
    if (cryptoAssets.length > 0) {
        // Build Kraken ticker pairs
        const pairs = cryptoAssets.map(asset => getKrakenTickerPair(asset));
        console.log('[Kraken] Fetching ticker pairs:', pairs);

        try {
            const tickers = await getTicker(pairs);
            console.log('[Kraken] Ticker response keys:', Object.keys(tickers));

            for (const asset of cryptoAssets) {
                const balance = balances[asset];
                const tickerPair = getKrakenTickerPair(asset);

                // Kraken returns keys with XX prefix sometimes (e.g., XXBTZUSD for XBTUSD request)
                const tickerKey = Object.keys(tickers).find(k => {
                    // Direct match
                    if (k === tickerPair) return true;
                    // Kraken often returns XXBTZUSD when you request XBTUSD
                    if (k === `X${tickerPair.replace('USD', 'ZUSD')}`) return true;
                    if (k === `XX${tickerPair.replace('USD', 'ZUSD')}`) return true;
                    // For BTC/XBT
                    if (asset === 'BTC' && k.includes('XBT')) return true;
                    // Generic - check if key contains the ticker pair or asset
                    if (k.includes(tickerPair.replace('USD', ''))) return true;
                    return false;
                });

                console.log(`[Kraken] Asset ${asset}: requested=${tickerPair}, found=${tickerKey}, ticker=${JSON.stringify(tickers[tickerKey]?.c)}`);

                const tickerData = tickers[tickerKey];
                // Kraken ticker format: c[0] = last trade price
                const price = tickerData ? parseFloat(tickerData.c?.[0] || tickerData.last || 0) : 0;
                const open24h = tickerData ? parseFloat(tickerData.o || tickerData.open24h || price) : price;
                const value = balance * price;
                const change24h = open24h > 0 ? ((price - open24h) / open24h * 100) : 0;

                console.log(`[Kraken] ${asset}: balance=${balance}, price=${price}, value=${value}`);

                holdings.push({
                    symbol: asset,
                    name: getCryptoName(asset),
                    quantity: balance,
                    price,
                    value,
                    change24h,
                    type: 'crypto'
                });

                totalValue += value;
            }
        } catch (error) {
            console.error('[Kraken] Batch ticker failed, trying individually:', error.message);
            // Batch may fail if one pair is invalid — try each individually
            for (const asset of cryptoAssets) {
                const balance = balances[asset];
                let price = 0;
                let change24h = 0;

                try {
                    const pair = getKrakenTickerPair(asset);
                    const tickers = await getTicker([pair]);
                    const tickerKey = Object.keys(tickers)[0];
                    if (tickerKey && tickers[tickerKey]) {
                        price = parseFloat(tickers[tickerKey].c?.[0] || tickers[tickerKey].last || 0);
                        const open24h = parseFloat(tickers[tickerKey].o || tickers[tickerKey].open24h || price);
                        if (open24h > 0) change24h = ((price - open24h) / open24h * 100);
                    }
                } catch (e) {
                    console.log(`[Kraken] Individual ticker failed for ${asset}:`, e.message);
                }

                const value = balance * price;
                holdings.push({
                    symbol: asset,
                    name: getCryptoName(asset),
                    quantity: balance,
                    price,
                    value,
                    change24h,
                    type: 'crypto'
                });
                totalValue += value;
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
 * Get full name for crypto asset
 * @param {string} symbol - Asset symbol
 * @returns {string} Full name
 */
function getCryptoName(symbol) {
    const names = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'LTC': 'Litecoin',
        'XRP': 'Ripple',
        'XLM': 'Stellar',
        'DOGE': 'Dogecoin',
        'XMR': 'Monero',
        'ETC': 'Ethereum Classic',
        'ZEC': 'Zcash',
        'ADA': 'Cardano',
        'DOT': 'Polkadot',
        'SOL': 'Solana',
        'LINK': 'Chainlink',
        'MATIC': 'Polygon',
        'AVAX': 'Avalanche',
        'ATOM': 'Cosmos',
        'UNI': 'Uniswap',
        'AAVE': 'Aave'
    };
    return names[symbol] || symbol;
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
