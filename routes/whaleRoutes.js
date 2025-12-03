// server/routes/whaleRoutes.js - Whale & Insider Trading API Routes
// Provides endpoints for insider trades, crypto whales, unusual options, and more

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const whaleService = require('../services/whaleService');

// @route   GET /api/whale/alerts
// @desc    Get all whale/insider alerts (combined feed)
// @access  Private
router.get('/alerts', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const types = req.query.types ? req.query.types.split(',') : ['insider', 'crypto', 'options', 'congress'];
        
        console.log(`[Whale API] Fetching alerts: limit=${limit}, types=${types.join(',')}`);
        
        const alerts = await whaleService.getAllAlerts({ limit, types });
        
        res.json({
            success: true,
            count: alerts.length,
            alerts
        });
    } catch (error) {
        console.error('[Whale API] Error fetching alerts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch whale alerts' });
    }
});

// @route   GET /api/whale/insider
// @desc    Get insider trading data (SEC Form 4)
// @access  Private
router.get('/insider', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        console.log(`[Whale API] Fetching insider trades: limit=${limit}`);
        
        const trades = await whaleService.fetchSECInsiderTrades(limit);
        
        // Calculate summary stats
        const buys = trades.filter(t => t.transactionType === 'BUY');
        const sells = trades.filter(t => t.transactionType === 'SELL');
        const totalBuyValue = buys.reduce((sum, t) => sum + (t.totalValue || 0), 0);
        const totalSellValue = sells.reduce((sum, t) => sum + (t.totalValue || 0), 0);
        
        res.json({
            success: true,
            count: trades.length,
            summary: {
                totalBuys: buys.length,
                totalSells: sells.length,
                totalBuyValue,
                totalSellValue,
                buyToSellRatio: sells.length > 0 ? (buys.length / sells.length).toFixed(2) : 'N/A',
                sentiment: buys.length > sells.length ? 'BULLISH' : 'BEARISH'
            },
            trades
        });
    } catch (error) {
        console.error('[Whale API] Error fetching insider trades:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch insider trades' });
    }
});

// @route   GET /api/whale/insider/:symbol
// @desc    Get insider trading for a specific stock
// @access  Private
router.get('/insider/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        
        console.log(`[Whale API] Fetching insider trades for ${symbol}`);
        
        const trades = await whaleService.fetchInsiderTradesBySymbol(symbol, limit);
        
        // Calculate summary for this symbol
        const buys = trades.filter(t => t.transactionType === 'BUY');
        const sells = trades.filter(t => t.transactionType === 'SELL');
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            count: trades.length,
            summary: {
                totalBuys: buys.length,
                totalSells: sells.length,
                recentSentiment: buys.length > sells.length ? 'BULLISH' : 
                                 sells.length > buys.length ? 'BEARISH' : 'NEUTRAL'
            },
            trades
        });
    } catch (error) {
        console.error(`[Whale API] Error fetching insider trades for ${req.params.symbol}:`, error);
        res.status(500).json({ success: false, error: 'Failed to fetch insider trades' });
    }
});

// @route   GET /api/whale/crypto
// @desc    Get crypto whale transactions
// @access  Private
router.get('/crypto', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const minValue = parseInt(req.query.minValue) || 1000000;
        
        console.log(`[Whale API] Fetching crypto whales: limit=${limit}, minValue=${minValue}`);
        
        let whales = await whaleService.fetchCryptoWhaleAlerts(limit);
        
        // Filter by minimum value if specified
        if (minValue > 1000000) {
            whales = whales.filter(w => w.amountUsd >= minValue);
        }
        
        // Calculate summary stats
        const inflows = whales.filter(w => w.type === 'exchange_inflow');
        const outflows = whales.filter(w => w.type === 'exchange_outflow');
        const totalInflowValue = inflows.reduce((sum, w) => sum + (w.amountUsd || 0), 0);
        const totalOutflowValue = outflows.reduce((sum, w) => sum + (w.amountUsd || 0), 0);
        
        res.json({
            success: true,
            count: whales.length,
            summary: {
                totalInflows: inflows.length,
                totalOutflows: outflows.length,
                totalInflowValue,
                totalOutflowValue,
                netFlow: totalInflowValue - totalOutflowValue,
                marketSentiment: totalOutflowValue > totalInflowValue ? 'ACCUMULATION' : 'DISTRIBUTION'
            },
            transactions: whales
        });
    } catch (error) {
        console.error('[Whale API] Error fetching crypto whales:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch crypto whale data' });
    }
});

