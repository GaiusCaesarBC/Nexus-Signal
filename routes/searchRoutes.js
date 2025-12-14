// server/routes/searchRoutes.js - Stock & Crypto Search API
// Uses Alpha Vantage Pro for stocks, CoinGecko Pro for crypto, GeckoTerminal for DEX tokens

const express = require('express');
const router = express.Router();
const axios = require('axios');
const geckoTerminalService = require('../services/geckoTerminalService');

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

// Search GeckoTerminal for DEX tokens (BSC, ETH, SOL, etc.)
async function searchGeckoTerminal(query, network = null) {
    try {
        const results = await geckoTerminalService.search(query, network);

        return results
            .filter(t => t.tvl > 1000 && t.price > 0)
            .map(token => ({
                symbol: token.symbol,
                name: token.name,
                type: 'crypto',
                source: 'geckoterminal',
                chain: token.chain,
                network: token.network,
                tokenAddress: token.contractAddress,
                poolAddress: token.poolAddress,
                price: token.price,
                priceChange24h: token.changePercent,
                tvl: token.tvl,
                volume: token.volume,
                matchScore: (token.tvl / 100000) + (token.volume / 1000000) // Score by TVL + volume
            }))
            .slice(0, 10);
    } catch (error) {
        console.error('[Search] GeckoTerminal search failed:', error.message);
        return [];
    }
}

