// server/services/chartService.js - Shared Chart Data Service
// Supports: Stocks (Alpha Vantage), Major Crypto (CoinGecko), DEX Tokens (Gecko Terminal)

const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for chart data
const chartDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Known crypto symbols (expanded list)
const KNOWN_CRYPTOS = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
    'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
    'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'FET', 'INJ', 'SUI', 'SEI', 'TIA',
    'ALGO', 'VET', 'FIL', 'THETA', 'EOS', 'XLM', 'TRX', 'XMR', 'HBAR', 'ICP',
    'TON', 'BCH', 'MKR', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'IMX', 'CRV',
    'TRUMP', 'MELANIA', 'FARTCOIN', 'AI16Z', 'VIRTUAL', 'AIXBT', 'TAO', 'WLD',
    'RNDR', 'OCEAN', 'GRT', 'AR', 'PENDLE', 'JUP', 'PYTH', 'ONDO', 'ENA'
];

// CoinGecko ID mapping
const COINGECKO_ID_MAP = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'DOGE': 'dogecoin',
    'ADA': 'cardano', 'XRP': 'ripple', 'DOT': 'polkadot', 'AVAX': 'avalanche-2',
    'SHIB': 'shiba-inu', 'MATIC': 'matic-network', 'LINK': 'chainlink',
    'UNI': 'uniswap', 'AAVE': 'aave', 'LTC': 'litecoin', 'ATOM': 'cosmos',
    'NEAR': 'near', 'APT': 'aptos', 'ARB': 'arbitrum', 'OP': 'optimism',
    'PEPE': 'pepe', 'FLOKI': 'floki', 'BONK': 'bonk', 'WIF': 'dogwifcoin',
    'SUI': 'sui', 'SEI': 'sei-network', 'TIA': 'celestia', 'INJ': 'injective-protocol',
    'FET': 'fetch-ai', 'RENDER': 'render-token', 'BNB': 'binancecoin',
    'TRUMP': 'official-trump', 'TAO': 'bittensor', 'WLD': 'worldcoin-wld'
};

// Helper: Detect if input is a contract address
const isContractAddress = (input) => {
    if (!input) return false;
    const trimmed = input.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) return { type: 'evm', address: trimmed.toLowerCase() };
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return { type: 'solana', address: trimmed };
    return false;
};

// Helper: Check if symbol is crypto (with network specifier support)
const isCrypto = (symbol) => {
    const upper = symbol.toUpperCase();
    // Check for network specifier (e.g., XRP:bsc, PEPE:eth, MEC:bsc)
    if (upper.includes(':')) return true;
    // Check for -USD, -USDT suffixes
    if (upper.includes('-USD') || upper.includes('USDT')) return true;
    // Check if base symbol is a known crypto
    const base = upper.replace(/-USD.*$/, '').replace(/USDT$/, '');
    return KNOWN_CRYPTOS.includes(base);
};

// Helper: Parse crypto symbol with network support
const parseCryptoSymbol = (symbol) => {
    // Check for network specifier (e.g., XRP:bsc, MEC:bsc)
    if (symbol.includes(':')) {
        const [crypto, network] = symbol.split(':');
        return {
            crypto: crypto.toUpperCase().replace(/USDT$/, ''),
            market: 'USD',
            network: network.toLowerCase()
        };
    }
    if (symbol.includes('-')) {
        const [crypto, market] = symbol.split('-');
        return { crypto: crypto.toUpperCase(), market: market.toUpperCase(), network: null };
    }
    // Strip USDT/USD suffix for Binance-style pairs (e.g., BTCUSDT -> BTC)
    const crypto = symbol.toUpperCase().replace(/USDT$/, '').replace(/USD$/, '');
    return { crypto, market: 'USD', network: null };
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

    prices.forEach(([timestamp, price]) => {
        const bucketTime = Math.floor(timestamp / candleMs) * candleMs;

        if (!candles.has(bucketTime)) {
            candles.set(bucketTime, {
                time: Math.floor(bucketTime / 1000),
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0
            });
        } else {
            const candle = candles.get(bucketTime);
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            candle.close = price;
        }
    });

    if (volumes && volumes.length > 0) {
        volumes.forEach(([timestamp, volume]) => {
            const bucketTime = Math.floor(timestamp / candleMs) * candleMs;
            if (candles.has(bucketTime)) {
                candles.get(bucketTime).volume += volume / (24 * 60 / candleMinutes);
            }
        });
    }

    return Array.from(candles.values())
        .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
        .sort((a, b) => a.time - b.time);
};