// @route   GET /api/whale/crypto/:symbol
// @desc    Get whale transactions for a specific crypto
// @access  Private
router.get('/crypto/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const limit = parseInt(req.query.limit) || 30;
        
        console.log(`[Whale API] Fetching crypto whales for ${symbol}`);
        
        const allWhales = await whaleService.fetchCryptoWhaleAlerts(100);
        const filteredWhales = allWhales
            .filter(w => w.symbol?.toUpperCase() === symbol.toUpperCase())
            .slice(0, limit);
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            count: filteredWhales.length,
            transactions: filteredWhales
        });
    } catch (error) {
        console.error(`[Whale API] Error fetching crypto whales for ${req.params.symbol}:`, error);
        res.status(500).json({ success: false, error: 'Failed to fetch crypto whale data' });
    }
});

// @route   GET /api/whale/options
// @desc    Get unusual options activity
// @access  Private
router.get('/options', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const sentiment = req.query.sentiment; // 'bullish', 'bearish', or undefined for all
        
        console.log(`[Whale API] Fetching unusual options: limit=${limit}`);
        
        let options = await whaleService.fetchUnusualOptionsActivity(limit);
        
        // Filter by sentiment if specified
        if (sentiment) {
            options = options.filter(o => 
                o.sentiment.toLowerCase() === sentiment.toLowerCase()
            );
        }
        
        // Calculate summary
        const bullish = options.filter(o => o.sentiment === 'BULLISH');
        const bearish = options.filter(o => o.sentiment === 'BEARISH');
        const totalBullishPremium = bullish.reduce((sum, o) => sum + (o.premium || 0), 0);
        const totalBearishPremium = bearish.reduce((sum, o) => sum + (o.premium || 0), 0);
        
        res.json({
            success: true,
            count: options.length,
            summary: {
                bullishCount: bullish.length,
                bearishCount: bearish.length,
                totalBullishPremium,
                totalBearishPremium,
                putCallRatio: bullish.length > 0 ? (bearish.length / bullish.length).toFixed(2) : 'N/A',
                overallSentiment: bullish.length > bearish.length ? 'BULLISH' : 'BEARISH'
            },
            options
        });
    } catch (error) {
        console.error('[Whale API] Error fetching unusual options:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch unusual options' });
    }
});

// @route   GET /api/whale/options/:symbol
// @desc    Get unusual options for a specific stock
// @access  Private
router.get('/options/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        
        console.log(`[Whale API] Fetching unusual options for ${symbol}`);
        
        const allOptions = await whaleService.fetchUnusualOptionsActivity(100);
        const filteredOptions = allOptions
            .filter(o => o.symbol?.toUpperCase() === symbol.toUpperCase())
            .slice(0, limit);
        
        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            count: filteredOptions.length,
            options: filteredOptions
        });
    } catch (error) {
        console.error(`[Whale API] Error fetching options for ${req.params.symbol}:`, error);
        res.status(500).json({ success: false, error: 'Failed to fetch unusual options' });
    }
});

// @route   GET /api/whale/exchange-flows
// @desc    Get exchange inflow/outflow data
// @access  Private
router.get('/exchange-flows', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        
        console.log(`[Whale API] Fetching exchange flows`);
        
        const flows = await whaleService.fetchExchangeFlows(limit);
        
        // Calculate net flows
        const inflows = flows.filter(f => f.flowType === 'inflow');
        const outflows = flows.filter(f => f.flowType === 'outflow');
        
        res.json({
            success: true,
            count: flows.length,
            summary: {
                totalInflows: inflows.length,
                totalOutflows: outflows.length,
                inflowVolume: inflows.reduce((sum, f) => sum + (f.amountUsd || 0), 0),
                outflowVolume: outflows.reduce((sum, f) => sum + (f.amountUsd || 0), 0)
            },
            flows
        });
    } catch (error) {
        console.error('[Whale API] Error fetching exchange flows:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch exchange flows' });
    }
});

