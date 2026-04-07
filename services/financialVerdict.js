// server/services/financialVerdict.js
// Financial Verdict — derivation layer over the existing Alpha Vantage
// financials endpoints. Adds: investment verdict (BUY/HOLD/AVOID),
// 0-100 health score with 4 sub-scores, valuation status, key insights,
// risk flags, sector comparison, and trade signal bridge.

const axios = require('axios');
const opportunityEngine = require('./opportunityEngine');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// ═══════════════════════════════════════════════════════════
// SECTOR AVERAGES — coarse benchmarks for valuation comparison
// Based on rough multi-year medians; good enough for relative ranking
// ═══════════════════════════════════════════════════════════
const SECTOR_AVERAGES = {
    'Technology':            { pe: 28, growth: 12, operatingMargin: 22, netMargin: 18, roe: 22 },
    'Information Technology':{ pe: 28, growth: 12, operatingMargin: 22, netMargin: 18, roe: 22 },
    'Healthcare':            { pe: 22, growth: 8,  operatingMargin: 15, netMargin: 11, roe: 16 },
    'Health Care':           { pe: 22, growth: 8,  operatingMargin: 15, netMargin: 11, roe: 16 },
    'Financial Services':    { pe: 14, growth: 7,  operatingMargin: 32, netMargin: 22, roe: 12 },
    'Financials':            { pe: 14, growth: 7,  operatingMargin: 32, netMargin: 22, roe: 12 },
    'Consumer Cyclical':     { pe: 19, growth: 9,  operatingMargin: 11, netMargin: 7,  roe: 15 },
    'Consumer Defensive':    { pe: 21, growth: 5,  operatingMargin: 9,  netMargin: 6,  roe: 17 },
    'Communication Services':{ pe: 20, growth: 8,  operatingMargin: 18, netMargin: 13, roe: 16 },
    'Energy':                { pe: 13, growth: 6,  operatingMargin: 14, netMargin: 9,  roe: 13 },
    'Industrials':           { pe: 21, growth: 6,  operatingMargin: 12, netMargin: 8,  roe: 14 },
    'Basic Materials':       { pe: 17, growth: 4,  operatingMargin: 13, netMargin: 8,  roe: 12 },
    'Utilities':             { pe: 19, growth: 3,  operatingMargin: 18, netMargin: 11, roe: 9  },
    'Real Estate':           { pe: 32, growth: 5,  operatingMargin: 30, netMargin: 18, roe: 8  }
};
function getSectorAvg(sector) {
    if (!sector) return SECTOR_AVERAGES['Technology'];
    return SECTOR_AVERAGES[sector] || SECTOR_AVERAGES['Technology'];
}

