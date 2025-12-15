// server/routes/marketReportsRoutes.js - AI-Generated Market Reports

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Cache for reports
const reportsCache = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/market-reports/daily
 * Get today's AI-generated market report
 */
router.get('/daily', auth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `daily-${today}`;

        // Check cache
        if (reportsCache[cacheKey] && Date.now() - reportsCache[cacheKey].timestamp < CACHE_DURATION) {
            console.log('[Market Reports] Returning cached daily report');
            return res.json(reportsCache[cacheKey].data);
        }

        console.log('[Market Reports] Generating daily report...');

        // Fetch market data for context
        const marketData = await fetchMarketData();

        // Generate AI report
        const report = await generateDailyReport(marketData);

        const result = {
            success: true,
            report: {
                type: 'daily',
                date: today,
                ...report,
                generatedAt: new Date().toISOString()
            }
        };

        reportsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Market Reports] Daily report error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate daily report', error: error.message });
    }
});

/**
 * GET /api/market-reports/weekly
 * Get weekly AI-generated market summary
 */
router.get('/weekly', auth, async (req, res) => {
    try {
        const weekStart = getWeekStart();
        const cacheKey = `weekly-${weekStart}`;

        if (reportsCache[cacheKey] && Date.now() - reportsCache[cacheKey].timestamp < CACHE_DURATION * 24) {
            console.log('[Market Reports] Returning cached weekly report');
            return res.json(reportsCache[cacheKey].data);
        }

        console.log('[Market Reports] Generating weekly report...');

        const marketData = await fetchMarketData();
        const report = await generateWeeklyReport(marketData);

        const result = {
            success: true,
            report: {
                type: 'weekly',
                weekStart,
                ...report,
                generatedAt: new Date().toISOString()
            }
        };

        reportsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Market Reports] Weekly report error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate weekly report', error: error.message });
    }
});

/**
 * GET /api/market-reports/sector/:sector
 * Get AI analysis for a specific sector
 */
router.get('/sector/:sector', auth, async (req, res) => {
    try {
        const { sector } = req.params;
        const validSectors = ['technology', 'healthcare', 'financials', 'energy', 'consumer', 'industrials', 'utilities', 'materials', 'realestate'];

        if (!validSectors.includes(sector.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid sector' });
        }

        const cacheKey = `sector-${sector}-${new Date().toISOString().split('T')[0]}`;

        if (reportsCache[cacheKey] && Date.now() - reportsCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(reportsCache[cacheKey].data);
        }

        const report = await generateSectorReport(sector);

        const result = {
            success: true,
            report: {
                type: 'sector',
                sector: sector.charAt(0).toUpperCase() + sector.slice(1),
                ...report,
                generatedAt: new Date().toISOString()
            }
        };

        reportsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Market Reports] Sector report error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate sector report', error: error.message });
    }
});

/**
 * GET /api/market-reports/stock/:symbol
 * Get AI analysis for a specific stock
 */
router.get('/stock/:symbol', auth, async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const cacheKey = `stock-${symbol}-${new Date().toISOString().split('T')[0]}`;

        if (reportsCache[cacheKey] && Date.now() - reportsCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(reportsCache[cacheKey].data);
        }

        console.log(`[Market Reports] Generating stock report for ${symbol}...`);

        const stockData = await fetchStockData(symbol);
        const report = await generateStockReport(symbol, stockData);

        const result = {
            success: true,
            report: {
                type: 'stock',
                symbol,
                ...report,
                stockData,
                generatedAt: new Date().toISOString()
            }
        };

        reportsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Market Reports] Stock report error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate stock report', error: error.message });
    }
});

// ============ HELPER FUNCTIONS ============

