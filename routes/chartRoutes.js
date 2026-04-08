// server/routes/chartRoutes.js - Real-time Chart Data with CRYPTO SUPPORT

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const { sanitizeSymbol, encodeSymbolForUrl } = require('../utils/symbolValidation');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for chart data (Alpha Vantage Pro - higher rate limits)
const chartDataCache = new Map();
const CACHE_DURATION = 15 * 1000; // 15 seconds for Pro users

// Known crypto symbols (expanded list)
const KNOWN_CRYPTOS = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
    'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
    'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'FET', 'INJ', 'SUI', 'SEI', 'TIA',
    'ALGO', 'VET', 'FIL', 'THETA', 'EOS', 'XLM', 'TRX', 'XMR', 'HBAR', 'ICP',
    // Additional popular coins
    'TON', 'BCH', 'LEO', 'DAI', 'USDC', 'USDT', 'WBTC', 'STETH', 'OKB', 'MKR',
    'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'IMX', 'LRC', 'CHZ', 'CRV', 'SNX',
    'COMP', 'YFI', 'SUSHI', 'BAL', 'ZRX', '1INCH', 'CAKE', 'RUNE', 'KCS', 'GT',
    'FTM', 'ONE', 'KAVA', 'CELO', 'ZIL', 'WAVES', 'IOTA', 'NEO', 'QTUM', 'ONT',
    'ZEC', 'DASH', 'DCR', 'SC', 'BTT', 'HOT', 'WIN', 'JST', 'SUN', 'JUST',
    'TRUMP', 'MELANIA', 'FARTCOIN', 'AI16Z', 'VIRTUAL', 'AIXBT', 'GRIFFAIN',
    'ZEREBRO', 'GOAT', 'ARC', 'ELIZA', 'SWARMS', 'ALCH', 'AVA', 'PRIME', 'AGIX',
    'TAO', 'WLD', 'RNDR', 'OCEAN', 'GRT', 'AR', 'PENDLE', 'JUP', 'PYTH', 'JTO',
    'W', 'DYM', 'STRK', 'MANTA', 'ALT', 'PIXEL', 'PORTAL', 'XAI', 'ACE', 'AI',
    'ONDO', 'ENA', 'ETHFI', 'AEVO', 'SAGA', 'BB', 'REZ', 'NOT', 'IO', 'ZK', 'ZRO',
    'LISTA', 'BLAST', 'BANANA', 'BOME', 'MEW', 'POPCAT', 'NEIRO', 'TURBO', 'BRETT',
    'MOG', 'SPX', 'GIGA', 'MOODENG', 'PNUT', 'ACT', 'CHILLGUY', 'GOATSEUS'
];

// Comprehensive CoinGecko ID mapping (symbol -> coingecko id)
const COINGECKO_ID_MAP = {
    // Top coins
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'BNB': 'binancecoin',
    'SOL': 'solana', 'USDC': 'usd-coin', 'XRP': 'ripple', 'DOGE': 'dogecoin',
    'ADA': 'cardano', 'TRX': 'tron', 'AVAX': 'avalanche-2', 'SHIB': 'shiba-inu',
    'TON': 'the-open-network', 'LINK': 'chainlink', 'DOT': 'polkadot',
    'BCH': 'bitcoin-cash', 'NEAR': 'near', 'MATIC': 'matic-network', 'LTC': 'litecoin',
    'LEO': 'leo-token', 'DAI': 'dai', 'UNI': 'uniswap', 'APT': 'aptos',
    'PEPE': 'pepe', 'ICP': 'internet-computer', 'ATOM': 'cosmos', 'RENDER': 'render-token',
    'FET': 'fetch-ai', 'HBAR': 'hedera-hashgraph', 'ETC': 'ethereum-classic',
    'CRO': 'crypto-com-chain', 'ARB': 'arbitrum', 'FIL': 'filecoin', 'INJ': 'injective-protocol',
    'IMX': 'immutable-x', 'OP': 'optimism', 'STX': 'stacks', 'MKR': 'maker',
    'VET': 'vechain', 'GRT': 'the-graph', 'WIF': 'dogwifcoin', 'SUI': 'sui',
    'AAVE': 'aave', 'TAO': 'bittensor', 'TIA': 'celestia', 'SEI': 'sei-network',
    'BONK': 'bonk', 'THETA': 'theta-token', 'RUNE': 'thorchain', 'JUP': 'jupiter-exchange-solana',
    'ALGO': 'algorand', 'FTM': 'fantom', 'PYTH': 'pyth-network', 'LDO': 'lido-dao',
    'FLOKI': 'floki', 'FLOW': 'flow', 'XLM': 'stellar', 'QNT': 'quant-network',
    'SAND': 'the-sandbox', 'MANA': 'decentraland', 'AXS': 'axie-infinity', 'GALA': 'gala',
    'ENJ': 'enjincoin', 'CHZ': 'chiliz', 'LRC': 'loopring', 'CRV': 'curve-dao-token',
    'SNX': 'havven', 'COMP': 'compound-governance-token', 'YFI': 'yearn-finance',
    'SUSHI': 'sushi', 'BAL': 'balancer', 'ZRX': '0x', '1INCH': '1inch',
    'CAKE': 'pancakeswap-token', 'KCS': 'kucoin-shares', 'GT': 'gatechain-token',
    'ONE': 'harmony', 'KAVA': 'kava', 'CELO': 'celo', 'ZIL': 'zilliqa',
    'WAVES': 'waves', 'IOTA': 'iota', 'NEO': 'neo', 'QTUM': 'qtum', 'ONT': 'ontology',
    'ZEC': 'zcash', 'DASH': 'dash', 'DCR': 'decred', 'SC': 'siacoin',
    'XMR': 'monero', 'EOS': 'eos', 'HOT': 'holotoken', 'BTT': 'bittorrent',
    // Meme coins
    'TRUMP': 'official-trump', 'MELANIA': 'melania-meme', 'FARTCOIN': 'fartcoin',
    'TURBO': 'turbo', 'BRETT': 'brett', 'MOG': 'mog-coin', 'POPCAT': 'popcat',
    'NEIRO': 'neiro-3', 'MOODENG': 'moo-deng', 'PNUT': 'peanut-the-squirrel',
    'SPX': 'spx6900', 'GIGA': 'gigachad', 'BOME': 'book-of-meme', 'MEW': 'cat-in-a-dogs-world',
    'CHILLGUY': 'chill-guy', 'ACT': 'act-i-the-ai-prophecy', 'GOAT': 'goatseus-maximus',
    // AI coins
    'AI16Z': 'ai16z', 'VIRTUAL': 'virtual-protocol', 'AIXBT': 'aixbt',
    'GRIFFAIN': 'griffain', 'ZEREBRO': 'zerebro', 'ARC': 'arc',
    'ELIZA': 'elizawakesup', 'SWARMS': 'swarms', 'ALCH': 'alchemist-ai',
    'AVA': 'ava-ai', 'PRIME': 'echelon-prime', 'AGIX': 'singularitynet',
    'WLD': 'worldcoin-wld', 'OCEAN': 'ocean-protocol', 'AR': 'arweave',
    // New launches
    'PENDLE': 'pendle', 'JTO': 'jito-governance-token', 'W': 'wormhole',
    'DYM': 'dymension', 'STRK': 'starknet', 'MANTA': 'manta-network',
    'ALT': 'altlayer', 'PIXEL': 'pixels', 'PORTAL': 'portal-2', 'XAI': 'xai-blockchain',
    'ONDO': 'ondo-finance', 'ENA': 'ethena', 'ETHFI': 'ether-fi',
    'SAGA': 'saga-2', 'NOT': 'notcoin', 'IO': 'io', 'ZK': 'zksync',
    'ZRO': 'layerzero', 'LISTA': 'lista-dao', 'BLAST': 'blast',
    'BANANA': 'banana-gun', 'RNDR': 'render-token'
};

