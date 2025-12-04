// server/services/priceService.js - CENTRALIZED PRICE SERVICE
// No circular dependencies - standalone service

const axios = require('axios');

// ============ CONFIGURATION ============
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Cache for prices (5 minute TTL)
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ CRYPTO SYMBOL DETECTION ============
const CRYPTO_SYMBOLS = new Set([
    // Top coins
    'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'DOT', 'MATIC', 'SHIB',
    'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL',
    'TRX', 'NEAR', 'TON',
    // DeFi & Layer 2
    'AAVE', 'MKR', 'CRV', 'LDO', 'ARB', 'OP', 'INJ', 'SUI', 'APT', 'SEI',
    'COMP', 'SNX', 'SUSHI', 'YFI', '1INCH', 'DYDX', 'GMX',
    // Meme coins
    'PEPE', 'FLOKI', 'BONK', 'WIF',
    // Metaverse & Gaming
    'APE', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'IMX', 'RENDER', 'AUDIO', 'CHZ',
    // Infrastructure
    'GRT', 'FTM', 'THETA', 'TFUEL', 'LRC', 'ZRX', 'ANKR', 'STORJ', 'SKL', 'CELO',
    'REN', 'UMA', 'BNT', 'OCEAN', 'FET', 'API3', 'ENS',
    // Privacy & Legacy
    'XMR', 'DASH', 'ZEC', 'ZEN', 'SC', 'DCR', 'AR',
    // Smart Contract Platforms
    'FLOW', 'ICP', 'EGLD', 'XTZ', 'HBAR', 'QNT', 'KLAY', 'BSV', 'NEO', 'WAVES',
    'IOTA', 'KSM', 'KAVA', 'MINA', 'ROSE', 'ONE', 'ZIL', 'ICX', 'ONT', 'QTUM',
    // Exchange & DeFi tokens
    'CRO', 'CAKE', 'RUNE', 'SRM', 'RAY', 'C98', 'BICO',
    // Other popular
    'BAT', 'HOT', 'XEC', 'BTT', 'HNT', 'OMG', 'DGB', 'RVN', 'NANO', 'WAXP',
    'LSK', 'ARDR', 'STEEM', 'JASMY', 'SPELL', 'PEOPLE', 'SLP',
    // Full name aliases
    'BITCOIN', 'ETHEREUM', 'SOLANA', 'CARDANO', 'DOGECOIN', 'RIPPLE', 'POLKADOT'
]);