async function fetchMarketData() {
    const data = {
        indices: {},
        topGainers: [],
        topLosers: [],
        mostActive: [],
        news: []
    };

    try {
        // Fetch major indices from Yahoo Finance
        const indices = ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX'];
        const indexPromises = indices.map(async (symbol) => {
            try {
                const response = await axios.get(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
                    { timeout: 10000 }
                );
                const result = response.data?.chart?.result?.[0];
                if (result?.meta) {
                    const price = result.meta.regularMarketPrice;
                    const prevClose = result.meta.previousClose || result.meta.chartPreviousClose;
                    return {
                        symbol,
                        price,
                        change: price - prevClose,
                        changePercent: ((price - prevClose) / prevClose) * 100
                    };
                }
            } catch (e) {
                console.log(`Failed to fetch ${symbol}`);
            }
            return null;
        });

        const indexResults = await Promise.all(indexPromises);
        indexResults.forEach(result => {
            if (result) data.indices[result.symbol] = result;
        });

        // Fetch top movers from Finnhub
        if (FINNHUB_API_KEY) {
            try {
                const newsResponse = await axios.get('https://finnhub.io/api/v1/news', {
                    params: { category: 'general', token: FINNHUB_API_KEY },
                    timeout: 10000
                });
                data.news = (newsResponse.data || []).slice(0, 5).map(n => ({
                    headline: n.headline,
                    source: n.source,
                    summary: n.summary?.substring(0, 200),
                    url: n.url
                }));
            } catch (e) {
                console.log('Failed to fetch news');
            }
        }

    } catch (error) {
        console.error('[Market Reports] Error fetching market data:', error.message);
    }

    return data;
}

