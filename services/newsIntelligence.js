// server/services/newsIntelligence.js
// News Intelligence — derivation layer over the existing news source.
// Adds: impact scoring, why-matters templater, trade impact joining
// against the Opportunity Engine, market narrative generator, and
// sidebar widgets (trending tickers, market sentiment shift, news-
// driven setups, smart money movements).

const alphaVantageService = require('./alphaVantageService');
const opportunityEngine = require('./opportunityEngine');

// ═══════════════════════════════════════════════════════════
// SECTOR MAPPING — coarse, used for narrative grouping
// ═══════════════════════════════════════════════════════════
const SECTOR_BY_TICKER = {
    // Tech / Semis
    NVDA: 'Tech', AMD: 'Tech', AVGO: 'Tech', INTC: 'Tech', TSM: 'Tech',
    AAPL: 'Tech', MSFT: 'Tech', GOOG: 'Tech', GOOGL: 'Tech', META: 'Tech',
    AMZN: 'Tech', NFLX: 'Tech', ORCL: 'Tech', CRM: 'Tech', ADBE: 'Tech',
    QCOM: 'Tech', AMAT: 'Tech', LRCX: 'Tech', MU: 'Tech', PANW: 'Tech',
    // EV / Auto
    TSLA: 'Auto', RIVN: 'Auto', LCID: 'Auto', F: 'Auto', GM: 'Auto',
    // Healthcare
    JNJ: 'Healthcare', PFE: 'Healthcare', MRNA: 'Healthcare', LLY: 'Healthcare',
    UNH: 'Healthcare', ABBV: 'Healthcare', MRK: 'Healthcare', TMO: 'Healthcare',
    BMY: 'Healthcare', CVS: 'Healthcare',
    // Financials
    JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', GS: 'Financials',
    MS: 'Financials', C: 'Financials', V: 'Financials', MA: 'Financials',
    AXP: 'Financials', BLK: 'Financials',
    // Energy
    XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
    OXY: 'Energy',
    // Consumer
    WMT: 'Consumer', HD: 'Consumer', NKE: 'Consumer', SBUX: 'Consumer',
    MCD: 'Consumer', COST: 'Consumer', TGT: 'Consumer', LOW: 'Consumer',
    // Crypto
    BTC: 'Crypto', ETH: 'Crypto', SOL: 'Crypto', XRP: 'Crypto', ADA: 'Crypto',
    DOGE: 'Crypto', BNB: 'Crypto', AVAX: 'Crypto', DOT: 'Crypto', LINK: 'Crypto'
};

function getSector(ticker) {
    return SECTOR_BY_TICKER[String(ticker || '').toUpperCase()] || 'Other';
}