// @route   GET /api/whale/hedge-funds
// @desc    Get hedge fund activity (13F filings)
// @access  Private
router.get('/hedge-funds', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        
        console.log(`[Whale API] Fetching hedge fund activity`);
        
        const activity = await whaleService.fetchHedgeFundActivity(limit);
        
        // Group by action type
        const newPositions = activity.filter(a => a.action === 'NEW_POSITION');
        const increased = activity.filter(a => a.action === 'INCREASED');
        const decreased = activity.filter(a => a.action === 'DECREASED');
        const soldOut = activity.filter(a => a.action === 'SOLD_OUT');
        
        res.json({
            success: true,
            count: activity.length,
            summary: {
                newPositions: newPositions.length,
                increased: increased.length,
                decreased: decreased.length,
                soldOut: soldOut.length,
                overallSentiment: (newPositions.length + increased.length) > (decreased.length + soldOut.length) 
                    ? 'ACCUMULATING' : 'DISTRIBUTING'
            },
            filings: activity
        });
    } catch (error) {
        console.error('[Whale API] Error fetching hedge fund activity:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch hedge fund data' });
    }
});

// @route   GET /api/whale/congress
// @desc    Get congressional trading data
// @access  Private
router.get('/congress', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const party = req.query.party; // 'D', 'R', or undefined for all
        
        console.log(`[Whale API] Fetching congress trades`);
        
        let trades = await whaleService.fetchCongressTrades(limit);
        
        // Filter by party if specified
        if (party) {
            trades = trades.filter(t => t.party === party.toUpperCase());
        }
        
        // Calculate summary
        const buys = trades.filter(t => t.transactionType === 'BUY');
        const sells = trades.filter(t => t.transactionType === 'SELL');
        const democrats = trades.filter(t => t.party === 'D');
        const republicans = trades.filter(t => t.party === 'R');
        
        res.json({
            success: true,
            count: trades.length,
            summary: {
                totalBuys: buys.length,
                totalSells: sells.length,
                democratTrades: democrats.length,
                republicanTrades: republicans.length,
                mostActiveSymbols: getMostActiveSymbols(trades)
            },
            trades
        });
    } catch (error) {
        console.error('[Whale API] Error fetching congress trades:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch congressional trades' });
    }
});

// @route   GET /api/whale/summary
// @desc    Get overall market whale activity summary
// @access  Private
router.get('/summary', auth, async (req, res) => {
    try {
        console.log(`[Whale API] Fetching whale summary`);
        
        // Fetch all data in parallel
        const [insider, crypto, options, congress] = await Promise.all([
            whaleService.fetchSECInsiderTrades(20),
            whaleService.fetchCryptoWhaleAlerts(20),
            whaleService.fetchUnusualOptionsActivity(20),
            whaleService.fetchCongressTrades(20)
        ]);
        
        // Calculate sentiments
        const insiderBuys = insider.filter(t => t.transactionType === 'BUY').length;
        const insiderSells = insider.filter(t => t.transactionType === 'SELL').length;
        
        const cryptoInflows = crypto.filter(w => w.type === 'exchange_inflow').length;
        const cryptoOutflows = crypto.filter(w => w.type === 'exchange_outflow').length;
        
        const bullishOptions = options.filter(o => o.sentiment === 'BULLISH').length;
        const bearishOptions = options.filter(o => o.sentiment === 'BEARISH').length;
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            summary: {
                insider: {
                    total: insider.length,
                    buys: insiderBuys,
                    sells: insiderSells,
                    sentiment: insiderBuys > insiderSells ? 'BULLISH' : 'BEARISH',
                    topSymbols: getMostActiveSymbols(insider, 5)
                },
                crypto: {
                    total: crypto.length,
                    inflows: cryptoInflows,
                    outflows: cryptoOutflows,
                    sentiment: cryptoOutflows > cryptoInflows ? 'ACCUMULATION' : 'DISTRIBUTION',
                    topCoins: getMostActiveSymbols(crypto, 5)
                },
                options: {
                    total: options.length,
                    bullish: bullishOptions,
                    bearish: bearishOptions,
                    sentiment: bullishOptions > bearishOptions ? 'BULLISH' : 'BEARISH',
                    topSymbols: getMostActiveSymbols(options, 5)
                },
                congress: {
                    total: congress.length,
                    buys: congress.filter(t => t.transactionType === 'BUY').length,
                    sells: congress.filter(t => t.transactionType === 'SELL').length,
                    topSymbols: getMostActiveSymbols(congress, 5)
                },
                overallSentiment: calculateOverallSentiment({
                    insiderBuys, insiderSells,
                    cryptoInflows, cryptoOutflows,
                    bullishOptions, bearishOptions
                })
            },
            recentHighlights: getRecentHighlights(insider, crypto, options)
        });
    } catch (error) {
        console.error('[Whale API] Error fetching whale summary:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch whale summary' });
    }
});

