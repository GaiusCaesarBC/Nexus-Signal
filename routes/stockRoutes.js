// server/routes/stockRoutes.js - IMPROVED WITH YAHOO FINANCE FALLBACKS

const express = require('express');
const router = express.Router();
const axios = require('axios');

const {
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
} = require('../utils/indicators');

const { getSentimentSignal } = require('../services/sentimentService');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const stockCache = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const QUOTE_CACHE_DURATION = 60 * 1000; // 1 minute for quotes

// Map frontend ranges to Alpha Vantage time series functions
function getAlphaVantageFunction(range) {
    switch (range) {
        case '1D':
        case '5D':
            return 'TIME_SERIES_INTRADAY';
        case '1M':
        case '3M':
        case '6M':
        case '1Y':
            return 'TIME_SERIES_DAILY';
        case '5Y':
        case 'MAX':
            return 'TIME_SERIES_WEEKLY';
        default:
            return 'TIME_SERIES_DAILY';
    }
}

function getAlphaVantageInterval(range) {
    switch (range) {
        case '1D':
            return '5min';
        case '5D':
            return '60min';
        default:
            return null; // Daily/Weekly don't need interval
    }
}

function getOutputSize(range) {
    // For intraday, we need 'full' to get enough data
    if (range === '1D' || range === '5D') return 'full';
    // For daily/weekly, 'compact' gives 100 data points, 'full' gives all
    return 'full';
}

