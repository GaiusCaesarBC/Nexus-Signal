// server/services/priceService.js - Centralized Price Fetching Service
// Single source of truth for all price data across the platform

const axios = require('axios');

// API Configuration
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

// Cache configuration (reduces API calls significantly)
const priceCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for real-time prices
const EXTENDED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for less time-sensitive uses

// ============ CRYPTO SYMBOL MAPPING ============
// Comprehensive map of crypto symbols to CoinGecko IDs
const cryptoSymbolMap = {
    // Major cryptocurrencies
    BTC: 'bitcoin',
    ETH: 'ethereum',
    XRP: 'ripple',
    LTC: 'litecoin',
    BCH: 'bitcoin-cash',
    
    // Smart contract platforms
    ADA: 'cardano',
    SOL: 'solana',
    DOT: 'polkadot',
    AVAX: 'avalanche-2',
    ATOM: 'cosmos',
    NEAR: 'near',
    APT: 'aptos',
    SUI: 'sui',
    SEI: 'sei-network',
    TIA: 'celestia',
    
    // Layer 2 & Scaling
    MATIC: 'matic-network',
    ARB: 'arbitrum',
    OP: 'optimism',
    IMX: 'immutable-x',
    
    // DeFi
    UNI: 'uniswap',
    AAVE: 'aave',
    CRV: 'curve-dao-token',
    MKR: 'maker',
    SNX: 'havven',
    COMP: 'compound-governance-token',
    LDO: 'lido-dao',
    RPL: 'rocket-pool',
    FXS: 'frax-share',
    GMX: 'gmx',
    PENDLE: 'pendle',
    JUP: 'jupiter-exchange-solana',
    
    // Exchange tokens
    BNB: 'binancecoin',
    CRO: 'crypto-com-chain',
    OKB: 'okb',
    KCS: 'kucoin-shares',
    
    // Oracles & Infrastructure
    LINK: 'chainlink',
    BAND: 'band-protocol',
    API3: 'api3',
    
    // AI & Data
    FET: 'fetch-ai',
    RENDER: 'render-token',
    OCEAN: 'ocean-protocol',
    INJ: 'injective-protocol',
    
    // Meme coins
    DOGE: 'dogecoin',
    SHIB: 'shiba-inu',
    PEPE: 'pepe',
    BONK: 'bonk',
    WIF: 'dogwifcoin',
    FLOKI: 'floki',
    TRUMP: 'official-trump',
    
    // Privacy coins
    XMR: 'monero',
    ZEC: 'zcash',
    
    // Other major tokens
    TRX: 'tron',
    XLM: 'stellar',
    ALGO: 'algorand',
    VET: 'vechain',
    HBAR: 'hedera-hashgraph',
    FIL: 'filecoin',
    THETA: 'theta-token',
    EOS: 'eos',
    XTZ: 'tezos',
    FLOW: 'flow',
    SAND: 'the-sandbox',
    MANA: 'decentraland',
    AXS: 'axie-infinity',
    GALA: 'gala',
    ENJ: 'enjincoin',
    CHZ: 'chiliz',
    BAT: 'basic-attention-token',
    ZRX: '0x',
    ENS: 'ethereum-name-service',
    GRT: 'the-graph',
    QNT: 'quant-network',
    EGLD: 'elrond-erd-2',
    KDA: 'kadena',
    ROSE: 'oasis-network',
    KAVA: 'kava',
    ONE: 'harmony',
    ZIL: 'zilliqa',
    ICX: 'icon',
    WAVES: 'waves',
    NEO: 'neo',
    QTUM: 'qtum',
    ONT: 'ontology',
    IOTA: 'iota',
    SC: 'siacoin',
    DCR: 'decred',
    RVN: 'ravencoin',
    BTG: 'bitcoin-gold',
    DGB: 'digibyte',
    ZEN: 'horizen',
    KSM: 'kusama',
    CELO: 'celo',
    ANKR: 'ankr',
    SKL: 'skale',
    STORJ: 'storj',
    SNT: 'status',
    CVC: 'civic',
    NMR: 'numeraire',
    REP: 'augur',
    BNT: 'bancor',
    CELR: 'celer-network',
    DENT: 'dent',
    HOT: 'holotoken',
    WIN: 'wink',
    BTT: 'bittorrent',
    JST: 'just',
    SUN: 'sun-token',
    REEF: 'reef',
    ALICE: 'my-neighbor-alice',
    TLM: 'alien-worlds',
    ILV: 'illuvium',
    YGG: 'yield-guild-games',
    MAGIC: 'magic',
    PRIME: 'echelon-prime',
    BLUR: 'blur',
    ARK: 'ark',
    STACKS: 'blockstack',
    STX: 'blockstack',
    RUNE: 'thorchain',
    OSMO: 'osmosis',
    JUNO: 'juno-network',
    SCRT: 'secret',
    MINA: 'mina-protocol',
    CFX: 'conflux-token',
    CORE: 'coredaoorg',
    KASPA: 'kaspa',
    KAS: 'kaspa',
    TON: 'the-open-network',
    NOT: 'notcoin',
    TAO: 'bittensor',
    WLD: 'worldcoin-wld',
    PYTH: 'pyth-network',
    JTO: 'jito-governance-token',
    TWT: 'trust-wallet-token',
    SAFE: 'safe',
    EIGEN: 'eigenlayer',
    ENA: 'ethena',
    STRK: 'starknet',
    ZK: 'zksync',
    ONDO: 'ondo-finance',
    ETHFI: 'ether-fi',
    W: 'wormhole',
    DYM: 'dymension',
    ALT: 'altlayer',
    MANTA: 'manta-network',
    PIXEL: 'pixels',
    PORTAL: 'portal',
    AEVO: 'aevo-exchange',
    BOME: 'book-of-meme',
    MEW: 'cat-in-a-dogs-world',
    POPCAT: 'popcat',
    BRETT: 'brett',
    MOG: 'mog-coin',
    SPX: 'spx6900',
    NEIRO: 'neiro-on-eth',
    GOAT: 'goatseus-maximus',
    PNUT: 'peanut-the-squirrel',
    ACT: 'act-i-the-ai-prophecy',
    VIRTUAL: 'virtual-protocol',
    AI16Z: 'ai16z',
    GRIFFAIN: 'griffain',
    ZEREBRO: 'zerebro',
    ARC: 'arc',
    AIXBT: 'aixbt-by-virtuals',
    FARTCOIN: 'fartcoin',
    PENGU: 'pudgy-penguins',
    HYPE: 'hyperliquid',
    USUAL: 'usual',
    MOVE: 'movement',
    ME: 'magic-eden',
    VANA: 'vana',
    AVAAI: 'holoworld-ai',
    BIO: 'bio-protocol',
    ANIME: 'anime',
    MELANIA: 'melania-meme',
    VINE: 'vine-coin',
    SOLV: 'solv-protocol',
    LAYER: 'layer',
    TST: 'tst',
    KAITO: 'kaito',
    IP: 'story-2',
    RED: 'red',
    BMT: 'bubblemaps',
    FORM: 'binaryform-ai',
    NIL: 'nil',
    GPS: 'gps',
    SOON: 'soon',
    SHELL: 'myshell',
    B3: 'b3-token',
    PI: 'pi-network',
    BNX: 'binaryx',
    PARTI: 'parti',
    MUB: 'mubchain'
};