// Fetch from Binance
const fetchBinanceOHLC = async (symbol, interval) => {
    // Map interval to Binance format
    let binanceInterval;
    switch(interval) {
        case '1m': binanceInterval = '1m'; break;
        case '5m': binanceInterval = '5m'; break;
        case '15m': binanceInterval = '15m'; break;
        case '30m': binanceInterval = '30m'; break;
        case '1h': binanceInterval = '1h'; break;
        case '4h': binanceInterval = '4h'; break;
        case '1D': binanceInterval = '1d'; break;
        case '1W': binanceInterval = '1w'; break;
        default: binanceInterval = '1d';
    }

    const binanceSymbol = `${symbol}USDT`;
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=500`;
    console.log(`[Chart Service] 📊 Binance: ${url}`);

    const response = await axios.get(url, { timeout: 10000 });

    if (!response.data || response.data.length === 0) {
        throw new Error('No data from Binance');
    }

    const chartData = response.data.map(candle => ({
        time: Math.floor(candle[0] / 1000),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
    }))
    .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);

    console.log(`[Chart Service] 📊 Binance: ${chartData.length} candles for ${symbol}`);
    return chartData;
};

// Fetch from CoinGecko market_chart
const fetchCoinGeckoOHLC = async (symbol, interval) => {
    const cgId = getCoinGeckoId(symbol);

    let days, candleMinutes;
    switch(interval) {
        case '1m':
        case '5m':
        case '15m':
            days = 1;
            candleMinutes = 15;
            break;
        case '30m':
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
            candleMinutes = 1440;
            break;
        case '1W':
            days = 365;
            candleMinutes = 10080;
            break;
        default:
            days = 90;
            candleMinutes = 1440;
    }

    const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`;
    console.log(`[Chart Service] 🦎 CoinGecko: ${url}`);

    const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (!response.data || !response.data.prices || response.data.prices.length === 0) {
        throw new Error('No data from CoinGecko');
    }

    return synthesizeOHLC(response.data.prices, response.data.total_volumes, candleMinutes);
};

