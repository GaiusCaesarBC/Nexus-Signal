// server/services/tokenPriceService.js - Token Price Fetching Service
const axios = require('axios');

// Cache for token prices (5 minute TTL)
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Common token mappings (symbol -> coingecko id)
const TOKEN_ID_MAP = {
    // Major tokens
    'ETH': 'ethereum',
    'WETH': 'weth',
    'BTC': 'bitcoin',
    'WBTC': 'wrapped-bitcoin',
    'BNB': 'binancecoin',
    'WBNB': 'wbnb',
    'MATIC': 'matic-network',
    'WMATIC': 'wmatic',
    'AVAX': 'avalanche-2',
    'WAVAX': 'wrapped-avax',

    // Stablecoins
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'BUSD': 'binance-usd',
    'FRAX': 'frax',
    'TUSD': 'true-usd',
    'USDP': 'paxos-standard',

    // DeFi tokens
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'LINK': 'chainlink',
    'CRV': 'curve-dao-token',
    'MKR': 'maker',
    'COMP': 'compound-governance-token',
    'SNX': 'havven',
    'SUSHI': 'sushi',
    '1INCH': '1inch',
    'BAL': 'balancer',
    'YFI': 'yearn-finance',
    'LDO': 'lido-dao',
    'RPL': 'rocket-pool',
    'GMX': 'gmx',
    'DYDX': 'dydx',

    // Layer 2s
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'IMX': 'immutable-x',
    'LRC': 'loopring',
    'METIS': 'metis-token',

    // Meme coins
    'DOGE': 'dogecoin',
    'SHIB': 'shiba-inu',
    'PEPE': 'pepe',
    'FLOKI': 'floki',
    'BONK': 'bonk',

    // Other popular
    'APE': 'apecoin',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'ENS': 'ethereum-name-service',
    'GRT': 'the-graph',
    'FET': 'fetch-ai',
    'RNDR': 'render-token',
    'INJ': 'injective-protocol',
    'STX': 'blockstack',
    'APT': 'aptos',
    'SUI': 'sui',
    'SEI': 'sei-network',
    'TIA': 'celestia',
    'JUP': 'jupiter-exchange-solana',
    'WLD': 'worldcoin-wld',
    'BLUR': 'blur',
    'CAKE': 'pancakeswap-token',
    'XVS': 'venus'
};

// Contract address to CoinGecko ID mapping for popular tokens
const CONTRACT_TO_ID = {
    // Ethereum Mainnet
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether', // USDT
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin', // USDC
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai', // DAI
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // WBTC
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'weth', // WETH
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap', // UNI
    '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink', // LINK
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'aave', // AAVE

    // BSC
    '0x55d398326f99059ff775485246999027b3197955': 'tether', // USDT on BSC
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'usd-coin', // USDC on BSC
    '0xe9e7cea3dedca5984780bafc599bd69add087d56': 'binance-usd', // BUSD
    '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82': 'pancakeswap-token', // CAKE
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'wbnb', // WBNB

    // Polygon
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'tether', // USDT on Polygon
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'usd-coin', // USDC on Polygon
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'wmatic' // WMATIC
};

/**
 * Get token price from CoinGecko
 * @param {string} tokenId - CoinGecko token ID
 * @returns {Promise<number|null>} Token price in USD
 */
async function getTokenPrice(tokenId) {
    const cacheKey = `price_${tokenId}`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.price;
    }

    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price`,
            {
                params: {
                    ids: tokenId,
                    vs_currencies: 'usd',
                    include_24hr_change: true
                },
                timeout: 5000
            }
        );

        if (response.data && response.data[tokenId]) {
            const price = response.data[tokenId].usd;
            const change24h = response.data[tokenId].usd_24h_change || 0;

            priceCache.set(cacheKey, {
                price,
                change24h,
                timestamp: Date.now()
            });

            return price;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching price for ${tokenId}:`, error.message);
        return cached?.price || null;
    }
}

/**
 * Get prices for multiple tokens at once
 * @param {string[]} tokenIds - Array of CoinGecko token IDs
 * @returns {Promise<Object>} Map of tokenId -> {price, change24h}
 */
