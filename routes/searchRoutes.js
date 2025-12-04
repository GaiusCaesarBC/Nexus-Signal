// server/routes/searchRoutes.js - Stock & Crypto Search API
// Uses Alpha Vantage Pro for stocks, CoinGecko Pro for crypto, Yahoo Finance as backup

const express = require('express');
const router = express.Router();
const axios = require('axios');

// API Keys
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
const THE_GRAPH_API_KEY = process.env.THE_GRAPH_API_KEY;
const PANCAKESWAP_V3_SUBGRAPH_ID = process.env.PANCAKESWAP_V3_SUBGRAPH_ID || 'A1fvJWQLBeUAggX2WQTMm3FKjXTekNXo77ZySun4YN2m';

// Cache for search results (short TTL since search is dynamic)
const searchCache = new Map();
const CACHE_DURATION = 60 * 1000; // 1 minute cache
const COIN_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for coin list

// Store coin list for faster crypto lookups
let coinListCache = null;
let coinListCacheTime = 0;

// Common crypto symbols for quick matching
const COMMON_CRYPTO = {
    'BTC': { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    'ETH': { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    'SOL': { id: 'solana', name: 'Solana', symbol: 'SOL' },
    'XRP': { id: 'ripple', name: 'XRP', symbol: 'XRP' },
    'ADA': { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
    'DOGE': { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
    'DOT': { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
    'MATIC': { id: 'matic-network', name: 'Polygon', symbol: 'MATIC' },
    'LINK': { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
    'AVAX': { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
    'SHIB': { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB' },
    'LTC': { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
    'UNI': { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
    'ATOM': { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM' },
    'XLM': { id: 'stellar', name: 'Stellar', symbol: 'XLM' },
    'ALGO': { id: 'algorand', name: 'Algorand', symbol: 'ALGO' },
    'VET': { id: 'vechain', name: 'VeChain', symbol: 'VET' },
    'FIL': { id: 'filecoin', name: 'Filecoin', symbol: 'FIL' },
    'AAVE': { id: 'aave', name: 'Aave', symbol: 'AAVE' },
    'SAND': { id: 'the-sandbox', name: 'The Sandbox', symbol: 'SAND' },
    'MANA': { id: 'decentraland', name: 'Decentraland', symbol: 'MANA' },
    'AXS': { id: 'axie-infinity', name: 'Axie Infinity', symbol: 'AXS' },
    'BNB': { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    'TRX': { id: 'tron', name: 'TRON', symbol: 'TRX' },
    'NEAR': { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR' },
    'APT': { id: 'aptos', name: 'Aptos', symbol: 'APT' },
    'ARB': { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB' },
    'OP': { id: 'optimism', name: 'Optimism', symbol: 'OP' },
    'SUI': { id: 'sui', name: 'Sui', symbol: 'SUI' },
    'SEI': { id: 'sei-network', name: 'Sei', symbol: 'SEI' },
    'PEPE': { id: 'pepe', name: 'Pepe', symbol: 'PEPE' },
    'INJ': { id: 'injective-protocol', name: 'Injective', symbol: 'INJ' },
    'FET': { id: 'fetch-ai', name: 'Fetch.ai', symbol: 'FET' },
    'RENDER': { id: 'render-token', name: 'Render', symbol: 'RENDER' },
    'TAO': { id: 'bittensor', name: 'Bittensor', symbol: 'TAO' },
    'FTM': { id: 'fantom', name: 'Fantom', symbol: 'FTM' },
    'HBAR': { id: 'hedera-hashgraph', name: 'Hedera', symbol: 'HBAR' },
    'ICP': { id: 'internet-computer', name: 'Internet Computer', symbol: 'ICP' },
    'MKR': { id: 'maker', name: 'Maker', symbol: 'MKR' },
    'GRT': { id: 'the-graph', name: 'The Graph', symbol: 'GRT' },
    'IMX': { id: 'immutable-x', name: 'Immutable', symbol: 'IMX' },
    'STX': { id: 'blockstack', name: 'Stacks', symbol: 'STX' },
    'BONK': { id: 'bonk', name: 'Bonk', symbol: 'BONK' },
    'WIF': { id: 'dogwifcoin', name: 'dogwifhat', symbol: 'WIF' },
    'FLOKI': { id: 'floki', name: 'FLOKI', symbol: 'FLOKI' },
};

// ============ HELPER FUNCTIONS ============

// Get cached result if valid
function getCachedResult(key) {
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Set cache
function setCacheResult(key, data) {
    searchCache.set(key, { data, timestamp: Date.now() });
}

// Fetch full coin list from CoinGecko (cached for 24h)
async function getCoinList() {
    if (coinListCache && Date.now() - coinListCacheTime < COIN_LIST_CACHE_DURATION) {
        return coinListCache;
    }

    try {
        const response = await axios.get(`${COINGECKO_BASE_URL}/coins/list`, {
            params: { x_cg_pro_api_key: COINGECKO_API_KEY }
        });
        coinListCache = response.data;
        coinListCacheTime = Date.now();
        console.log(`[Search] Loaded ${coinListCache.length} coins from CoinGecko`);
        return coinListCache;
    } catch (error) {
        console.error('[Search] Failed to fetch coin list:', error.message);
        return [];
    }
}

// Search stocks using Alpha Vantage SYMBOL_SEARCH
async function searchStocks(query) {
    try {
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'SYMBOL_SEARCH',
                keywords: query,
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 10000
        });

        const matches = response.data.bestMatches || [];
        
        // Filter to only US stocks (exclude forex, crypto listed on AV, etc.)
        return matches
            .filter(match => {
                const type = match['3. type'];
                const region = match['4. region'];
                // Only include Equity from US
                return type === 'Equity' && region === 'United States';
            })
            .slice(0, 8)
            .map(match => ({
                symbol: match['1. symbol'],
                name: match['2. name'],
                type: 'stock',
                exchange: match['8. currency'] === 'USD' ? 'NASDAQ/NYSE' : match['4. region'],
                matchScore: parseFloat(match['9. matchScore']) || 0
            }));
    } catch (error) {
        console.error('[Search] Alpha Vantage search failed:', error.message);
        return [];
    }
}

// Backup stock search using Yahoo Finance
async function searchStocksYahoo(query) {
    try {
        const response = await axios.get('https://query1.finance.yahoo.com/v1/finance/search', {
            params: {
                q: query,
                quotesCount: 8,
                newsCount: 0,
                enableFuzzyQuery: true,
                quotesQueryId: 'tss_match_phrase_query'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const quotes = response.data.quotes || [];
        
        return quotes
            .filter(q => q.quoteType === 'EQUITY' && !q.symbol.includes('-'))
            .slice(0, 8)
            .map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                type: 'stock',
                exchange: q.exchange || 'NASDAQ',
                matchScore: q.score || 0
            }));
    } catch (error) {
        console.error('[Search] Yahoo Finance search failed:', error.message);
        return [];
    }
}

// Search crypto - first check common list, then CoinGecko
async function searchCrypto(query) {
    const queryUpper = query.toUpperCase();
    const queryLower = query.toLowerCase();
    const results = [];

    // First, check common crypto list (instant)
    for (const [symbol, data] of Object.entries(COMMON_CRYPTO)) {
        if (
            symbol.includes(queryUpper) ||
            data.name.toLowerCase().includes(queryLower) ||
            data.id.includes(queryLower)
        ) {
            results.push({
                symbol: data.symbol,
                name: data.name,
                type: 'crypto',
                coinGeckoId: data.id,
                matchScore: symbol === queryUpper ? 1 : 0.8
            });
        }
    }

    // If we have enough results from common list, return early
    if (results.length >= 5) {
        return results.slice(0, 8);
    }

    // Search CoinGecko for more results
    try {
        const response = await axios.get(`${COINGECKO_BASE_URL}/search`, {
            params: {
                query: query,
                x_cg_pro_api_key: COINGECKO_API_KEY
            },
            timeout: 10000
        });

        const coins = response.data.coins || [];
        
        for (const coin of coins.slice(0, 10)) {
            // Skip if already in results
            if (results.some(r => r.symbol === coin.symbol.toUpperCase())) continue;
            
            results.push({
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                type: 'crypto',
                coinGeckoId: coin.id,
                thumb: coin.thumb,
                marketCapRank: coin.market_cap_rank,
                matchScore: coin.market_cap_rank ? 1 / coin.market_cap_rank : 0.1
            });
        }
    } catch (error) {
        console.error('[Search] CoinGecko search failed:', error.message);
    }

    // Sort by match score and return top 8
    return results
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 8);
}

// Search PancakeSwap for BSC tokens via The Graph
async function searchPancakeSwap(query) {
    if (!THE_GRAPH_API_KEY) {
        return [];
    }

    try {
        const endpoint = `https://gateway.thegraph.com/api/${THE_GRAPH_API_KEY}/subgraphs/id/${PANCAKESWAP_V3_SUBGRAPH_ID}`;

        const graphQuery = `
            query SearchTokens($query: String!) {
                tokens(
                    first: 10,
                    where: { symbol_contains_nocase: $query },
                    orderBy: totalValueLockedUSD,
                    orderDirection: desc
                ) {
                    id
                    symbol
                    name
                    derivedUSD
                    totalValueLockedUSD
                }
            }
        `;

        const response = await axios.post(
            endpoint,
            { query: graphQuery, variables: { query: query.toUpperCase() } },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );

        if (response.data.errors) {
            console.error('[Search] PancakeSwap GraphQL error:', response.data.errors[0]?.message);
            return [];
        }

        const tokens = response.data?.data?.tokens || [];

        // Filter tokens with valid prices and TVL > $1000 (to avoid dust tokens)
        return tokens
            .filter(t => t.derivedUSD && parseFloat(t.derivedUSD) > 0 && parseFloat(t.totalValueLockedUSD) > 1000)
            .map(token => ({
                symbol: token.symbol.toUpperCase(),
                name: token.name,
                type: 'crypto',
                source: 'pancakeswap',
                tokenAddress: token.id,
                price: parseFloat(token.derivedUSD),
                tvl: parseFloat(token.totalValueLockedUSD),
                matchScore: parseFloat(token.totalValueLockedUSD) / 1000000 // Score by TVL in millions
            }))
            .slice(0, 8);
    } catch (error) {
        console.error('[Search] PancakeSwap search failed:', error.message);
        return [];
    }
}

// Determine if query is likely crypto
function isLikelyCrypto(query) {
    const upper = query.toUpperCase();
    
    // Direct match in common crypto
    if (COMMON_CRYPTO[upper]) return true;
    
    // Common crypto-related terms
    const cryptoTerms = ['COIN', 'TOKEN', 'CHAIN', 'SWAP', 'DEFI', 'NFT', 'DAO', 'PROTOCOL'];
    if (cryptoTerms.some(term => upper.includes(term))) return true;
    
    return false;
}

// ============ ROUTES ============

// GET /api/search?q=AAPL - Unified search endpoint
router.get('/', async (req, res) => {
    try {
        const { q, type } = req.query;
        
        if (!q || q.trim().length < 1) {
            return res.json({ stocks: [], crypto: [], query: '' });
        }

        const query = q.trim();
        const cacheKey = `search-${query.toLowerCase()}-${type || 'all'}`;
        
        // Check cache
        const cached = getCachedResult(cacheKey);
        if (cached) {
            console.log(`[Search] Cache hit for: ${query}`);
            return res.json(cached);
        }

        console.log(`[Search] Searching for: ${query}, type: ${type || 'all'}`);

        let stocks = [];
        let crypto = [];

        // Determine what to search based on type param or heuristics
        const searchStocksFlag = !type || type === 'stock' || type === 'all';
        const searchCryptoFlag = !type || type === 'crypto' || type === 'all';

        // Run searches in parallel
        // Use Yahoo Finance as PRIMARY for stocks (more reliable for pricing)
        const promises = [];
        let pancakeSwapResults = [];

        if (searchStocksFlag) {
            promises.push(
                searchStocksYahoo(query)
                    .then(results => { stocks = results; })
                    .catch(() => { stocks = []; })
            );
        }

        if (searchCryptoFlag) {
            // Search both CoinGecko and PancakeSwap in parallel
            promises.push(
                searchCrypto(query)
                    .then(results => { crypto = results; })
                    .catch(() => { crypto = []; })
            );
            promises.push(
                searchPancakeSwap(query)
                    .then(results => { pancakeSwapResults = results; })
                    .catch(() => { pancakeSwapResults = []; })
            );
        }

        await Promise.all(promises);

        // Merge PancakeSwap results with CoinGecko results (avoid duplicates)
        if (pancakeSwapResults.length > 0) {
            const existingSymbols = new Set(crypto.map(c => c.symbol.toUpperCase()));
            for (const token of pancakeSwapResults) {
                if (!existingSymbols.has(token.symbol.toUpperCase())) {
                    crypto.push(token);
                }
            }
            // Re-sort by match score
            crypto.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
            crypto = crypto.slice(0, 12); // Limit to 12 results
        }

        // If Yahoo failed for stocks, try Alpha Vantage as backup
        if (searchStocksFlag && stocks.length === 0) {
            stocks = await searchStocks(query);
        }

        const result = {
            query,
            stocks,
            crypto,
            pancakeSwapCount: pancakeSwapResults.length,
            timestamp: Date.now()
        };

        // Cache the result
        setCacheResult(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error('[Search] Error:', error.message);
        res.status(500).json({ 
            error: 'Search failed', 
            message: error.message,
            stocks: [],
            crypto: []
        });
    }
});

// GET /api/search/stocks?q=AAPL - Stock-only search
router.get('/stocks', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length < 1) {
            return res.json({ results: [], query: '' });
        }

        const query = q.trim();
        const cacheKey = `stock-search-${query.toLowerCase()}`;
        
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Use Yahoo as PRIMARY (more reliable for pricing)
        let results = await searchStocksYahoo(query);

        // Fallback to Alpha Vantage if Yahoo fails
        if (results.length === 0) {
            results = await searchStocks(query);
        }

        const response = { results, query, timestamp: Date.now() };
        setCacheResult(cacheKey, response);
        
        res.json(response);
    } catch (error) {
        console.error('[Search] Stock search error:', error.message);
        res.status(500).json({ error: 'Stock search failed', results: [] });
    }
});

// GET /api/search/crypto?q=BTC - Crypto-only search
router.get('/crypto', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length < 1) {
            return res.json({ results: [], query: '' });
        }

        const query = q.trim();
        const cacheKey = `crypto-search-${query.toLowerCase()}`;
        
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const results = await searchCrypto(query);
        const response = { results, query, timestamp: Date.now() };
        setCacheResult(cacheKey, response);
        
        res.json(response);
    } catch (error) {
        console.error('[Search] Crypto search error:', error.message);
        res.status(500).json({ error: 'Crypto search failed', results: [] });
    }
});

// GET /api/search/validate/:symbol - Check if symbol is stock or crypto
router.get('/validate/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const upper = symbol.toUpperCase();

        // Check if it's a known crypto
        if (COMMON_CRYPTO[upper]) {
            return res.json({
                symbol: upper,
                type: 'crypto',
                name: COMMON_CRYPTO[upper].name,
                coinGeckoId: COMMON_CRYPTO[upper].id,
                valid: true
            });
        }

        // Try to validate as stock via Alpha Vantage
        try {
            const response = await axios.get('https://www.alphavantage.co/query', {
                params: {
                    function: 'GLOBAL_QUOTE',
                    symbol: upper,
                    apikey: ALPHA_VANTAGE_API_KEY
                },
                timeout: 10000
            });

            const quote = response.data['Global Quote'];
            if (quote && quote['01. symbol']) {
                return res.json({
                    symbol: upper,
                    type: 'stock',
                    name: upper, // Alpha Vantage doesn't return name in GLOBAL_QUOTE
                    price: parseFloat(quote['05. price']) || 0,
                    valid: true
                });
            }
        } catch (e) {
            // Continue to check crypto
        }

        // Try to validate as crypto via CoinGecko
        try {
            const coinList = await getCoinList();
            const coin = coinList.find(c => 
                c.symbol.toUpperCase() === upper || 
                c.id === symbol.toLowerCase()
            );
            
            if (coin) {
                return res.json({
                    symbol: coin.symbol.toUpperCase(),
                    type: 'crypto',
                    name: coin.name,
                    coinGeckoId: coin.id,
                    valid: true
                });
            }
        } catch (e) {
            // Continue
        }

        // Unknown symbol
        res.json({
            symbol: upper,
            type: 'unknown',
            valid: false,
            message: 'Symbol not found'
        });
    } catch (error) {
        console.error('[Search] Validate error:', error.message);
        res.status(500).json({ error: 'Validation failed', valid: false });
    }
});

// GET /api/search/pancakeswap?q=CAKE - PancakeSwap BSC token search
router.get('/pancakeswap', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({ results: [], query: '', source: 'pancakeswap' });
        }

        if (!THE_GRAPH_API_KEY) {
            return res.status(503).json({
                error: 'PancakeSwap search not configured',
                message: 'THE_GRAPH_API_KEY is not set'
            });
        }

        const query = q.trim();
        const cacheKey = `pancakeswap-search-${query.toLowerCase()}`;

        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const results = await searchPancakeSwap(query);
        const response = {
            results,
            query,
            source: 'pancakeswap',
            count: results.length,
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[Search] PancakeSwap search error:', error.message);
        res.status(500).json({ error: 'PancakeSwap search failed', results: [] });
    }
});

// GET /api/search/pancakeswap/top - Get top PancakeSwap tokens by TVL
router.get('/pancakeswap/top', async (req, res) => {
    try {
        if (!THE_GRAPH_API_KEY) {
            return res.status(503).json({ error: 'PancakeSwap not configured' });
        }

        const cacheKey = 'pancakeswap-top-tokens';
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const endpoint = `https://gateway.thegraph.com/api/${THE_GRAPH_API_KEY}/subgraphs/id/${PANCAKESWAP_V3_SUBGRAPH_ID}`;

        const query = `
            query TopTokens {
                tokens(
                    first: 50,
                    orderBy: totalValueLockedUSD,
                    orderDirection: desc,
                    where: { totalValueLockedUSD_gt: "10000" }
                ) {
                    id
                    symbol
                    name
                    derivedUSD
                    totalValueLockedUSD
                }
            }
        `;

        const response = await axios.post(
            endpoint,
            { query },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );

        if (response.data.errors) {
            throw new Error(response.data.errors[0]?.message || 'GraphQL error');
        }

        const tokens = (response.data?.data?.tokens || [])
            .filter(t => t.derivedUSD && parseFloat(t.derivedUSD) > 0)
            .map(token => ({
                symbol: token.symbol.toUpperCase(),
                name: token.name,
                type: 'crypto',
                source: 'pancakeswap',
                tokenAddress: token.id,
                price: parseFloat(token.derivedUSD),
                tvl: parseFloat(token.totalValueLockedUSD)
            }));

        const result = {
            tokens,
            count: tokens.length,
            source: 'pancakeswap',
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('[Search] PancakeSwap top tokens error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top tokens' });
    }
});

// Preload coin list on startup
getCoinList().then(() => {
    console.log('[Search] Coin list preloaded');
}).catch(err => {
    console.warn('[Search] Failed to preload coin list:', err.message);
});

module.exports = router;