// Gecko Terminal network mapping for DEX tokens
const GECKO_TERMINAL_NETWORKS = {
    'ethereum': 'eth', 'solana': 'solana', 'base': 'base',
    'arbitrum': 'arbitrum', 'polygon': 'polygon_pos', 'bsc': 'bsc',
    'avalanche': 'avax', 'optimism': 'optimism', 'fantom': 'ftm'
};

// Helper: Detect if input is a contract address
const isContractAddress = (input) => {
    if (!input) return false;
    const trimmed = input.trim();
    // EVM address (0x followed by 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) return { type: 'evm', address: trimmed.toLowerCase() };
    // Solana address (base58, typically 32-44 chars, no 0/O/I/l)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return { type: 'solana', address: trimmed };
    return false;
};

// Helper: Fetch token info by contract address from Gecko Terminal
const fetchTokenByContract = async (contractInfo, interval) => {
    const { type, address } = contractInfo;

    // Determine network based on address type
    // For EVM, we need to search across multiple networks
    const evmNetworks = ['eth', 'bsc', 'base', 'arbitrum', 'polygon_pos', 'avalanche', 'optimism', 'fantom'];
    const networksToSearch = type === 'solana' ? ['solana'] : evmNetworks;

    console.log(`[Chart] 🔍 Looking up contract ${address} (${type}) across networks: ${networksToSearch.join(', ')}`);

    let tokenData = null;
    let poolData = null;

    // Try to find the token across networks
    for (const network of networksToSearch) {
        try {
            // First try to get token info directly
            const tokenUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}`;
            console.log(`[Chart] 🦎 Trying: ${tokenUrl}`);

            const tokenResponse = await axios.get(tokenUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
            });

            if (tokenResponse.data?.data) {
                tokenData = tokenResponse.data.data;
                console.log(`[Chart] ✅ Found token on ${network}: ${tokenData.attributes?.name || 'Unknown'} (${tokenData.attributes?.symbol || 'N/A'})`);

                // Get the top pool for this token
                const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools?page=1`;
                const poolsResponse = await axios.get(poolsUrl, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 8000
                });

                if (poolsResponse.data?.data && poolsResponse.data.data.length > 0) {
                    poolData = {
                        pool: poolsResponse.data.data[0],
                        network: network
                    };
                    console.log(`[Chart] ✅ Found pool: ${poolData.pool.attributes?.address}`);
                }
                break;
            }
        } catch (error) {
            // Token not found on this network, continue
            if (error.response?.status !== 404) {
                console.log(`[Chart] ⚠️ Error checking ${network}: ${error.message}`);
            }
        }
    }

    if (!poolData) {
        throw new Error(`Token not found for contract ${address}`);
    }

    // Map interval to Gecko Terminal timeframe
    let timeframe;
    switch(interval) {
        case 'LIVE':
        case '1m':
        case '5m':
        case '15m':
            timeframe = 'minute';
            break;
        case '30m':
        case '1h':
        case '4h':
            timeframe = 'hour';
            break;
        case '1D':
        case '1W':
            timeframe = 'day';
            break;
        default:
            timeframe = 'hour';
    }

    // Fetch OHLCV data from the pool with pagination (up to 7000 candles for extended history)
    const poolAddress = poolData.pool.attributes?.address;
    const TARGET_CANDLES = 7000;
    const BATCH_SIZE = 1000;
    let allCandles = [];
    let beforeTimestamp = null;

    while (allCandles.length < TARGET_CANDLES) {
        let ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/${poolData.network}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${BATCH_SIZE}`;
        if (beforeTimestamp) {
            ohlcvUrl += `&before_timestamp=${beforeTimestamp}`;
        }
        console.log(`[Chart] 🦎 Fetching OHLCV (batch ${Math.floor(allCandles.length / BATCH_SIZE) + 1}): ${ohlcvUrl}`);

        const ohlcvResponse = await axios.get(ohlcvUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });

        if (!ohlcvResponse.data?.data?.attributes?.ohlcv_list) {
            if (allCandles.length === 0) {
                throw new Error('No OHLCV data available for this token');
            }
            break;
        }

        const batch = ohlcvResponse.data.data.attributes.ohlcv_list;
        if (batch.length === 0) break;

        allCandles = allCandles.concat(batch);

        const oldestTimestamp = batch[batch.length - 1][0];
        if (oldestTimestamp === beforeTimestamp) break;
        beforeTimestamp = oldestTimestamp;

        if (batch.length < BATCH_SIZE) break;
    }

    console.log(`[Chart] 🦎 Fetched ${allCandles.length} total candles for contract`);

    const ohlcvList = allCandles;
    const chartData = ohlcvList
        .map(candle => {
            // Explicit null/undefined check on raw data before parsing
            if (candle[0] == null || candle[1] == null || candle[2] == null ||
                candle[3] == null || candle[4] == null) {
                return null;
            }
            return {
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5]) || 0
            };
        })
        .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                     Number.isFinite(c.low) && Number.isFinite(c.close) &&
                     c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
        .sort((a, b) => a.time - b.time);

    // Debug logging
    if (chartData.length > 0) {
        const tokenSymbol = tokenData?.attributes?.symbol || 'UNKNOWN';
        console.log(`[Chart] 📊 Contract ${address} (${tokenSymbol}): ${chartData.length} candles`);
        chartData.slice(0, 3).forEach((c, i) => {
            const variation = ((c.high - c.low) / c.low * 100).toFixed(4);
            console.log(`  [${i}] O:${c.open.toFixed(10)} H:${c.high.toFixed(10)} L:${c.low.toFixed(10)} C:${c.close.toFixed(10)} (${variation}% range)`);
        });
    }

    return {
        chartData,
        tokenInfo: {
            symbol: tokenData?.attributes?.symbol || 'UNKNOWN',
            name: tokenData?.attributes?.name || 'Unknown Token',
            network: poolData.network,
            address: address
        }
    };
};

// Helper: Get CoinGecko ID for a symbol
const getCoinGeckoId = (symbol) => {
    const upper = symbol.toUpperCase();
    return COINGECKO_ID_MAP[upper] || upper.toLowerCase();
};

// Helper: Synthesize OHLC candles from raw price data points
const synthesizeOHLC = (prices, volumes, candleMinutes) => {
    if (!prices || prices.length === 0) return [];

    const candleMs = candleMinutes * 60 * 1000;
    const candles = new Map();

    // Group price points into candle buckets
    prices.forEach(([timestamp, price]) => {
        const bucketTime = Math.floor(timestamp / candleMs) * candleMs;

        if (!candles.has(bucketTime)) {
            candles.set(bucketTime, {
                time: Math.floor(bucketTime / 1000),
                open: price,
                high: price,
                low: price,
                close: price,
                prices: [price],
                volume: 0
            });
        } else {
            const candle = candles.get(bucketTime);
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            candle.close = price; // Last price becomes close
            candle.prices.push(price);
        }
    });

    // Add volume data if available
    if (volumes && volumes.length > 0) {
        volumes.forEach(([timestamp, volume]) => {
            const bucketTime = Math.floor(timestamp / candleMs) * candleMs;
            if (candles.has(bucketTime)) {
                candles.get(bucketTime).volume += volume / (24 * 60 / candleMinutes); // Approximate per-candle volume
            }
        });
    }

    // Convert to array and sort
    return Array.from(candles.values())
        .map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: Math.round(c.volume)
        }))
        .sort((a, b) => a.time - b.time);
};

// Kraken symbol mapping for cryptos not on Binance US
const KRAKEN_SYMBOL_MAP = {
    'XRP': 'XXRPZUSD',
    'BTC': 'XXBTZUSD',
    'ETH': 'XETHZUSD',
    'LTC': 'XLTCZUSD',
    'XLM': 'XXLMZUSD',
    'ADA': 'ADAUSD',
    'DOT': 'DOTUSD',
    'LINK': 'LINKUSD',
    'SOL': 'SOLUSD',
    'AVAX': 'AVAXUSD',
    'ATOM': 'ATOMUSD',
    'ALGO': 'ALGOUSD',
    'MATIC': 'MATICUSD'
};

// Helper: Fetch intraday OHLC from CryptoCompare histominute (works in US,
// has every major coin including BNB, gives true 1-minute candles).
// Supports aggregation for 1m / 5m / 15m / 30m timeframes.
const fetchCryptoCompareIntraday = async (symbol, interval) => {
    let aggregate = 1;
    let limit = 1500;
    switch (interval) {
        case 'LIVE':
        case '1m': aggregate = 1; limit = 1500; break;
        case '5m': aggregate = 5; limit = 1500; break;
        case '15m': aggregate = 15; limit = 1500; break;
        case '30m': aggregate = 30; limit = 1500; break;
        case '1h': aggregate = 60; limit = 1500; break;
        case '4h': aggregate = 240; limit = 720; break;
        default: throw new Error(`CryptoCompare histominute does not handle interval ${interval}`);
    }
    const url = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${encodeURIComponent(symbol)}&tsym=USD&limit=${limit}&aggregate=${aggregate}`;
    console.log(`[Chart] 💿 CryptoCompare histominute: ${url}`);
    const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });
    const bars = response?.data?.Data?.Data;
    if (!Array.isArray(bars) || bars.length === 0) {
        throw new Error(`No CryptoCompare data for ${symbol}`);
    }
    const chartData = bars
        .filter(b => b && b.close > 0 && b.open > 0)
        .map(b => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volumeto || 0
        }))
        .sort((a, b) => a.time - b.time);
    if (chartData.length === 0) throw new Error(`CryptoCompare returned no valid candles for ${symbol}`);
    console.log(`[Chart] 💿 CryptoCompare returned ${chartData.length} candles for ${symbol} (${interval})`);
    return chartData;
};