// Known crypto symbols for auto-detection (derived from map)
const KNOWN_CRYPTO_SYMBOLS = new Set(Object.keys(cryptoSymbolMap));

// Common crypto trading pair suffixes
const CRYPTO_SUFFIXES = ['-USD', '-USDT', '-BTC', '-ETH', '-BUSD', '-USDC', 'USD', 'USDT'];

// ============ HELPER FUNCTIONS ============

/**
 * Check if a symbol is a cryptocurrency
 * @param {string} symbol - The trading symbol
 * @returns {boolean}
 */
function isCryptoSymbol(symbol) {
    if (!symbol) return false;
    
    const upperSymbol = symbol.toUpperCase();
    
    // Check for crypto pair suffixes
    if (CRYPTO_SUFFIXES.some(suffix => upperSymbol.endsWith(suffix))) {
        return true;
    }
    
    // Check if base symbol is a known crypto
    const baseSymbol = getBaseSymbol(upperSymbol);
    return KNOWN_CRYPTO_SYMBOLS.has(baseSymbol);
}

/**
 * Extract base symbol from a trading pair (BTC-USD -> BTC)
 * @param {string} symbol - The trading symbol
 * @returns {string}
 */
function getBaseSymbol(symbol) {
    if (!symbol) return symbol;
    
    const upperSymbol = symbol.toUpperCase();
    
    // Handle various formats: BTC-USD, BTCUSD, BTC/USD
    if (upperSymbol.includes('-')) {
        return upperSymbol.split('-')[0];
    }
    if (upperSymbol.includes('/')) {
        return upperSymbol.split('/')[0];
    }
    
    // Handle BTCUSD format
    for (const suffix of ['USD', 'USDT', 'USDC', 'BTC', 'ETH']) {
        if (upperSymbol.endsWith(suffix) && upperSymbol.length > suffix.length) {
            return upperSymbol.slice(0, -suffix.length);
        }
    }
    
    return upperSymbol;
}