// Fetch from Gecko Terminal (for DEX tokens)
const fetchGeckoTerminalOHLC = async (symbol, interval, network = null) => {
    let searchUrl;
    if (network) {
        searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}&network=${network}`;
    } else {
        searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${symbol}`;
    }
    console.log(`[Chart Service] 🦎 Gecko Terminal search: ${searchUrl}`);

    const searchResponse = await axios.get(searchUrl, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
        throw new Error(`No pool found for ${symbol}${network ? ` on ${network}` : ''}`);
    }

    const pool = searchResponse.data.data[0];
    const poolAddress = pool.attributes?.address;
    const poolNetwork = pool.id?.split('_')[0] || network || 'eth';

    if (!poolAddress) {
        throw new Error(`Invalid pool data for ${symbol}`);
    }

    console.log(`[Chart Service] 🦎 Found pool: ${poolAddress} on ${poolNetwork}`);

    let timeframe;
    switch(interval) {
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
            timeframe = 'day';
    }

    // Fetch OHLCV data
    const ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/${poolNetwork}/pools/${poolAddress}/ohlcv/${timeframe}?limit=1000`;
    console.log(`[Chart Service] 🦎 Gecko Terminal OHLCV: ${ohlcvUrl}`);

    const ohlcvResponse = await axios.get(ohlcvUrl, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
    });

    if (!ohlcvResponse.data?.data?.attributes?.ohlcv_list) {
        throw new Error('No OHLCV data from Gecko Terminal');
    }

    const ohlcvList = ohlcvResponse.data.data.attributes.ohlcv_list;
    const chartData = ohlcvList
        .map(candle => ({
            time: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]) || 0
        }))
        .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
        .sort((a, b) => a.time - b.time);

    console.log(`[Chart Service] 🦎 Gecko Terminal: ${chartData.length} candles for ${symbol}`);
    return chartData;
};

// Fetch token by contract address from Gecko Terminal
const fetchTokenByContract = async (contractInfo, interval) => {
    const { type, address } = contractInfo;
    const evmNetworks = ['eth', 'bsc', 'base', 'arbitrum', 'polygon_pos', 'avalanche', 'optimism'];
    const networksToSearch = type === 'solana' ? ['solana'] : evmNetworks;

    console.log(`[Chart Service] 🔍 Looking up contract ${address}`);

    for (const network of networksToSearch) {
        try {
            const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools?page=1`;
            const poolsResponse = await axios.get(poolsUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
            });

            if (poolsResponse.data?.data && poolsResponse.data.data.length > 0) {
                const pool = poolsResponse.data.data[0];
                const poolAddress = pool.attributes?.address;

                let timeframe = 'day';
                if (['1m', '5m', '15m'].includes(interval)) timeframe = 'minute';
                else if (['30m', '1h', '4h'].includes(interval)) timeframe = 'hour';

                const ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?limit=1000`;
                const ohlcvResponse = await axios.get(ohlcvUrl, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 10000
                });

                if (ohlcvResponse.data?.data?.attributes?.ohlcv_list) {
                    const ohlcvList = ohlcvResponse.data.data.attributes.ohlcv_list;
                    return ohlcvList
                        .map(candle => ({
                            time: candle[0],
                            open: parseFloat(candle[1]),
                            high: parseFloat(candle[2]),
                            low: parseFloat(candle[3]),
                            close: parseFloat(candle[4]),
                            volume: parseFloat(candle[5]) || 0
                        }))
                        .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
                        .sort((a, b) => a.time - b.time);
                }
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.log(`[Chart Service] ⚠️ Error on ${network}: ${error.message}`);
            }
        }
    }

    throw new Error(`Token not found for contract ${address}`);
};

/**
 * Fetch chart data for stocks or crypto
 * Supports: Major crypto (CoinGecko), DEX tokens (Gecko Terminal), Stocks (Alpha Vantage)
 */
const getChartData = async (symbol, interval = '1D') => {
    try {
        const cacheKey = `${symbol}-${interval}`;

        // Check cache first
        const cached = chartDataCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[Chart Service] Cache HIT for ${symbol} ${interval}`);
            return {
                success: true,
                data: cached.data,
                symbol: symbol.toUpperCase(),
                interval
            };
        }

        console.log(`[Chart Service] Fetching data for ${symbol} ${interval}`);

        // ====== CONTRACT ADDRESS PATH ======
        const contractInfo = isContractAddress(symbol);
        if (contractInfo) {
            console.log(`[Chart Service] 📝 Contract address: ${contractInfo.address}`);
            const chartData = await fetchTokenByContract(contractInfo, interval);

            chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

            return {
                success: true,
                data: chartData,
                symbol: symbol,
                interval,
                source: 'geckoterminal-contract'
            };
        }

        // ====== CRYPTO PATH ======
        if (isCrypto(symbol)) {
            const { crypto, market, network } = parseCryptoSymbol(symbol);
            console.log(`[Chart Service] 🪙 CRYPTO: ${crypto}${network ? ` on ${network}` : ''}`);

            // If network is specified (e.g., MEC:bsc), use Gecko Terminal
            if (network) {
                try {
                    const chartData = await fetchGeckoTerminalOHLC(crypto, interval, network);
                    chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

                    return {
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval,
                        source: 'geckoterminal'
                    };
                } catch (gtError) {
                    console.log(`[Chart Service] ⚠️ Gecko Terminal failed for ${network}: ${gtError.message}`);
                    throw gtError;
                }
            }

            // Try Binance first for major cryptos (best data quality)
            try {
                const chartData = await fetchBinanceOHLC(crypto, interval);
                chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

                return {
                    success: true,
                    data: chartData,
                    symbol: `${crypto}-USD`,
                    interval,
                    source: 'binance'
                };
            } catch (binanceError) {
                console.log(`[Chart Service] ⚠️ Binance failed: ${binanceError.message}`);
            }

            // Try CoinGecko as fallback
            try {
                const chartData = await fetchCoinGeckoOHLC(crypto, interval);
                chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

                return {
                    success: true,
                    data: chartData,
                    symbol: `${crypto}-USD`,
                    interval,
                    source: 'coingecko'
                };
            } catch (cgError) {
                console.log(`[Chart Service] ⚠️ CoinGecko failed: ${cgError.message}`);
            }

            // Try Gecko Terminal for DEX tokens
            try {
                const chartData = await fetchGeckoTerminalOHLC(crypto, interval);
                chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

                return {
                    success: true,
                    data: chartData,
                    symbol: `${crypto}-USD`,
                    interval,
                    source: 'geckoterminal'
                };
            } catch (gtError) {
                console.log(`[Chart Service] ⚠️ Gecko Terminal failed: ${gtError.message}`);
            }

            // Fall back to Alpha Vantage for crypto
            console.log(`[Chart Service] 🔄 Falling back to Alpha Vantage for ${crypto}...`);

            const alphaVantageFunction = 'DIGITAL_CURRENCY_DAILY';
            const dataKey = 'Time Series (Digital Currency Daily)';
            const apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${crypto}&market=${market}&apikey=${ALPHA_VANTAGE_API_KEY}`;

            const response = await axios.get(apiUrl);

            if (response.data['Error Message']) {
                throw new Error(`Crypto symbol not found: ${crypto}`);
            }

            if (response.data['Note']) {
                throw new Error('API rate limit reached');
            }

            const timeSeries = response.data[dataKey];
            if (!timeSeries) {
                throw new Error('No crypto data found');
            }

            const entries = Object.entries(timeSeries);
            const uniqueData = new Map();

            entries.forEach(([time, values]) => {
                const openKey = `1a. open (${market})`;
                const highKey = `2a. high (${market})`;
                const lowKey = `3a. low (${market})`;
                const closeKey = `4a. close (${market})`;

                const dateObj = new Date(time);
                const timestamp = Math.floor(dateObj.getTime() / 1000);

                if (!uniqueData.has(timestamp)) {
                    uniqueData.set(timestamp, {
                        time: timestamp,
                        open: parseFloat(values[openKey] || values['1. open'] || 0),
                        high: parseFloat(values[highKey] || values['2. high'] || 0),
                        low: parseFloat(values[lowKey] || values['3. low'] || 0),
                        close: parseFloat(values[closeKey] || values['4. close'] || 0),
                        volume: parseFloat(values['5. volume'] || 0)
                    });
                }
            });

            const chartData = Array.from(uniqueData.values())
                .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
                .sort((a, b) => a.time - b.time)
                .slice(-200);

            chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

            return {
                success: true,
                data: chartData,
                symbol: `${crypto}-${market}`,
                interval,
                source: 'alphavantage'
            };

        } else {
            // ====== STOCK PATH ======
            console.log(`[Chart Service] 📈 STOCK: ${symbol}`);

            const alphaVantageFunction = interval === '1W' ? 'TIME_SERIES_WEEKLY' :
                                          interval === '1M' ? 'TIME_SERIES_MONTHLY' : 'TIME_SERIES_DAILY';
            const dataKey = interval === '1W' ? 'Weekly Time Series' :
                           interval === '1M' ? 'Monthly Time Series' : 'Time Series (Daily)';

            const apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

            const response = await axios.get(apiUrl);

            if (response.data['Error Message']) {
                throw new Error(`Stock symbol not found: ${symbol}`);
            }

            if (response.data['Note']) {
                throw new Error('API rate limit reached');
            }

            const timeSeries = response.data[dataKey];
            if (!timeSeries) {
                throw new Error('No stock data found');
            }

            const entries = Object.entries(timeSeries);
            const uniqueData = new Map();

            entries.forEach(([time, values]) => {
                const dateObj = new Date(time);
                const timestamp = Math.floor(dateObj.getTime() / 1000);

                if (!uniqueData.has(timestamp)) {
                    uniqueData.set(timestamp, {
                        time: timestamp,
                        open: parseFloat(values['1. open']),
                        high: parseFloat(values['2. high']),
                        low: parseFloat(values['3. low']),
                        close: parseFloat(values['4. close']),
                        volume: parseInt(values['5. volume'] || 0)
                    });
                }
            });

            const chartData = Array.from(uniqueData.values())
                .filter(c => c.time && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
                .sort((a, b) => a.time - b.time)
                .slice(-200);

            chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

            return {
                success: true,
                data: chartData,
                symbol: symbol.toUpperCase(),
                interval,
                source: 'alphavantage'
            };
        }

    } catch (error) {
        console.error('[Chart Service] ❌ Error:', error.message);
        throw error;
    }
};

module.exports = {
    getChartData,
    isCrypto,
    parseCryptoSymbol,
    isContractAddress
};
