// server/routes/chartRoutes.js - Real-time Chart Data with CRYPTO SUPPORT

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for chart data
const chartDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper: Check if symbol is crypto
const isCrypto = (symbol) => {
    const cryptoPatterns = ['-USD', '-USDT', 'BTC', 'ETH', 'DOGE', 'SOL', 'ADA', 'XRP', 'SHIB', 'AVAX', 'DOT', 'MATIC', 'LINK'];
    return cryptoPatterns.some(pattern => symbol.toUpperCase().includes(pattern));
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
        const { symbol, interval } = req.params;
        const cacheKey = `${symbol}-${interval}`;
        
        // Check cache
        const cached = chartDataCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[Chart] Cache HIT for ${symbol} ${interval}`);
            return res.json({
                success: true,
                data: cached.data,
                symbol: symbol.toUpperCase(),
                interval
            });
        }
        
        console.log(`[Chart] Fetching data for ${symbol} ${interval}`);
        
        // Check if crypto or stock
        if (isCrypto(symbol)) {
            // ====== CRYPTO PATH ======
            const { crypto, market } = parseCryptoSymbol(symbol);
            console.log(`[Chart] 🪙 Detected CRYPTO: ${crypto}/${market}`);
            
            let alphaVantageFunction;
            let dataKey;
            
            // Map interval to Alpha Vantage crypto function
            switch(interval) {
                case '1m':
                case '5m':
                case '15m':
                case '30m':
                case '1h':
                case '4h':
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
    .slice(-200); // Take last 200 candles


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
           // Map interval to Alpha Vantage function
switch(interval) {
    case '1m':
    case '5m':
    case '15m':
    case '30m':
    case '60m':
    case '1h':
        alphaVantageFunction = 'TIME_SERIES_INTRADAY';
        // Convert to Alpha Vantage format: 1m -> 1min, 5m -> 5min, etc.
        let avInterval;
        if (interval === '1h') {
            avInterval = '60min';
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
    } else {
        avInterval = interval.replace('m', 'min'); // 1m -> 1min, 5m -> 5min
    }
    apiUrl += `&interval=${avInterval}&outputsize=full`;
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
    .slice(-200); // Take last 200 candles
            
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
        const { symbol } = req.params;
        
        const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
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