async function fetchStockData(symbol) {
    try {
        const response = await axios.get(
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,financialData,defaultKeyStatistics`,
            { timeout: 10000 }
        );
        const result = response.data?.quoteSummary?.result?.[0];
        if (result) {
            const price = result.price || {};
            const summary = result.summaryDetail || {};
            const financial = result.financialData || {};
            const keyStats = result.defaultKeyStatistics || {};

            return {
                name: price.shortName || price.longName,
                price: price.regularMarketPrice?.raw,
                change: price.regularMarketChange?.raw,
                changePercent: price.regularMarketChangePercent?.raw,
                marketCap: price.marketCap?.raw,
                pe: summary.trailingPE?.raw,
                forwardPE: summary.forwardPE?.raw,
                eps: keyStats.trailingEps?.raw,
                dividend: summary.dividendYield?.raw,
                beta: keyStats.beta?.raw,
                high52: summary.fiftyTwoWeekHigh?.raw,
                low52: summary.fiftyTwoWeekLow?.raw,
                targetPrice: financial.targetMeanPrice?.raw,
                recommendation: financial.recommendationKey
            };
        }
    } catch (error) {
        console.error(`[Market Reports] Error fetching stock data for ${symbol}:`, error.message);
    }
    return null;
}

async function generateDailyReport(marketData) {
    const prompt = `You are a professional financial analyst. Generate a concise daily market report based on the following data:

Market Indices:
${Object.entries(marketData.indices).map(([sym, d]) => `- ${sym}: $${d?.price?.toFixed(2)} (${d?.changePercent >= 0 ? '+' : ''}${d?.changePercent?.toFixed(2)}%)`).join('\n')}

Recent Headlines:
${marketData.news.map(n => `- ${n.headline}`).join('\n')}

Please provide:
1. A brief market summary (2-3 sentences)
2. Key market themes today (3 bullet points)
3. Sector highlights (which sectors are leading/lagging)
4. Risk factors to watch
5. Trading outlook (bullish/bearish/neutral with reasoning)

Format the response as JSON with these fields: summary, themes (array), sectorHighlights, riskFactors (array), outlook (object with sentiment and reasoning).`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        // Try to parse as JSON, fallback to raw text
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.log('[Market Reports] Could not parse JSON, using raw text');
        }

        return {
            summary: content,
            themes: [],
            sectorHighlights: '',
            riskFactors: [],
            outlook: { sentiment: 'neutral', reasoning: 'See summary' }
        };
    } catch (error) {
        console.error('[Market Reports] AI generation error:', error.message);
        throw error;
    }
}

async function generateWeeklyReport(marketData) {
    const prompt = `You are a professional financial analyst. Generate a comprehensive weekly market review based on current market data.

Current Market Status:
${Object.entries(marketData.indices).map(([sym, d]) => `- ${sym}: $${d?.price?.toFixed(2)} (${d?.changePercent >= 0 ? '+' : ''}${d?.changePercent?.toFixed(2)}%)`).join('\n')}

Please provide:
1. Week in Review summary (3-4 sentences)
2. Major market events and their impact
3. Sector performance ranking
4. Economic indicators to watch next week
5. Key earnings to watch
6. Technical levels for major indices
7. Week ahead outlook

Format as JSON with: weekSummary, majorEvents (array), sectorRanking (array of objects with sector and performance), economicIndicators (array), earningsWatch (array), technicalLevels (object), weekAheadOutlook (object with sentiment and keyPoints array).`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.log('[Market Reports] Could not parse JSON');
        }

        return {
            weekSummary: content,
            majorEvents: [],
            sectorRanking: [],
            economicIndicators: [],
            earningsWatch: [],
            technicalLevels: {},
            weekAheadOutlook: { sentiment: 'neutral', keyPoints: [] }
        };
    } catch (error) {
        console.error('[Market Reports] AI generation error:', error.message);
        throw error;
    }
}

async function generateSectorReport(sector) {
    const sectorETFs = {
        technology: { etf: 'XLK', stocks: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'] },
        healthcare: { etf: 'XLV', stocks: ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK'] },
        financials: { etf: 'XLF', stocks: ['JPM', 'BAC', 'WFC', 'GS', 'MS'] },
        energy: { etf: 'XLE', stocks: ['XOM', 'CVX', 'COP', 'SLB', 'EOG'] },
        consumer: { etf: 'XLY', stocks: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE'] },
        industrials: { etf: 'XLI', stocks: ['CAT', 'UPS', 'HON', 'BA', 'GE'] },
        utilities: { etf: 'XLU', stocks: ['NEE', 'DUK', 'SO', 'D', 'AEP'] },
        materials: { etf: 'XLB', stocks: ['LIN', 'APD', 'ECL', 'SHW', 'DD'] },
        realestate: { etf: 'XLRE', stocks: ['AMT', 'PLD', 'CCI', 'EQIX', 'SPG'] }
    };

    const sectorInfo = sectorETFs[sector.toLowerCase()];

    const prompt = `You are a sector analyst. Provide a detailed analysis of the ${sector} sector.

Key ETF: ${sectorInfo.etf}
Top Holdings: ${sectorInfo.stocks.join(', ')}

Please provide:
1. Sector overview and current state
2. Key drivers affecting the sector
3. Top performing stocks analysis
4. Underperforming stocks to watch
5. Catalysts and upcoming events
6. Technical analysis of sector ETF
7. Investment thesis (bullish/bearish case)

Format as JSON with: overview, keyDrivers (array), topPerformers (array with symbol and reason), underperformers (array), catalysts (array), technicalAnalysis, investmentThesis (object with bullishCase and bearishCase).`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1800,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return { ...JSON.parse(jsonMatch[0]), etf: sectorInfo.etf, topStocks: sectorInfo.stocks };
            }
        } catch (e) {
            console.log('[Market Reports] Could not parse JSON');
        }

        return {
            overview: content,
            keyDrivers: [],
            topPerformers: [],
            underperformers: [],
            catalysts: [],
            technicalAnalysis: '',
            investmentThesis: {},
            etf: sectorInfo.etf,
            topStocks: sectorInfo.stocks
        };
    } catch (error) {
        console.error('[Market Reports] AI generation error:', error.message);
        throw error;
    }
}

async function generateStockReport(symbol, stockData) {
    const prompt = `You are a professional equity analyst. Provide a detailed analysis of ${symbol}.

Stock Data:
- Company: ${stockData?.name || symbol}
- Current Price: $${stockData?.price?.toFixed(2) || 'N/A'}
- Change: ${stockData?.changePercent?.toFixed(2) || 0}%
- Market Cap: ${stockData?.marketCap ? '$' + (stockData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
- P/E Ratio: ${stockData?.pe?.toFixed(2) || 'N/A'}
- Forward P/E: ${stockData?.forwardPE?.toFixed(2) || 'N/A'}
- EPS: $${stockData?.eps?.toFixed(2) || 'N/A'}
- 52-Week Range: $${stockData?.low52?.toFixed(2) || 'N/A'} - $${stockData?.high52?.toFixed(2) || 'N/A'}
- Analyst Target: $${stockData?.targetPrice?.toFixed(2) || 'N/A'}
- Recommendation: ${stockData?.recommendation || 'N/A'}

Please provide:
1. Investment summary (2-3 sentences)
2. Key strengths (3 bullet points)
3. Key risks (3 bullet points)
4. Valuation assessment
5. Technical analysis
6. Price targets (bull/base/bear case)
7. Overall recommendation

Format as JSON with: summary, strengths (array), risks (array), valuation, technicalAnalysis, priceTargets (object with bull, base, bear), recommendation (object with rating and reasoning).`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.log('[Market Reports] Could not parse JSON');
        }

        return {
            summary: content,
            strengths: [],
            risks: [],
            valuation: '',
            technicalAnalysis: '',
            priceTargets: {},
            recommendation: { rating: 'neutral', reasoning: 'See summary' }
        };
    } catch (error) {
        console.error('[Market Reports] AI generation error:', error.message);
        throw error;
    }
}

function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

module.exports = router;
