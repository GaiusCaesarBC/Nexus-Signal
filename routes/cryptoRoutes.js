// server/routes/cryptoRoutes.js - PROPER PRO API CONFIGURATION

const express = require('express');
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const geckoTerminalService = require('../services/geckoTerminalService');

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for historical
const QUOTE_CACHE_DURATION = 60 * 1000; // 1 minute for quotes
const AXIOS_TIMEOUT = 10000; // 10 second timeout for API calls
const MAX_CACHE_SIZE = 500; // Maximum cache entries to prevent memory leaks
const cryptoCache = {};
const quoteCache = {};

// Validate CoinGecko ID to prevent SSRF attacks
// CoinGecko IDs are alphanumeric with hyphens only (e.g., "bitcoin", "avalanche-2", "matic-network")
function validateCoinGeckoId(id) {
    if (!id || typeof id !== 'string') {
        throw new Error('Invalid cryptocurrency identifier');
    }
    const trimmed = id.trim().toLowerCase();
    // Allow only alphanumeric characters and hyphens, 1-50 chars
    if (!/^[a-z0-9-]{1,50}$/.test(trimmed)) {
        throw new Error('Invalid cryptocurrency identifier format');
    }
    // Disallow path traversal attempts
    if (trimmed.includes('--') || trimmed.startsWith('-') || trimmed.endsWith('-')) {
        throw new Error('Invalid cryptocurrency identifier format');
    }
    return trimmed;
}

// Cache cleanup function to prevent memory leaks
function cleanupCache(cache, maxSize) {
    const keys = Object.keys(cache);
    if (keys.length > maxSize) {
        const sortedKeys = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        const keysToRemove = sortedKeys.slice(0, keys.length - maxSize);
        keysToRemove.forEach(key => delete cache[key]);
        console.log(`[Crypto] Cleaned up ${keysToRemove.length} old cache entries`);
    }
}

const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin', 
    ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot', 
    BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap', 
    MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron', 
    AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
    PEPE: 'pepe', ARB: 'arbitrum', OP: 'optimism',
    APT: 'aptos', SUI: 'sui', SEI: 'sei-network',
    INJ: 'injective-protocol', FET: 'fetch-ai', RENDER: 'render-token',
    TAO: 'bittensor', NEAR: 'near', FTM: 'fantom',
    ALGO: 'algorand', VET: 'vechain', HBAR: 'hedera-hashgraph',
    ICP: 'internet-computer', FIL: 'filecoin', SAND: 'the-sandbox',
    MANA: 'decentraland', AXS: 'axie-infinity', AAVE: 'aave',
    MKR: 'maker', CRV: 'curve-dao-token', LDO: 'lido-dao',
    RPL: 'rocket-pool', GMX: 'gmx', DYDX: 'dydx',
};

// Reverse map for lookups
const coinGeckoIdToSymbol = Object.fromEntries(
    Object.entries(cryptoSymbolMap).map(([symbol, id]) => [id, symbol])
);

function getCoinGeckoDays(range) {
    switch (range) {
        case '1D': return 1;
        case '5D': return 7;
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        case '5Y': return 1825;
        case 'MAX': return 'max';
        default: return 30;
    }
}

// Format timestamp to date string
function formatDateString(timestamp, range) {
    const date = new Date(timestamp);
    if (range === '1D' || range === '5D') {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }
    return date.toISOString().slice(0, 10);
}