// Helper: Fetch OHLC from Kraken (good for XRP and others not on Binance US)
const fetchKrakenOHLC = async (symbol, interval) => {
    const krakenSymbol = KRAKEN_SYMBOL_MAP[symbol.toUpperCase()];
    if (!krakenSymbol) {
        throw new Error(`No Kraken mapping for ${symbol}`);
    }

    // Map interval to Kraken format (in minutes)
    let krakenInterval;
    switch(interval) {
        case 'LIVE':
        case '1m': krakenInterval = 1; break;
        case '5m': krakenInterval = 5; break;
        case '15m': krakenInterval = 15; break;
        case '30m': krakenInterval = 30; break;
        case '1h': krakenInterval = 60; break;
        case '4h': krakenInterval = 240; break;
        case '1D': krakenInterval = 1440; break;
        case '1W': krakenInterval = 10080; break;
        default: krakenInterval = 60;
    }

    // Calculate since timestamp for more data (720 candles ~ 30 days for 1h)
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenSymbol}&interval=${krakenInterval}&since=${since}`;
    console.log(`[Chart] 🦑 Kraken OHLC: ${url}`);

    const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken error: ${response.data.error.join(', ')}`);
    }

    // Get the result key (it varies by pair)
    const resultKey = Object.keys(response.data.result).find(k => k !== 'last');
    if (!resultKey || !response.data.result[resultKey]) {
        throw new Error('No data from Kraken');
    }

    const ohlcData = response.data.result[resultKey];
    console.log(`[Chart] 🦑 Kraken returned ${ohlcData.length} candles`);

    // Kraken format: [time, open, high, low, close, vwap, volume, count]
    const chartData = ohlcData
        .map(candle => ({
            time: parseInt(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[6]) || 0
        }))
        .filter(c => c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                     Number.isFinite(c.low) && Number.isFinite(c.close) &&
                     c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
        .sort((a, b) => a.time - b.time);

    if (chartData.length > 0) {
        console.log(`[Chart] 🦑 Kraken sample: O:${chartData[0].open} H:${chartData[0].high} L:${chartData[0].low} C:${chartData[0].close}`);
    }

    return chartData;
};