// ═══════════════════════════════════════════════════════════
// FETCH HELPERS
// ═══════════════════════════════════════════════════════════
async function fetchAV(fn, symbol) {
    if (!ALPHA_VANTAGE_API_KEY) return null;
    try {
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: { function: fn, symbol, apikey: ALPHA_VANTAGE_API_KEY },
            timeout: 15000
        });
        if (response.data?.['Error Message'] || response.data?.['Note']) return null;
        return response.data;
    } catch (e) {
        console.error(`[FinancialVerdict] AV ${fn} fetch failed:`, e.message);
        return null;
    }
}
function parseNum(v) {
    if (v === null || v === undefined || v === 'None' || v === '-') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════════════════════
// SCORING — Health Score (0-100) with 4 sub-scores
// ═══════════════════════════════════════════════════════════
function scoreProfitability({ profitMargin, operatingMargin, returnOnEquity }) {
    // profitMargin and operatingMargin from AV come as decimals (0.18 = 18%)
    // ROE same
    let s = 0;
    let n = 0;
    if (profitMargin !== null) {
        const pm = profitMargin * 100;
        s += Math.min(100, Math.max(0, pm * 4)); // 25% margin = 100
        n++;
    }
    if (operatingMargin !== null) {
        const om = operatingMargin * 100;
        s += Math.min(100, Math.max(0, om * 3.5)); // 28% = 100
        n++;
    }
    if (returnOnEquity !== null) {
        const roe = returnOnEquity * 100;
        s += Math.min(100, Math.max(0, roe * 4)); // 25% ROE = 100
        n++;
    }
    return n > 0 ? Math.round(s / n) : 50;
}

function scoreGrowth({ revenueGrowth, earningsGrowth, epsGrowth }) {
    // AV growth values come as decimals too
    let s = 0;
    let n = 0;
    if (revenueGrowth !== null) {
        const g = revenueGrowth * 100;
        s += Math.min(100, Math.max(0, 50 + g * 3)); // 0% = 50, 17% = 100, -17% = 0
        n++;
    }
    if (earningsGrowth !== null || epsGrowth !== null) {
        const g = (earningsGrowth ?? epsGrowth) * 100;
        s += Math.min(100, Math.max(0, 50 + g * 2.5));
        n++;
    }
    return n > 0 ? Math.round(s / n) : 50;
}

function scoreEfficiency({ returnOnEquity, returnOnAssets }) {
    let s = 0;
    let n = 0;
    if (returnOnEquity !== null) {
        s += Math.min(100, Math.max(0, returnOnEquity * 100 * 4));
        n++;
    }
    if (returnOnAssets !== null) {
        s += Math.min(100, Math.max(0, returnOnAssets * 100 * 8));
        n++;
    }
    return n > 0 ? Math.round(s / n) : 50;
}

function scoreStability({ debtToEquity, currentRatio }) {
    let s = 0;
    let n = 0;
    if (debtToEquity !== null) {
        // Lower is better. 0 = 100, 1 = 70, 2 = 40, 3+ = 10
        s += Math.max(10, 100 - debtToEquity * 30);
        n++;
    }
    if (currentRatio !== null) {
        // Sweet spot ~1.5-3. <1 is bad, >5 means inefficient
        if (currentRatio < 1) s += 30;
        else if (currentRatio <= 1.5) s += 70;
        else if (currentRatio <= 3) s += 95;
        else if (currentRatio <= 5) s += 80;
        else s += 60;
        n++;
    }
    return n > 0 ? Math.round(s / n) : 60;
}

function computeHealthScore(metrics) {
    const profitability = scoreProfitability(metrics);
    const growth = scoreGrowth(metrics);
    const efficiency = scoreEfficiency(metrics);
    const stability = scoreStability(metrics);
    const overall = Math.round((profitability + growth + efficiency + stability) / 4);
    return { overall, profitability, growth, efficiency, stability };
}

// ═══════════════════════════════════════════════════════════
// VALUATION — vs sector average
// ═══════════════════════════════════════════════════════════
function computeValuation({ peRatio, sector, revenueGrowth }) {
    const avg = getSectorAvg(sector);
    if (!peRatio || peRatio <= 0) {
        return { status: 'unknown', label: 'No P/E', sub: 'Negative or missing earnings — valuation unclear' };
    }
    const ratio = peRatio / avg.pe;
    // Account for growth — high growth justifies higher PE
    const growthBonus = revenueGrowth ? Math.min(0.5, (revenueGrowth * 100) / 30) : 0;
    const adjusted = ratio - growthBonus;

    if (adjusted < 0.85) {
        return {
            status: 'undervalued',
            label: 'Undervalued',
            sub: `P/E ${peRatio.toFixed(1)} vs sector ${avg.pe} — trading at a discount`
        };
    }
    if (adjusted > 1.30) {
        return {
            status: 'overvalued',
            label: 'Overvalued',
            sub: `P/E ${peRatio.toFixed(1)} vs sector ${avg.pe} — premium not justified by growth`
        };
    }
    return {
        status: 'fair',
        label: 'Fair Value',
        sub: `P/E ${peRatio.toFixed(1)} vs sector ${avg.pe} — within normal range`
    };
}

// ═══════════════════════════════════════════════════════════
// VERDICT — BUY / HOLD / AVOID
// ═══════════════════════════════════════════════════════════
function computeVerdict({ healthScore, valuation, metrics }) {
    const score = healthScore.overall;
    const valStatus = valuation.status;

    // Strong company at reasonable price → BUY
    if (score >= 70 && valStatus !== 'overvalued') {
        return {
            rating: 'BUY',
            color: '#10b981',
            confidence: Math.min(95, score + 5),
            label: 'Strong Fundamentals'
        };
    }
    // Weak company → AVOID
    if (score < 40) {
        return {
            rating: 'AVOID',
            color: '#ef4444',
            confidence: Math.min(95, (100 - score) + 5),
            label: 'Weak Fundamentals'
        };
    }
    // Overvalued + weak growth → AVOID
    if (valStatus === 'overvalued' && (metrics.revenueGrowth || 0) * 100 < 5) {
        return {
            rating: 'AVOID',
            color: '#ef4444',
            confidence: 70,
            label: 'Overvalued vs Growth'
        };
    }
    // Strong company but expensive → HOLD
    if (score >= 70 && valStatus === 'overvalued') {
        return {
            rating: 'HOLD',
            color: '#f59e0b',
            confidence: 65,
            label: 'Strong but Expensive'
        };
    }
    // Everything else → HOLD
    return {
        rating: 'HOLD',
        color: '#f59e0b',
        confidence: 60,
        label: 'Mixed Signals'
    };
}

// ═══════════════════════════════════════════════════════════
// METRIC INTERPRETATION
// ═══════════════════════════════════════════════════════════
function interpretMetric(key, value, ctx) {
    if (value === null || value === undefined) return { tone: 'mid', text: 'No data' };
    const v = Number(value);

    switch (key) {
        case 'revenueGrowth': {
            const pct = v * 100;
            if (pct > 15) return { tone: 'pass', text: `Strong growth +${pct.toFixed(0)}% YoY` };
            if (pct > 5) return { tone: 'pass', text: `Healthy growth +${pct.toFixed(0)}% YoY` };
            if (pct > 0) return { tone: 'mid', text: `Modest growth +${pct.toFixed(0)}% YoY` };
            return { tone: 'warn', text: `Declining ${pct.toFixed(0)}% YoY` };
        }
        case 'earningsGrowth':
        case 'epsGrowth': {
            const pct = v * 100;
            if (pct > 20) return { tone: 'pass', text: `Earnings accelerating +${pct.toFixed(0)}% YoY` };
            if (pct > 5) return { tone: 'pass', text: `Earnings growing +${pct.toFixed(0)}% YoY` };
            if (pct > -5) return { tone: 'mid', text: `Flat earnings ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` };
            return { tone: 'warn', text: `Earnings declining ${pct.toFixed(0)}%` };
        }
        case 'profitMargin':
        case 'netMargin': {
            const pct = v * 100;
            if (pct > 20) return { tone: 'pass', text: `Excellent margin ${pct.toFixed(0)}%` };
            if (pct > 10) return { tone: 'pass', text: `Healthy margin ${pct.toFixed(0)}%` };
            if (pct > 5) return { tone: 'mid', text: `Modest margin ${pct.toFixed(0)}%` };
            return { tone: 'warn', text: `Thin margin ${pct.toFixed(0)}%` };
        }
        case 'operatingMargin': {
            const pct = v * 100;
            if (pct > 25) return { tone: 'pass', text: `Excellent op margin ${pct.toFixed(0)}%` };
            if (pct > 15) return { tone: 'pass', text: `Strong op margin ${pct.toFixed(0)}%` };
            if (pct > 5) return { tone: 'mid', text: `Modest op margin ${pct.toFixed(0)}%` };
            return { tone: 'warn', text: `Weak op margin ${pct.toFixed(0)}%` };
        }
        case 'returnOnEquity': {
            const pct = v * 100;
            if (pct > 20) return { tone: 'pass', text: `Excellent ROE ${pct.toFixed(0)}%` };
            if (pct > 12) return { tone: 'pass', text: `Strong ROE ${pct.toFixed(0)}%` };
            if (pct > 5) return { tone: 'mid', text: `Modest ROE ${pct.toFixed(0)}%` };
            return { tone: 'warn', text: `Weak ROE ${pct.toFixed(0)}%` };
        }
        case 'returnOnAssets': {
            const pct = v * 100;
            if (pct > 10) return { tone: 'pass', text: `Strong ROA ${pct.toFixed(0)}%` };
            if (pct > 5) return { tone: 'pass', text: `Healthy ROA ${pct.toFixed(0)}%` };
            return { tone: 'mid', text: `Modest ROA ${pct.toFixed(0)}%` };
        }
        case 'peRatio': {
            const avgPe = ctx?.sectorAvg?.pe || 22;
            if (v <= 0) return { tone: 'warn', text: 'Negative earnings' };
            if (v < avgPe * 0.8) return { tone: 'pass', text: `P/E ${v.toFixed(1)} — below sector` };
            if (v < avgPe * 1.2) return { tone: 'mid', text: `P/E ${v.toFixed(1)} — near sector avg` };
            return { tone: 'warn', text: `P/E ${v.toFixed(1)} — premium to sector` };
        }
        case 'debtToEquity': {
            if (v < 0.5) return { tone: 'pass', text: `Low leverage ${v.toFixed(2)}` };
            if (v < 1.5) return { tone: 'mid', text: `Moderate leverage ${v.toFixed(2)}` };
            return { tone: 'warn', text: `High leverage ${v.toFixed(2)}` };
        }
        case 'currentRatio': {
            if (v >= 1.5 && v <= 3) return { tone: 'pass', text: `Healthy liquidity ${v.toFixed(2)}` };
            if (v >= 1) return { tone: 'mid', text: `Adequate liquidity ${v.toFixed(2)}` };
            return { tone: 'warn', text: `Low liquidity ${v.toFixed(2)}` };
        }
        case 'dividendYield': {
            const pct = v * 100;
            if (pct === 0) return { tone: 'mid', text: 'No dividend — reinvesting' };
            if (pct < 2) return { tone: 'mid', text: `${pct.toFixed(2)}% yield — modest` };
            if (pct < 5) return { tone: 'pass', text: `${pct.toFixed(2)}% yield — solid` };
            return { tone: 'pass', text: `${pct.toFixed(2)}% yield — high` };
        }
        default:
            return { tone: 'mid', text: '' };
    }
}

// ═══════════════════════════════════════════════════════════
// KEY INSIGHTS + RISK FLAGS
// ═══════════════════════════════════════════════════════════
function buildInsights(metrics, sectorAvg) {
    const insights = [];
    const risks = [];

    // Revenue growth
    if (metrics.revenueGrowth !== null) {
        const pct = metrics.revenueGrowth * 100;
        if (pct > 15) insights.push(`Revenue growing +${pct.toFixed(0)}% YoY — strong expansion`);
        else if (pct > 5) insights.push(`Steady ${pct.toFixed(0)}% revenue growth`);
        else if (pct < 0) risks.push(`Revenue declining ${pct.toFixed(0)}% YoY — top-line pressure`);
        else if (pct < 3) risks.push(`Slowing revenue growth — only ${pct.toFixed(0)}% YoY`);
    }

    // Margins
    if (metrics.operatingMargin !== null) {
        const om = metrics.operatingMargin * 100;
        if (om > 25) insights.push(`Operating margin ${om.toFixed(0)}% — pricing power and operating leverage`);
        else if (om < 5) risks.push(`Thin operating margin ${om.toFixed(0)}% — limited cushion`);
    }

    // ROE
    if (metrics.returnOnEquity !== null) {
        const roe = metrics.returnOnEquity * 100;
        if (roe > 20) insights.push(`ROE ${roe.toFixed(0)}% — efficient capital allocation`);
        else if (roe < 5) risks.push(`ROE only ${roe.toFixed(0)}% — capital not earning its cost`);
    }

    // Earnings growth
    if (metrics.earningsGrowth !== null || metrics.epsGrowth !== null) {
        const g = (metrics.earningsGrowth ?? metrics.epsGrowth) * 100;
        if (g > 20) insights.push(`Earnings up +${g.toFixed(0)}% YoY — bottom-line momentum`);
        else if (g < -10) risks.push(`Earnings down ${g.toFixed(0)}% YoY — profitability deteriorating`);
    }

    // Valuation
    if (metrics.peRatio && sectorAvg.pe) {
        const ratio = metrics.peRatio / sectorAvg.pe;
        if (ratio > 1.5) risks.push(`P/E ${metrics.peRatio.toFixed(1)} significantly above sector ${sectorAvg.pe} — valuation risk`);
        else if (ratio < 0.7) insights.push(`P/E ${metrics.peRatio.toFixed(1)} well below sector ${sectorAvg.pe} — value opportunity`);
    }

    // Debt
    if (metrics.debtToEquity !== null) {
        if (metrics.debtToEquity < 0.3) insights.push(`Low debt/equity ${metrics.debtToEquity.toFixed(2)} — financial flexibility`);
        else if (metrics.debtToEquity > 2) risks.push(`Debt/equity ${metrics.debtToEquity.toFixed(2)} — leverage concerns`);
    }

    // Dividend
    if (metrics.dividendYield !== null) {
        const dy = metrics.dividendYield * 100;
        if (dy === 0) insights.push('No dividend — reinvesting for growth');
        else if (dy > 4) insights.push(`${dy.toFixed(2)}% dividend yield — income generator`);
    }

    // Current ratio liquidity
    if (metrics.currentRatio !== null && metrics.currentRatio < 1) {
        risks.push(`Current ratio ${metrics.currentRatio.toFixed(2)} below 1 — short-term liquidity tight`);
    }

    // Always have at least 2 risks (honest)
    if (risks.length === 0) {
        if (metrics.peRatio && metrics.peRatio > sectorAvg.pe) {
            risks.push('Valuation slightly above sector average');
        }
        if (risks.length === 0) {
            risks.push('Macro and sector cycle risk applies to all positions');
        }
    }

    return {
        keyInsights: insights.slice(0, 5),
        riskFlags: risks.slice(0, 5)
    };
}

// ═══════════════════════════════════════════════════════════
// TRADE BRIDGE — joins with Opportunity Engine
// ═══════════════════════════════════════════════════════════
async function buildTradeBridge(symbol, verdict) {
    const opp = await opportunityEngine.getOpportunityBySymbol(symbol).catch(() => null);
    if (!opp) {
        return {
            state: 'no_signal',
            label: 'No Active Signal',
            sub: 'Run an analysis on the asset page to generate one'
        };
    }

    const isLong = opp.bias === 'long';
    const isBuy = verdict.rating === 'BUY';
    const isAvoid = verdict.rating === 'AVOID';

    // Aligned: fundamentals say BUY + active LONG signal, OR AVOID + active SHORT
    const aligned = (isBuy && isLong) || (isAvoid && !isLong);
    // Conflicting: fundamentals BUY but signal SHORT, or vice versa
    const conflicting = (isBuy && !isLong) || (isAvoid && isLong);

    let state, label, sub;
    if (aligned) {
        state = 'aligned';
        label = 'Aligned Signal';
        sub = `Fundamentals support ${isLong ? 'LONG' : 'SHORT'} setup — high-conviction trade`;
    } else if (conflicting) {
        state = 'conflicting';
        label = 'Conflict Detected';
        sub = `Fundamentals say ${verdict.rating}, signal says ${isLong ? 'LONG' : 'SHORT'} — wait for confirmation`;
    } else {
        state = 'neutral';
        label = 'Mixed Signal';
        sub = `Active ${isLong ? 'LONG' : 'SHORT'} setup — fundamentals are mixed`;
    }

    return {
        state,
        label,
        sub,
        signalId: opp.id || opp.signalId,
        aiScore: opp.aiScore,
        bias: opp.bias,
        setupLabel: opp.setupLabel,
        isCrypto: opp.isCrypto
    };
}

// ═══════════════════════════════════════════════════════════
// CHART DATA — pull from income + cash flow histories
// ═══════════════════════════════════════════════════════════
function buildChartData(income, balance, cashflow) {
    if (!income?.annualReports) return null;
    const years = income.annualReports.slice(0, 5).reverse();
    const cashflowYears = (cashflow?.annualReports || []).slice(0, 5).reverse();

    const series = years.map((r, i) => {
        const cf = cashflowYears[i] || {};
        const fcf = cf.operatingCashflow !== undefined && cf.capitalExpenditures !== undefined
            ? (cf.operatingCashflow || 0) + (cf.capitalExpenditures || 0)
            : null;
        return {
            year: (r.fiscalDateEnding || '').slice(0, 4),
            revenue: r.totalRevenue || null,
            netIncome: r.netIncome || null,
            eps: r.eps || null,
            freeCashFlow: fcf
        };
    });

    // Compute YoY growth %
    const withGrowth = series.map((point, i) => {
        if (i === 0) return { ...point, revenueGrowthPct: null, netIncomeGrowthPct: null };
        const prev = series[i - 1];
        const revGrowth = prev.revenue && prev.revenue > 0
            ? ((point.revenue - prev.revenue) / prev.revenue) * 100
            : null;
        const niGrowth = prev.netIncome && Math.abs(prev.netIncome) > 0
            ? ((point.netIncome - prev.netIncome) / Math.abs(prev.netIncome)) * 100
            : null;
        return {
            ...point,
            revenueGrowthPct: revGrowth !== null ? Math.round(revGrowth) : null,
            netIncomeGrowthPct: niGrowth !== null ? Math.round(niGrowth) : null
        };
    });

    // Acceleration tag from last 2-3 years
    let acceleration = 'steady';
    const recent = withGrowth.filter(p => p.revenueGrowthPct !== null).slice(-3);
    if (recent.length >= 2) {
        const last = recent[recent.length - 1].revenueGrowthPct;
        const prev = recent[recent.length - 2].revenueGrowthPct;
        if (last - prev > 5) acceleration = 'accelerating';
        else if (prev - last > 5) acceleration = 'decelerating';
    }

    return { series: withGrowth, acceleration };
}

// ═══════════════════════════════════════════════════════════
// MAIN — getVerdictSnapshot
// ═══════════════════════════════════════════════════════════
async function getVerdictSnapshot(symbol) {
    const sym = String(symbol || '').toUpperCase();

    // Fetch all four AV endpoints in parallel
    const [overviewRaw, incomeRaw, balanceRaw, cashflowRaw] = await Promise.all([
        fetchAV('OVERVIEW', sym),
        fetchAV('INCOME_STATEMENT', sym),
        fetchAV('BALANCE_SHEET', sym),
        fetchAV('CASH_FLOW', sym)
    ]);

    if (!overviewRaw || !overviewRaw.Symbol) {
        return { success: false, error: 'Symbol not found or no data available' };
    }

    // Normalize the overview into our metrics shape
    const metrics = {
        symbol: overviewRaw.Symbol,
        name: overviewRaw.Name,
        sector: overviewRaw.Sector,
        industry: overviewRaw.Industry,
        marketCap: parseNum(overviewRaw.MarketCapitalization),
        peRatio: parseNum(overviewRaw.PERatio),
        pegRatio: parseNum(overviewRaw.PEGRatio),
        priceToBook: parseNum(overviewRaw.PriceToBookRatio),
        priceToSales: parseNum(overviewRaw.PriceToSalesRatioTTM),
        profitMargin: parseNum(overviewRaw.ProfitMargin),
        operatingMargin: parseNum(overviewRaw.OperatingMarginTTM),
        netMargin: parseNum(overviewRaw.ProfitMargin),
        returnOnAssets: parseNum(overviewRaw.ReturnOnAssetsTTM),
        returnOnEquity: parseNum(overviewRaw.ReturnOnEquityTTM),
        revenue: parseNum(overviewRaw.RevenueTTM),
        netIncome: parseNum(overviewRaw.NetIncomeTTM) || (parseNum(overviewRaw.EPS) || 0) * (parseNum(overviewRaw.SharesOutstanding) || 0),
        eps: parseNum(overviewRaw.EPS),
        epsGrowth: parseNum(overviewRaw.QuarterlyEarningsGrowthYOY),
        revenueGrowth: parseNum(overviewRaw.QuarterlyRevenueGrowthYOY),
        earningsGrowth: parseNum(overviewRaw.QuarterlyEarningsGrowthYOY),
        dividendYield: parseNum(overviewRaw.DividendYield),
        debtToEquity: null, // computed below from balance sheet
        currentRatio: null,
        bookValue: parseNum(overviewRaw.BookValue),
        analystTargetPrice: parseNum(overviewRaw.AnalystTargetPrice)
    };

    // Pull debt/equity + current ratio from balance sheet most recent
    if (balanceRaw?.annualReports?.length > 0) {
        const r = balanceRaw.annualReports[0];
        const totalLiab = parseNum(r.totalLiabilities);
        const equity = parseNum(r.totalShareholderEquity);
        const ca = parseNum(r.totalCurrentAssets);
        const cl = parseNum(r.totalCurrentLiabilities);
        if (totalLiab !== null && equity !== null && equity > 0) {
            metrics.debtToEquity = totalLiab / equity;
        }
        if (ca !== null && cl !== null && cl > 0) {
            metrics.currentRatio = ca / cl;
        }
    }

    const sectorAvg = getSectorAvg(metrics.sector);

    // Compute everything
    const healthScore = computeHealthScore(metrics);
    const valuation = computeValuation(metrics);
    const verdict = computeVerdict({ healthScore, valuation, metrics });
    const { keyInsights, riskFlags } = buildInsights(metrics, sectorAvg);
    const tradeBridge = await buildTradeBridge(sym, verdict);

    // Sector comparison
    const sectorComparison = {
        pe: { company: metrics.peRatio, sector: sectorAvg.pe },
        growth: {
            company: metrics.revenueGrowth !== null ? metrics.revenueGrowth * 100 : null,
            sector: sectorAvg.growth
        },
        operatingMargin: {
            company: metrics.operatingMargin !== null ? metrics.operatingMargin * 100 : null,
            sector: sectorAvg.operatingMargin
        },
        roe: {
            company: metrics.returnOnEquity !== null ? metrics.returnOnEquity * 100 : null,
            sector: sectorAvg.roe
        }
    };

    // Build interpreted metrics list for the grid
    const ctx = { sectorAvg };
    const metricsGrid = [
        { key: 'revenueGrowth', label: 'Revenue Growth', value: metrics.revenueGrowth, format: 'pct' },
        { key: 'earningsGrowth', label: 'Earnings Growth', value: metrics.earningsGrowth, format: 'pct' },
        { key: 'profitMargin', label: 'Net Margin', value: metrics.profitMargin, format: 'pct' },
        { key: 'operatingMargin', label: 'Operating Margin', value: metrics.operatingMargin, format: 'pct' },
        { key: 'returnOnEquity', label: 'ROE', value: metrics.returnOnEquity, format: 'pct' },
        { key: 'returnOnAssets', label: 'ROA', value: metrics.returnOnAssets, format: 'pct' },
        { key: 'peRatio', label: 'P/E Ratio', value: metrics.peRatio, format: 'num' },
        { key: 'debtToEquity', label: 'Debt / Equity', value: metrics.debtToEquity, format: 'num' },
        { key: 'currentRatio', label: 'Current Ratio', value: metrics.currentRatio, format: 'num' },
        { key: 'dividendYield', label: 'Dividend Yield', value: metrics.dividendYield, format: 'pct' }
    ].map(m => ({
        ...m,
        interpretation: interpretMetric(m.key, m.value, ctx)
    }));

    // Chart data
    const chart = buildChartData(incomeRaw, balanceRaw, cashflowRaw);

    return {
        success: true,
        refreshedAt: new Date().toISOString(),
        symbol: metrics.symbol,
        name: metrics.name,
        sector: metrics.sector,
        industry: metrics.industry,
        marketCap: metrics.marketCap,
        verdict,
        healthScore,
        valuation,
        tradeBridge,
        metrics,
        metricsGrid,
        keyInsights,
        riskFlags,
        sectorComparison,
        chart,
        sectorAvg
    };
}

module.exports = {
    getVerdictSnapshot,
    computeHealthScore,
    computeValuation,
    computeVerdict
};