// ✅ TEST ENDPOINT - Verify Pro API is working correctly
router.get('/test-api/:symbol?', async (req, res) => {
    try {
        const symbol = req.params.symbol || 'ethereum';
        // Map to known ID or validate user input to prevent SSRF
        let coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()];
        if (!coinGeckoId) {
            try {
                coinGeckoId = validateCoinGeckoId(symbol);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
        }

        console.log('\n=== COINGECKO PRO API TEST ===');
        console.log('API Key exists:', !!COINGECKO_API_KEY);
        console.log('API Key (first 10 chars):', COINGECKO_API_KEY ? COINGECKO_API_KEY.substring(0, 10) + '...' : 'MISSING');
        console.log('Base URL:', COINGECKO_BASE_URL);
        console.log('Coin ID:', coinGeckoId);

        // Test 1: Simple price check
        const priceUrl = `${COINGECKO_BASE_URL}/simple/price`;
        const priceParams = {
            ids: coinGeckoId,
            vs_currencies: 'usd',
            include_24hr_vol: true,
            include_24hr_change: true,
            include_market_cap: true,
            x_cg_pro_api_key: COINGECKO_API_KEY
        };

        console.log('\n--- Test 1: Simple Price ---');
        const priceResponse = await axios.get(priceUrl, { params: priceParams, timeout: AXIOS_TIMEOUT });
        const priceData = priceResponse.data[coinGeckoId];

        console.log('✅ Price Response:', JSON.stringify(priceData, null, 2));

        // Test 2: Market chart data
        const chartUrl = `${COINGECKO_BASE_URL}/coins/${coinGeckoId}/market_chart`;
        const chartParams = {
            vs_currency: 'usd',
            days: 7,
            x_cg_pro_api_key: COINGECKO_API_KEY
        };

        console.log('\n--- Test 2: Market Chart ---');
        const chartResponse = await axios.get(chartUrl, { params: chartParams, timeout: AXIOS_TIMEOUT });
        const prices = chartResponse.data.prices || [];

        console.log('✅ Data Points:', prices.length);

        res.json({
            success: true,
            apiConfig: {
                hasApiKey: !!COINGECKO_API_KEY,
                baseUrl: COINGECKO_BASE_URL,
                coinId: coinGeckoId
            },
            simplePrice: {
                price: priceData?.usd,
                change24h: priceData?.usd_24h_change,
                volume24h: priceData?.usd_24h_vol,
                marketCap: priceData?.usd_market_cap
            },
            marketChart: {
                dataPoints: prices.length,
                firstPrice: prices[0],
                lastPrice: prices[prices.length - 1]
            }
        });

    } catch (error) {
        console.error('\n❌ API TEST FAILED:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
    }
});

// ✅ NEW: GET /api/crypto/quote/:symbol - Real-time quote data
router.get('/quote/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        // Map to known ID or validate user input to prevent SSRF
        let coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()];
        if (!coinGeckoId) {
            try {
                coinGeckoId = validateCoinGeckoId(symbol);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
        }

        // Check cache
        const cacheKey = `quote-${coinGeckoId}`;
        if (quoteCache[cacheKey] && (Date.now() - quoteCache[cacheKey].timestamp < QUOTE_CACHE_DURATION)) {
            console.log(`[Crypto] Serving cached quote for ${symbol}`);
            return res.json(quoteCache[cacheKey].data);
        }

        console.log(`[Crypto] Fetching quote for ${symbol} (${coinGeckoId})`);

        // Fetch detailed coin data
        const url = `${COINGECKO_BASE_URL}/coins/${coinGeckoId}`;
        const params = {
            localization: false,
            tickers: false,
            community_data: false,
            developer_data: false,
            sparkline: false,
            x_cg_pro_api_key: COINGECKO_API_KEY
        };

        const response = await axios.get(url, { params, timeout: AXIOS_TIMEOUT });
        const data = response.data;
        const market = data.market_data;

        const quoteData = {
            symbol: symbol.toUpperCase(),
            name: data.name,
            price: market.current_price?.usd || 0,
            change24h: market.price_change_24h || 0,
            changePercent24h: market.price_change_percentage_24h || 0,
            high24h: market.high_24h?.usd || 0,
            low24h: market.low_24h?.usd || 0,
            volume24h: market.total_volume?.usd || 0,
            marketCap: market.market_cap?.usd || 0,
            marketCapRank: market.market_cap_rank || data.market_cap_rank || null,
            circulatingSupply: market.circulating_supply || 0,
            totalSupply: market.total_supply || null,
            maxSupply: market.max_supply || null,
            ath: market.ath?.usd || 0,
            athDate: market.ath_date?.usd || null,
            athChangePercent: market.ath_change_percentage?.usd || 0,
            atl: market.atl?.usd || 0,
            atlDate: market.atl_date?.usd || null,
            priceChange7d: market.price_change_percentage_7d || 0,
            priceChange30d: market.price_change_percentage_30d || 0,
            priceChange1y: market.price_change_percentage_1y || null,
            lastUpdated: data.last_updated,
            image: data.image?.small || null
        };

        // Cache the result and cleanup if needed
        quoteCache[cacheKey] = { timestamp: Date.now(), data: quoteData };
        cleanupCache(quoteCache, MAX_CACHE_SIZE);

        res.json(quoteData);

    } catch (error) {
        console.error('[Crypto] Quote error:', error.message);
        
        if (error.response?.status === 429) {
            return res.status(429).json({ msg: 'Rate limit exceeded. Please wait.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ msg: `Crypto "${req.params.symbol}" not found.` });
        }
        
        res.status(500).json({ 
            msg: 'Failed to fetch crypto quote', 
            error: error.message 
        });
    }
});

// Helper function to fetch crypto data from CoinGecko PRO
async function fetchCryptoData(symbol, range) {
    // Map to known ID or validate user input to prevent SSRF
    let coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()];
    if (!coinGeckoId) {
        coinGeckoId = validateCoinGeckoId(symbol); // Will throw if invalid
    }

    const cacheKey = `crypto-${coinGeckoId}-${range}`;
    if (cryptoCache[cacheKey] && (Date.now() - cryptoCache[cacheKey].timestamp < CACHE_DURATION)) {
        console.log(`[Crypto] Serving cached data for ${coinGeckoId}`);
        return cryptoCache[cacheKey].data;
    }

    const days = getCoinGeckoDays(range || '6M');

    // ✅ Pro API requires API key in URL parameter
    const params = {
        vs_currency: 'usd',
        days: days,
        x_cg_pro_api_key: COINGECKO_API_KEY
    };

    if (days > 90) {
        params.interval = 'daily';
    }

    const url = `${COINGECKO_BASE_URL}/coins/${coinGeckoId}/market_chart`;
    console.log(`\n[Crypto] Fetching ${symbol} (${coinGeckoId}) for ${range}`);
    console.log(`[Crypto] Has API Key:`, !!COINGECKO_API_KEY);

    try {
        const response = await axios.get(url, { params, timeout: AXIOS_TIMEOUT });

        console.log(`[Crypto] ✅ Response status: ${response.status}`);
        
        const prices = response.data.prices || [];
        const volumes = response.data.total_volumes || [];

        if (prices.length === 0) {
            throw new Error(`No price data found for ${symbol}`);
        }

        // ✅ Log prices to verify correctness
        const firstPrice = prices[0][1];
        const lastPrice = prices[prices.length - 1][1];
        console.log(`[Crypto] Price range: $${firstPrice.toFixed(2)} → $${lastPrice.toFixed(2)}`);
        console.log(`[Crypto] Total data points: ${prices.length}`);

        // Build historical data
        const historicalDataMap = new Map();
        
        prices.forEach(([timestamp, price]) => {
            historicalDataMap.set(timestamp, {
                time: timestamp,
                date: formatDateString(timestamp, range), // ✅ Add date string
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0
            });
        });

        volumes.forEach(([timestamp, volume]) => {
            if (historicalDataMap.has(timestamp)) {
                historicalDataMap.get(timestamp).volume = volume;
            }
        });

        let historicalData = Array.from(historicalDataMap.values()).sort((a, b) => a.time - b.time);

        // Fill OHLC data with simulated variation
        for (let i = 1; i < historicalData.length; i++) {
            const prevClose = historicalData[i-1].close;
            const currentClose = historicalData[i].close;
            
            historicalData[i].open = prevClose;
            
            const priceChange = Math.abs(currentClose - prevClose);
            const volatility = priceChange * 0.5;
            
            historicalData[i].high = Math.max(prevClose, currentClose) + volatility;
            historicalData[i].low = Math.min(prevClose, currentClose) - volatility;
        }

        if (historicalData.length > 0) {
            historicalData[0].open = historicalData[0].close;
            const initialVolatility = historicalData[0].close * 0.002;
            historicalData[0].high = historicalData[0].close + initialVolatility;
            historicalData[0].low = historicalData[0].close - initialVolatility;
        }

        const finalPrice = historicalData[historicalData.length - 1].close;
        console.log(`[Crypto] ✅ Final current price for ${symbol}: $${finalPrice.toFixed(2)}`);

        cryptoCache[cacheKey] = { timestamp: Date.now(), data: historicalData };
        cleanupCache(cryptoCache, MAX_CACHE_SIZE);
        return historicalData;

    } catch (error) {
        console.error(`[Crypto] ❌ API Error:`, error.message);
        if (error.response) {
            console.error(`[Crypto] Status:`, error.response.status);
            console.error(`[Crypto] Data:`, JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Prediction calculation with FORMATTED INDICATORS
const calculateCryptoPrediction = (historicalData, lastClosePrice) => {
    console.log('\n=== CRYPTO PREDICTION ===');
    console.log('Data points:', historicalData.length);
    console.log('Current price:', `$${lastClosePrice.toFixed(2)}`);
    
    const sortedData = [...historicalData].sort((a, b) => a.time - b.time);
    const closes = sortedData.map(d => d.close);
    const volumes = sortedData.map(d => d.volume || 0);

    const hasEnoughData = (minLen) => closes.length >= minLen;

    const rsi = hasEnoughData(14) ? calculateRSI(closes) : null;
    const macdResult = hasEnoughData(26) ? calculateMACD(closes) : { macd: null, signal: null, histogram: null };
    const bbResult = hasEnoughData(20) ? calculateBollingerBands(closes) : { mid: lastClosePrice, upper: null, lower: null };
    
    // ✅ FIX: calculateSMA returns an array, extract the last value
    const sma50Array = hasEnoughData(50) ? calculateSMA(sortedData, 50) : [];
    const sma200Array = hasEnoughData(200) ? calculateSMA(sortedData, 200) : [];
    
    const sma50 = sma50Array.length > 0 ? sma50Array[sma50Array.length - 1].value : null;
    const sma200 = sma200Array.length > 0 ? sma200Array[sma200Array.length - 1].value : null;
    
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    // SMA Analysis
    if (sma50 !== null && sma200 !== null && hasEnoughData(200)) {
        if (sma50 > sma200 && lastClosePrice > sma50) {
            bullishScore += 4;
            signals.push("Strong uptrend (Golden Cross)");
        } else if (sma50 < sma200 && lastClosePrice < sma50) {
            bearishScore += 4;
            signals.push("Strong downtrend (Death Cross)");
        } else if (lastClosePrice > sma50) {
            bullishScore += 2;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 2;
            signals.push("Price below 50-SMA");
        }
    } else if (sma50 !== null) {
        if (lastClosePrice > sma50) {
            bullishScore += 2.5;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 2.5;
            signals.push("Price below 50-SMA");
        }
    }

    // RSI
    if (rsi !== null) {
        if (rsi < 30) {
            bullishScore += 3;
            signals.push(`RSI oversold (${rsi.toFixed(0)})`);
        } else if (rsi > 70) {
            bearishScore += 3;
            signals.push(`RSI overbought (${rsi.toFixed(0)})`);
        } else if (rsi > 50) {
            bullishScore += 0.5;
        } else {
            bearishScore += 0.5;
        }
    }

    // MACD
    if (macdResult.macd !== null && macdResult.signal !== null) {
        if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
            bullishScore += 3.5;
            signals.push("MACD bullish crossover");
        } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
            bearishScore += 3.5;
            signals.push("MACD bearish crossover");
        }
    }

    // Bollinger Bands
    if (bbResult.upper !== null && bbResult.lower !== null) {
        if (lastClosePrice >= bbResult.upper * 0.99) {
            bearishScore += 2;
            signals.push("Near upper Bollinger Band");
        } else if (lastClosePrice <= bbResult.lower * 1.01) {
            bullishScore += 2;
            signals.push("Near lower Bollinger Band");
        }
    }

    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 
        ? Math.min(95, Math.round((Math.max(bullishScore, bearishScore) / totalScore) * 100)) 
        : 50;
    
    const predictedDirection = bullishScore > bearishScore ? 'Up' : 'Down';
    const percentageChange = predictedDirection === 'Up' 
        ? (bullishScore / 10) * 2 
        : -(bearishScore / 10) * 2;
    
    const predictedPrice = lastClosePrice * (1 + percentageChange / 100);

    console.log(`Prediction: ${predictedDirection} to $${predictedPrice.toFixed(2)} (${percentageChange.toFixed(2)}%)`);

    // Format indicators for frontend
    const formattedIndicators = {
        RSI: {
            value: rsi !== null ? rsi.toFixed(2) : 'N/A',
            signal: rsi !== null ? (rsi < 30 ? 'BUY' : rsi > 70 ? 'SELL' : 'HOLD') : 'N/A'
        },
        MACD: {
            value: macdResult.macd !== null 
                ? `${macdResult.macd > macdResult.signal ? 'Bullish' : 'Bearish'}` 
                : 'N/A',
            signal: macdResult.macd !== null 
                ? (macdResult.macd > macdResult.signal ? 'BUY' : 'SELL') 
                : 'N/A'
        },
        'MA50': {
            value: sma50 !== null ? `$${sma50.toFixed(2)}` : 'N/A',
            signal: sma50 !== null ? (lastClosePrice > sma50 ? 'BUY' : 'SELL') : 'N/A'
        },
        'MA200': {
            value: sma200 !== null ? `$${sma200.toFixed(2)}` : 'N/A',
            signal: sma200 !== null ? (lastClosePrice > sma200 ? 'BUY' : 'SELL') : 'N/A'
        },
        Volume: {
            value: avgVolume !== null ? `${(avgVolume / 1000000).toFixed(1)}M` : 'N/A',
            signal: volumes[volumes.length - 1] > avgVolume ? 'HIGH' : 'LOW'
        },
        Bollinger: {
            value: bbResult.upper !== null 
                ? (lastClosePrice >= bbResult.upper * 0.99 ? 'Upper' : 
                   lastClosePrice <= bbResult.lower * 1.01 ? 'Lower' : 'Middle')
                : 'N/A',
            signal: bbResult.upper !== null 
                ? (lastClosePrice <= bbResult.lower * 1.01 ? 'BUY' : 
                   lastClosePrice >= bbResult.upper * 0.99 ? 'SELL' : 'HOLD')
                : 'N/A'
        }
    };

    return {
        predictedPrice,
        predictedDirection,
        percentageChange,
        confidence,
        message: signals.length > 0 ? signals.join('. ') : 'Neutral market conditions',
        indicators: formattedIndicators,
        rawIndicators: {
            rsi,
            macd: macdResult,
            bollingerBands: bbResult,
            sma50,
            sma200,
            avgVolume,
            lastVolume: volumes[volumes.length - 1],
        }
    };
};

// GET /api/crypto/prediction/:symbol
router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const historicalData = await fetchCryptoData(symbol, range);

        if (historicalData.length < 50) {
            return res.status(400).json({ 
                msg: `Not enough data (${historicalData.length} points). Try a longer range.` 
            });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        const prediction = calculateCryptoPrediction(historicalData, lastClosePrice);

        res.json({
            symbol: symbol.toUpperCase(),
            currentPrice: lastClosePrice,
            historicalData,
            ...prediction,
        });

    } catch (error) {
        console.error('[Crypto] Prediction error:', error.message);
        
        if (error.response?.status === 429) {
            return res.status(429).json({ msg: 'Rate limit exceeded. Please wait.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ msg: `Crypto "${req.params.symbol}" not found.` });
        }
        
        res.status(500).json({ 
            msg: 'Failed to generate crypto prediction', 
            error: error.message 
        });
    }
});

// GET /api/crypto/historical/:symbol
router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const historicalData = await fetchCryptoData(symbol, range);

        res.json({
            symbol: symbol.toUpperCase(),
            range,
            dataPoints: historicalData.length,
            historicalData,
        });

    } catch (error) {
        console.error('[Crypto] Historical error:', error.message);
        
        if (error.response?.status === 429) {
            return res.status(429).json({ msg: 'Rate limit exceeded. Please wait.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ msg: `Crypto "${req.params.symbol}" not found.` });
        }
        
        res.status(500).json({ 
            msg: 'Failed to fetch crypto data', 
            error: error.message 
        });
    }
});

// GET /api/crypto/list - Get list of supported cryptocurrencies
router.get('/list', async (req, res) => {
    try {
        const supportedCryptos = Object.entries(cryptoSymbolMap).map(([symbol, id]) => ({
            symbol,
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')
        }));

        res.json({
            count: supportedCryptos.length,
            cryptocurrencies: supportedCryptos
        });
    } catch (error) {
        res.status(500).json({ msg: 'Failed to get crypto list', error: error.message });
    }
});

// =====================================================
// GeckoTerminal DEX Token Routes
// =====================================================

// GET /api/crypto/dex/quote/:network/:poolAddress - Get DEX token quote
router.get('/dex/quote/:network/:poolAddress', async (req, res) => {
    try {
        const { network, poolAddress } = req.params;

        console.log(`[Crypto] Fetching DEX quote for pool ${poolAddress} on ${network}`);

        const poolData = await geckoTerminalService.getPoolData(network, poolAddress);

        if (!poolData) {
            return res.status(404).json({ msg: 'DEX pool not found' });
        }

        res.json({
            symbol: poolData.symbol,
            name: poolData.name,
            price: poolData.price,
            change24h: poolData.change,
            changePercent24h: poolData.changePercent,
            volume24h: poolData.volume,
            tvl: poolData.tvl,
            fdv: poolData.fdv,
            poolAddress: poolData.poolAddress,
            tokenAddress: poolData.contractAddress,
            network: network,
            chain: poolData.chain,
            dex: poolData.dex,
            source: 'geckoterminal',
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Crypto] DEX quote error:', error.message);
        res.status(500).json({ msg: 'Failed to fetch DEX quote', error: error.message });
    }
});

// GET /api/crypto/dex/historical/:network/:poolAddress - Get DEX token OHLCV chart data
router.get('/dex/historical/:network/:poolAddress', async (req, res) => {
    try {
        const { network, poolAddress } = req.params;
        const { range = '1M' } = req.query;

        // Map range to GeckoTerminal timeframe and aggregate
        let timeframe, aggregate;
        switch (range) {
            case '1D':
                timeframe = 'minute';
                aggregate = 15; // 15-minute candles
                break;
            case '5D':
                timeframe = 'hour';
                aggregate = 1;
                break;
            case '1M':
                timeframe = 'hour';
                aggregate = 4; // 4-hour candles
                break;
            case '3M':
            case '6M':
                timeframe = 'day';
                aggregate = 1;
                break;
            case '1Y':
            case '5Y':
            case 'MAX':
                timeframe = 'day';
                aggregate = 1;
                break;
            default:
                timeframe = 'hour';
                aggregate = 4;
        }

        console.log(`[Crypto] Fetching DEX OHLCV for pool ${poolAddress} on ${network}, range: ${range}`);

        const ohlcvData = await geckoTerminalService.getOHLCV(network, poolAddress, timeframe, aggregate);

        if (!ohlcvData || ohlcvData.length === 0) {
            return res.status(404).json({ msg: 'No OHLCV data found for this pool' });
        }

        // Format data to match CoinGecko format
        const historicalData = ohlcvData.map(candle => ({
            time: candle.time,
            date: formatDateString(candle.time, range),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        }));

        // Get pool info for symbol
        const poolData = await geckoTerminalService.getPoolData(network, poolAddress);

        res.json({
            symbol: poolData?.symbol || 'DEX',
            name: poolData?.name || 'DEX Token',
            network,
            poolAddress,
            range,
            source: 'geckoterminal',
            dataPoints: historicalData.length,
            historicalData
        });

    } catch (error) {
        console.error('[Crypto] DEX historical error:', error.message);
        res.status(500).json({ msg: 'Failed to fetch DEX historical data', error: error.message });
    }
});

// GET /api/crypto/dex/prediction/:network/:poolAddress - DEX token prediction
router.get('/dex/prediction/:network/:poolAddress', async (req, res) => {
    try {
        const { network, poolAddress } = req.params;
        const { range = '1M' } = req.query;

        // Get OHLCV data
        const ohlcvData = await geckoTerminalService.getOHLCV(network, poolAddress, 'hour', 4);

        if (!ohlcvData || ohlcvData.length < 20) {
            return res.status(400).json({
                msg: `Not enough data (${ohlcvData?.length || 0} points). DEX tokens may have limited history.`
            });
        }

        // Format data
        const historicalData = ohlcvData.map(candle => ({
            time: candle.time,
            date: formatDateString(candle.time, range),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        }));

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        const prediction = calculateCryptoPrediction(historicalData, lastClosePrice);

        // Get pool info
        const poolData = await geckoTerminalService.getPoolData(network, poolAddress);

        res.json({
            symbol: poolData?.symbol || 'DEX',
            name: poolData?.name || 'DEX Token',
            network,
            poolAddress,
            source: 'geckoterminal',
            currentPrice: lastClosePrice,
            historicalData,
            ...prediction
        });

    } catch (error) {
        console.error('[Crypto] DEX prediction error:', error.message);
        res.status(500).json({ msg: 'Failed to generate DEX prediction', error: error.message });
    }
});

// GET /api/crypto/dex/trending/:network? - Get trending DEX tokens
router.get('/dex/trending/:network?', async (req, res) => {
    try {
        const network = req.params.network || 'bsc';
        const limit = parseInt(req.query.limit) || 20;

        console.log(`[Crypto] Fetching trending DEX tokens on ${network}`);

        const trending = await geckoTerminalService.getTrendingPools(network);

        res.json({
            network,
            source: 'geckoterminal',
            count: Math.min(trending.length, limit),
            tokens: trending.slice(0, limit)
        });

    } catch (error) {
        console.error('[Crypto] DEX trending error:', error.message);
        res.status(500).json({ msg: 'Failed to fetch trending DEX tokens', error: error.message });
    }
});

// GET /api/crypto/dex/gainers/:network? - Get top DEX gainers
router.get('/dex/gainers/:network?', async (req, res) => {
    try {
        const network = req.params.network || 'bsc';
        const limit = parseInt(req.query.limit) || 20;

        const gainers = await geckoTerminalService.getTopGainers(network);

        res.json({
            network,
            source: 'geckoterminal',
            count: Math.min(gainers.length, limit),
            tokens: gainers.slice(0, limit)
        });

    } catch (error) {
        console.error('[Crypto] DEX gainers error:', error.message);
        res.status(500).json({ msg: 'Failed to fetch DEX gainers', error: error.message });
    }
});

// GET /api/crypto/dex/losers/:network? - Get top DEX losers
router.get('/dex/losers/:network?', async (req, res) => {
    try {
        const network = req.params.network || 'bsc';
        const limit = parseInt(req.query.limit) || 20;

        const losers = await geckoTerminalService.getTopLosers(network);

        res.json({
            network,
            source: 'geckoterminal',
            count: Math.min(losers.length, limit),
            tokens: losers.slice(0, limit)
        });

    } catch (error) {
        console.error('[Crypto] DEX losers error:', error.message);
        res.status(500).json({ msg: 'Failed to fetch DEX losers', error: error.message });
    }
});

// GET /api/crypto/dex/search - Search DEX tokens across networks
router.get('/dex/search', async (req, res) => {
    try {
        let { q, network } = req.query;

        // Fix type confusion: q could be an array if multiple q params are passed
        if (Array.isArray(q)) {
            q = q[0];
        }

        if (!q || typeof q !== 'string' || q.length < 2) {
            return res.status(400).json({ msg: 'Query must be at least 2 characters' });
        }

        console.log(`[Crypto] Searching DEX tokens for "${q}" on ${network || 'all networks'}`);

        const results = await geckoTerminalService.search(q, network);

        res.json({
            query: q,
            network: network || 'all',
            source: 'geckoterminal',
            count: results.length,
            tokens: results
        });

    } catch (error) {
        console.error('[Crypto] DEX search error:', error.message);
        res.status(500).json({ msg: 'Failed to search DEX tokens', error: error.message });
    }
});

module.exports = router;