/**
 * Get CoinGecko ID for a crypto symbol
 * @param {string} symbol - The crypto symbol
 * @returns {string}
 */
function getCoinGeckoId(symbol) {
    const baseSymbol = getBaseSymbol(symbol);
    return cryptoSymbolMap[baseSymbol] || baseSymbol.toLowerCase();
}

/**
 * Get cached price if valid
 * @param {string} cacheKey - Cache key
 * @param {number} maxAge - Maximum age in ms
 * @returns {number|null}
 */
function getCachedPrice(cacheKey, maxAge = CACHE_TTL_MS) {
    const cached = priceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < maxAge) {
        return cached.price;
    }
    return null;
}

/**
 * Set price in cache
 * @param {string} cacheKey - Cache key
 * @param {number} price - Price to cache
 */
function setCachedPrice(cacheKey, price) {
    priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
    });
}

/**
 * Clear expired cache entries (call periodically)
 */
function clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of priceCache.entries()) {
        if (now - value.timestamp > EXTENDED_CACHE_TTL_MS) {
            priceCache.delete(key);
        }
    }
}

// Clear cache every 10 minutes
setInterval(clearExpiredCache, 10 * 60 * 1000);

// ============ PRICE FETCHING FUNCTIONS ============

/**
 * Fetch stock price from Alpha Vantage (Pro)
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number|null>}
 */
async function fetchAlphaVantagePrice(symbol) {
    const cacheKey = `av:${symbol.toUpperCase()}`;
    const cached = getCachedPrice(cacheKey);
    if (cached !== null) {
        console.log(`[PriceService] Cache hit for ${symbol}: $${cached}`);
        return cached;
    }
    
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data;
        
        // Check for API errors
        if (data['Error Message']) {
            console.error(`[PriceService] Alpha Vantage error for ${symbol}:`, data['Error Message']);
            return null;
        }
        
        // Check for rate limit (shouldn't hit with Pro, but just in case)
        if (data['Note']) {
            console.warn(`[PriceService] Alpha Vantage rate limit warning`);
        }
        
        if (data['Global Quote'] && data['Global Quote']['05. price']) {
            const price = parseFloat(data['Global Quote']['05. price']);
            setCachedPrice(cacheKey, price);
            console.log(`[PriceService] Alpha Vantage price for ${symbol}: $${price}`);
            return price;
        }
        
        console.log(`[PriceService] No Alpha Vantage data for ${symbol}`);
        return null;
        
    } catch (error) {
        console.error(`[PriceService] Alpha Vantage error for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Fetch crypto price from CoinGecko (Pro)
 * @param {string} symbol - Crypto symbol
 * @returns {Promise<number|null>}
 */
async function fetchCoinGeckoPrice(symbol) {
    const coinGeckoId = getCoinGeckoId(symbol);
    const cacheKey = `cg:${coinGeckoId}`;
    const cached = getCachedPrice(cacheKey);
    if (cached !== null) {
        console.log(`[PriceService] Cache hit for ${symbol} (${coinGeckoId}): $${cached}`);
        return cached;
    }
    
    try {
        const params = { 
            ids: coinGeckoId, 
            vs_currencies: 'usd',
            precision: 'full'
        };
        
        // Add Pro API key
        if (COINGECKO_API_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
        }
        
        const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, { 
            params, 
            timeout: 10000,
            headers: COINGECKO_API_KEY ? {
                'x-cg-pro-api-key': COINGECKO_API_KEY
            } : {}
        });
        
        const data = response.data;
        
        if (data[coinGeckoId] && data[coinGeckoId].usd !== undefined) {
            const price = data[coinGeckoId].usd;
            setCachedPrice(cacheKey, price);
            console.log(`[PriceService] CoinGecko price for ${symbol} (${coinGeckoId}): $${price}`);
            return price;
        }
        
        console.log(`[PriceService] No CoinGecko data for ${symbol} (${coinGeckoId})`);
        return null;
        
    } catch (error) {
        console.error(`[PriceService] CoinGecko error for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Fetch multiple crypto prices at once from CoinGecko (more efficient)
 * @param {string[]} symbols - Array of crypto symbols
 * @returns {Promise<Object>} - Map of symbol -> price
 */
async function fetchCoinGeckoPricesBatch(symbols) {
    if (!symbols || symbols.length === 0) return {};
    
    try {
        // Convert symbols to CoinGecko IDs
        const coinGeckoIds = symbols.map(s => getCoinGeckoId(s));
        const uniqueIds = [...new Set(coinGeckoIds)];
        
        const params = {
            ids: uniqueIds.join(','),
            vs_currencies: 'usd',
            precision: 'full'
        };
        
        if (COINGECKO_API_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
        }
        
        const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
            params,
            timeout: 15000,
            headers: COINGECKO_API_KEY ? {
                'x-cg-pro-api-key': COINGECKO_API_KEY
            } : {}
        });
        
        const data = response.data;
        const result = {};
        
        for (const symbol of symbols) {
            const coinGeckoId = getCoinGeckoId(symbol);
            if (data[coinGeckoId] && data[coinGeckoId].usd !== undefined) {
                result[symbol.toUpperCase()] = data[coinGeckoId].usd;
                setCachedPrice(`cg:${coinGeckoId}`, data[coinGeckoId].usd);
            }
        }
        
        console.log(`[PriceService] Batch fetched ${Object.keys(result).length}/${symbols.length} crypto prices`);
        return result;
        
    } catch (error) {
        console.error(`[PriceService] CoinGecko batch error:`, error.message);
        return {};
    }
}

