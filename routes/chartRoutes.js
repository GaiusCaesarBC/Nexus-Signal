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
    'ALGO', 'VET', 'FIL', 'THETA', 'EOS', 'XLM', 'TRX', 'XMR', 'HBAR', 'ICP'
];

// Helper: Check if symbol is crypto
const isCrypto = (symbol) => {
    const upper = symbol.toUpperCase();
    // Check for -USD, -USDT suffixes
    if (upper.includes('-USD') || upper.includes('USDT')) return true;
    // Check if base symbol is a known crypto
    const base = upper.replace(/-USD.*$/, '').replace(/USDT$/, '');
    return KNOWN_CRYPTOS.includes(base);
};

// Helper: Parse crypto symbol (BTC-USD -> BTC + USD)
const parseCryptoSymbol = (symbol) => {
    if (symbol.includes('-')) {
        const [crypto, market] = symbol.split('-');
        return { crypto: crypto.toUpperCase(), market: market.toUpperCase() };
    }
    // Default to USD if no market specified
    return { crypto: symbol.toUpperCase(), market: 'USD' };
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
        
        // Check if crypto or stock
        if (isCrypto(symbol)) {
            // ====== CRYPTO PATH ======
            const { crypto, market } = parseCryptoSymbol(symbol);
            console.log(`[Chart] 🪙 Detected CRYPTO: ${crypto}/${market}`);

            // Use Binance API for intraday (free, no API key required)
            // Use Alpha Vantage for daily/weekly/monthly
            const isIntraday = ['LIVE', '1m', '5m', '15m', '30m', '1h', '4h'].includes(interval);

            if (isIntraday) {
                // ====== BINANCE INTRADAY CRYPTO ======
                // Map interval to Binance format
                let binanceInterval;
                switch(interval) {
                    case 'LIVE':
                    case '1m': binanceInterval = '1m'; break;
                    case '5m': binanceInterval = '5m'; break;
                    case '15m': binanceInterval = '15m'; break;
                    case '30m': binanceInterval = '30m'; break;
                    case '1h': binanceInterval = '1h'; break;
                    case '4h': binanceInterval = '4h'; break;
                    default: binanceInterval = '1m';
                }

                // Binance uses BTCUSDT format (no dash)
                const binanceSymbol = `${crypto}USDT`;
                const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=1000`;

                console.log(`[Chart] 🔗 Crypto intraday API call to Binance: ${binanceUrl}`);

                try {
                    const response = await axios.get(binanceUrl, {
                        headers: {
                            'User-Agent': 'NexusSignal/1.0',
                            'Accept': 'application/json'
                        },
                        timeout: 10000
                    });

                    if (!response.data || response.data.length === 0) {
                        console.log(`[Chart] ❌ No Binance data for ${binanceSymbol}`);
                        return res.status(404).json({
                            success: false,
                            error: 'No crypto data found for this symbol'
                        });
                    }

                    // Transform Binance kline data to chart format
                    // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
                    const chartData = response.data.map(kline => ({
                        time: Math.floor(kline[0] / 1000), // openTime in seconds
                        open: parseFloat(kline[1]),
                        high: parseFloat(kline[2]),
                        low: parseFloat(kline[3]),
                        close: parseFloat(kline[4]),
                        volume: parseFloat(kline[5])
                    }));

                    // Cache the data
                    chartDataCache.set(cacheKey, {
                        data: chartData,
                        timestamp: Date.now()
                    });

                    console.log(`[Chart] ✅ Successfully fetched ${chartData.length} crypto candles from Binance for ${crypto}/${binanceInterval}`);

                    return res.json({
                        success: true,
                        data: chartData,
                        symbol: `${crypto}-USD`,
                        interval
                    });

                } catch (binanceError) {
                    console.error(`[Chart] ❌ Binance error:`, binanceError.message);
                    console.error(`[Chart] ❌ Binance error details:`, binanceError.response?.data || 'No response data');

                    // Try alternative: use Binance US API as fallback
                    try {
                        console.log(`[Chart] 🔄 Trying Binance US API as fallback...`);
                        const binanceUsUrl = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=1000`;
                        const usResponse = await axios.get(binanceUsUrl, {
                            headers: {
                                'User-Agent': 'NexusSignal/1.0',
                                'Accept': 'application/json'
                            },
                            timeout: 10000
                        });

                        if (usResponse.data && usResponse.data.length > 0) {
                            const chartData = usResponse.data.map(kline => ({
                                time: Math.floor(kline[0] / 1000),
                                open: parseFloat(kline[1]),
                                high: parseFloat(kline[2]),
                                low: parseFloat(kline[3]),
                                close: parseFloat(kline[4]),
                                volume: parseFloat(kline[5])
                            }));

                            chartDataCache.set(cacheKey, {
                                data: chartData,
                                timestamp: Date.now()
                            });

                            console.log(`[Chart] ✅ Binance US fallback succeeded: ${chartData.length} candles`);
                            return res.json({
                                success: true,
                                data: chartData,
                                symbol: `${crypto}-USD`,
                                interval
                            });
                        }
                    } catch (usError) {
                        console.error(`[Chart] ❌ Binance US also failed:`, usError.message);
                    }

                    // Both failed, return error
                    return res.status(503).json({
                        success: false,
                        error: 'Crypto intraday data temporarily unavailable',
                        message: binanceError.message
                    });
                }
            }

            // ====== ALPHA VANTAGE DAILY/WEEKLY/MONTHLY CRYPTO ======
            let alphaVantageFunction;
            let dataKey;

            // Map interval to Alpha Vantage crypto function
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

            // Build API URL for CRYPTO
            const apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${crypto}&market=${market}&apikey=${ALPHA_VANTAGE_API_KEY}`;

            console.log(`[Chart] 🔗 Crypto API call to Alpha Vantage`);

            const response = await axios.get(apiUrl);

            // Check for API errors
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
                console.log('[Chart] Response keys:', Object.keys(response.data));
                return res.status(404).json({
                    success: false,
                    error: 'No crypto data found for this symbol'
                });
            }

            // Transform CRYPTO data to chart format
const entries = Object.entries(timeSeries);
const uniqueData = new Map(); // Use Map to ensure unique timestamps

entries.forEach(([time, values]) => {
    // Alpha Vantage crypto has different field names
    const openKey = `1a. open (${market})`;
    const highKey = `2a. high (${market})`;
    const lowKey = `3a. low (${market})`;
    const closeKey = `4a. close (${market})`;
    const volumeKey = '5. volume';

    // Convert to Unix timestamp (in seconds)
    const dateObj = new Date(time);
    const timestamp = Math.floor(dateObj.getTime() / 1000);

    // Only keep the first entry for each timestamp
    if (!uniqueData.has(timestamp)) {
        uniqueData.set(timestamp, {
            time: timestamp,
            open: parseFloat(values[openKey] || values['1. open'] || 0),
            high: parseFloat(values[highKey] || values['2. high'] || 0),
            low: parseFloat(values[lowKey] || values['3. low'] || 0),
            close: parseFloat(values[closeKey] || values['4. close'] || 0),
            volume: parseFloat(values[volumeKey] || 0)
        });
    }
});

// Convert Map to array and sort by timestamp
const chartData = Array.from(uniqueData.values())
    .sort((a, b) => a.time - b.time) // Sort by Unix timestamp
    .slice(-1000); // Take last 1000 candles for more history


            // Cache the data
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
            
            let alphaVantageFunction;
            let dataKey;
            
            // Map interval to Alpha Vantage function
switch(interval) {
    case 'LIVE':
    case '1m':
    case '5m':
    case '15m':
    case '30m':
    case '60m':
    case '1h':
        alphaVantageFunction = 'TIME_SERIES_INTRADAY';
        // Convert to Alpha Vantage format: LIVE/1m -> 1min, 5m -> 5min, etc.
        let avInterval;
        if (interval === '1h') {
            avInterval = '60min';
        } else if (interval === 'LIVE') {
            avInterval = '1min'; // LIVE uses 1-minute candles
        } else {
            avInterval = interval.replace('m', 'min'); // 1m -> 1min, 5m -> 5min
        }
        dataKey = `Time Series (${avInterval})`;
        break;
                case '4h':
                case '1D':
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
    
    // Only keep the first entry for each timestamp (in case of duplicates)
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

// Convert Map to array and sort by timestamp
const chartData = Array.from(uniqueData.values())
    .sort((a, b) => a.time - b.time) // Sort by Unix timestamp
    .slice(-1000); // Take last 1000 candles for more history

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