// server/services/priceService.js
// Centralized price fetching service for stocks and crypto
// Uses Yahoo Finance for stocks and CoinGecko for crypto

const axios = require('axios');

// ============ PRICE CACHE ============
const priceCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds cache

// ============ CRYPTO SYMBOLS ============
const CRYPTO_SYMBOLS = [
    'BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'MATIC', 'SHIB', 'AVAX',
    'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'AAVE',
    'SAND', 'MANA', 'AXS', 'THETA', 'XTZ', 'EOS', 'CAKE', 'RUNE', 'ZEC', 'DASH',
    'NEO', 'WAVES', 'BAT', 'ENJ', 'CHZ', 'COMP', 'SNX', 'YFI', 'SUSHI', 'CRV',
    'BNB', 'TRX', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'SEI', 'TIA',
    'PEPE', 'WIF', 'BONK', 'FLOKI', 'RENDER', 'FET', 'TAO', 'INJ', 'RNDR', 'GRT',
    'IMX', 'STX', 'MKR', 'EGLD', 'HBAR', 'QNT', 'FTM', 'KAVA', 'FLOW', 'MINA',
    'BITCOIN', 'ETHEREUM', 'RIPPLE', 'SOLANA', 'CARDANO', 'DOGECOIN', 'POLKADOT'
];

// Crypto symbol to CoinGecko ID mapping
const CRYPTO_ID_MAP = {
    'BTC': 'bitcoin',
    'BITCOIN': 'bitcoin',
    'ETH': 'ethereum',
    'ETHEREUM': 'ethereum',
    'XRP': 'ripple',
    'RIPPLE': 'ripple',
    'SOL': 'solana',
    'SOLANA': 'solana',
    'ADA': 'cardano',
    'CARDANO': 'cardano',
    'DOGE': 'dogecoin',
    'DOGECOIN': 'dogecoin',
    'DOT': 'polkadot',
    'POLKADOT': 'polkadot',
    'MATIC': 'matic-network',
    'POLYGON': 'matic-network',
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
    'AAVE': 'aave',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'THETA': 'theta-token',
    'XTZ': 'tezos',
    'EOS': 'eos',
    'BNB': 'binancecoin',
    'TRX': 'tron',
    'BCH': 'bitcoin-cash',
    'NEAR': 'near',
    'APT': 'aptos',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'SUI': 'sui',
    'SEI': 'sei-network',
    'TIA': 'celestia',
    'PEPE': 'pepe',
    'WIF': 'dogwifcoin',
    'BONK': 'bonk',
    'FLOKI': 'floki',
    'RENDER': 'render-token',
    'RNDR': 'render-token',
    'FET': 'fetch-ai',
    'TAO': 'bittensor',
    'INJ': 'injective-protocol',
    'GRT': 'the-graph',
    'IMX': 'immutable-x',
    'STX': 'blockstack',
    'MKR': 'maker',
    'EGLD': 'elrond-erd-2',
    'HBAR': 'hedera-hashgraph',
    'QNT': 'quant-network',
    'FTM': 'fantom',
    'KAVA': 'kava',
    'FLOW': 'flow',
    'MINA': 'mina-protocol'
};

// ============ HELPER FUNCTIONS ============

function isCryptoSymbol(symbol) {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    return CRYPTO_SYMBOLS.includes(upper) || CRYPTO_ID_MAP[upper] !== undefined;
}

function getCacheKey(symbol, type) {
    return `${symbol.toUpperCase()}-${type}`;
}

function getCachedPrice(symbol, type) {
    const key = getCacheKey(symbol, type);
    const cached = priceCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.price;
    }
    
    return null;
}

function setCachedPrice(symbol, type, price) {
    const key = getCacheKey(symbol, type);
    priceCache.set(key, {
        price,
        timestamp: Date.now()
    });
}

// ============ STOCK PRICE FETCHING ============