async function getMultipleTokenPrices(tokenIds) {
    const uniqueIds = [...new Set(tokenIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return {};
    }

    // Check cache first
    const result = {};
    const uncachedIds = [];

    for (const id of uniqueIds) {
        const cached = priceCache.get(`price_${id}`);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            result[id] = { price: cached.price, change24h: cached.change24h };
        } else {
            uncachedIds.push(id);
        }
    }

    if (uncachedIds.length === 0) {
        return result;
    }

    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price`,
            {
                params: {
                    ids: uncachedIds.join(','),
                    vs_currencies: 'usd',
                    include_24hr_change: true
                },
                timeout: 10000
            }
        );

        for (const id of uncachedIds) {
            if (response.data && response.data[id]) {
                const price = response.data[id].usd;
                const change24h = response.data[id].usd_24h_change || 0;

                result[id] = { price, change24h };

                priceCache.set(`price_${id}`, {
                    price,
                    change24h,
                    timestamp: Date.now()
                });
            }
        }

        return result;
    } catch (error) {
        console.error('Error fetching multiple token prices:', error.message);
        return result;
    }
}

/**
 * Get CoinGecko ID from token symbol
 * @param {string} symbol - Token symbol (e.g., 'ETH', 'USDT')
 * @returns {string|null} CoinGecko ID
 */
function getTokenIdFromSymbol(symbol) {
    if (!symbol) return null;
    return TOKEN_ID_MAP[symbol.toUpperCase()] || null;
}

/**
 * Get CoinGecko ID from contract address
 * @param {string} contractAddress - Token contract address
 * @returns {string|null} CoinGecko ID
 */
function getTokenIdFromContract(contractAddress) {
    if (!contractAddress) return null;
    return CONTRACT_TO_ID[contractAddress.toLowerCase()] || null;
}

/**
 * Search for token on CoinGecko
 * @param {string} query - Token symbol or name
 * @returns {Promise<Object|null>} Token info
 */
async function searchToken(query) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/search`,
            {
                params: { query },
                timeout: 5000
            }
        );

        if (response.data?.coins?.length > 0) {
            const coin = response.data.coins[0];
            return {
                id: coin.id,
                symbol: coin.symbol,
                name: coin.name,
                thumb: coin.thumb
            };
        }

        return null;
    } catch (error) {
        console.error('Error searching token:', error.message);
        return null;
    }
}

/**
 * Get token info with price
 * @param {string} symbol - Token symbol
 * @param {string} contractAddress - Optional contract address
 * @returns {Promise<Object|null>} Token info with price
 */
async function getTokenInfo(symbol, contractAddress = null) {
    // Try to get ID from contract first, then symbol
    let tokenId = getTokenIdFromContract(contractAddress) || getTokenIdFromSymbol(symbol);

    // If not in our mapping, try to search
    if (!tokenId && symbol) {
        const searchResult = await searchToken(symbol);
        if (searchResult) {
            tokenId = searchResult.id;
            // Add to mapping for future use
            TOKEN_ID_MAP[symbol.toUpperCase()] = tokenId;
        }
    }

    if (!tokenId) {
        return null;
    }

    const price = await getTokenPrice(tokenId);
    const cached = priceCache.get(`price_${tokenId}`);

    return {
        id: tokenId,
        symbol: symbol?.toUpperCase(),
        price: price || 0,
        change24h: cached?.change24h || 0
    };
}

/**
 * Get market data for a token
 * @param {string} tokenId - CoinGecko token ID
 * @returns {Promise<Object|null>} Market data
 */
async function getTokenMarketData(tokenId) {
    const cacheKey = `market_${tokenId}`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${tokenId}`,
            {
                params: {
                    localization: false,
                    tickers: false,
                    community_data: false,
                    developer_data: false
                },
                timeout: 10000
            }
        );

        const data = response.data;
        const marketData = {
            id: data.id,
            symbol: data.symbol,
            name: data.name,
            image: data.image?.small,
            currentPrice: data.market_data?.current_price?.usd || 0,
            marketCap: data.market_data?.market_cap?.usd || 0,
            marketCapRank: data.market_cap_rank,
            volume24h: data.market_data?.total_volume?.usd || 0,
            priceChange24h: data.market_data?.price_change_percentage_24h || 0,
            priceChange7d: data.market_data?.price_change_percentage_7d || 0,
            priceChange30d: data.market_data?.price_change_percentage_30d || 0,
            ath: data.market_data?.ath?.usd || 0,
            athChangePercentage: data.market_data?.ath_change_percentage?.usd || 0,
            circulatingSupply: data.market_data?.circulating_supply || 0
        };

        priceCache.set(cacheKey, {
            data: marketData,
            timestamp: Date.now()
        });

        return marketData;
    } catch (error) {
        console.error(`Error fetching market data for ${tokenId}:`, error.message);
        return cached?.data || null;
    }
}

/**
 * Clear the price cache
 */
function clearCache() {
    priceCache.clear();
    console.log('[TokenPriceService] Cache cleared');
}

module.exports = {
    getTokenPrice,
    getMultipleTokenPrices,
    getTokenIdFromSymbol,
    getTokenIdFromContract,
    getTokenInfo,
    getTokenMarketData,
    searchToken,
    clearCache,
    TOKEN_ID_MAP
};