// CoinGecko ID mapping - comprehensive list for all supported cryptos
const COINGECKO_IDS = {
    // Top coins
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'SOL': 'solana',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'SHIB': 'shiba-inu',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'LTC': 'litecoin',
    'ETC': 'ethereum-classic',
    'XLM': 'stellar',
    'ALGO': 'algorand',
    'VET': 'vechain',
    'FIL': 'filecoin',
    'TRX': 'tron',
    'NEAR': 'near',
    'TON': 'the-open-network',
    // DeFi & Layer 2
    'AAVE': 'aave',
    'MKR': 'maker',
    'CRV': 'curve-dao-token',
    'LDO': 'lido-dao',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'INJ': 'injective-protocol',
    'SUI': 'sui',
    'APT': 'aptos',
    'SEI': 'sei-network',
    'COMP': 'compound-governance-token',
    'SNX': 'havven',
    'SUSHI': 'sushi',
    'YFI': 'yearn-finance',
    '1INCH': '1inch',
    'DYDX': 'dydx',
    'GMX': 'gmx',
    // Meme coins
    'PEPE': 'pepe',
    'FLOKI': 'floki',
    'BONK': 'bonk',
    'WIF': 'dogwifcoin',
    // Metaverse & Gaming
    'APE': 'apecoin',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'GALA': 'gala',
    'ENJ': 'enjincoin',
    'IMX': 'immutable-x',
    'RENDER': 'render-token',
    'AUDIO': 'audius',
    'CHZ': 'chiliz',
    // Infrastructure
    'GRT': 'the-graph',
    'FTM': 'fantom',
    'THETA': 'theta-token',
    'TFUEL': 'theta-fuel',
    'LRC': 'loopring',
    'ZRX': '0x',
    'ANKR': 'ankr',
    'STORJ': 'storj',
    'SKL': 'skale',
    'CELO': 'celo',
    'REN': 'republic-protocol',
    'UMA': 'uma',
    'BNT': 'bancor',
    'OCEAN': 'ocean-protocol',
    'FET': 'fetch-ai',
    'API3': 'api3',
    'ENS': 'ethereum-name-service',
    // Privacy & Legacy
    'XMR': 'monero',
    'DASH': 'dash',
    'ZEC': 'zcash',
    'ZEN': 'horizen',
    'SC': 'siacoin',
    'DCR': 'decred',
    'AR': 'arweave',
    // Smart Contract Platforms
    'FLOW': 'flow',
    'ICP': 'internet-computer',
    'EGLD': 'elrond-erd-2',
    'XTZ': 'tezos',
    'HBAR': 'hedera-hashgraph',
    'QNT': 'quant-network',
    'KLAY': 'klay-token',
    'BSV': 'bitcoin-cash-sv',
    'NEO': 'neo',
    'WAVES': 'waves',
    'IOTA': 'iota',
    'KSM': 'kusama',
    'KAVA': 'kava',
    'MINA': 'mina-protocol',
    'ROSE': 'oasis-network',
    'ONE': 'harmony',
    'ZIL': 'zilliqa',
    'ICX': 'icon',
    'ONT': 'ontology',
    'QTUM': 'qtum',
    // Exchange & DeFi tokens
    'CRO': 'crypto-com-chain',
    'CAKE': 'pancakeswap-token',
    'RUNE': 'thorchain',
    'SRM': 'serum',
    'RAY': 'raydium',
    'C98': 'coin98',
    'BICO': 'biconomy',
    // Other popular
    'BAT': 'basic-attention-token',
    'HOT': 'holotoken',
    'XEC': 'ecash',
    'BTT': 'bittorrent',
    'HNT': 'helium',
    'OMG': 'omisego',
    'DGB': 'digibyte',
    'RVN': 'ravencoin',
    'NANO': 'nano',
    'WAXP': 'wax',
    'LSK': 'lisk',
    'ARDR': 'ardor',
    'STEEM': 'steem',
    'JASMY': 'jasmy',
    'SPELL': 'spell-token',
    'PEOPLE': 'constitutiondao',
    'SLP': 'smooth-love-potion'
};

// ============ HELPER FUNCTIONS ============

/**
 * Normalize symbol - handles BTC-USD, BTC/USD, BTCUSD -> BTC
 * Allows users to enter crypto in any common format
 */
function normalizeSymbol(symbol) {
    if (!symbol) return '';
    let upper = symbol.toUpperCase().trim();

    // Remove common crypto pair suffixes
    const suffixes = ['-USD', '-USDT', '-BUSD', '-EUR', '-GBP', '/USD', '/USDT'];
    for (const suffix of suffixes) {
        if (upper.endsWith(suffix)) {
            const base = upper.slice(0, -suffix.length);
            // Only strip if the base is a known crypto
            if (CRYPTO_SYMBOLS.has(base) || COINGECKO_IDS.hasOwnProperty(base)) {
                return base;
            }
        }
    }

    // Handle BTCUSD, ETHUSD format (4+ char base + USD/USDT)
    if (upper.endsWith('USDT') && upper.length > 4) {
        const base = upper.slice(0, -4);
        if (CRYPTO_SYMBOLS.has(base) || COINGECKO_IDS.hasOwnProperty(base)) {
            return base;
        }
    }
    if (upper.endsWith('USD') && upper.length > 3) {
        const base = upper.slice(0, -3);
        if (CRYPTO_SYMBOLS.has(base) || COINGECKO_IDS.hasOwnProperty(base)) {
            return base;
        }
    }

    return upper;
}

/**
 * Check if a symbol is a cryptocurrency
 */
function isCryptoSymbol(symbol) {
    if (!symbol) return false;
    const normalized = normalizeSymbol(symbol);
    return CRYPTO_SYMBOLS.has(normalized) || COINGECKO_IDS.hasOwnProperty(normalized);
}

/**
 * Get CoinGecko ID for a symbol
 */
function getCoinGeckoId(symbol) {
    if (!symbol) return null;
    const normalized = normalizeSymbol(symbol);
    return COINGECKO_IDS[normalized] || normalized.toLowerCase();
}

/**
 * Get from cache if valid
 */
function getFromCache(key) {
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached;
    }
    return null;
}

/**
 * Set cache entry
 */
function setCache(key, price, source) {
    priceCache.set(key, {
        price,
        source,
        timestamp: Date.now()
    });
}

// ============ PRICE FETCHING FUNCTIONS ============