async function getStockPrice(symbol) {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    const cached = getCachedPrice(upperSymbol, 'stock');
    if (cached !== null) {
        return { price: cached, source: 'cache' };
    }
    
    try {
        // Try Yahoo Finance API (via query1)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=1d`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const result = response.data?.chart?.result?.[0];
        if (!result) {
            throw new Error('No data returned');
        }
        
        // Get the current price
        const price = result.meta?.regularMarketPrice || 
                      result.indicators?.quote?.[0]?.close?.slice(-1)[0];
        
        if (!price || isNaN(price)) {
            throw new Error('Invalid price data');
        }
        
        setCachedPrice(upperSymbol, 'stock', price);
        return { price, source: 'yahoo' };
        
    } catch (error) {
        console.error(`[PriceService] Yahoo Finance error for ${upperSymbol}:`, error.message);
        
        // Try backup: Yahoo Finance v7 endpoint
        try {
            const backupUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${upperSymbol}`;
            const backupResponse = await axios.get(backupUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            const quote = backupResponse.data?.quoteResponse?.result?.[0];
            if (quote && quote.regularMarketPrice) {
                setCachedPrice(upperSymbol, 'stock', quote.regularMarketPrice);
                return { price: quote.regularMarketPrice, source: 'yahoo-v7' };
            }
        } catch (backupError) {
            console.error(`[PriceService] Backup Yahoo error for ${upperSymbol}:`, backupError.message);
        }
        
        return { price: null, source: 'error', error: error.message };
    }
}

// ============ CRYPTO PRICE FETCHING ============

async function getCryptoPrice(symbol) {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    const cached = getCachedPrice(upperSymbol, 'crypto');
    if (cached !== null) {
        return { price: cached, source: 'cache' };
    }
    
    // Get CoinGecko ID
    const coinId = CRYPTO_ID_MAP[upperSymbol] || upperSymbol.toLowerCase();
    
    try {
        // CoinGecko free API
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const price = response.data?.[coinId]?.usd;
        
        if (!price || isNaN(price)) {
            throw new Error('Invalid price data from CoinGecko');
        }
        
        setCachedPrice(upperSymbol, 'crypto', price);
        return { price, source: 'coingecko' };
        
    } catch (error) {
        console.error(`[PriceService] CoinGecko error for ${upperSymbol}:`, error.message);
        
        // Try backup: CoinGecko coins/markets endpoint
        try {
            const backupUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}`;
            const backupResponse = await axios.get(backupUrl, { timeout: 10000 });
            
            if (backupResponse.data?.[0]?.current_price) {
                const price = backupResponse.data[0].current_price;
                setCachedPrice(upperSymbol, 'crypto', price);
                return { price, source: 'coingecko-markets' };
            }
        } catch (backupError) {
            console.error(`[PriceService] Backup CoinGecko error:`, backupError.message);
        }
        
        // Last resort: Try Yahoo Finance for crypto (BTC-USD format)
        try {
            const yahooSymbol = `${upperSymbol}-USD`;
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
            
            const yahooResponse = await axios.get(yahooUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            const result = yahooResponse.data?.chart?.result?.[0];
            const price = result?.meta?.regularMarketPrice;
            
            if (price && !isNaN(price)) {
                setCachedPrice(upperSymbol, 'crypto', price);
                return { price, source: 'yahoo-crypto' };
            }
        } catch (yahooError) {
            console.error(`[PriceService] Yahoo crypto error:`, yahooError.message);
        }
        
        return { price: null, source: 'error', error: error.message };
    }
}

// ============ MAIN EXPORT FUNCTION ============

async function getCurrentPrice(symbol, type = 'stock') {
    if (!symbol) {
        return { price: null, source: 'error', error: 'No symbol provided' };
    }
    
    const upperSymbol = symbol.toUpperCase();
    
    // Auto-detect type if needed
    const detectedType = type || (isCryptoSymbol(upperSymbol) ? 'crypto' : 'stock');
    
    console.log(`[PriceService] Fetching ${detectedType} price for ${upperSymbol}`);
    
    if (detectedType === 'crypto') {
        return await getCryptoPrice(upperSymbol);
    } else {
        return await getStockPrice(upperSymbol);
    }
}

// ============ BATCH PRICE FETCHING ============

async function getBatchPrices(symbols) {
    const results = {};
    
    // Separate stocks and crypto
    const stocks = [];
    const cryptos = [];
    
    for (const sym of symbols) {
        if (isCryptoSymbol(sym)) {
            cryptos.push(sym);
        } else {
            stocks.push(sym);
        }
    }
    
    // Fetch in parallel
    const promises = [];
    
    for (const stock of stocks) {
        promises.push(
            getStockPrice(stock).then(result => {
                results[stock.toUpperCase()] = result;
            })
        );
    }
    
    for (const crypto of cryptos) {
        promises.push(
            getCryptoPrice(crypto).then(result => {
                results[crypto.toUpperCase()] = result;
            })
        );
    }
    
    await Promise.allSettled(promises);
    
    return results;
}

// ============ CACHE MANAGEMENT ============

function clearCache() {
    priceCache.clear();
    console.log('[PriceService] Cache cleared');
}

function getCacheStats() {
    return {
        size: priceCache.size,
        entries: Array.from(priceCache.keys())
    };
}

// ============ EXPORTS ============

module.exports = {
    getCurrentPrice,
    getStockPrice,
    getCryptoPrice,
    getBatchPrices,
    isCryptoSymbol,
    clearCache,
    getCacheStats,
    CRYPTO_SYMBOLS,
    CRYPTO_ID_MAP
};