// Helper: Fetch price data from CoinGecko market_chart and synthesize OHLC
const fetchCoinGeckoOHLC = async (symbol, interval) => {
    // CoinGecko free /market_chart minimum granularity is ~5 minutes for days=1.
    // Refuse 1m so the caller falls through to a source that provides true 1-minute data
    // (Kraken, Gecko Terminal, or Binance).
    if (interval === '1m' || interval === 'LIVE') {
        throw new Error('CoinGecko cannot provide true 1-minute candles');
    }

    const cgId = getCoinGeckoId(symbol);

    // Map interval to CoinGecko days parameter and candle size
    // /market_chart returns: 1 day = 5-minute data, 2-90 days = hourly, 90+ = daily
    let days, candleMinutes;
    switch(interval) {
        case '5m':
            days = 1;
            candleMinutes = 5;
            break;
        case '15m':
            days = 1;
            candleMinutes = 15;
            break;
        case '30m':
            days = 2;        // Gets hourly data
            candleMinutes = 30;
            break;
        case '1h':
            days = 7;
            candleMinutes = 60;
            break;
        case '4h':
            days = 30;
            candleMinutes = 240;
            break;
        case '1D':
            days = 90;
            candleMinutes = 1440; // 24 hours
            break;
        case '1W':
            days = 365;
            candleMinutes = 10080; // 7 days
            break;
        default:
            days = 7;
            candleMinutes = 60;
    }

    const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`;
    console.log(`[Chart] 🦎 CoinGecko market_chart: ${url}`);

    const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (!response.data || !response.data.prices || response.data.prices.length === 0) {
        throw new Error('No data from CoinGecko');
    }

    console.log(`[Chart] 📊 CoinGecko raw data: ${response.data.prices.length} price points`);

    // Synthesize OHLC candles from raw price data
    const chartData = synthesizeOHLC(
        response.data.prices,
        response.data.total_volumes,
        candleMinutes
    );

    // Debug: Log sample candles to verify OHLC variation
    if (chartData.length > 0) {
        console.log(`[Chart] 📊 Synthesized ${chartData.length} candles for ${symbol} (${candleMinutes}min):`);
        chartData.slice(0, 3).forEach((c, i) => {
            const variation = ((c.high - c.low) / c.low * 100).toFixed(2);
            console.log(`  [${i}] O:${c.open.toFixed(6)} H:${c.high.toFixed(6)} L:${c.low.toFixed(6)} C:${c.close.toFixed(6)} (${variation}% range)`);
        });
    }

    return chartData;
};

// Helper: Fetch from Gecko Terminal (DEX data - has more tokens)
const fetchGeckoTerminalOHLC = async (symbol, interval, network = null) => {
    // First, search for the token to get the pool address
    // If network is specified, search that network; otherwise search all networks
    let searchUrl;
    if (network) {
        searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}&network=${network}`;
    } else {
        // Search all networks
        searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}`;
    }
    console.log(`[Chart] 🦎 Gecko Terminal search: ${searchUrl}`);

    const searchResponse = await axios.get(searchUrl, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
        throw new Error(`No pool found for ${symbol}${network ? ` on ${network}` : ''}`);
    }

    // Get the first (most liquid) pool
    const pool = searchResponse.data.data[0];
    const poolAddress = pool.attributes?.address;
    // Extract network from pool ID (format: network_address, e.g., "base_0x...")
    const poolNetwork = pool.id?.split('_')[0] || network || 'eth';

    if (!poolAddress) {
        throw new Error(`Invalid pool data for ${symbol}`);
    }

    console.log(`[Chart] 🦎 Found pool: ${poolAddress} on ${poolNetwork}`);

    // Map interval to Gecko Terminal timeframe
    let timeframe;
    switch(interval) {
        case 'LIVE':
        case '1m':
            timeframe = 'minute';
            break;
        case '5m':
            timeframe = 'minute';
            break;
        case '15m':
            timeframe = 'minute';
            break;
        case '1h':
            timeframe = 'hour';
            break;
        case '4h':
            timeframe = 'hour';
            break;
        case '1D':
            timeframe = 'day';
            break;
        default:
            timeframe = 'hour';
    }

    // Fetch OHLCV data with pagination (up to 7000 candles for extended history)
    const TARGET_CANDLES = 7000;
    const BATCH_SIZE = 1000;
    let allCandles = [];
    let beforeTimestamp = null;

    while (allCandles.length < TARGET_CANDLES) {
        let ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/${poolNetwork}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${BATCH_SIZE}`;
        if (beforeTimestamp) {
            ohlcvUrl += `&before_timestamp=${beforeTimestamp}`;
        }
        console.log(`[Chart] 🦎 Gecko Terminal OHLCV (batch ${Math.floor(allCandles.length / BATCH_SIZE) + 1}): ${ohlcvUrl}`);

        const ohlcvResponse = await axios.get(ohlcvUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });

        if (!ohlcvResponse.data?.data?.attributes?.ohlcv_list) {
            if (allCandles.length === 0) {
                throw new Error('No OHLCV data from Gecko Terminal');
            }
            break; // No more data available
        }

        const batch = ohlcvResponse.data.data.attributes.ohlcv_list;
        if (batch.length === 0) break;

        allCandles = allCandles.concat(batch);

        // Get the oldest timestamp for the next batch
        const oldestTimestamp = batch[batch.length - 1][0];
        if (oldestTimestamp === beforeTimestamp) break; // No progress, stop
        beforeTimestamp = oldestTimestamp;

        // If we got less than requested, no more data available
        if (batch.length < BATCH_SIZE) break;
    }

    console.log(`[Chart] 🦎 Fetched ${allCandles.length} total candles for ${symbol}`);

    // Gecko Terminal format: [timestamp, open, high, low, close, volume]
    const ohlcvList = allCandles;
    const chartData = ohlcvList
        .map(candle => {
            // Explicit null/undefined check on raw data before parsing
            if (candle[0] == null || candle[1] == null || candle[2] == null ||
                candle[3] == null || candle[4] == null) {
                return null;
            }
            return {
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5]) || 0
            };
        })
        .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                     Number.isFinite(c.low) && Number.isFinite(c.close) &&
                     c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
        .sort((a, b) => a.time - b.time); // Sort ascending by time

    // Debug: Log sample candles to verify OHLC variation
    if (chartData.length > 0) {
        console.log(`[Chart] 📊 Gecko Terminal ${chartData.length} candles for ${symbol}:`);
        chartData.slice(0, 3).forEach((c, i) => {
            const variation = ((c.high - c.low) / c.low * 100).toFixed(4);
            console.log(`  [${i}] O:${c.open.toFixed(8)} H:${c.high.toFixed(8)} L:${c.low.toFixed(8)} C:${c.close.toFixed(8)} (${variation}% range)`);
        });
    }

    return chartData;
};

// Helper: Check if symbol is crypto
const isCrypto = (symbol) => {
    const upper = symbol.toUpperCase();
    // Check for network specifier (e.g., XRP:bsc, PEPE:eth)
    if (upper.includes(':')) return true;
    // Check for -USD, -USDT suffixes
    if (upper.includes('-USD') || upper.includes('USDT')) return true;
    // Check if base symbol is a known crypto
    const base = upper.replace(/-USD.*$/, '').replace(/USDT$/, '');
    return KNOWN_CRYPTOS.includes(base);
};

// Helper: Parse crypto symbol with network support
// Formats: BTC-USD, BTC, XRP:bsc, PEPE:eth, TOKEN:solana
const parseCryptoSymbol = (symbol) => {
    // Check for network specifier (e.g., XRP:bsc, PEPE:eth)
    if (symbol.includes(':')) {
        const [crypto, network] = symbol.split(':');
        return {
            crypto: crypto.toUpperCase(),
            market: 'USD',
            network: network.toLowerCase()
        };
    }
    if (symbol.includes('-')) {
        const [crypto, market] = symbol.split('-');
        return { crypto: crypto.toUpperCase(), market: market.toUpperCase(), network: null };
    }
    // Default to USD if no market specified
    return { crypto: symbol.toUpperCase(), market: 'USD', network: null };
};