/**
 * Fetch crypto price from CoinGecko
 * @param {string} symbol - The crypto symbol (e.g., BTC, ETH)
 * @param {string} coinGeckoId - Optional: The exact CoinGecko ID if known
 */
async function fetchCryptoPrice(symbol, coinGeckoId = null) {
    // Use provided coinGeckoId if available, otherwise derive from symbol
    const coinId = coinGeckoId || getCoinGeckoId(symbol);

    try {
        const headers = {};
        if (COINGECKO_API_KEY) {
            headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }

        const baseUrl = COINGECKO_API_KEY
            ? 'https://pro-api.coingecko.com/api/v3'
            : 'https://api.coingecko.com/api/v3';

        const response = await axios.get(
            `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`,
            { headers, timeout: 10000 }
        );

        if (response.data && response.data[coinId] && response.data[coinId].usd) {
            return {
                price: response.data[coinId].usd,
                source: 'coingecko',
                coinGeckoId: coinId
            };
        }

        // If the provided/derived ID failed and we have a coinGeckoId, try symbol-based lookup as fallback
        if (coinGeckoId && coinId !== getCoinGeckoId(symbol)) {
            const fallbackId = getCoinGeckoId(symbol);
            const fallbackResponse = await axios.get(
                `${baseUrl}/simple/price?ids=${fallbackId}&vs_currencies=usd`,
                { headers, timeout: 10000 }
            );

            if (fallbackResponse.data && fallbackResponse.data[fallbackId] && fallbackResponse.data[fallbackId].usd) {
                return {
                    price: fallbackResponse.data[fallbackId].usd,
                    source: 'coingecko',
                    coinGeckoId: fallbackId
                };
            }
        }
    } catch (error) {
        console.log(`[PriceService] CoinGecko failed for ${symbol} (${coinId}):`, error.message);
    }

    return { price: null, source: null };
}

/**
 * Fetch stock price from Yahoo Finance
 */
async function fetchStockPriceYahoo(symbol) {
    try {
        const response = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
            { timeout: 10000 }
        );
        
        const result = response.data?.chart?.result?.[0];
        if (result) {
            const price = result.meta?.regularMarketPrice || 
                         result.indicators?.quote?.[0]?.close?.slice(-1)[0];
            
            if (price) {
                return {
                    price: parseFloat(price),
                    source: 'yahoo'
                };
            }
        }
    } catch (error) {
        console.log(`[PriceService] Yahoo failed for ${symbol}:`, error.message);
    }
    
    return { price: null, source: null };
}

/**
 * Fetch stock price from Alpha Vantage
 */