// Search PancakeSwap for BSC tokens via The Graph (DEPRECATED - use GeckoTerminal)
async function searchPancakeSwap(query) {
    // Now using GeckoTerminal for BSC tokens - more reliable and free
    return searchGeckoTerminal(query, 'bsc');
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
        const { q, type, network: queryNetwork } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({ stocks: [], crypto: [], query: '' });
        }

        const query = q.trim();

        // ============ CONTRACT ADDRESS DETECTION ============
        // EVM address: 0x followed by 40 hex characters
        // Solana address: Base58 encoded, 32-44 characters (no 0x prefix)
        const isEvmAddress = /^0x[a-fA-F0-9]{40}$/i.test(query);
        const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) && !query.startsWith('0x');

        if (isEvmAddress || isSolanaAddress) {
            console.log(`[Search] Contract address detected: ${query.substring(0, 10)}...`);

            try {
                // Determine which networks to search
                let networksToSearch = [];
                if (isSolanaAddress) {
                    networksToSearch = ['solana'];
                } else if (queryNetwork) {
                    networksToSearch = [queryNetwork.toLowerCase()];
                } else {
                    // Search all EVM networks
                    networksToSearch = ['bsc', 'eth', 'base', 'arbitrum', 'polygon_pos', 'avax'];
                }

                // Search for token by contract address across networks
                const searchPromises = networksToSearch.map(async (network) => {
                    try {
                        // First try to get token info directly
                        const tokenInfo = await geckoTerminalService.getTokenPrice(network, query.toLowerCase());
                        if (tokenInfo && tokenInfo.price > 0) {
                            return {
                                symbol: tokenInfo.symbol,
                                name: tokenInfo.name || tokenInfo.symbol,
                                type: 'crypto',
                                source: 'geckoterminal',
                                chain: network.toUpperCase(),
                                network: network,
                                tokenAddress: query.toLowerCase(),
                                price: tokenInfo.price,
                                priceChange24h: tokenInfo.priceChange24h
                            };
                        }

                        // Fallback: search using the address as query
                        const searchResults = await geckoTerminalService.search(query, network, false);
                        if (searchResults && searchResults.length > 0) {
                            const match = searchResults.find(r =>
                                r.contractAddress?.toLowerCase() === query.toLowerCase()
                            ) || searchResults[0];

                            if (match && match.price > 0) {
                                return {
                                    symbol: match.symbol,
                                    name: match.name || match.symbol,
                                    type: 'crypto',
                                    source: 'geckoterminal',
                                    chain: match.chain || network.toUpperCase(),
                                    network: network,
                                    tokenAddress: match.contractAddress || query.toLowerCase(),
                                    poolAddress: match.poolAddress,
                                    price: match.price,
                                    priceChange24h: match.changePercent
                                };
                            }
                        }
                        return null;
                    } catch (err) {
                        return null;
                    }
                });

                const addressResults = await Promise.all(searchPromises);
                const validResults = addressResults.filter(r => r !== null);

                if (validResults.length > 0) {
                    console.log(`[Search] Found ${validResults.length} tokens by contract address`);

                    return res.json({
                        query,
                        stocks: [],
                        crypto: validResults,
                        searchType: 'contract_address',
                        timestamp: Date.now()
                    });
                } else {
                    console.log(`[Search] No token found for contract address: ${query.substring(0, 10)}...`);
                }
            } catch (caError) {
                console.log('[Search] Contract address search error:', caError.message);
            }
        }
        // ============ END CONTRACT ADDRESS DETECTION ============

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
        let geckoTerminalResults = [];

        if (searchStocksFlag) {
            promises.push(
                searchStocksYahoo(query)
                    .then(results => { stocks = results; })
                    .catch(() => { stocks = []; })
            );
        }

        if (searchCryptoFlag) {
            // Search CoinGecko for established coins and GeckoTerminal for DEX tokens
            promises.push(
                searchCrypto(query)
                    .then(results => { crypto = results; })
                    .catch(() => { crypto = []; })
            );
            promises.push(
                searchGeckoTerminal(query)
                    .then(results => { geckoTerminalResults = results; })
                    .catch(() => { geckoTerminalResults = []; })
            );
        }

        await Promise.all(promises);

        // Merge GeckoTerminal DEX results with CoinGecko results (avoid duplicates)
        if (geckoTerminalResults.length > 0) {
            const existingSymbols = new Set(crypto.map(c => c.symbol.toUpperCase()));
            for (const token of geckoTerminalResults) {
                if (!existingSymbols.has(token.symbol.toUpperCase())) {
                    crypto.push(token);
                }
            }
            // Re-sort by match score
            crypto.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
            crypto = crypto.slice(0, 15); // Limit to 15 results
        }

        // If Yahoo failed for stocks, try Alpha Vantage as backup
        if (searchStocksFlag && stocks.length === 0) {
            stocks = await searchStocks(query);
        }

        const result = {
            query,
            stocks,
            crypto,
            dexTokensCount: geckoTerminalResults.length,
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

// GET /api/search/dex?q=CAKE&network=bsc - DEX token search via GeckoTerminal
router.get('/dex', async (req, res) => {
    try {
        const { q, network } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({ results: [], query: '', source: 'geckoterminal' });
        }

        const query = q.trim();
        const cacheKey = `dex-search-${query.toLowerCase()}-${network || 'all'}`;

        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const results = await searchGeckoTerminal(query, network || null);
        const response = {
            results,
            query,
            network: network || 'all',
            source: 'geckoterminal',
            count: results.length,
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[Search] DEX search error:', error.message);
        res.status(500).json({ error: 'DEX search failed', results: [] });
    }
});

// GET /api/search/dex/trending?network=bsc - Get trending DEX tokens
router.get('/dex/trending', async (req, res) => {
    try {
        const { network = 'bsc', limit = 20 } = req.query;

        const cacheKey = `dex-trending-${network}-${limit}`;
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const tokens = await geckoTerminalService.getTrendingPools(network, parseInt(limit));

        const result = {
            tokens: tokens.map(t => ({
                symbol: t.symbol,
                name: t.name,
                type: 'crypto',
                source: 'geckoterminal',
                chain: t.chain,
                tokenAddress: t.contractAddress,
                poolAddress: t.poolAddress,
                price: t.price,
                priceChange24h: t.changePercent,
                volume: t.volume,
                tvl: t.tvl
            })),
            count: tokens.length,
            network,
            source: 'geckoterminal',
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('[Search] DEX trending error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending tokens' });
    }
});

// GET /api/search/dex/gainers?network=bsc - Get top gainers from DEX
router.get('/dex/gainers', async (req, res) => {
    try {
        const { network = 'bsc', limit = 20 } = req.query;

        const cacheKey = `dex-gainers-${network}-${limit}`;
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const tokens = await geckoTerminalService.getTopGainers(network, parseInt(limit));

        const result = {
            tokens,
            count: tokens.length,
            network,
            source: 'geckoterminal',
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('[Search] DEX gainers error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top gainers' });
    }
});

// GET /api/search/dex/losers?network=bsc - Get top losers from DEX
router.get('/dex/losers', async (req, res) => {
    try {
        const { network = 'bsc', limit = 20 } = req.query;

        const cacheKey = `dex-losers-${network}-${limit}`;
        const cached = getCachedResult(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const tokens = await geckoTerminalService.getTopLosers(network, parseInt(limit));

        const result = {
            tokens,
            count: tokens.length,
            network,
            source: 'geckoterminal',
            timestamp: Date.now()
        };

        setCacheResult(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('[Search] DEX losers error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top losers' });
    }
});

// Legacy route - redirect to /dex
router.get('/pancakeswap', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ results: [], query: '', source: 'geckoterminal' });

    const results = await searchGeckoTerminal(q.trim(), 'bsc');
    res.json({
        results,
        query: q.trim(),
        source: 'geckoterminal',
        count: results.length,
        timestamp: Date.now()
    });
});

// Legacy route - redirect to /dex/trending
router.get('/pancakeswap/top', async (req, res) => {
    const tokens = await geckoTerminalService.getTrendingPools('bsc', 50);
    res.json({
        tokens: tokens.map(t => ({
            symbol: t.symbol,
            name: t.name,
            type: 'crypto',
            source: 'geckoterminal',
            tokenAddress: t.contractAddress,
            price: t.price,
            tvl: t.tvl
        })),
        count: tokens.length,
        source: 'geckoterminal',
        timestamp: Date.now()
    });
});

// Preload coin list on startup
getCoinList().then(() => {
    console.log('[Search] Coin list preloaded');
}).catch(err => {
    console.warn('[Search] Failed to preload coin list:', err.message);
});

module.exports = router;