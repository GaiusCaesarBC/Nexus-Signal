// server/services/chartService.js - Shared Chart Data Service

const axios = require('axios');

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
    return { crypto: symbol.toUpperCase(), market: 'USD' };
};

/**
 * Fetch chart data for stocks or crypto
 * Used by BOTH chart routes and pattern routes - NO HTTP CALLS NEEDED!
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
        
        // Check if crypto or stock
        if (isCrypto(symbol)) {
            // ====== CRYPTO PATH ======
            const { crypto, market } = parseCryptoSymbol(symbol);
            console.log(`[Chart Service] 🪙 CRYPTO: ${crypto}/${market}`);
            
            let alphaVantageFunction;
            let dataKey;
            
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
            
            const apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${crypto}&market=${market}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            
            const response = await axios.get(apiUrl);
            
            // Check for errors
            if (response.data['Error Message']) {
                throw new Error(`Crypto symbol not found: ${crypto}`);
            }
            
            if (response.data['Note']) {
                throw new Error('API rate limit reached. Please try again in a minute.');
            }
            
            const timeSeries = response.data[dataKey];
            
            if (!timeSeries) {
                throw new Error('No crypto data found for this symbol');
            }
            
            // Transform crypto data
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

            const chartData = Array.from(uniqueData.values())
                .sort((a, b) => a.time - b.time)
                .slice(-200);

            // Cache the data
            chartDataCache.set(cacheKey, {
                data: chartData,
                timestamp: Date.now()
            });
            
            console.log(`[Chart Service] ✅ Fetched ${chartData.length} crypto candles`);
            
            return {
                success: true,
                data: chartData,
                symbol: `${crypto}-${market}`,
                interval
            };
            
        } else {
            // ====== STOCK PATH ======
            console.log(`[Chart Service] 📈 STOCK: ${symbol}`);
            
            let alphaVantageFunction;
            let dataKey;
            
            switch(interval) {
                case '1m':
                case '5m':
                case '15m':
                case '30m':
                case '60m':
                case '1h':
                    alphaVantageFunction = 'TIME_SERIES_INTRADAY';
                    let avInterval;
                    if (interval === '1h') {
                        avInterval = '60min';
                    } else {
                        avInterval = interval.replace('m', 'min');
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
            
            let apiUrl = `https://www.alphavantage.co/query?function=${alphaVantageFunction}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            
            if (alphaVantageFunction === 'TIME_SERIES_INTRADAY') {
                let avInterval;
                if (interval === '1h') {
                    avInterval = '60min';
                } else {
                    avInterval = interval.replace('m', 'min');
                }
                apiUrl += `&interval=${avInterval}&outputsize=full`;
            }
            
            const response = await axios.get(apiUrl);
            
            // Check for errors
            if (response.data['Error Message']) {
                throw new Error(`Stock symbol not found: ${symbol}`);
            }
            
            if (response.data['Note']) {
                throw new Error('API rate limit reached. Please try again in a minute.');
            }
            
            const timeSeries = response.data[dataKey];
            
            if (!timeSeries) {
                throw new Error('No stock data found for this symbol');
            }
            
            // Transform stock data
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
                .sort((a, b) => a.time - b.time)
                .slice(-200);
            
            // Cache the data
            chartDataCache.set(cacheKey, {
                data: chartData,
                timestamp: Date.now()
            });
            
            console.log(`[Chart Service] ✅ Fetched ${chartData.length} stock candles`);
            
            return {
                success: true,
                data: chartData,
                symbol: symbol.toUpperCase(),
                interval
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
    parseCryptoSymbol
};