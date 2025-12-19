// server/services/whaleService.js - Whale & Insider Trading Data Service
// Fetches from SEC EDGAR, Finnhub, Whale Alert, and other sources

const axios = require('axios');

// API Keys from environment
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const WHALE_ALERT_API_KEY = process.env.WHALE_ALERT_API_KEY;
// Add these with your existing API keys
const SEC_API_KEY = process.env.SEC_API_KEY;
const QUIVER_API_KEY = process.env.QUIVER_API_KEY;

// Cache to prevent excessive API calls
const cache = {
    insiderTrades: { data: null, timestamp: 0 },
    insiderTradesBySymbol: {},
    congressTrades: { data: null, timestamp: 0 },
    hedgeFundActivity: { data: null, timestamp: 0 },
    cryptoWhales: { data: null, timestamp: 0 },
    unusualOptions: { data: null, timestamp: 0 },
    exchangeFlows: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const LONG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for slower-updating data

// ============ HELPER FUNCTIONS ============

function isCacheValid(cacheEntry, duration = CACHE_DURATION) {
    return cacheEntry.data && (Date.now() - cacheEntry.timestamp < duration);
}

function formatLargeNumber(num) {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// ============ SEC INSIDER TRADING (Form 4) ============

/**
 * Fetch recent insider trades from SEC EDGAR
 * Free API - no key required
 */
async function fetchSECInsiderTrades(limit = 50) {
    if (isCacheValid(cache.insiderTrades)) {
        console.log('[Whale] Serving cached SEC insider trades');
        return cache.insiderTrades.data;
    }

    try {
        // Try SEC-API.io first (if you have the key)
        if (SEC_API_KEY) {
            console.log('[Whale] Fetching from SEC-API.io...');
            
            const response = await axios.get('https://api.sec-api.io/insider-trading', {
                params: {
                    token: SEC_API_KEY,
                    from: '0',
                    size: limit.toString(),
                    sort: [{ filedAt: { order: 'desc' } }]
                },
                timeout: 10000
            });

            if (response.data && response.data.transactions) {
                const trades = response.data.transactions.map((trade, index) => {
                    const shares = parseInt(trade.transactionShares) || 0;
                    const price = parseFloat(trade.transactionPricePerShare) || 0;
                    const totalValue = shares * price;
                    
                    return {
                        id: `sec-api-${trade.id || Date.now()}-${index}`,
                        symbol: trade.issuerTradingSymbol || 'N/A',
                        companyName: trade.issuerName || trade.issuerTradingSymbol,
                        insiderName: trade.reportingName || 'Unknown',
                        insiderTitle: trade.reportingRelationship || 'Insider',
                        transactionType: ['P', 'A', 'M'].includes(trade.transactionCode) ? 'BUY' : 'SELL',
                        shares: shares,
                        pricePerShare: parseFloat(price.toFixed(2)),
                        totalValue: parseFloat(totalValue.toFixed(2)),
                        filingDate: trade.filedAt || trade.periodOfReport,
                        transactionDate: trade.transactionDate || trade.periodOfReport,
                        source: 'SEC-API.io',
                        significance: calculateSignificance(totalValue)
                    };
                });
                
                cache.insiderTrades = { data: trades, timestamp: Date.now() };
                console.log(`[Whale] ✅ Fetched ${trades.length} trades from SEC-API.io`);
                return trades;
            }
        }
        
        // Fall back to SEC EDGAR (your existing code)
        console.log('[Whale] Fetching SEC EDGAR...');
        const response = await axios.get('https://efts.sec.gov/LATEST/search-index', {
            params: {
                q: 'formType:"4"',
                dateRange: 'custom',
                startdt: getDateDaysAgo(7),
                enddt: getTodayDate(),
                from: 0,
                size: limit
            },
            headers: {
                'User-Agent': 'NexusSignal/1.0 (contact@nexussignal.com)',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        const trades = parseSecFilings(response.data);
        cache.insiderTrades = { data: trades, timestamp: Date.now() };
        return trades;
        
    } catch (error) {
        console.error('[Whale] SEC API error:', error.message);
        return fetchFinnhubInsiderTrades(limit);
    }
}
/**
 * Fetch insider trades from Finnhub (backup/additional source)
 */
async function fetchFinnhubInsiderTrades(limit = 50) {
    if (!FINNHUB_API_KEY) {
        console.log('[Whale] No Finnhub API key, using mock data');
        return generateMockInsiderTrades(limit);
    }

    try {
        console.log('[Whale] Fetching Finnhub insider trades...');
        
        // Finnhub insider transactions endpoint
        const response = await axios.get('https://finnhub.io/api/v1/stock/insider-transactions', {
            params: {
                symbol: '', // Empty for all recent
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const trades = (response.data.data || []).slice(0, limit).map(trade => ({
            id: `finnhub-${trade.symbol}-${trade.transactionDate}-${Math.random()}`,
            symbol: trade.symbol,
            companyName: trade.symbol, // Finnhub doesn't provide company name
            insiderName: trade.name,
            insiderTitle: trade.position || 'Insider',
            transactionType: trade.transactionType === 'P' ? 'BUY' : 'SELL',
            shares: Math.abs(trade.share || 0),
            pricePerShare: trade.transactionPrice || 0,
            totalValue: Math.abs((trade.share || 0) * (trade.transactionPrice || 0)),
            sharesOwnedAfter: trade.shareAfter || 0,
            filingDate: trade.filingDate,
            transactionDate: trade.transactionDate,
            source: 'Finnhub',
            significance: calculateSignificance(Math.abs((trade.share || 0) * (trade.transactionPrice || 0)))
        }));

        cache.insiderTrades = { data: trades, timestamp: Date.now() };
        return trades;
    } catch (error) {
        console.error('[Whale] Finnhub API error:', error.message);
        return generateMockInsiderTrades(limit);
    }
}

/**
 * Fetch insider trades for a specific symbol
 */
async function fetchInsiderTradesBySymbol(symbol, limit = 20) {
    const cacheKey = symbol.toUpperCase();
    
    if (cache.insiderTradesBySymbol[cacheKey] && 
        isCacheValid(cache.insiderTradesBySymbol[cacheKey])) {
        return cache.insiderTradesBySymbol[cacheKey].data;
    }

    if (!FINNHUB_API_KEY) {
        return generateMockInsiderTrades(limit, symbol);
    }

    try {
        const response = await axios.get('https://finnhub.io/api/v1/stock/insider-transactions', {
            params: {
                symbol: symbol.toUpperCase(),
                token: FINNHUB_API_KEY
            },
            timeout: 10000
        });

        const trades = (response.data.data || []).slice(0, limit).map(trade => ({
            id: `finnhub-${trade.symbol}-${trade.transactionDate}-${Math.random()}`,
            symbol: trade.symbol,
            insiderName: trade.name,
            insiderTitle: trade.position || 'Insider',
            transactionType: trade.transactionType === 'P' ? 'BUY' : 'SELL',
            shares: Math.abs(trade.share || 0),
            pricePerShare: trade.transactionPrice || 0,
            totalValue: Math.abs((trade.share || 0) * (trade.transactionPrice || 0)),
            filingDate: trade.filingDate,
            transactionDate: trade.transactionDate,
            source: 'Finnhub',
            significance: calculateSignificance(Math.abs((trade.share || 0) * (trade.transactionPrice || 0)))
        }));

        cache.insiderTradesBySymbol[cacheKey] = { data: trades, timestamp: Date.now() };
        return trades;
    } catch (error) {
        console.error('[Whale] Error fetching insider trades for %s:', symbol, error.message);
        return generateMockInsiderTrades(limit, symbol);
    }
}

// ============ UNUSUAL OPTIONS ACTIVITY ============

/**
 * Fetch unusual options activity
 * Large options bets often precede big stock moves
 */
async function fetchUnusualOptionsActivity(limit = 30) {
    if (isCacheValid(cache.unusualOptions)) {
        console.log('[Whale] Serving cached unusual options');
        return cache.unusualOptions.data;
    }

    // Note: For real unusual options data, you'd need:
    // - Unusual Whales API (paid)
    // - Market Chameleon API (paid)
    // - Or scrape from free sources
    
    // For now, generate realistic mock data
    const options = generateMockUnusualOptions(limit);
    
    cache.unusualOptions = { data: options, timestamp: Date.now() };
    return options;
}

// ============ CRYPTO WHALE ALERTS ============

/**
 * Fetch crypto whale transactions
 * Uses Whale Alert API for large crypto movements
 */
async function fetchCryptoWhaleAlerts(limit = 50) {
    if (isCacheValid(cache.cryptoWhales)) {
        console.log('[Whale] Serving cached crypto whale alerts');
        return cache.cryptoWhales.data;
    }

    if (!WHALE_ALERT_API_KEY) {
        console.log('[Whale] No Whale Alert API key, using mock data');
        const mockData = generateMockCryptoWhales(limit);
        cache.cryptoWhales = { data: mockData, timestamp: Date.now() };
        return mockData;
    }

    try {
        console.log('[Whale] Fetching Whale Alert data...');
        
        const response = await axios.get('https://api.whale-alert.io/v1/transactions', {
            params: {
                api_key: WHALE_ALERT_API_KEY,
                min_value: 1000000, // $1M minimum
                start: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
                limit: limit
            },
            timeout: 10000
        });

        const whales = (response.data.transactions || []).map(tx => ({
            id: tx.id || `whale-${tx.hash}`,
            blockchain: tx.blockchain,
            symbol: tx.symbol?.toUpperCase(),
            amount: tx.amount,
            amountUsd: tx.amount_usd,
            from: categorizeWallet(tx.from),
            to: categorizeWallet(tx.to),
            fromAddress: tx.from?.address,
            toAddress: tx.to?.address,
            hash: tx.hash,
            timestamp: new Date(tx.timestamp * 1000).toISOString(),
            type: determineWhaleType(tx),
            significance: calculateCryptoSignificance(tx.amount_usd),
            source: 'Whale Alert'
        }));

        cache.cryptoWhales = { data: whales, timestamp: Date.now() };
        return whales;
    } catch (error) {
        console.error('[Whale] Whale Alert API error:', error.message);
        const mockData = generateMockCryptoWhales(limit);
        cache.cryptoWhales = { data: mockData, timestamp: Date.now() };
        return mockData;
    }
}

/**
 * Fetch exchange inflows/outflows
 * Large inflows to exchanges often signal selling pressure
 */
async function fetchExchangeFlows(limit = 20) {
    if (isCacheValid(cache.exchangeFlows, LONG_CACHE_DURATION)) {
        return cache.exchangeFlows.data;
    }

    // Generate realistic exchange flow data
    const flows = generateMockExchangeFlows(limit);
    
    cache.exchangeFlows = { data: flows, timestamp: Date.now() };
    return flows;
}

// ============ HEDGE FUND / 13F FILINGS ============

/**
 * Fetch recent 13F filings (hedge fund holdings)
 */
async function fetchHedgeFundActivity(limit = 20) {
    if (isCacheValid(cache.hedgeFundActivity, LONG_CACHE_DURATION)) {
        return cache.hedgeFundActivity.data;
    }

    // 13F data updates quarterly, so we generate realistic data
    const activity = generateMockHedgeFundActivity(limit);
    
    cache.hedgeFundActivity = { data: activity, timestamp: Date.now() };
    return activity;
}

// ============ CONGRESS TRADING ============

/**
 * Fetch congressional trading data
 * Politicians must disclose trades within 45 days
 */
async function fetchCongressTrades(limit = 30) {
    if (isCacheValid(cache.congressTrades, LONG_CACHE_DURATION)) {
        console.log('[Whale] Serving cached congress trades');
        return cache.congressTrades.data;
    }

    try {
        // Use QuiverQuant API if key available
        if (QUIVER_API_KEY) {
            console.log('[Whale] Fetching from QuiverQuant...');
            
            const response = await axios.get('https://api.quiverquant.com/beta/live/congresstrading', {
                headers: {
                    'Authorization': `Bearer ${QUIVER_API_KEY}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && Array.isArray(response.data)) {
                const trades = response.data.slice(0, limit).map(trade => {
                    let transactionType = 'UNKNOWN';
                    if (trade.Transaction) {
                        if (trade.Transaction.toLowerCase().includes('purchase')) {
                            transactionType = 'BUY';
                        } else if (trade.Transaction.toLowerCase().includes('sale')) {
                            transactionType = 'SELL';
                        }
                    }
                    
                    return {
                        id: `quiver-${trade.TransactionID || Date.now()}-${Math.random()}`,
                        politicianName: trade.Representative || 'Unknown',
                        party: trade.Party || 'I',
                        state: trade.State || 'N/A',
                        chamber: trade.House || trade.Chamber || 'Unknown',
                        symbol: trade.Ticker || 'N/A',
                        companyName: trade.Asset || trade.Ticker || 'Unknown',
                        transactionType: transactionType,
                        amountRange: trade.Range || 'Not Disclosed',
                        transactionDate: trade.TransactionDate || new Date().toISOString(),
                        disclosureDate: trade.ReportDate || trade.FilingDate || new Date().toISOString(),
                        owner: trade.Owner || 'Self',
                        significance: trade.Range?.includes('$250,001') ? 'high' : 'medium',
                        source: 'QuiverQuant'
                    };
                });
                
                cache.congressTrades = { data: trades, timestamp: Date.now() };
                console.log(`[Whale] ✅ Fetched ${trades.length} trades from QuiverQuant`);
                return trades;
            }
        }
        
        // Fallback to mock data if no API key
        console.log('[Whale] Using mock congress data');
        const trades = generateMockCongressTrades(limit);
        cache.congressTrades = { data: trades, timestamp: Date.now() };
        return trades;
        
    } catch (error) {
        console.error('[Whale] QuiverQuant error:', error.message);
        const trades = generateMockCongressTrades(limit);
        cache.congressTrades = { data: trades, timestamp: Date.now() };
        return trades;
    }
}

// ============ AGGREGATED FEED ============

/**
 * Get all whale/insider alerts combined and sorted
 */
async function getAllAlerts(options = {}) {
    const { limit = 50, types = ['insider', 'crypto', 'options', 'congress'] } = options;
    
    const alerts = [];

    try {
        // Fetch all requested types in parallel
        const promises = [];
        
        if (types.includes('insider')) {
            promises.push(fetchSECInsiderTrades(20).then(data => 
                data.map(d => ({ ...d, alertType: 'insider' }))
            ));
        }
        
        if (types.includes('crypto')) {
            promises.push(fetchCryptoWhaleAlerts(20).then(data => 
                data.map(d => ({ ...d, alertType: 'crypto' }))
            ));
        }
        
        if (types.includes('options')) {
            promises.push(fetchUnusualOptionsActivity(15).then(data => 
                data.map(d => ({ ...d, alertType: 'options' }))
            ));
        }
        
        if (types.includes('congress')) {
            promises.push(fetchCongressTrades(10).then(data => 
                data.map(d => ({ ...d, alertType: 'congress' }))
            ));
        }

        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                alerts.push(...result.value);
            }
        });

        // Sort by date/timestamp, most recent first
        alerts.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.filingDate || a.transactionDate);
            const dateB = new Date(b.timestamp || b.filingDate || b.transactionDate);
            return dateB - dateA;
        });

        return alerts.slice(0, limit);
    } catch (error) {
        console.error('[Whale] Error fetching all alerts:', error);
        return [];
    }
}

// ============ HELPER FUNCTIONS ============

function parseSecFilings(data) {
    // Parse SEC EDGAR response format
    if (!data || !data.hits || !data.hits.hits) {
        return [];
    }

    return data.hits.hits.map(hit => {
        const source = hit._source || {};
        return {
            id: hit._id,
            symbol: source.tickers?.[0] || 'N/A',
            companyName: source.display_names?.[0] || source.entity || 'Unknown',
            insiderName: source.entity || 'Unknown Insider',
            filingDate: source.file_date,
            formType: source.form || '4',
            source: 'SEC EDGAR',
            significance: 'medium'
        };
    });
}

function calculateSignificance(value) {
    if (value >= 10000000) return 'massive';  // $10M+
    if (value >= 1000000) return 'high';      // $1M+
    if (value >= 100000) return 'medium';     // $100K+
    return 'low';
}

function calculateCryptoSignificance(valueUsd) {
    if (valueUsd >= 100000000) return 'massive';  // $100M+
    if (valueUsd >= 10000000) return 'high';      // $10M+
    if (valueUsd >= 1000000) return 'medium';     // $1M+
    return 'low';
}

function categorizeWallet(wallet) {
    if (!wallet) return { type: 'unknown', name: 'Unknown' };
    
    const owner = wallet.owner || '';
    const ownerType = wallet.owner_type || '';
    
    if (ownerType === 'exchange' || owner.toLowerCase().includes('exchange')) {
        return { type: 'exchange', name: owner || 'Exchange' };
    }
    if (ownerType === 'unknown' && !owner) {
        return { type: 'wallet', name: 'Unknown Wallet' };
    }
    return { type: ownerType || 'wallet', name: owner || 'Wallet' };
}

function determineWhaleType(tx) {
    const from = tx.from?.owner_type || '';
    const to = tx.to?.owner_type || '';
    
    if (from === 'exchange' && to !== 'exchange') return 'exchange_outflow';
    if (to === 'exchange' && from !== 'exchange') return 'exchange_inflow';
    if (from === 'exchange' && to === 'exchange') return 'exchange_transfer';
    return 'wallet_transfer';
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============ MOCK DATA GENERATORS ============

function generateMockInsiderTrades(limit = 50, specificSymbol = null) {
    const symbols = specificSymbol ? [specificSymbol] : [
        'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AMD', 
        'JPM', 'BAC', 'GS', 'V', 'MA', 'UNH', 'JNJ', 'PFE', 'XOM', 'CVX'
    ];
    
    const titles = [
        'CEO', 'CFO', 'COO', 'CTO', 'Director', 'VP Sales', 'VP Engineering',
        '10% Owner', 'Board Member', 'General Counsel', 'Chief Strategy Officer'
    ];
    
    const names = [
        'John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Williams', 
        'David Brown', 'Lisa Anderson', 'Robert Taylor', 'Jennifer Martinez',
        'William Davis', 'Amanda Wilson', 'James Miller', 'Patricia Moore'
    ];

    const trades = [];
    
    for (let i = 0; i < limit; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const isBuy = Math.random() > 0.35; // 65% buys (insiders buy less often but it's more significant)
        const shares = Math.floor(Math.random() * 50000) + 1000;
        const price = 50 + Math.random() * 400;
        const totalValue = shares * price;
        
        const daysAgo = Math.floor(Math.random() * 14);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        
        trades.push({
            id: `mock-insider-${i}-${Date.now()}`,
            symbol,
            companyName: getCompanyName(symbol),
            insiderName: names[Math.floor(Math.random() * names.length)],
            insiderTitle: titles[Math.floor(Math.random() * titles.length)],
            transactionType: isBuy ? 'BUY' : 'SELL',
            shares,
            pricePerShare: price,
            totalValue,
            sharesOwnedAfter: Math.floor(Math.random() * 500000) + shares,
            filingDate: date.toISOString(),
            transactionDate: date.toISOString(),
            source: 'SEC Form 4',
            significance: calculateSignificance(totalValue)
        });
    }
    
    return trades.sort((a, b) => new Date(b.filingDate) - new Date(a.filingDate));
}

function generateMockCryptoWhales(limit = 50) {
    const cryptos = [
        { symbol: 'BTC', name: 'Bitcoin', avgPrice: 97000 },
        { symbol: 'ETH', name: 'Ethereum', avgPrice: 3400 },
        { symbol: 'SOL', name: 'Solana', avgPrice: 180 },
        { symbol: 'XRP', name: 'Ripple', avgPrice: 2.20 },
        { symbol: 'DOGE', name: 'Dogecoin', avgPrice: 0.35 },
        { symbol: 'ADA', name: 'Cardano', avgPrice: 0.90 },
        { symbol: 'AVAX', name: 'Avalanche', avgPrice: 35 },
        { symbol: 'LINK', name: 'Chainlink', avgPrice: 22 }
    ];
    
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'Bitfinex', 'FTX', 'Gemini', 'KuCoin'];
    
    const whales = [];
    
    for (let i = 0; i < limit; i++) {
        const crypto = cryptos[Math.floor(Math.random() * cryptos.length)];
        const isInflow = Math.random() > 0.5;
        const amount = (Math.random() * 5000 + 100) * (crypto.symbol === 'BTC' ? 1 : 
                       crypto.symbol === 'ETH' ? 10 : 1000);
        const amountUsd = amount * crypto.avgPrice;
        
        const hoursAgo = Math.floor(Math.random() * 48);
        const date = new Date();
        date.setHours(date.getHours() - hoursAgo);
        
        const exchange = exchanges[Math.floor(Math.random() * exchanges.length)];
        
        whales.push({
            id: `mock-whale-${i}-${Date.now()}`,
            blockchain: crypto.name,
            symbol: crypto.symbol,
            amount: Math.floor(amount),
            amountUsd,
            from: isInflow 
                ? { type: 'wallet', name: 'Unknown Wallet' }
                : { type: 'exchange', name: exchange },
            to: isInflow
                ? { type: 'exchange', name: exchange }
                : { type: 'wallet', name: 'Unknown Wallet' },
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            timestamp: date.toISOString(),
            type: isInflow ? 'exchange_inflow' : 'exchange_outflow',
            significance: calculateCryptoSignificance(amountUsd),
            source: 'Blockchain'
        });
    }
    
    return whales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function generateMockUnusualOptions(limit = 30) {
    const symbols = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'SPY', 'QQQ', 'META', 'AMZN', 'MSFT', 'GOOGL'];
    
    const options = [];
    
    for (let i = 0; i < limit; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const isCall = Math.random() > 0.45;
        const isSweep = Math.random() > 0.7;
        const contracts = Math.floor(Math.random() * 5000) + 500;
        const premium = (Math.random() * 20 + 1) * contracts * 100;
        const currentPrice = 100 + Math.random() * 300;
        const strikeOffset = (Math.random() - 0.3) * 50;
        const strike = Math.round((currentPrice + strikeOffset) / 5) * 5;
        
        const daysToExpiry = [7, 14, 30, 45, 60, 90][Math.floor(Math.random() * 6)];
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + daysToExpiry);
        
        const hoursAgo = Math.floor(Math.random() * 24);
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - hoursAgo);
        
        options.push({
            id: `mock-option-${i}-${Date.now()}`,
            symbol,
            companyName: getCompanyName(symbol),
            optionType: isCall ? 'CALL' : 'PUT',
            strike,
            expiry: expiry.toISOString().split('T')[0],
            contracts,
            premium,
            sentiment: isCall ? 'BULLISH' : 'BEARISH',
            orderType: isSweep ? 'SWEEP' : 'BLOCK',
            unusualScore: Math.floor(Math.random() * 50) + 50,
            volumeVsOI: (Math.random() * 10 + 2).toFixed(1) + 'x',
            timestamp: timestamp.toISOString(),
            significance: calculateSignificance(premium),
            source: 'Options Flow'
        });
    }
    
    return options.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function generateMockExchangeFlows(limit = 20) {
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'Bitfinex', 'Gemini'];
    const cryptos = ['BTC', 'ETH', 'SOL', 'XRP'];
    
    const flows = [];
    
    for (let i = 0; i < limit; i++) {
        const exchange = exchanges[Math.floor(Math.random() * exchanges.length)];
        const crypto = cryptos[Math.floor(Math.random() * cryptos.length)];
        const isInflow = Math.random() > 0.5;
        const amount = Math.random() * 10000 + 1000;
        const amountUsd = amount * (crypto === 'BTC' ? 97000 : crypto === 'ETH' ? 3400 : 100);
        
        const hoursAgo = Math.floor(Math.random() * 24);
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - hoursAgo);
        
        flows.push({
            id: `mock-flow-${i}-${Date.now()}`,
            exchange,
            symbol: crypto,
            flowType: isInflow ? 'inflow' : 'outflow',
            amount,
            amountUsd,
            timestamp: timestamp.toISOString(),
            interpretation: isInflow 
                ? 'Potential selling pressure - coins moving to exchange'
                : 'Potential accumulation - coins leaving exchange',
            significance: calculateCryptoSignificance(amountUsd)
        });
    }
    
    return flows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function generateMockHedgeFundActivity(limit = 20) {
    const funds = [
        'Berkshire Hathaway', 'Bridgewater Associates', 'Renaissance Technologies',
        'Citadel', 'Point72', 'Two Sigma', 'Millennium Management', 'Elliott Management',
        'Tiger Global', 'Coatue Management', 'Viking Global', 'Lone Pine Capital'
    ];
    
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V'];
    
    const activity = [];
    
    for (let i = 0; i < limit; i++) {
        const fund = funds[Math.floor(Math.random() * funds.length)];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const action = ['NEW_POSITION', 'INCREASED', 'DECREASED', 'SOLD_OUT'][Math.floor(Math.random() * 4)];
        const shares = Math.floor(Math.random() * 5000000) + 100000;
        const value = shares * (100 + Math.random() * 300);
        const changePercent = (Math.random() - 0.3) * 100;
        
        activity.push({
            id: `mock-13f-${i}-${Date.now()}`,
            fundName: fund,
            symbol,
            companyName: getCompanyName(symbol),
            action,
            shares,
            value,
            changePercent,
            portfolioPercent: (Math.random() * 5 + 0.5).toFixed(2),
            filingDate: new Date().toISOString(),
            quarterEnd: '2024-09-30',
            significance: calculateSignificance(value),
            source: 'SEC 13F'
        });
    }
    
    return activity;
}

function generateMockCongressTrades(limit = 30) {
    const politicians = [
        { name: 'Nancy Pelosi', party: 'D', state: 'CA', chamber: 'House' },
        { name: 'Dan Crenshaw', party: 'R', state: 'TX', chamber: 'House' },
        { name: 'Tommy Tuberville', party: 'R', state: 'AL', chamber: 'Senate' },
        { name: 'Mark Kelly', party: 'D', state: 'AZ', chamber: 'Senate' },
        { name: 'Josh Gottheimer', party: 'D', state: 'NJ', chamber: 'House' },
        { name: 'Michael McCaul', party: 'R', state: 'TX', chamber: 'House' }
    ];
    
    const symbols = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'CRM', 'NOW', 'PANW', 'CRWD', 'AI'];
    
    const trades = [];
    
    for (let i = 0; i < limit; i++) {
        const politician = politicians[Math.floor(Math.random() * politicians.length)];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const isBuy = Math.random() > 0.4;
        const amountRange = ['$1,001 - $15,000', '$15,001 - $50,000', '$50,001 - $100,000', 
                            '$100,001 - $250,000', '$250,001 - $500,000', '$500,001 - $1,000,000'][
                            Math.floor(Math.random() * 6)];
        
        const daysAgo = Math.floor(Math.random() * 45);
        const transactionDate = new Date();
        transactionDate.setDate(transactionDate.getDate() - daysAgo);
        
        const disclosureDate = new Date(transactionDate);
        disclosureDate.setDate(disclosureDate.getDate() + Math.floor(Math.random() * 30) + 15);
        
        trades.push({
            id: `mock-congress-${i}-${Date.now()}`,
            politicianName: politician.name,
            party: politician.party,
            state: politician.state,
            chamber: politician.chamber,
            symbol,
            companyName: getCompanyName(symbol),
            transactionType: isBuy ? 'BUY' : 'SELL',
            amountRange,
            transactionDate: transactionDate.toISOString(),
            disclosureDate: disclosureDate.toISOString(),
            owner: ['Self', 'Spouse', 'Child'][Math.floor(Math.random() * 3)],
            significance: 'medium',
            source: 'Congressional Disclosure'
        });
    }
    
    return trades.sort((a, b) => new Date(b.disclosureDate) - new Date(a.disclosureDate));
}

function getCompanyName(symbol) {
    const names = {
        'AAPL': 'Apple Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corporation',
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.',
        'META': 'Meta Platforms Inc.',
        'AMD': 'Advanced Micro Devices',
        'JPM': 'JPMorgan Chase & Co.',
        'BAC': 'Bank of America',
        'GS': 'Goldman Sachs',
        'V': 'Visa Inc.',
        'MA': 'Mastercard Inc.',
        'UNH': 'UnitedHealth Group',
        'JNJ': 'Johnson & Johnson',
        'PFE': 'Pfizer Inc.',
        'XOM': 'Exxon Mobil',
        'CVX': 'Chevron Corporation',
        'SPY': 'SPDR S&P 500 ETF',
        'QQQ': 'Invesco QQQ Trust',
        'CRM': 'Salesforce Inc.',
        'NOW': 'ServiceNow Inc.',
        'PANW': 'Palo Alto Networks',
        'CRWD': 'CrowdStrike Holdings',
        'AI': 'C3.ai Inc.',
        'BRK.B': 'Berkshire Hathaway'
    };
    return names[symbol] || `${symbol} Corp`;
}

// ============ EXPORTS ============

module.exports = {
    fetchSECInsiderTrades,
    fetchFinnhubInsiderTrades,
    fetchInsiderTradesBySymbol,
    fetchUnusualOptionsActivity,
    fetchCryptoWhaleAlerts,
    fetchExchangeFlows,
    fetchHedgeFundActivity,
    fetchCongressTrades,
    getAllAlerts,
    formatLargeNumber
};