/**
 * Fetch price using Yahoo Finance as fallback
 * @param {string} symbol - Stock or crypto symbol
 * @returns {Promise<number|null>}
 */
async function fetchYahooFinancePrice(symbol) {
    const cacheKey = `yf:${symbol.toUpperCase()}`;
    const cached = getCachedPrice(cacheKey);
    if (cached !== null) {
        console.log(`[PriceService] Cache hit (Yahoo) for ${symbol}: $${cached}`);
        return cached;
    }
    
    try {
        // Dynamic import for yahoo-finance2
        const yahooFinance = require('yahoo-finance2').default;
        
        // Format symbol for Yahoo
        let yahooSymbol = symbol.toUpperCase();
        if (isCryptoSymbol(symbol) && !yahooSymbol.includes('-')) {
            yahooSymbol = `${getBaseSymbol(yahooSymbol)}-USD`;
        }
        
        const quote = await yahooFinance.quote(yahooSymbol);
        
        if (quote && quote.regularMarketPrice) {
            const price = quote.regularMarketPrice;
            setCachedPrice(cacheKey, price);
            console.log(`[PriceService] Yahoo Finance price for ${yahooSymbol}: $${price}`);
            return price;
        }
        
        return null;
        
    } catch (error) {
        console.log(`[PriceService] Yahoo Finance error for ${symbol}:`, error.message);
        return null;
    }
}

// ============ MAIN PRICE FETCHING FUNCTION ============

/**
 * Get current price for any asset with automatic detection and fallbacks
 * @param {string} symbol - The trading symbol
 * @param {string} [assetType] - Optional: 'stock' or 'crypto' (auto-detected if not provided)
 * @param {Object} [options] - Options
 * @param {boolean} [options.skipCache] - Skip cache lookup
 * @param {boolean} [options.useFallback] - Use fallback sources (default: true)
 * @returns {Promise<{price: number|null, source: string, cached: boolean}>}
 */