// @route   GET /api/chart/:symbol/:interval
// @desc    Get historical chart data for stocks AND crypto
// @access  Private
router.get('/:symbol/:interval', auth, async (req, res) => {
    try {
        const { interval } = req.params;
        console.log(`[Chart] 📊 Request received: symbol=${req.params.symbol}, interval=${interval}`);

        // Validate symbol to prevent SSRF/injection attacks
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: validationError.message
            });
        }

        const cacheKey = `${symbol}-${interval}`;
        console.log(`[Chart] Cache key: ${cacheKey}`);

        // Check cache
        const cached = chartDataCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[Chart] ✅ Cache HIT for ${symbol} ${interval} (${cached.data.length} candles)`);
            return res.json({
                success: true,
                data: cached.data,
                symbol: symbol.toUpperCase(),
                interval
            });
        }
        console.log(`[Chart] ❌ Cache MISS for ${symbol} ${interval}`);

        console.log(`[Chart] Fetching data for ${symbol} ${interval}`);

        // ====== CONTRACT ADDRESS PATH ======
        // Check if the symbol is actually a contract address (0x... or Solana base58)
        const contractInfo = isContractAddress(symbol);
        if (contractInfo) {
            console.log(`[Chart] 📝 Detected CONTRACT ADDRESS: ${contractInfo.address} (${contractInfo.type})`);

            try {
                const result = await fetchTokenByContract(contractInfo, interval);

                // Cache the data
                chartDataCache.set(cacheKey, {
                    data: result.chartData,
                    timestamp: Date.now()
                });

                console.log(`[Chart] ✅ Contract lookup succeeded: ${result.chartData.length} candles for ${result.tokenInfo.symbol}`);

                return res.json({
                    success: true,
                    data: result.chartData,
                    symbol: result.tokenInfo.symbol,
                    name: result.tokenInfo.name,
                    network: result.tokenInfo.network,
                    address: result.tokenInfo.address,
                    interval,
                    source: 'geckoterminal-contract'
                });
            } catch (contractError) {
                console.error(`[Chart] ❌ Contract lookup failed: ${contractError.message}`);
                return res.status(404).json({
                    success: false,
                    error: 'Token not found',
                    message: `Could not find token for contract address: ${contractInfo.address}`,
                    address: contractInfo.address
                });
            }
        }

        // ====== SYMBOL PATH (traditional) ======
        // Check if crypto or stock
        if (isCrypto(symbol)) {
            // ====== CRYPTO PATH ======
            const { crypto, market, network } = parseCryptoSymbol(symbol);
            console.log(`[Chart] 🪙 Detected CRYPTO: ${crypto}/${market}${network ? ` (network: ${network})` : ''}`);

            // Use Binance API for intraday (free, no API key required)
            // Use Alpha Vantage for daily/weekly/monthly
            const isIntraday = ['LIVE', '1m', '5m', '15m', '30m', '1h', '4h'].includes(interval);

            if (isIntraday) {
                // ====== CRYPTO INTRADAY - PRIORITY ORDER ======
                // If network is specified, prioritize Gecko Terminal (DEX data)
                // Otherwise: 1. CoinGecko, 2. Gecko Terminal, 3. Binance

                // If network is specified (e.g., XRP:bsc), try Gecko Terminal FIRST
                if (network) {
                    try {
                        console.log(`[Chart] 🦎 Network specified (${network}), trying Gecko Terminal first for ${crypto}...`);
                        const chartData = await fetchGeckoTerminalOHLC(crypto, interval, network);

                        chartDataCache.set(cacheKey, {
                            data: chartData,
                            timestamp: Date.now()
                        });

                        console.log(`[Chart] ✅ Gecko Terminal succeeded: ${chartData.length} candles for ${crypto} on ${network}`);

                        return res.json({
                            success: true,
                            data: chartData,
                            symbol: `${crypto}-USD`,
                            interval,
                            source: 'geckoterminal',
                            network: network
                        });
                    } catch (gtError) {
                        console.log(`[Chart] ⚠️ Gecko Terminal failed for ${network}: ${gtError.message}`);
                        // Continue to other sources
                    }
                }

                // Try CryptoCompare histominute FIRST for known centralized cryptos.
                // It has BNB and most majors, returns true minute-granularity OHLC, and
                // is not geo-blocked from US datacenters (unlike Binance Global).
                if (KNOWN_CRYPTOS.includes(crypto.toUpperCase())) {
                    try {
                        const chartData = await fetchCryptoCompareIntraday(crypto, interval);
                        if (chartData && chartData.length > 0) {
                            chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });
                            console.log(`[Chart] ✅ CryptoCompare histominute succeeded: ${chartData.length} candles for ${crypto}`);
                            return res.json({
                                success: true,
                                data: chartData,
                                symbol: `${crypto}-USD`,
                                interval,
                                source: 'cryptocompare-histominute'
                            });
                        }
                    } catch (ccErr) {
                        console.log(`[Chart] ⚠️ CryptoCompare histominute failed for ${crypto}: ${ccErr.message}`);
                    }
                }

                // Try Kraken next for supported cryptos (real OHLC data, works in US)
                if (KRAKEN_SYMBOL_MAP[crypto]) {
                    try {
                        console.log(`[Chart] 🦑 Trying Kraken for ${crypto}...`);
                        const chartData = await fetchKrakenOHLC(crypto, interval);

                        if (chartData && chartData.length > 0) {
                            chartDataCache.set(cacheKey, {
                                data: chartData,
                                timestamp: Date.now()
                            });

                            console.log(`[Chart] ✅ Kraken succeeded: ${chartData.length} candles for ${crypto}`);

                            return res.json({
                                success: true,
                                data: chartData,
                                symbol: `${crypto}-USD`,
                                interval,
                                source: 'kraken'
                            });
                        }
                    } catch (krakenError) {
                        console.log(`[Chart] ⚠️ Kraken failed: ${krakenError.message}`);
                    }
                }

                // Try CoinGecko (synthesized OHLC from price data)
                try {
                    console.log(`[Chart] 🦎 Trying CoinGecko for ${crypto}...`);
                    const chartData = await fetchCoinGeckoOHLC(crypto, interval);

                    chartDataCache.set(cacheKey, {
                        data: chartData,
                        timestamp: Date.now()
                    });

                    console.log(`[Chart] ✅ CoinGecko succeeded: ${chartData.length} candles for ${crypto}`);

                    return res.json({
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval,
                        source: 'coingecko'
                    });
                } catch (cgError) {
                    console.log(`[Chart] ⚠️ CoinGecko failed: ${cgError.message}`);
                }

                // For known centralized cryptos, try Binance BEFORE Gecko Terminal —
                // GT's DEX search returns wrong-token scam pools when ticker collides
                // (e.g. "BNB" matches a $5 wrapped DEX token instead of real BNB).
                const isKnownCentralized = KNOWN_CRYPTOS.includes(crypto.toUpperCase());
                if (!isKnownCentralized) {
                    // Unknown / DEX-only token: try Gecko Terminal (any network)
                    try {
                        console.log(`[Chart] 🦎 Trying Gecko Terminal (any network) for ${crypto}...`);
                        const chartData = await fetchGeckoTerminalOHLC(crypto, interval);

                        chartDataCache.set(cacheKey, {
                            data: chartData,
                            timestamp: Date.now()
                        });

                        console.log(`[Chart] ✅ Gecko Terminal succeeded: ${chartData.length} candles for ${crypto}`);

                        return res.json({
                            success: true,
                            data: chartData,
                            symbol: `${crypto}-USD`,
                            interval,
                            source: 'geckoterminal'
                        });
                    } catch (gtError) {
                        console.log(`[Chart] ⚠️ Gecko Terminal failed: ${gtError.message}`);
                    }
                }

                // Fallback to Binance (always tried for known centralized cryptos)
                console.log(`[Chart] 🔄 Falling back to Binance for ${crypto}...`);

                // Map interval to Binance format (Binance supports real 1m and 5m)
                let binanceInterval;
                switch(interval) {
                    case 'LIVE': binanceInterval = '1m'; break;
                    case '1m': binanceInterval = '1m'; break;
                    case '5m': binanceInterval = '5m'; break;
                    case '15m': binanceInterval = '15m'; break;
                    case '30m': binanceInterval = '30m'; break;
                    case '1h': binanceInterval = '1h'; break;
                    case '4h': binanceInterval = '4h'; break;
                    default: binanceInterval = '1h';
                }

                const binanceSymbol = `${crypto}USDT`;
                const TARGET_BINANCE_CANDLES = 2000;
                const BINANCE_BATCH = 1000;

                try {
                    // Fetch with pagination for more candles
                    let allCandles = [];
                    let endTime = null;

                    while (allCandles.length < TARGET_BINANCE_CANDLES) {
                        let binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${BINANCE_BATCH}`;
                        if (endTime) {
                            binanceUrl += `&endTime=${endTime}`;
                        }

                        const response = await axios.get(binanceUrl, {
                            headers: {
                                'User-Agent': 'NexusSignal/1.0',
                                'Accept': 'application/json'
                            },
                            timeout: 10000
                        });

                        if (!response.data || response.data.length === 0) break;

                        // Prepend older data
                        allCandles = [...response.data, ...allCandles];

                        // Get oldest timestamp for next batch
                        endTime = response.data[0][0] - 1;

                        if (response.data.length < BINANCE_BATCH) break;
                    }

                    if (allCandles.length === 0) {
                        console.log(`[Chart] ❌ No Binance data for ${binanceSymbol}`);
                        return res.status(404).json({
                            success: false,
                            error: 'No crypto data found for this symbol'
                        });
                    }

                    const chartData = allCandles
                        .map(kline => {
                            // Explicit null/undefined check on raw data before parsing
                            if (kline[0] == null || kline[1] == null || kline[2] == null ||
                                kline[3] == null || kline[4] == null) {
                                return null;
                            }
                            return {
                                time: Math.floor(kline[0] / 1000),
                                open: parseFloat(kline[1]),
                                high: parseFloat(kline[2]),
                                low: parseFloat(kline[3]),
                                close: parseFloat(kline[4]),
                                volume: parseFloat(kline[5]) || 0
                            };
                        })
                        .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                                     Number.isFinite(c.low) && Number.isFinite(c.close) &&
                                     c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
                        .sort((a, b) => a.time - b.time);

                    // Cache the data
                    chartDataCache.set(cacheKey, {
                        data: chartData,
                        timestamp: Date.now()
                    });

                    console.log(`[Chart] ✅ Binance succeeded: ${chartData.length} candles for ${crypto}/${binanceInterval}`);

                    return res.json({
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval,
                        source: 'binance'
                    });

                } catch (binanceError) {
                    console.error(`[Chart] ❌ Binance Global error:`, binanceError.message);

                    // Try Binance US as last resort with pagination
                    try {
                        console.log(`[Chart] 🔄 Trying Binance US as final fallback...`);
                        let usCandles = [];
                        let usEndTime = null;

                        while (usCandles.length < TARGET_BINANCE_CANDLES) {
                            let binanceUsUrl = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${BINANCE_BATCH}`;
                            if (usEndTime) {
                                binanceUsUrl += `&endTime=${usEndTime}`;
                            }

                            const usResponse = await axios.get(binanceUsUrl, {
                                headers: {
                                    'User-Agent': 'NexusSignal/1.0',
                                    'Accept': 'application/json'
                                },
                                timeout: 10000
                            });

                            if (!usResponse.data || usResponse.data.length === 0) break;

                            usCandles = [...usResponse.data, ...usCandles];
                            usEndTime = usResponse.data[0][0] - 1;

                            if (usResponse.data.length < BINANCE_BATCH) break;
                        }

                        if (usCandles.length > 0) {
                            const chartData = usCandles
                                .map(kline => {
                                    // Explicit null/undefined check on raw data before parsing
                                    if (kline[0] == null || kline[1] == null || kline[2] == null ||
                                        kline[3] == null || kline[4] == null) {
                                        return null;
                                    }
                                    return {
                                        time: Math.floor(kline[0] / 1000),
                                        open: parseFloat(kline[1]),
                                        high: parseFloat(kline[2]),
                                        low: parseFloat(kline[3]),
                                        close: parseFloat(kline[4]),
                                        volume: parseFloat(kline[5]) || 0
                                    };
                                })
                                .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                                             Number.isFinite(c.low) && Number.isFinite(c.close) &&
                                             c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
                                .sort((a, b) => a.time - b.time);

                            chartDataCache.set(cacheKey, {
                                data: chartData,
                                timestamp: Date.now()
                            });

                            console.log(`[Chart] ✅ Binance US succeeded: ${chartData.length} candles`);
                            return res.json({
                                success: true,
                                data: chartData,
                                symbol: `${crypto}-USD`,
                                interval,
                                source: 'binance-us'
                            });
                        }
                    } catch (usError) {
                        console.error(`[Chart] ❌ Binance US also failed:`, usError.message);
                    }

                    // All sources failed
                    return res.status(503).json({
                        success: false,
                        error: 'Unable to fetch crypto data',
                        message: 'All data sources failed (CoinGecko, Gecko Terminal, Binance)',
                        symbol: crypto
                    });
                }
            }

            // ====== DAILY/WEEKLY/MONTHLY CRYPTO ======
            // If network is specified, try Gecko Terminal FIRST (for DEX tokens)
            if (network) {
                try {
                    console.log(`[Chart] 🦎 Network specified (${network}), trying Gecko Terminal first for ${crypto} (${interval})...`);
                    const chartData = await fetchGeckoTerminalOHLC(crypto, interval, network);

                    chartDataCache.set(cacheKey, {
                        data: chartData,
                        timestamp: Date.now()
                    });

                    console.log(`[Chart] ✅ Gecko Terminal succeeded: ${chartData.length} candles for ${crypto} on ${network} (${interval})`);

                    return res.json({
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval,
                        source: 'geckoterminal',
                        network: network
                    });
                } catch (gtError) {
                    console.log(`[Chart] ⚠️ Gecko Terminal failed for ${network}: ${gtError.message}, trying CoinGecko...`);
                }
            }

            // For known centralized cryptos, try CryptoCompare histoday FIRST.
            // This is the most reliable source for BNB and other majors and avoids
            // CoinGecko rate-limit fall-throughs that end up at Gecko Terminal returning
            // wrong-token DEX pools.
            const isKnownCentralizedDaily = KNOWN_CRYPTOS.includes(crypto.toUpperCase());
            if (isKnownCentralizedDaily) {
                try {
                    const ccLimit = interval === '1M' ? 30 : interval === '1W' ? 364 : 365;
                    const ccUrl = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${encodeURIComponent(crypto)}&tsym=USD&limit=${ccLimit}`;
                    console.log(`[Chart] 💿 CryptoCompare histoday (priority): ${ccUrl}`);
                    const ccRes = await axios.get(ccUrl, { timeout: 8000 });
                    const bars = ccRes?.data?.Data?.Data || [];
                    if (bars.length > 10) {
                        const ccChart = bars
                            .filter(b => b.close > 0 && b.open > 0)
                            .map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volumeto || 0 }));
                        chartDataCache.set(cacheKey, { data: ccChart, timestamp: Date.now() });
                        console.log(`[Chart] ✅ CryptoCompare histoday: ${ccChart.length} candles for ${crypto}`);
                        return res.json({ success: true, data: ccChart, symbol: `${crypto}-USD`, interval, source: 'cryptocompare-priority' });
                    }
                } catch (ccPriErr) {
                    console.log(`[Chart] ⚠️ CryptoCompare histoday priority failed: ${ccPriErr.message}`);
                }
            }

            // Try Kraken next for supported cryptos (real OHLC data, works in US)
            if (KRAKEN_SYMBOL_MAP[crypto]) {
                try {
                    console.log(`[Chart] 🦑 Trying Kraken for ${crypto} (${interval})...`);
                    const chartData = await fetchKrakenOHLC(crypto, interval);

                    if (chartData && chartData.length > 0) {
                        chartDataCache.set(cacheKey, {
                            data: chartData,
                            timestamp: Date.now()
                        });

                        console.log(`[Chart] ✅ Kraken succeeded: ${chartData.length} candles for ${crypto} (${interval})`);

                        return res.json({
                            success: true,
                            data: chartData,
                            symbol: `${crypto}-USD`,
                            interval,
                            source: 'kraken'
                        });
                    }
                } catch (krakenError) {
                    console.log(`[Chart] ⚠️ Kraken failed: ${krakenError.message}`);
                }
            }

            // Try CoinGecko (synthesized OHLC from price data)
            try {
                console.log(`[Chart] 🦎 Trying CoinGecko for ${crypto} (${interval})...`);
                const chartData = await fetchCoinGeckoOHLC(crypto, interval);

                chartDataCache.set(cacheKey, {
                    data: chartData,
                    timestamp: Date.now()
                });

                console.log(`[Chart] ✅ CoinGecko succeeded: ${chartData.length} candles for ${crypto} (${interval})`);

                return res.json({
                    success: true,
                    data: chartData,
                    symbol: `${crypto}-USD`,
                    interval,
                    source: 'coingecko'
                });
            } catch (cgError) {
                console.log(`[Chart] ⚠️ CoinGecko failed for daily: ${cgError.message}, trying Gecko Terminal...`);
            }

            // Try Gecko Terminal for daily data (DEX tokens only — known centralized
            // cryptos must NEVER hit GT search because it returns wrong-token pools
            // when tickers collide with wrapped/scam variants).
            if (!isKnownCentralizedDaily) {
                try {
                    console.log(`[Chart] 🦎 Trying Gecko Terminal for ${crypto} (${interval})${network ? ` on ${network}` : ''}...`);
                    const chartData = await fetchGeckoTerminalOHLC(crypto, interval, network);

                    chartDataCache.set(cacheKey, {
                        data: chartData,
                        timestamp: Date.now()
                    });

                    console.log(`[Chart] ✅ Gecko Terminal succeeded: ${chartData.length} candles for ${crypto} (${interval})`);

                    return res.json({
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval,
                        source: 'geckoterminal',
                        network: network || undefined
                    });
                } catch (gtError) {
                    console.log(`[Chart] ⚠️ Gecko Terminal failed for daily: ${gtError.message}, trying Alpha Vantage...`);
                }
            }

            // Fallback to Alpha Vantage for daily/weekly/monthly
            let alphaVantageFunction;
            let dataKey;

            switch(interval) {
                case '1D':
                    alphaVantageFunction = 'DIGITAL_CURRENCY_DAILY';
                    dataKey = 'Time Series (Digital Currency Daily)';
                    break;
                case '1W':
                    alphaVantageFunction = 'DIGITAL_CURRENCY_WEEKLY';
                    dataKey = 'Time Series (Digital Currency Weekly)';
                    break;
                case '1M':
                    alphaVantageFunction = 'DIGITAL_CURRENCY_MONTHLY';
                    dataKey = 'Time Series (Digital Currency Monthly)';
                    break;
                default:
                    alphaVantageFunction = 'DIGITAL_CURRENCY_DAILY';
                    dataKey = 'Time Series (Digital Currency Daily)';
            }

            // TRY CRYPTOCOMPARE FIRST (no rate limit issues, fast)
            try {
                console.log(`[Chart] 🔄 Trying CryptoCompare for ${crypto} (${interval})...`);
                const ccEndpoint = ['1W','1M'].includes(interval) ? 'histoday' : 'histoday';
                const ccLimit = interval === '1M' ? 30 : interval === '1W' ? 52 * 7 : interval === '6M' ? 180 : 365;
                const ccRes = await axios.get(
                    `https://min-api.cryptocompare.com/data/v2/${ccEndpoint}?fsym=${crypto}&tsym=USD&limit=${ccLimit}`,
                    { timeout: 8000 }
                );
                const ccBars = ccRes.data?.Data?.Data || [];
                if (ccBars.length > 10) {
                    const ccChart = ccBars
                        .filter(b => b.close > 0)
                        .map(b => ({
                            time: b.time,
                            open: b.open,
                            high: b.high,
                            low: b.low,
                            close: b.close,
                            volume: b.volumeto || 0
                        }));
                    chartDataCache.set(cacheKey, { data: ccChart, timestamp: Date.now() });
                    console.log(`[Chart] ✅ CryptoCompare: ${ccChart.length} candles for ${crypto}`);
                    return res.json({ success: true, data: ccChart, symbol: `${crypto}-USD`, interval, source: 'cryptocompare' });
                }
            } catch (ccErr) {
                console.log(`[Chart] CryptoCompare failed for ${crypto}:`, ccErr.message);
            }

            // FALLBACK: Alpha Vantage (may rate limit)
            const apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${crypto}&market=${market}&apikey=${ALPHA_VANTAGE_API_KEY}`;

            console.log(`[Chart] 🔗 Crypto API call to Alpha Vantage`);

            const response = await axios.get(apiUrl);

            if (response.data['Error Message']) {
                console.log(`[Chart] ❌ Crypto symbol not found: ${crypto}`);
                return res.status(404).json({
                    success: false,
                    error: 'Crypto symbol not found'
                });
            }

            if (response.data['Note']) {
                console.log(`[Chart] ⏱️ API rate limit reached`);
                return res.status(429).json({
                    success: false,
                    error: 'API rate limit reached. Please try again in a minute.'
                });
            }

            const timeSeries = response.data[dataKey];

            if (!timeSeries) {
                console.log('[Chart] ❌ No crypto data in response');
                return res.status(404).json({
                    success: false,
                    error: 'No crypto data found for this symbol'
                });
            }

            // Transform CRYPTO data to chart format
            const entries = Object.entries(timeSeries);
            const uniqueData = new Map();

            entries.forEach(([time, values]) => {
                const openKey = `1a. open (${market})`;
                const highKey = `2a. high (${market})`;
                const lowKey = `3a. low (${market})`;
                const closeKey = `4a. close (${market})`;
                const volumeKey = '5. volume';

                const dateObj = new Date(time);
                const timestamp = Math.floor(dateObj.getTime() / 1000);

                // Get raw values
                const openVal = values[openKey] || values['1. open'];
                const highVal = values[highKey] || values['2. high'];
                const lowVal = values[lowKey] || values['3. low'];
                const closeVal = values[closeKey] || values['4. close'];

                // Skip if any OHLC value is null/undefined
                if (openVal == null || highVal == null || lowVal == null || closeVal == null) {
                    return;
                }

                if (!uniqueData.has(timestamp)) {
                    uniqueData.set(timestamp, {
                        time: timestamp,
                        open: parseFloat(openVal),
                        high: parseFloat(highVal),
                        low: parseFloat(lowVal),
                        close: parseFloat(closeVal),
                        volume: parseFloat(values[volumeKey] || 0)
                    });
                }
            });

            const chartData = Array.from(uniqueData.values())
                .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                             Number.isFinite(c.low) && Number.isFinite(c.close) &&
                             c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
                .sort((a, b) => a.time - b.time)
                .slice(-1000);

            chartDataCache.set(cacheKey, {
                data: chartData,
                timestamp: Date.now()
            });

            console.log(`[Chart] ✅ Successfully fetched ${chartData.length} crypto candles for ${crypto}/${market}`);
            
            return res.json({
                success: true,
                data: chartData,
                symbol: `${crypto}-${market}`,
                interval
            });
            
        } else {
            // ====== STOCK PATH ======
            console.log(`[Chart] 📈 Detected STOCK: ${symbol}`);

            // TRY YAHOO FINANCE FIRST (real-time, free, accurate)
            try {
                let yahooInterval, yahooRange;
                switch(interval) {
                    case 'LIVE': case '1m': yahooInterval = '1m'; yahooRange = '1d'; break;
                    case '5m': yahooInterval = '5m'; yahooRange = '5d'; break;
                    case '15m': yahooInterval = '15m'; yahooRange = '5d'; break;
                    case '30m': yahooInterval = '30m'; yahooRange = '1mo'; break;
                    case '1h': case '60m': yahooInterval = '1h'; yahooRange = '1mo'; break;
                    case '4h': yahooInterval = '1d'; yahooRange = '6mo'; break;
                    case '1D': yahooInterval = '1d'; yahooRange = '2y'; break;
                    case '1W': yahooInterval = '1wk'; yahooRange = '5y'; break;
                    case '1M': yahooInterval = '1mo'; yahooRange = '10y'; break;
                    default: yahooInterval = '1d'; yahooRange = '1y';
                }

                console.log(`[Chart] 📊 Trying Yahoo Finance for ${symbol} (${yahooInterval}/${yahooRange})...`);
                const yahooRes = await axios.get(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${yahooRange}`,
                    {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        timeout: 10000
                    }
                );

                const result = yahooRes.data?.chart?.result?.[0];
                const timestamps = result?.timestamp;
                const quote = result?.indicators?.quote?.[0];

                if (timestamps?.length > 5 && quote) {
                    const yahooChart = timestamps.map((t, i) => ({
                        time: t,
                        open: quote.open?.[i],
                        high: quote.high?.[i],
                        low: quote.low?.[i],
                        close: quote.close?.[i],
                        volume: quote.volume?.[i] || 0
                    })).filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0 &&
                                    Number.isFinite(c.open) && Number.isFinite(c.close));

                    if (yahooChart.length > 5) {
                        chartDataCache.set(cacheKey, { data: yahooChart, timestamp: Date.now() });
                        const lastPrice = yahooChart[yahooChart.length - 1].close;
                        console.log(`[Chart] ✅ Yahoo Finance: ${yahooChart.length} candles for ${symbol} (last: $${lastPrice.toFixed(2)})`);
                        return res.json({ success: true, data: yahooChart, symbol, interval, source: 'yahoo' });
                    }
                }
                console.log(`[Chart] ⚠️ Yahoo Finance returned insufficient data for ${symbol}`);
            } catch (yahooErr) {
                console.log(`[Chart] Yahoo Finance failed for ${symbol}:`, yahooErr.message);
            }

            // FALLBACK: Finnhub (delayed data on free tier but works for daily+)
            const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
            if (FINNHUB_KEY) {
                try {
                    const now = Math.floor(Date.now() / 1000);
                    let resolution, from;
                    switch(interval) {
                        case 'LIVE': case '1m': resolution = '1'; from = now - 86400; break;
                        case '5m': resolution = '5'; from = now - 86400 * 3; break;
                        case '15m': resolution = '15'; from = now - 86400 * 5; break;
                        case '30m': resolution = '30'; from = now - 86400 * 7; break;
                        case '1h': case '60m': resolution = '60'; from = now - 86400 * 14; break;
                        case '4h': resolution = 'D'; from = now - 86400 * 90; break;
                        case '1D': resolution = 'D'; from = now - 86400 * 365; break;
                        case '1W': resolution = 'W'; from = now - 86400 * 365 * 3; break;
                        case '1M': resolution = 'M'; from = now - 86400 * 365 * 5; break;
                        default: resolution = 'D'; from = now - 86400 * 365;
                    }

                    console.log(`[Chart] 📊 Trying Finnhub for ${symbol} (${resolution})...`);
                    const fhRes = await axios.get(
                        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_KEY}`,
                        { timeout: 8000 }
                    );

                    if (fhRes.data?.s === 'ok' && fhRes.data?.c?.length > 5) {
                        const fhChart = fhRes.data.t.map((t, i) => ({
                            time: t,
                            open: fhRes.data.o[i],
                            high: fhRes.data.h[i],
                            low: fhRes.data.l[i],
                            close: fhRes.data.c[i],
                            volume: fhRes.data.v[i] || 0
                        })).filter(c => c.close > 0);

                        chartDataCache.set(cacheKey, { data: fhChart, timestamp: Date.now() });
                        console.log(`[Chart] ✅ Finnhub: ${fhChart.length} candles for ${symbol}`);
                        return res.json({ success: true, data: fhChart, symbol, interval, source: 'finnhub' });
                    }
                } catch (fhErr) {
                    console.log(`[Chart] Finnhub failed for ${symbol}:`, fhErr.message);
                }
            }

            let alphaVantageFunction;
            let dataKey;

            // Map interval to Alpha Vantage function
            switch(interval) {
                case 'LIVE': case '1m': case '5m': case '15m': case '30m': case '60m': case '1h':
                    alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                    {
                        let avInterval;
                        if (interval === '1h') avInterval = '60min';
                        else if (interval === 'LIVE') avInterval = '1min';
                        else avInterval = interval.replace('m', 'min');
                        dataKey = `Time Series (${avInterval})`;
                    }
                    break;
                case '4h': case '1D':
                    alphaVantageFunction = 'TIME_SERIES_DAILY';
                    dataKey = 'Time Series (Daily)';
                    break;
                case '1W':
                    alphaVantageFunction = 'TIME_SERIES_WEEKLY';
                    dataKey = 'Weekly Time Series';
                    break;
                case '1M':
                    alphaVantageFunction = 'TIME_SERIES_MONTHLY';
                    dataKey = 'Monthly Time Series';
                    break;
                default:
                    alphaVantageFunction = 'TIME_SERIES_DAILY';
                    dataKey = 'Time Series (Daily)';
            }

            // FALLBACK: Alpha Vantage
            // Build API URL for STOCKS
            let apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

            if (alphaVantageFunction === 'TIME_SERIES_INTRADAY') {
                let avInterval;
                if (interval === '1h') {
                    avInterval = '60min';
                } else if (interval === 'LIVE') {
                    avInterval = '1min'; // LIVE uses 1-minute candles
                } else {
                    avInterval = interval.replace('m', 'min'); // 1m -> 1min, 5m -> 5min
                }
                apiUrl += `&interval=${avInterval}&outputsize=full`;
            } else if (alphaVantageFunction === 'TIME_SERIES_DAILY') {
                // Get full historical data for daily charts
                apiUrl += `&outputsize=full`;
            }
            
            console.log(`[Chart] 🔗 Stock API call to Alpha Vantage`);
            
            const response = await axios.get(apiUrl);
            
            // Check for API errors
            if (response.data['Error Message']) {
                return res.status(404).json({
                    success: false,
                    error: 'Stock symbol not found'
                });
            }
            
            if (response.data['Note']) {
                return res.status(429).json({
                    success: false,
                    error: 'API rate limit reached. Please try again in a minute.'
                });
            }
            
            const timeSeries = response.data[dataKey];
            
            if (!timeSeries) {
                return res.status(404).json({
                    success: false,
                    error: 'No stock data found for this symbol'
                });
            }
            
           // Transform STOCK data to chart format
const entries = Object.entries(timeSeries);
const uniqueData = new Map(); // Use Map to ensure unique timestamps

entries.forEach(([time, values]) => {
    // Convert to Unix timestamp (in seconds for TradingView charts)
    const dateObj = new Date(time);
    const timestamp = Math.floor(dateObj.getTime() / 1000);

    // Get raw values
    const openVal = values['1. open'];
    const highVal = values['2. high'];
    const lowVal = values['3. low'];
    const closeVal = values['4. close'];

    // Skip if any OHLC value is null/undefined
    if (openVal == null || highVal == null || lowVal == null || closeVal == null) {
        return;
    }

    // Only keep the first entry for each timestamp (in case of duplicates)
    if (!uniqueData.has(timestamp)) {
        uniqueData.set(timestamp, {
            time: timestamp,
            open: parseFloat(openVal),
            high: parseFloat(highVal),
            low: parseFloat(lowVal),
            close: parseFloat(closeVal),
            volume: parseInt(values['5. volume'] || 0)
        });
    }
});

// Convert Map to array, filter invalid candles, sort by timestamp
const chartData = Array.from(uniqueData.values())
    .filter(c => c && c.time > 0 && Number.isFinite(c.open) && Number.isFinite(c.high) &&
                 Number.isFinite(c.low) && Number.isFinite(c.close) &&
                 c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
    .sort((a, b) => a.time - b.time) // Sort by Unix timestamp
    .slice(-2000); // Take last 2000 candles for extended history

            // Cache the data
            chartDataCache.set(cacheKey, {
                data: chartData,
                timestamp: Date.now()
            });

            console.log(`[Chart] ✅ Successfully fetched ${chartData.length} stock candles for ${symbol}`);
            
            return res.json({
                success: true,
                data: chartData,
                symbol: symbol.toUpperCase(),
                interval
            });
        }
        
    } catch (error) {
        console.error('[Chart] ❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chart data',
            message: error.message
        });
    }
});

// @route   GET /api/chart/:symbol/quote
// @desc    Get real-time quote for symbol
// @access  Private
router.get('/:symbol/quote', auth, async (req, res) => {
    try {
        // Validate symbol to prevent SSRF/injection attacks
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: validationError.message
            });
        }

        const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeSymbolForUrl(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
        const response = await axios.get(apiUrl);
        
        const quote = response.data['Global Quote'];
        
        if (!quote || Object.keys(quote).length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }
        
        res.json({
            success: true,
            quote: {
                symbol: quote['01. symbol'],
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
                volume: parseInt(quote['06. volume']),
                previousClose: parseFloat(quote['08. previous close'])
            }
        });
        
    } catch (error) {
        console.error('[Chart Quote] Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch quote',
            message: error.message
        });
    }
});

module.exports = router;