async function fetchAlphaVantageData(symbol, range) {
    const func = getAlphaVantageFunction(range);
    const interval = getAlphaVantageInterval(range);
    const outputsize = getOutputSize(range);

    let url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=${outputsize}`;
    
    if (interval) {
        url += `&interval=${interval}`;
    }

    console.log(`Fetching from Alpha Vantage: ${symbol}, Function: ${func}`);

    const response = await axios.get(url);
    const data = response.data;

    // Check for API errors
    if (data['Error Message']) {
        throw new Error(`Invalid symbol: ${symbol}`);
    }
    if (data['Note']) {
        throw new Error('API rate limit reached. Please try again in a minute.');
    }

    // Parse data based on function type
    let timeSeriesKey;
    if (func === 'TIME_SERIES_INTRADAY') {
        timeSeriesKey = `Time Series (${interval})`;
    } else if (func === 'TIME_SERIES_DAILY') {
        timeSeriesKey = 'Time Series (Daily)';
    } else if (func === 'TIME_SERIES_WEEKLY') {
        timeSeriesKey = 'Weekly Time Series';
    }

    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
        throw new Error('No data returned from Alpha Vantage');
    }

    // Convert to our format
    const historicalData = Object.entries(timeSeries).map(([dateStr, values]) => ({
        date: dateStr, // ✅ Keep original date string for frontend
        time: new Date(dateStr).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume'] || 0),
    })).sort((a, b) => a.time - b.time); // Sort ascending by time

    // Filter by range
    const now = Date.now();
    let cutoffTime;
    switch (range) {
        case '1D':
            cutoffTime = now - 24 * 60 * 60 * 1000;
            break;
        case '5D':
            cutoffTime = now - 5 * 24 * 60 * 60 * 1000;
            break;
        case '1M':
            cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
        case '3M':
            cutoffTime = now - 90 * 24 * 60 * 60 * 1000;
            break;
        case '6M':
            cutoffTime = now - 180 * 24 * 60 * 60 * 1000;
            break;
        case '1Y':
            cutoffTime = now - 365 * 24 * 60 * 60 * 1000;
            break;
        case '5Y':
            cutoffTime = now - 5 * 365 * 24 * 60 * 60 * 1000;
            break;
        default:
            cutoffTime = 0; // MAX - include all
    }

    return historicalData.filter(d => d.time >= cutoffTime);
}

// ============================================
// ✅ GET STOCK DETAILS (main endpoint)
// Route: /api/stocks/:symbol
// ============================================
router.get('/:symbol', async (req, res, next) => {
    try {
        const { symbol } = req.params;
        
        // Skip if this is a sub-route (quote, historical, prediction)
        if (['quote', 'historical', 'prediction', 'search'].includes(symbol.toLowerCase())) {
            return next();
        }
        
        const upperSymbol = symbol.toUpperCase();

        // Check cache
        const cacheKey = `stock-${upperSymbol}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < QUOTE_CACHE_DURATION)) {
            console.log(`[CACHE HIT] Stock details for ${upperSymbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Fetching stock details for ${upperSymbol}`);

        // Try Yahoo Finance first (faster, more reliable for basic quotes)
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=5d`;
            const yahooResponse = await axios.get(yahooUrl, { timeout: 10000 });
            const result = yahooResponse.data?.chart?.result?.[0];
            
            if (result?.meta) {
                const meta = result.meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose;
                const change = price - prevClose;
                const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                const stockData = {
                    symbol: upperSymbol,
                    name: meta.shortName || meta.longName || upperSymbol,
                    price: price,
                    change: change,
                    changePercent: changePercent,
                    previousClose: prevClose,
                    open: meta.regularMarketOpen || meta.open,
                    dayHigh: meta.regularMarketDayHigh || meta.dayHigh,
                    dayLow: meta.regularMarketDayLow || meta.dayLow,
                    volume: meta.regularMarketVolume,
                    marketCap: meta.marketCap || null,
                    exchange: meta.exchangeName || meta.exchange || 'UNKNOWN',
                    currency: meta.currency || 'USD',
                    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
                    marketState: meta.marketState || 'CLOSED',
                    lastUpdated: new Date().toISOString()
                };

                stockCache[cacheKey] = { timestamp: Date.now(), data: stockData };
                return res.json(stockData);
            }
        } catch (yahooError) {
            console.log(`Yahoo Finance failed for ${upperSymbol}, trying Alpha Vantage...`);
        }

        // Fallback to Alpha Vantage
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${upperSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const quoteResponse = await axios.get(quoteUrl, { timeout: 10000 });
        const quoteData = quoteResponse.data['Global Quote'];

        if (!quoteData || Object.keys(quoteData).length === 0) {
            return res.status(404).json({ 
                error: `Stock not found: ${upperSymbol}`,
                message: 'Could not find data for this symbol. It may be delisted or invalid.'
            });
        }

        // Get company overview for additional info
        let overview = {};
        try {
            const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${upperSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const overviewResponse = await axios.get(overviewUrl, { timeout: 10000 });
            overview = overviewResponse.data || {};
        } catch (e) {
            console.log(`Could not fetch overview for ${upperSymbol}`);
        }

        const price = parseFloat(quoteData['05. price']) || 0;
        const previousClose = parseFloat(quoteData['08. previous close']) || 0;
        const change = parseFloat(quoteData['09. change']) || 0;
        const changePercent = parseFloat(quoteData['10. change percent']?.replace('%', '')) || 0;

        const stockData = {
            symbol: upperSymbol,
            name: overview['Name'] || upperSymbol,
            price: price,
            change: change,
            changePercent: changePercent,
            previousClose: previousClose,
            open: parseFloat(quoteData['02. open']) || 0,
            dayHigh: parseFloat(quoteData['03. high']) || 0,
            dayLow: parseFloat(quoteData['04. low']) || 0,
            volume: parseInt(quoteData['06. volume']) || 0,
            marketCap: parseFloat(overview['MarketCapitalization']) || null,
            exchange: overview['Exchange'] || 'UNKNOWN',
            sector: overview['Sector'] || null,
            industry: overview['Industry'] || null,
            pe: parseFloat(overview['PERatio']) || null,
            eps: parseFloat(overview['EPS']) || null,
            beta: parseFloat(overview['Beta']) || null,
            fiftyTwoWeekHigh: parseFloat(overview['52WeekHigh']) || null,
            fiftyTwoWeekLow: parseFloat(overview['52WeekLow']) || null,
            dividend: parseFloat(overview['DividendPerShare']) || null,
            dividendYield: parseFloat(overview['DividendYield']) || null,
            description: overview['Description'] || null,
            lastUpdated: quoteData['07. latest trading day'] || new Date().toISOString()
        };

        stockCache[cacheKey] = { timestamp: Date.now(), data: stockData };
        res.json(stockData);

    } catch (error) {
        console.error(`Error fetching stock ${req.params.symbol}:`, error.message);
        
        if (error.message?.includes('rate limit')) {
            return res.status(429).json({ 
                error: 'API rate limit reached',
                message: 'Please try again in a minute.',
                retryAfter: 60
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch stock data',
            message: error.message 
        });
    }
});

// ============================================
// ✅ IMPROVED: GET STOCK QUOTE (for Key Statistics)
// Route: /api/stocks/quote/:symbol
// ============================================
router.get('/quote/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();

        // Check cache
        const cacheKey = `quote-${upperSymbol}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < QUOTE_CACHE_DURATION)) {
            console.log(`[CACHE HIT] Quote for ${upperSymbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Fetching quote for ${upperSymbol}`);

        // ============================================
        // TRY YAHOO FINANCE FIRST (More reliable, has most data)
        // ============================================
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${upperSymbol}?modules=price,summaryDetail,defaultKeyStatistics,financialData`;
            const yahooResponse = await axios.get(yahooUrl, { timeout: 10000 });
            const result = yahooResponse.data?.quoteSummary?.result?.[0];
            
            if (result) {
                const price = result.price || {};
                const summary = result.summaryDetail || {};
                const keyStats = result.defaultKeyStatistics || {};
                const financial = result.financialData || {};

                const currentPrice = price.regularMarketPrice?.raw || price.regularMarketPrice || 0;
                const prevClose = price.regularMarketPreviousClose?.raw || price.regularMarketPreviousClose || 0;
                const change = currentPrice - prevClose;
                const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                const quoteResult = {
                    symbol: upperSymbol,
                    price: currentPrice,
                    open: price.regularMarketOpen?.raw || price.regularMarketOpen || 0,
                    dayHigh: price.regularMarketDayHigh?.raw || price.regularMarketDayHigh || 0,
                    dayLow: price.regularMarketDayLow?.raw || price.regularMarketDayLow || 0,
                    previousClose: prevClose,
                    change: change,
                    changePercent: changePercent,
                    volume: price.regularMarketVolume?.raw || price.regularMarketVolume || 0,
                    
                    // Market Stats
                    marketCap: price.marketCap?.raw || summary.marketCap?.raw || null,
                    pe: summary.trailingPE?.raw || summary.forwardPE?.raw || null,
                    eps: keyStats.trailingEps?.raw || financial.currentPrice?.raw / (summary.trailingPE?.raw || 1) || null,
                    
                    // 52-week range
                    high52: summary.fiftyTwoWeekHigh?.raw || null,
                    low52: summary.fiftyTwoWeekLow?.raw || null,
                    
                    // Volume
                    avgVolume: price.averageDailyVolume10Day?.raw || summary.averageDailyVolume10Day?.raw || null,
                    
                    // Dividend
                    dividend: summary.dividendRate?.raw || summary.trailingAnnualDividendRate?.raw || null,
                    dividendYield: summary.dividendYield?.raw ? summary.dividendYield.raw * 100 : (summary.trailingAnnualDividendYield?.raw ? summary.trailingAnnualDividendYield.raw * 100 : null),
                    
                    // Other
                    beta: keyStats.beta?.raw || null,
                    exchange: price.exchangeName || price.exchange || 'NASDAQ',
                    name: price.shortName || price.longName || upperSymbol,
                    sector: summary.sector || null,
                    industry: summary.industry || null,
                    
                    // Additional useful fields
                    fiftyDayAverage: summary.fiftyDayAverage?.raw || null,
                    twoHundredDayAverage: summary.twoHundredDayAverage?.raw || null,
                    
                    lastUpdated: new Date().toISOString(),
                    source: 'Yahoo Finance'
                };

                console.log(`[Yahoo Finance] Successfully fetched ${upperSymbol} quote`);
                stockCache[cacheKey] = { timestamp: Date.now(), data: quoteResult };
                return res.json(quoteResult);
            }
        } catch (yahooError) {
            console.log(`Yahoo Finance failed for ${upperSymbol}, trying Alpha Vantage...`);
        }

        // ============================================
        // FALLBACK TO ALPHA VANTAGE
        // ============================================
        
        // Fetch GLOBAL_QUOTE from Alpha Vantage
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${upperSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const quoteResponse = await axios.get(quoteUrl, { timeout: 10000 });
        const quoteData = quoteResponse.data['Global Quote'];

        if (!quoteData || Object.keys(quoteData).length === 0) {
            // Last resort: try to get from daily historical data
            console.log(`No quote data, trying historical data for ${upperSymbol}`);
            try {
                const historicalData = await fetchAlphaVantageData(upperSymbol, '1Y');
                
                if (historicalData.length === 0) {
                    return res.status(404).json({ error: `No data found for ${upperSymbol}` });
                }

                const latest = historicalData[historicalData.length - 1];
                const previous = historicalData.length > 1 ? historicalData[historicalData.length - 2] : latest;
                
                // Calculate 52-week high/low from available data
                const yearData = historicalData.slice(-252); // ~1 year of trading days
                const high52 = Math.max(...yearData.map(d => d.high));
                const low52 = Math.min(...yearData.map(d => d.low));
                
                // Calculate average volume
                const avgVol = yearData.reduce((sum, d) => sum + (d.volume || 0), 0) / yearData.length;

                const fallbackQuote = {
                    symbol: upperSymbol,
                    price: latest.close,
                    open: latest.open,
                    dayHigh: latest.high,
                    dayLow: latest.low,
                    previousClose: previous.close,
                    change: latest.close - previous.close,
                    changePercent: ((latest.close - previous.close) / previous.close) * 100,
                    volume: latest.volume || 0,
                    avgVolume: avgVol,
                    high52,
                    low52,
                    marketCap: null,
                    pe: null,
                    eps: null,
                    dividend: null,
                    dividendYield: null,
                    beta: null,
                    exchange: 'NASDAQ',
                    name: upperSymbol,
                    sector: null,
                    industry: null,
                    lastUpdated: latest.date,
                    source: 'Alpha Vantage Historical'
                };

                stockCache[cacheKey] = { timestamp: Date.now(), data: fallbackQuote };
                return res.json(fallbackQuote);
            } catch (histError) {
                return res.status(404).json({ error: `No data found for ${upperSymbol}` });
            }
        }

        // Parse Alpha Vantage quote response
        const price = parseFloat(quoteData['05. price']) || 0;
        const previousClose = parseFloat(quoteData['08. previous close']) || 0;
        const change = parseFloat(quoteData['09. change']) || 0;
        const changePercent = parseFloat(quoteData['10. change percent']?.replace('%', '')) || 0;

        // Try to fetch OVERVIEW for additional stats
        let overview = {};
        try {
            const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${upperSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const overviewResponse = await axios.get(overviewUrl, { timeout: 10000 });
            overview = overviewResponse.data || {};
            
            // Check if overview actually has data
            if (!overview['Symbol']) {
                console.warn(`OVERVIEW returned no data for ${upperSymbol}, will use historical for 52-week range`);
                overview = {};
            }
        } catch (overviewError) {
            console.warn(`Could not fetch overview for ${upperSymbol}:`, overviewError.message);
        }

        // If OVERVIEW didn't return 52-week data, calculate from historical
        let high52 = parseFloat(overview['52WeekHigh']) || null;
        let low52 = parseFloat(overview['52WeekLow']) || null;
        let avgVolume = parseInt(overview['AverageVolume']) || null;

        if (!high52 || !low52 || !avgVolume) {
            try {
                console.log(`Fetching historical data to calculate 52-week stats for ${upperSymbol}`);
                const historicalData = await fetchAlphaVantageData(upperSymbol, '1Y');
                
                if (historicalData.length > 0) {
                    const yearData = historicalData.slice(-252); // ~1 year of trading days
                    if (!high52) high52 = Math.max(...yearData.map(d => d.high));
                    if (!low52) low52 = Math.min(...yearData.map(d => d.low));
                    if (!avgVolume) {
                        avgVolume = Math.round(yearData.reduce((sum, d) => sum + (d.volume || 0), 0) / yearData.length);
                    }
                    console.log(`Calculated from historical: 52W High=$${high52?.toFixed(2)}, Low=$${low52?.toFixed(2)}, AvgVol=${avgVolume}`);
                }
            } catch (histError) {
                console.warn(`Could not fetch historical data for 52-week calculation: ${histError.message}`);
            }
        }

        const quoteResult = {
            symbol: upperSymbol,
            price,
            open: parseFloat(quoteData['02. open']) || 0,
            dayHigh: parseFloat(quoteData['03. high']) || 0,
            dayLow: parseFloat(quoteData['04. low']) || 0,
            previousClose,
            change,
            changePercent,
            volume: parseInt(quoteData['06. volume']) || 0,
            latestTradingDay: quoteData['07. latest trading day'],
            
            // From OVERVIEW endpoint or calculated
            marketCap: parseFloat(overview['MarketCapitalization']) || null,
            pe: parseFloat(overview['PERatio']) || null,
            eps: parseFloat(overview['EPS']) || null,
            high52: high52,
            low52: low52,
            avgVolume: avgVolume,
            dividend: parseFloat(overview['DividendPerShare']) || null,
            dividendYield: parseFloat(overview['DividendYield']) ? parseFloat(overview['DividendYield']) * 100 : null,
            beta: parseFloat(overview['Beta']) || null,
            exchange: overview['Exchange'] || 'NASDAQ',
            name: overview['Name'] || upperSymbol,
            sector: overview['Sector'] || null,
            industry: overview['Industry'] || null,
            
            lastUpdated: new Date().toISOString(),
            source: 'Alpha Vantage'
        };

        console.log(`[Alpha Vantage] Quote for ${upperSymbol}:`, {
            price: quoteResult.price,
            marketCap: quoteResult.marketCap,
            pe: quoteResult.pe,
            high52: quoteResult.high52,
            low52: quoteResult.low52
        });

        // Cache the result
        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: quoteResult
        };

        res.json(quoteResult);

    } catch (error) {
        console.error('Error fetching stock quote:', error.message);
        
        // Check for rate limit
        if (error.message?.includes('rate limit')) {
            return res.status(429).json({ 
                error: 'API rate limit reached. Please try again in a minute.',
                retryAfter: 60
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch stock quote', 
            message: error.message 
        });
    }
});

// ============================================
// GET HISTORICAL DATA
// Route: /api/stocks/:symbol/historical OR /api/stocks/historical/:symbol
// ============================================
router.get('/:symbol/historical', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `hist-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Historical data for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Fetching historical data for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No historical data found for ${symbol}` 
            });
        }

        const responseData = {
            symbol,
            historicalData,
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error fetching historical stock data:', error.message);
        res.status(500).json({ 
            msg: 'Failed to fetch historical data', 
            error: error.message 
        });
    }
});

// Also support the old route pattern for backwards compatibility
router.get('/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `hist-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Historical data for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Fetching historical data for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No historical data found for ${symbol}` 
            });
        }

        const responseData = {
            symbol,
            historicalData,
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error fetching historical stock data:', error.message);
        res.status(500).json({ 
            msg: 'Failed to fetch historical data', 
            error: error.message 
        });
    }
});

// ============================================
// GET PREDICTION
// Route: /api/stocks/:symbol/prediction OR /api/stocks/prediction/:symbol
// ============================================
router.get('/:symbol/prediction', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `pred-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Prediction for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Getting prediction for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No data available for ${symbol}` 
            });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        
        console.log(`[Sentiment] Analyzing news for ${symbol}...`);
        const sentimentData = await getSentimentSignal(symbol);
        console.log(`[Sentiment] Result: ${sentimentData.label} (${sentimentData.signal.toFixed(2)})`);
        
        const prediction = calculateStockPrediction(historicalData, lastClosePrice, sentimentData);

        const responseData = {
            symbol,
            currentPrice: lastClosePrice,
            historicalData,
            ...prediction,
            sentiment: {
                score: sentimentData.signal,
                label: sentimentData.label,
                confidence: sentimentData.confidence,
                summary: sentimentData.summary
            }
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error generating prediction:', error.message);
        res.status(500).json({ 
            msg: 'Failed to generate prediction', 
            error: error.message 
        });
    }
});

// Also support the old route pattern for backwards compatibility
router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range = '6M' } = req.query;

        const cacheKey = `pred-${symbol}-${range}`;
        if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[CACHE HIT] Prediction for ${symbol}`);
            return res.json(stockCache[cacheKey].data);
        }

        console.log(`Getting prediction for ${symbol} - Range: ${range}`);

        const historicalData = await fetchAlphaVantageData(symbol, range);

        if (historicalData.length === 0) {
            return res.status(404).json({ 
                msg: `No data available for ${symbol}` 
            });
        }

        const lastClosePrice = historicalData[historicalData.length - 1].close;
        
        console.log(`[Sentiment] Analyzing news for ${symbol}...`);
        const sentimentData = await getSentimentSignal(symbol);
        console.log(`[Sentiment] Result: ${sentimentData.label} (${sentimentData.signal.toFixed(2)})`);
        
        const prediction = calculateStockPrediction(historicalData, lastClosePrice, sentimentData);

        const responseData = {
            symbol,
            currentPrice: lastClosePrice,
            historicalData,
            ...prediction,
            sentiment: {
                score: sentimentData.signal,
                label: sentimentData.label,
                confidence: sentimentData.confidence,
                summary: sentimentData.summary
            }
        };

        stockCache[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error generating prediction:', error.message);
        res.status(500).json({ 
            msg: 'Failed to generate prediction', 
            error: error.message 
        });
    }
});