async function getCurrentPrice(symbol, assetType = null, options = {}) {
    const { skipCache = false, useFallback = true } = options;
    
    if (!symbol) {
        console.error('[PriceService] No symbol provided');
        return { price: null, source: null, cached: false };
    }
    
    const upperSymbol = symbol.toUpperCase();
    
    // Auto-detect asset type if not provided
    const detectedCrypto = isCryptoSymbol(upperSymbol);
    const isCrypto = assetType === 'crypto' || (assetType !== 'stock' && detectedCrypto);
    
    if (detectedCrypto && assetType && assetType !== 'crypto') {
        console.log(`[PriceService] Auto-correcting ${symbol}: stored as ${assetType}, detected as crypto`);
    }
    
    let price = null;
    let source = null;
    let cached = false;
    
    if (isCrypto) {
        // Crypto: Try CoinGecko first (Pro), then Yahoo Finance
        price = await fetchCoinGeckoPrice(upperSymbol);
        source = 'coingecko';
        
        if (price === null && useFallback) {
            console.log(`[PriceService] CoinGecko failed for ${symbol}, trying Yahoo Finance...`);
            price = await fetchYahooFinancePrice(upperSymbol);
            source = 'yahoo';
        }
        
    } else {
        // Stock: Try Alpha Vantage first (Pro), then Yahoo Finance
        price = await fetchAlphaVantagePrice(upperSymbol);
        source = 'alphavantage';
        
        if (price === null && useFallback) {
            console.log(`[PriceService] Alpha Vantage failed for ${symbol}, trying Yahoo Finance...`);
            price = await fetchYahooFinancePrice(upperSymbol);
            source = 'yahoo';
        }
    }
    
    if (price === null) {
        console.log(`[PriceService] ❌ All sources failed for ${symbol}`);
        source = null;
    }
    
    return { price, source, cached };
}

/**
 * Simple price getter (returns just the price number)
 * @param {string} symbol - The trading symbol
 * @param {string} [assetType] - Optional asset type
 * @returns {Promise<number|null>}
 */
async function getPrice(symbol, assetType = null) {
    const result = await getCurrentPrice(symbol, assetType);
    return result.price;
}

/**
 * Get prices for multiple symbols efficiently
 * @param {Array<{symbol: string, assetType?: string}>} assets - Array of assets
 * @returns {Promise<Object>} - Map of symbol -> price
 */
async function getPricesBatch(assets) {
    if (!assets || assets.length === 0) return {};
    
    const results = {};
    
    // Separate crypto and stocks
    const cryptoAssets = assets.filter(a => isCryptoSymbol(a.symbol) || a.assetType === 'crypto');
    const stockAssets = assets.filter(a => !isCryptoSymbol(a.symbol) && a.assetType !== 'crypto');
    
    // Batch fetch crypto prices
    if (cryptoAssets.length > 0) {
        const cryptoPrices = await fetchCoinGeckoPricesBatch(cryptoAssets.map(a => a.symbol));
        Object.assign(results, cryptoPrices);
    }
    
    // Fetch stock prices individually (Alpha Vantage doesn't have great batch support)
    for (const asset of stockAssets) {
        const price = await getPrice(asset.symbol, 'stock');
        if (price !== null) {
            results[asset.symbol.toUpperCase()] = price;
        }
        // Small delay between stock API calls
        if (stockAssets.indexOf(asset) < stockAssets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    return results;
}

// ============ CACHE MANAGEMENT ============

/**
 * Get cache statistics
 * @returns {Object}
 */
function getCacheStats() {
    return {
        size: priceCache.size,
        entries: Array.from(priceCache.keys())
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
 * Manually set a price (useful for testing or manual overrides)
 * @param {string} symbol - The symbol
 * @param {number} price - The price
 */
function setPrice(symbol, price) {
    const cacheKey = `manual:${symbol.toUpperCase()}`;
    setCachedPrice(cacheKey, price);
}

// ============ EXPORTS ============

module.exports = {
    // Main functions
    getCurrentPrice,
    getPrice,
    getPricesBatch,
    
    // Individual source functions (if needed directly)
    fetchAlphaVantagePrice,
    fetchCoinGeckoPrice,
    fetchCoinGeckoPricesBatch,
    fetchYahooFinancePrice,
    
    // Helper functions
    isCryptoSymbol,
    getBaseSymbol,
    getCoinGeckoId,
    
    // Cache management
    getCacheStats,
    clearCache,
    setPrice,
    
    // Constants (for reference)
    cryptoSymbolMap,
    KNOWN_CRYPTO_SYMBOLS: Array.from(KNOWN_CRYPTO_SYMBOLS)
};