// ═══════════════════════════════════════════════════════════
// IMPACT SCORING — high / medium / low per article
// ═══════════════════════════════════════════════════════════
function computeImpact({ confidence, tickers, hasLiveSignal, headline }) {
    let score = 0;
    // Sentiment strength
    score += Math.min(50, (confidence || 0) * 0.5);
    // More tickers = broader impact
    score += Math.min(20, (tickers?.length || 0) * 4);
    // Live signal coupling = real trade impact
    if (hasLiveSignal) score += 30;
    // Earnings / M&A / Fed words trigger boost
    const text = String(headline || '').toLowerCase();
    if (/earnings|beat|miss|guidance|revenue/.test(text)) score += 15;
    if (/merger|acquisition|acquir|buyout/.test(text)) score += 15;
    if (/fed|federal reserve|rate|fomc|powell/.test(text)) score += 12;
    if (/sec|investigation|lawsuit|fraud/.test(text)) score += 10;

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

// ═══════════════════════════════════════════════════════════
// WHY MATTERS TEMPLATER
// ═══════════════════════════════════════════════════════════
function buildWhyMatters({ headline, sentiment, tickers, hasLiveSignal }) {
    const text = String(headline || '').toLowerCase();
    const tickerStr = (tickers || []).slice(0, 3).join(', ');

    if (/earnings/.test(text) || /beat/.test(text)) {
        return sentiment === 'bullish'
            ? 'Earnings beat reinforces sector strength and forward expectations'
            : 'Earnings disappointment raises concerns about forward guidance';
    }
    if (/merger|acquisition|acquir|buyout/.test(text)) {
        return 'M&A activity often creates tactical premium opportunity in target stocks';
    }
    if (/upgrade|outperform|buy rating/.test(text)) {
        return 'Institutional rerating often precedes price moves';
    }
    if (/downgrade|sell rating|underperform/.test(text)) {
        return 'Analyst caution can signal near-term weakness';
    }
    if (/fed|fomc|rate/.test(text)) {
        return sentiment === 'bullish'
            ? 'Dovish positioning supportive of risk assets'
            : 'Rate concerns weighing on risk assets across the board';
    }
    if (/lawsuit|investigation|sec/.test(text)) {
        return 'Regulatory headlines typically pressure share price near-term';
    }
    if (/launch|product|partnership/.test(text)) {
        return sentiment === 'bullish'
            ? 'Product news can catalyze near-term momentum'
            : 'Mixed reception possible — watch for follow-through';
    }
    if (hasLiveSignal && tickerStr) {
        return `News mentions ${tickerStr} — aligned with active trade setup`;
    }
    if (tickerStr) {
        return `News mentions ${tickerStr} — monitor for follow-through`;
    }
    return 'Broader market or sector context — no specific tradeable angle yet';
}

// ═══════════════════════════════════════════════════════════
// TRADE IMPACT — bridges article to live opportunity
// ═══════════════════════════════════════════════════════════
function buildTradeImpact(opp, article) {
    if (!opp) return null;
    const isLong = opp.bias === 'long';
    const direction = isLong ? 'Bullish' : 'Bearish';
    const setupWord = (opp.setupLabel || 'continuation').toLowerCase();

    let context = '';
    const text = String(article.title || '').toLowerCase();
    if (/earnings/.test(text)) context = ' after earnings news';
    else if (/upgrade/.test(text)) context = ' on analyst upgrade';
    else if (/launch/.test(text)) context = ' on product news';
    else if (/fed|rate/.test(text)) context = ' following macro shift';

    return {
        symbol: opp.symbol,
        bias: opp.bias,
        text: `${direction} ${setupWord} forming on ${opp.symbol}${context}`,
        aiScore: opp.aiScore,
        signalId: opp.id || opp.signalId,
        isCrypto: opp.isCrypto
    };
}

// ═══════════════════════════════════════════════════════════
// ARTICLE SCORING — for ranking the feed
// ═══════════════════════════════════════════════════════════
function scoreArticle(article, hasLiveSignal) {
    let score = 0;
    if (article.impact === 'high') score += 100;
    else if (article.impact === 'medium') score += 50;
    if (hasLiveSignal) score += 80;
    score += (article.confidence || 0) * 0.3;
    score += (article.tickers?.length || 0) * 5;
    // Recency bonus (newer = better tiebreaker)
    const ageHours = (Date.now() - new Date(article.timestamp).getTime()) / 3600000;
    score += Math.max(0, 20 - ageHours);
    return Math.round(score);
}

// ═══════════════════════════════════════════════════════════
// ENRICHMENT — turn raw articles into intel-grade cards
// ═══════════════════════════════════════════════════════════
function normalizeArticles(rawArticles) {
    return (rawArticles || []).map(a => ({
        id: a.id || a.url,
        title: a.title || 'Untitled',
        description: a.description || a.summary || '',
        source: a.source || 'Unknown',
        sentiment: a.sentiment || 'neutral',
        confidence: a.confidence || 0,
        timestamp: a.timestamp || a.time_published || new Date().toISOString(),
        tickers: (a.tickers || []).slice(0, 6).map(t => String(t).toUpperCase()),
        url: a.url,
        image: a.image || null
    }));
}

async function enrichArticles(articles) {
    const opportunities = await opportunityEngine.getOpportunities({}).catch(() => []);
    const oppMap = new Map(opportunities.map(o => [o.symbol, o]));

    return articles.map(a => {
        const liveSignals = a.tickers
            .map(t => oppMap.get(t))
            .filter(Boolean);
        const topSignal = liveSignals[0] || null;
        const hasLiveSignal = !!topSignal;

        const impact = computeImpact({
            confidence: a.confidence,
            tickers: a.tickers,
            hasLiveSignal,
            headline: a.title
        });

        const whyMatters = buildWhyMatters({
            headline: a.title,
            sentiment: a.sentiment,
            tickers: a.tickers,
            hasLiveSignal
        });

        const tradeImpact = buildTradeImpact(topSignal, a);
        const score = scoreArticle({ ...a, impact }, hasLiveSignal);

        return {
            ...a,
            impact,
            whyMatters,
            tradeImpact,
            hasLiveSignal,
            signalId: topSignal?.id || topSignal?.signalId || null,
            score
        };
    });
}

// ═══════════════════════════════════════════════════════════
// MARKET NARRATIVE — sector-level "what's happening" sentence
// ═══════════════════════════════════════════════════════════
function buildNarrative(enriched) {
    if (!enriched || enriched.length === 0) {
        return {
            text: 'Quiet news session — no significant headlines tracked yet.',
            tags: ['QUIET'],
            relatedSetups: 0,
            sectorFilter: null,
            biasFilter: null
        };
    }

    // Group by sector
    const bySector = new Map();
    enriched.forEach(a => {
        a.tickers.forEach(t => {
            const sec = getSector(t);
            if (!bySector.has(sec)) {
                bySector.set(sec, { name: sec, articles: [], tickers: new Set(), bullish: 0, bearish: 0 });
            }
            const entry = bySector.get(sec);
            if (!entry.articles.includes(a)) entry.articles.push(a);
            entry.tickers.add(t);
            if (a.sentiment === 'bullish') entry.bullish++;
            else if (a.sentiment === 'bearish') entry.bearish++;
        });
    });

    // Find dominant sector — needs at least 3 articles and clear directional skew
    let dominant = null;
    for (const entry of bySector.values()) {
        if (entry.articles.length < 3) continue;
        if (entry.name === 'Other') continue;
        const total = entry.bullish + entry.bearish;
        if (total === 0) continue;
        const bullPct = (entry.bullish / total) * 100;
        const bearPct = (entry.bearish / total) * 100;
        const skew = Math.abs(bullPct - bearPct);
        if (skew < 30) continue;
        const score = entry.articles.length * skew;
        if (!dominant || score > dominant._score) {
            dominant = {
                ...entry,
                bias: bullPct > bearPct ? 'bullish' : 'bearish',
                skew,
                _score: score
            };
        }
    }

    if (!dominant) {
        return {
            text: `Mixed news environment — ${enriched.length} articles spread across ${bySector.size} sectors with no clear directional skew.`,
            tags: ['MIXED'],
            relatedSetups: enriched.filter(a => a.hasLiveSignal).length,
            sectorFilter: null,
            biasFilter: null
        };
    }

    const tickerList = Array.from(dominant.tickers).slice(0, 3).join(', ');
    const setups = dominant.articles.filter(a => a.hasLiveSignal).length;

    let theme;
    const titles = dominant.articles.map(a => String(a.title || '').toLowerCase()).join(' ');
    if (/earnings|guidance|revenue/.test(titles)) theme = 'earnings momentum';
    else if (/upgrade|outperform/.test(titles)) theme = 'institutional rerating';
    else if (/launch|product|innovation/.test(titles)) theme = 'product cycle news';
    else if (/merger|acquisition/.test(titles)) theme = 'M&A activity';
    else theme = 'sector flow';

    const text = dominant.bias === 'bullish'
        ? `Bullish momentum building in ${dominant.name} — ${tickerList} showing increased sentiment on ${theme}.`
        : `Bearish pressure in ${dominant.name} — ${tickerList} under pressure from ${theme}.`;

    return {
        text,
        tags: [
            dominant.bias.toUpperCase(),
            `SECTOR: ${dominant.name.toUpperCase()}`,
            theme.toUpperCase().split(' ')[0],
            ...(setups > 0 ? [`${setups} RELATED SETUPS`] : [])
        ],
        relatedSetups: setups,
        sectorFilter: dominant.name,
        biasFilter: dominant.bias === 'bullish' ? 'long' : 'short'
    };
}

// ═══════════════════════════════════════════════════════════
// TRENDING TICKERS — count mentions, compute synthetic shift
// ═══════════════════════════════════════════════════════════
function buildTrendingTickers(enriched) {
    const counts = new Map();
    enriched.forEach(a => {
        a.tickers.forEach(t => {
            if (!counts.has(t)) counts.set(t, { symbol: t, mentions: 0, bullish: 0, bearish: 0, hasLiveSignal: a.hasLiveSignal });
            const entry = counts.get(t);
            entry.mentions++;
            if (a.sentiment === 'bullish') entry.bullish++;
            else if (a.sentiment === 'bearish') entry.bearish++;
            if (a.hasLiveSignal) entry.hasLiveSignal = true;
        });
    });

    const arr = Array.from(counts.values());
    arr.sort((a, b) => b.mentions - a.mentions);
    return arr.slice(0, 8).map(t => {
        const total = t.bullish + t.bearish;
        const bullPct = total > 0 ? Math.round((t.bullish / total) * 100) : 50;
        // Synthetic shift — relative skew * mentions, capped
        const sentimentShift = total > 0 ? Math.round(((t.bullish - t.bearish) / total) * t.mentions * 8) : 0;
        return {
            symbol: t.symbol,
            mentions: t.mentions,
            sentimentShift,
            bullPct,
            hasLiveSignal: t.hasLiveSignal
        };
    });
}

// ═══════════════════════════════════════════════════════════
// MARKET SENTIMENT — aggregate + synthetic shift vs yesterday
// ═══════════════════════════════════════════════════════════
function buildMarketSentiment(enriched) {
    const total = enriched.length;
    if (total === 0) {
        return { bullishPct: 0, bearishPct: 0, neutralPct: 0, shiftVsYesterday: 0, direction: 'flat' };
    }
    const bullish = enriched.filter(a => a.sentiment === 'bullish').length;
    const bearish = enriched.filter(a => a.sentiment === 'bearish').length;
    const neutral = total - bullish - bearish;
    const bullishPct = Math.round((bullish / total) * 100);
    const bearishPct = Math.round((bearish / total) * 100);
    const neutralPct = Math.max(0, 100 - bullishPct - bearishPct);

    // Synthetic shift — would normally compare against yesterday's snapshot
    // For now, base on the current skew strength
    const skew = bullishPct - bearishPct;
    const shiftVsYesterday = Math.round(skew * 0.15); // ~15% of current skew as "shift"
    const direction = shiftVsYesterday > 1 ? 'up' : shiftVsYesterday < -1 ? 'down' : 'flat';

    return { bullishPct, bearishPct, neutralPct, shiftVsYesterday, direction };
}

// ═══════════════════════════════════════════════════════════
// NEWS-DRIVEN SETUPS — sidebar widget
// ═══════════════════════════════════════════════════════════
function buildNewsDrivenSetups(enriched) {
    const seen = new Set();
    const setups = [];
    for (const a of enriched) {
        if (!a.tradeImpact) continue;
        if (seen.has(a.tradeImpact.symbol)) continue;
        seen.add(a.tradeImpact.symbol);
        setups.push({
            symbol: a.tradeImpact.symbol,
            bias: a.tradeImpact.bias,
            interpretation: a.tradeImpact.text,
            aiScore: a.tradeImpact.aiScore,
            signalId: a.tradeImpact.signalId,
            isCrypto: a.tradeImpact.isCrypto
        });
        if (setups.length >= 6) break;
    }
    return setups;
}

// ═══════════════════════════════════════════════════════════
// SMART MONEY MOVEMENTS — sector-level interpretive bullets
// ═══════════════════════════════════════════════════════════
function buildSmartMoneyMovements(enriched) {
    const bySector = new Map();
    enriched.forEach(a => {
        a.tickers.forEach(t => {
            const sec = getSector(t);
            if (sec === 'Other') return;
            if (!bySector.has(sec)) bySector.set(sec, { bullish: 0, bearish: 0, count: 0 });
            const entry = bySector.get(sec);
            entry.count++;
            if (a.sentiment === 'bullish') entry.bullish++;
            else if (a.sentiment === 'bearish') entry.bearish++;
        });
    });

    const movements = [];
    for (const [sec, entry] of bySector.entries()) {
        if (entry.count < 2) continue;
        const skew = entry.bullish - entry.bearish;
        if (skew >= 2) {
            movements.push({
                sector: sec,
                tone: 'bullish',
                text: `🟢 ${sec} accumulation continuing — ${entry.bullish} stocks bid`
            });
        } else if (skew <= -2) {
            movements.push({
                sector: sec,
                tone: 'bearish',
                text: `🔴 ${sec} bearish sentiment spike — ${entry.bearish} stocks under pressure`
            });
        } else if (entry.count >= 4) {
            movements.push({
                sector: sec,
                tone: 'mixed',
                text: `🟡 ${sec} mixed flow — high volume, no dominant direction`
            });
        }
    }

    return movements.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════
// MAIN — getNewsSnapshot
// ═══════════════════════════════════════════════════════════
async function getNewsSnapshot({ filters = {} } = {}) {
    let raw = [];
    try {
        raw = await alphaVantageService.getNewsSentiment('market', 100);
    } catch (e) {
        console.error('[NewsIntelligence] Fetch failed:', e.message);
    }

    // Normalize the AlphaVantage shape
    const normalized = (raw || []).map(article => ({
        id: article.url,
        title: article.title,
        description: article.summary || article.title,
        source: article.source || 'Unknown',
        sentiment: classifySentimentFromScore(article.overall_sentiment_score),
        confidence: Math.round(Math.abs(article.overall_sentiment_score || 0) * 100),
        timestamp: parseAVDate(article.time_published),
        tickers: (article.ticker_sentiment || []).map(t => String(t.ticker || '').toUpperCase()).slice(0, 6),
        url: article.url,
        image: article.banner_image || null
    }));

    let enriched = await enrichArticles(normalized);

    // Apply filters
    if (filters.sentiment && filters.sentiment !== 'all') {
        enriched = enriched.filter(a => a.sentiment === filters.sentiment);
    }
    if (filters.impact && filters.impact !== 'all') {
        if (filters.impact === 'high') enriched = enriched.filter(a => a.impact === 'high');
        else if (filters.impact === 'med-plus') enriched = enriched.filter(a => a.impact === 'high' || a.impact === 'medium');
    }
    if (filters.sector && filters.sector !== 'all') {
        enriched = enriched.filter(a => a.tickers.some(t => getSector(t).toLowerCase() === filters.sector.toLowerCase()));
    }
    if (filters.tradeOppOnly) {
        enriched = enriched.filter(a => a.hasLiveSignal);
    }
    if (filters.search) {
        const q = String(filters.search).toLowerCase();
        enriched = enriched.filter(a =>
            (a.title || '').toLowerCase().includes(q) ||
            a.tickers.some(t => t.toLowerCase().includes(q))
        );
    }

    // Sort by score (descending)
    enriched.sort((a, b) => b.score - a.score);

    // Compute everything
    const stats = {
        total: enriched.length,
        bullish: enriched.filter(a => a.sentiment === 'bullish').length,
        bearish: enriched.filter(a => a.sentiment === 'bearish').length,
        neutral: enriched.filter(a => a.sentiment === 'neutral').length,
        tradeOpportunities: enriched.filter(a => a.hasLiveSignal).length,
        highImpact: enriched.filter(a => a.impact === 'high').length
    };

    const narrative = buildNarrative(enriched);
    const trendingTickers = buildTrendingTickers(enriched);
    const marketSentiment = buildMarketSentiment(enriched);
    const newsDrivenSetups = buildNewsDrivenSetups(enriched);
    const smartMoneyMovements = buildSmartMoneyMovements(enriched);

    return {
        success: true,
        refreshedAt: new Date().toISOString(),
        stats,
        narrative,
        articles: enriched.slice(0, 50),
        trendingTickers,
        marketSentiment,
        newsDrivenSetups,
        smartMoneyMovements
    };
}

function classifySentimentFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 0.15) return 'bullish';
    if (s <= -0.15) return 'bearish';
    return 'neutral';
}

function parseAVDate(s) {
    // AlphaVantage format: YYYYMMDDTHHMMSS
    if (!s || typeof s !== 'string') return new Date().toISOString();
    if (s.length === 15 && s[8] === 'T') {
        const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
        return iso;
    }
    return new Date(s).toISOString();
}

module.exports = {
    getNewsSnapshot
};
