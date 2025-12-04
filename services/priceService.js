// server/services/priceService.js - CENTRALIZED PRICE SERVICE
// No circular dependencies - standalone service

const axios = require('axios');

// ============ CONFIGURATION ============
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

// Cache for prices (5 minute TTL)
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ CRYPTO SYMBOL DETECTION ============
const CRYPTO_SYMBOLS = new Set([
    'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'DOT', 'MATIC', 'SHIB',
    'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL',
    'TRX', 'THETA', 'XMR', 'AAVE', 'GRT', 'FTM', 'SAND', 'MANA', 'AXS', 'CHZ',
    'ENJ', 'SUSHI', 'YFI', 'COMP', 'SNX', 'MKR', 'CRV', 'LRC', '1INCH', 'BAT',
    'ZRX', 'ANKR', 'STORJ', 'SKL', 'CELO', 'REN', 'UMA', 'BNT', 'OCEAN', 'FET',
    'ROSE', 'ONE', 'HOT', 'ZIL', 'ENS', 'IMX', 'LDO', 'APE', 'CRO', 'NEAR',
    'FLOW', 'ICP', 'EGLD', 'XTZ', 'HBAR', 'QNT', 'KLAY', 'BSV', 'NEO', 'WAVES',
    'DASH', 'ZEC', 'IOTA', 'KSM', 'CAKE', 'RUNE', 'AR', 'KAVA', 'MINA', 'XEC',
    'BTT', 'HNT', 'TFUEL', 'QTUM', 'OMG', 'ZEN', 'SC', 'DCR', 'ICX', 'ONT',
    'DGB', 'RVN', 'NANO', 'WAXP', 'LSK', 'ARDR', 'STEEM', 'SRM', 'RAY', 'AUDIO',
    'GALA', 'JASMY', 'SPELL', 'BICO', 'API3', 'DYDX', 'PEOPLE', 'SLP', 'C98',
    'BITCOIN', 'ETHEREUM', 'SOLANA', 'CARDANO', 'DOGECOIN', 'RIPPLE', 'POLKADOT',
    'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'INJ', 'SEI', 'SUI', 'APT', 'ARB', 'OP'
]);

// CoinGecko ID mapping for common symbols
const COINGECKO_IDS = {
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
    'APE': 'apecoin',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
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
    'RENDER': 'render-token',
    'PEPE': 'pepe',
    'FLOKI': 'floki',
    'BONK': 'bonk',
    'WIF': 'dogwifcoin'
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
 */
async function fetchCryptoPrice(symbol) {
    const coinId = getCoinGeckoId(symbol);
    
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
                source: 'coingecko'
            };
        }
    } catch (error) {
        console.log(`[PriceService] CoinGecko failed for ${symbol}:`, error.message);
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

// ============ MAIN EXPORTED FUNCTIONS ============

/**
 * Get current price for any symbol (crypto or stock)
 * @param {string} symbol - The symbol to get price for
 * @param {string} assetType - Optional: 'crypto' or 'stock'
 * @returns {Promise<{price: number|null, source: string|null, cached: boolean}>}
 */
async function getCurrentPrice(symbol, assetType = null) {
    if (!symbol) {
        return { price: null, source: null, cached: false };
    }
    
    const upperSymbol = symbol.toUpperCase().trim();
    const cacheKey = `price_${upperSymbol}`;
    
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
        // Try CoinGecko for crypto
        result = await fetchCryptoPrice(upperSymbol);
    } else {
        // Try Yahoo first for stocks
        result = await fetchStockPriceYahoo(upperSymbol);
        
        // Fallback to Alpha Vantage
        if (!result.price) {
            result = await fetchStockPriceAlphaVantage(upperSymbol);
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