// ============================================
// PREDICTION CALCULATION
// ============================================
const calculateStockPrediction = (historicalData, lastClosePrice, sentimentData = null) => {
    console.log('=== ENHANCED PREDICTION DEBUG ===');
    console.log('Historical data points:', historicalData.length);
    console.log('Last close price:', lastClosePrice);
    console.log('Sentiment:', sentimentData ? `${sentimentData.label} (${sentimentData.signal.toFixed(2)})` : 'None');
    
    const sortedData = [...historicalData].sort((a, b) => a.time - b.time);
    const closes = sortedData.map(d => d.close);
    const volumes = sortedData.map(d => d.volume || 0);
    
    const hasEnoughData = (minLen) => closes.length >= minLen;

    // Calculate technical indicators
    const rsi = hasEnoughData(14) ? calculateRSI(closes) : null;
    const macdResult = hasEnoughData(26) ? calculateMACD(closes) : { macd: null, signal: null, histogram: null };
    const bbResult = hasEnoughData(20) ? calculateBollingerBands(closes) : { mid: lastClosePrice, upper: null, lower: null };
    
    const sma20Array = hasEnoughData(20) ? calculateSMA(sortedData, 20) : [];
    const sma50Array = hasEnoughData(50) ? calculateSMA(sortedData, 50) : [];
    const sma200Array = hasEnoughData(200) ? calculateSMA(sortedData, 200) : [];
    
    const sma20 = sma20Array.length > 0 ? sma20Array[sma20Array.length - 1].value : null;
    const sma50 = sma50Array.length > 0 ? sma50Array[sma50Array.length - 1].value : null;
    const sma200 = sma200Array.length > 0 ? sma200Array[sma200Array.length - 1].value : null;
    
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

    let bullishScore = 0;
    let bearishScore = 0;
    let signals = [];

    // ============================================
    // TECHNICAL ANALYSIS (Weight: 60%)
    // ============================================
    
    // SMA Analysis (20% weight)
    if (sma50 !== null && sma200 !== null && hasEnoughData(200)) {
        if (sma50 > sma200 && lastClosePrice > sma50) {
            bullishScore += 3;
            signals.push("Golden Cross detected");
        } else if (sma50 < sma200 && lastClosePrice < sma50) {
            bearishScore += 3;
            signals.push("Death Cross detected");
        } else if (lastClosePrice > sma50) {
            bullishScore += 1.5;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 1.5;
            signals.push("Price below 50-SMA");
        }
    } else if (sma50 !== null) {
        if (lastClosePrice > sma50) {
            bullishScore += 2;
            signals.push("Price above 50-SMA");
        } else {
            bearishScore += 2;
            signals.push("Price below 50-SMA");
        }
    }

    // RSI Analysis (15% weight)
    if (rsi !== null) {
        if (rsi < 30) {
            bullishScore += 2.5;
            signals.push(`RSI oversold (${rsi.toFixed(0)})`);
        } else if (rsi > 70) {
            bearishScore += 2.5;
            signals.push(`RSI overbought (${rsi.toFixed(0)})`);
        } else if (rsi > 50) {
            bullishScore += 0.5;
        } else {
            bearishScore += 0.5;
        }
    }

    // MACD Analysis (15% weight)
    if (macdResult.macd !== null && macdResult.signal !== null) {
        if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
            bullishScore += 2.5;
            signals.push("MACD bullish crossover");
        } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
            bearishScore += 2.5;
            signals.push("MACD bearish crossover");
        }
    }

    // Bollinger Bands (10% weight)
    if (bbResult.upper !== null && bbResult.lower !== null) {
        if (lastClosePrice >= bbResult.upper * 0.99) {
            bearishScore += 1.5;
            signals.push("Near upper Bollinger Band");
        } else if (lastClosePrice <= bbResult.lower * 1.01) {
            bullishScore += 1.5;
            signals.push("Near lower Bollinger Band");
        }
    }

    // ============================================
    // SENTIMENT ANALYSIS (Weight: 40%)
    // ============================================
    
    if (sentimentData && sentimentData.signal !== 0) {
        const sentimentWeight = 6;
        const sentimentScore = sentimentData.signal * sentimentWeight;
        
        if (sentimentScore > 0) {
            bullishScore += sentimentScore;
            signals.push(`${sentimentData.label} news sentiment (${sentimentData.confidence}% confidence)`);
        } else {
            bearishScore += Math.abs(sentimentScore);
            signals.push(`${sentimentData.label} news sentiment (${sentimentData.confidence}% confidence)`);
        }
        
        console.log(`[Sentiment Impact] Score: ${sentimentScore.toFixed(2)} (${sentimentData.label})`);
    }

    console.log('Final Scores:', { bullishScore: bullishScore.toFixed(2), bearishScore: bearishScore.toFixed(2) });

    // ============================================
    // CALCULATE PREDICTION
    // ============================================
    
    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 
        ? Math.min(95, Math.round((Math.max(bullishScore, bearishScore) / totalScore) * 100)) 
        : 50;
    
    const predictedDirection = bullishScore > bearishScore ? 'Up' : 'Down';
    
    let percentageChange = (Math.max(bullishScore, bearishScore) / 15) * 3;
    
    if (sentimentData) {
        percentageChange += sentimentData.signal * 1;
    }
    
    percentageChange = Math.max(-5, Math.min(5, percentageChange));
    
    if (predictedDirection === 'Down') {
        percentageChange = -Math.abs(percentageChange);
    }
    
    const predictedPrice = lastClosePrice * (1 + percentageChange / 100);

    // ✅ Format indicators for frontend display
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
            signal: volumes[volumes.length - 1] > avgVolume ? 'BUY' : 'SELL'
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
            sma20,
            sma50,
            sma200,
            avgVolume,
            lastVolume: volumes[volumes.length - 1],
        }
    };
};

module.exports = router;