async function fetchStockPriceAlphaVantage(symbol) {
    if (!ALPHA_VANTAGE_KEY) {
        return { price: null, source: null };
    }

    try {
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`,
            { timeout: 10000 }
        );

        const quote = response.data?.['Global Quote'];
        if (quote && quote['05. price']) {
            return {
                price: parseFloat(quote['05. price']),
                source: 'alphavantage'
            };
        }
    } catch (error) {
        console.log(`[PriceService] Alpha Vantage failed for ${symbol}:`, error.message);
    }

    return { price: null, source: null };
}

/**
 * Fetch stock price from Finnhub (additional fallback)
 */
async function fetchStockPriceFinnhub(symbol) {
    if (!FINNHUB_API_KEY) {
        return { price: null, source: null };
    }

    try {
        const response = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
            { timeout: 10000 }
        );

        // Finnhub returns: c = current price, h = high, l = low, o = open, pc = previous close
        if (response.data && response.data.c && response.data.c > 0) {
            return {
                price: parseFloat(response.data.c),
                source: 'finnhub'
            };
        }
    } catch (error) {
        console.log(`[PriceService] Finnhub failed for ${symbol}:`, error.message);
    }

    return { price: null, source: null };
}

// ============ MAIN EXPORTED FUNCTIONS ============

/**
 * Get current price for any symbol (crypto or stock)
 * @param {string} symbol - The symbol to get price for
 * @param {string} assetType - Optional: 'crypto' or 'stock'
 * @param {object} options - Optional: { coinGeckoId: string } for crypto
 * @returns {Promise<{price: number|null, source: string|null, cached: boolean}>}
 */
async function getCurrentPrice(symbol, assetType = null, options = {}) {
    if (!symbol) {
        return { price: null, source: null, cached: false };
    }

    const upperSymbol = symbol.toUpperCase().trim();
    const { coinGeckoId } = options;

    // Use coinGeckoId in cache key if provided for uniqueness
    const cacheKey = coinGeckoId ? `price_crypto_${coinGeckoId}` : `price_${upperSymbol}`;

    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
        console.log(`[PriceService] Cache hit for ${upperSymbol}: $${cached.price}`);
        return { price: cached.price, source: cached.source, cached: true };
    }

    // Determine asset type
    const isCrypto = assetType === 'crypto' || isCryptoSymbol(upperSymbol);

    let result = { price: null, source: null };

    if (isCrypto) {
        // Try CoinGecko for crypto - pass coinGeckoId if available
        result = await fetchCryptoPrice(upperSymbol, coinGeckoId);
    } else {
        // Try Yahoo first for stocks
        result = await fetchStockPriceYahoo(upperSymbol);

        // Fallback to Alpha Vantage
        if (!result.price) {
            result = await fetchStockPriceAlphaVantage(upperSymbol);
        }

        // Fallback to Finnhub
        if (!result.price) {
            result = await fetchStockPriceFinnhub(upperSymbol);
        }
    }

    // Cache successful results
    if (result.price !== null) {
        setCache(cacheKey, result.price, result.source);
        console.log(`[PriceService] Fetched ${upperSymbol}: $${result.price} (${result.source})`);
    }

    return { ...result, cached: false };
}

/**
 * Get prices for multiple symbols in batch
 * @param {string[]} symbols - Array of symbols
 * @returns {Promise<Map<string, number>>}
 */
async function getBatchPrices(symbols) {
    const results = new Map();
    
    if (!symbols || symbols.length === 0) {
        return results;
    }
    
    // Separate crypto and stocks
    const cryptoSymbols = [];
    const stockSymbols = [];
    
    for (const symbol of symbols) {
        const upper = symbol.toUpperCase().trim();
        if (isCryptoSymbol(upper)) {
            cryptoSymbols.push(upper);
        } else {
            stockSymbols.push(upper);
        }
    }
    
    // Batch fetch crypto prices from CoinGecko
    if (cryptoSymbols.length > 0) {
        try {
            const coinIds = cryptoSymbols.map(s => getCoinGeckoId(s)).join(',');
            
            const headers = {};
            if (COINGECKO_API_KEY) {
                headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
            }
            
            const baseUrl = COINGECKO_API_KEY 
                ? 'https://pro-api.coingecko.com/api/v3'
                : 'https://api.coingecko.com/api/v3';
            
            const response = await axios.get(
                `${baseUrl}/simple/price?ids=${coinIds}&vs_currencies=usd`,
                { headers, timeout: 15000 }
            );
            
            for (const symbol of cryptoSymbols) {
                const coinId = getCoinGeckoId(symbol);
                if (response.data[coinId]?.usd) {
                    const price = response.data[coinId].usd;
                    results.set(symbol, price);
                    setCache(`price_${symbol}`, price, 'coingecko');
                }
            }
        } catch (error) {
            console.log(`[PriceService] Batch crypto fetch failed:`, error.message);
        }
    }
    
    // Fetch stock prices individually (Yahoo doesn't have good batch API)
    for (const symbol of stockSymbols) {
        const result = await getCurrentPrice(symbol, 'stock');
        if (result.price) {
            results.set(symbol, result.price);
        }
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[PriceService] Batch fetched ${results.size}/${symbols.length} prices`);
    return results;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    let validCount = 0;
    const now = Date.now();
    
    for (const [key, value] of priceCache.entries()) {
        if (now - value.timestamp < CACHE_TTL) {
            validCount++;
        }
    }
    
    return {
        size: priceCache.size,
        validEntries: validCount,
        ttlMinutes: CACHE_TTL / 60000
    };
}

/**
 * Clear all cached prices
 */
function clearCache() {
    priceCache.clear();
    console.log('[PriceService] Cache cleared');
}

/**
 * Get a single price (alias for getCurrentPrice for backward compatibility)
 */
async function getPrice(symbol, assetType = null) {
    const result = await getCurrentPrice(symbol, assetType);
    return result.price;
}

// ============ EXPORTS ============
module.exports = {
    // Main functions
    getCurrentPrice,
    getPrice,
    getBatchPrices,
    
    // Helper functions
    normalizeSymbol,
    isCryptoSymbol,
    getCoinGeckoId,
    
    // Cache management
    getCacheStats,
    clearCache,
    
    // Constants (for external use if needed)
    CRYPTO_SYMBOLS,
    COINGECKO_IDS
};