// Helper function to get most active symbols
function getMostActiveSymbols(data, limit = 5) {
    const symbolCounts = {};
    data.forEach(item => {
        const symbol = item.symbol;
        if (symbol) {
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        }
    });
    
    return Object.entries(symbolCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([symbol, count]) => ({ symbol, count }));
}

// Helper function to calculate overall sentiment
function calculateOverallSentiment(data) {
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (data.insiderBuys > data.insiderSells) bullishSignals++;
    else bearishSignals++;
    
    if (data.cryptoOutflows > data.cryptoInflows) bullishSignals++;
    else bearishSignals++;
    
    if (data.bullishOptions > data.bearishOptions) bullishSignals++;
    else bearishSignals++;
    
    if (bullishSignals > bearishSignals) return 'BULLISH';
    if (bearishSignals > bullishSignals) return 'BEARISH';
    return 'NEUTRAL';
}

// Helper function to get recent significant highlights
function getRecentHighlights(insider, crypto, options) {
    const highlights = [];
    
    // Get biggest insider trade
    const biggestInsider = insider
        .filter(t => t.totalValue)
        .sort((a, b) => b.totalValue - a.totalValue)[0];
    if (biggestInsider) {
        highlights.push({
            type: 'insider',
            title: `${biggestInsider.insiderTitle} ${biggestInsider.transactionType}S ${biggestInsider.symbol}`,
            description: `${biggestInsider.insiderName} ${biggestInsider.transactionType.toLowerCase()}s $${whaleService.formatLargeNumber(biggestInsider.totalValue)} worth`,
            significance: biggestInsider.significance,
            timestamp: biggestInsider.filingDate
        });
    }
    
    // Get biggest crypto whale
    const biggestWhale = crypto
        .filter(w => w.amountUsd)
        .sort((a, b) => b.amountUsd - a.amountUsd)[0];
    if (biggestWhale) {
        highlights.push({
            type: 'crypto',
            title: `${biggestWhale.symbol} Whale Movement`,
            description: `$${whaleService.formatLargeNumber(biggestWhale.amountUsd)} moved ${biggestWhale.type === 'exchange_inflow' ? 'to' : 'from'} exchange`,
            significance: biggestWhale.significance,
            timestamp: biggestWhale.timestamp
        });
    }
    
    // Get biggest options bet
    const biggestOption = options
        .filter(o => o.premium)
        .sort((a, b) => b.premium - a.premium)[0];
    if (biggestOption) {
        highlights.push({
            type: 'options',
            title: `${biggestOption.sentiment} ${biggestOption.symbol} Options Bet`,
            description: `$${whaleService.formatLargeNumber(biggestOption.premium)} ${biggestOption.optionType} ${biggestOption.orderType}`,
            significance: biggestOption.significance,
            timestamp: biggestOption.timestamp
        });
    }
    
    return highlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = router;