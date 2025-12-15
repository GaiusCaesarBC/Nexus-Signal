// server/routes/financialsRoutes.js - Company Financials API (Income Statement, Balance Sheet, Cash Flow)

const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const { sanitizeSymbol } = require('../utils/symbolValidation');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache for financial data
const financialsCache = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (financial data doesn't change often)

/**
 * GET /api/financials/income/:symbol
 * Get income statement (annual and quarterly)
 */
router.get('/income/:symbol', auth, async (req, res) => {
    try {
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({ success: false, message: validationError.message });
        }

        const cacheKey = `income-${symbol}`;
        if (financialsCache[cacheKey] && Date.now() - financialsCache[cacheKey].timestamp < CACHE_DURATION) {
            console.log(`[Financials] Cache hit for income statement: ${symbol}`);
            return res.json(financialsCache[cacheKey].data);
        }

        console.log(`[Financials] Fetching income statement for ${symbol}`);

        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'INCOME_STATEMENT',
                symbol: symbol,
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 15000
        });

        if (response.data['Error Message']) {
            return res.status(404).json({ success: false, message: 'Symbol not found' });
        }

        if (response.data['Note']) {
            return res.status(429).json({ success: false, message: 'API rate limit reached' });
        }

        const annualReports = response.data.annualReports || [];
        const quarterlyReports = response.data.quarterlyReports || [];

        // Format the data for better readability
        const formatReport = (report) => ({
            fiscalDateEnding: report.fiscalDateEnding,
            reportedCurrency: report.reportedCurrency,
            // Revenue
            totalRevenue: parseNumber(report.totalRevenue),
            costOfRevenue: parseNumber(report.costOfRevenue),
            grossProfit: parseNumber(report.grossProfit),
            // Operating Expenses
            researchAndDevelopment: parseNumber(report.researchAndDevelopment),
            sellingGeneralAdministrative: parseNumber(report.sellingGeneralAndAdministrative),
            operatingExpenses: parseNumber(report.operatingExpenses),
            operatingIncome: parseNumber(report.operatingIncome),
            // Other Income/Expenses
            interestIncome: parseNumber(report.interestIncome),
            interestExpense: parseNumber(report.interestExpense),
            otherNonOperatingIncome: parseNumber(report.otherNonOperatingIncome),
            // Profit
            incomeBeforeTax: parseNumber(report.incomeBeforeTax),
            incomeTaxExpense: parseNumber(report.incomeTaxExpense),
            netIncome: parseNumber(report.netIncome),
            // Per Share
            ebitda: parseNumber(report.ebitda),
            eps: parseNumber(report.reportedEPS) || parseNumber(report.dilutedEPS),
            // Margins (calculated)
            grossMargin: calculateMargin(report.grossProfit, report.totalRevenue),
            operatingMargin: calculateMargin(report.operatingIncome, report.totalRevenue),
            netMargin: calculateMargin(report.netIncome, report.totalRevenue)
        });

        const result = {
            success: true,
            symbol,
            currency: annualReports[0]?.reportedCurrency || 'USD',
            annualReports: annualReports.slice(0, 5).map(formatReport),
            quarterlyReports: quarterlyReports.slice(0, 8).map(formatReport),
            lastUpdated: new Date().toISOString()
        };

        financialsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Financials] Income statement error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch income statement', error: error.message });
    }
});

/**
 * GET /api/financials/balance/:symbol
 * Get balance sheet (annual and quarterly)
 */
router.get('/balance/:symbol', auth, async (req, res) => {
    try {
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({ success: false, message: validationError.message });
        }

        const cacheKey = `balance-${symbol}`;
        if (financialsCache[cacheKey] && Date.now() - financialsCache[cacheKey].timestamp < CACHE_DURATION) {
            console.log(`[Financials] Cache hit for balance sheet: ${symbol}`);
            return res.json(financialsCache[cacheKey].data);
        }

        console.log(`[Financials] Fetching balance sheet for ${symbol}`);

        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'BALANCE_SHEET',
                symbol: symbol,
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 15000
        });

        if (response.data['Error Message']) {
            return res.status(404).json({ success: false, message: 'Symbol not found' });
        }

        if (response.data['Note']) {
            return res.status(429).json({ success: false, message: 'API rate limit reached' });
        }

        const annualReports = response.data.annualReports || [];
        const quarterlyReports = response.data.quarterlyReports || [];

        const formatReport = (report) => ({
            fiscalDateEnding: report.fiscalDateEnding,
            reportedCurrency: report.reportedCurrency,
            // Assets
            totalAssets: parseNumber(report.totalAssets),
            totalCurrentAssets: parseNumber(report.totalCurrentAssets),
            cashAndEquivalents: parseNumber(report.cashAndCashEquivalentsAtCarryingValue),
            shortTermInvestments: parseNumber(report.shortTermInvestments),
            currentNetReceivables: parseNumber(report.currentNetReceivables),
            inventory: parseNumber(report.inventory),
            totalNonCurrentAssets: parseNumber(report.totalNonCurrentAssets),
            propertyPlantEquipment: parseNumber(report.propertyPlantEquipment),
            goodwill: parseNumber(report.goodwill),
            intangibleAssets: parseNumber(report.intangibleAssets),
            // Liabilities
            totalLiabilities: parseNumber(report.totalLiabilities),
            totalCurrentLiabilities: parseNumber(report.totalCurrentLiabilities),
            accountsPayable: parseNumber(report.accountsPayable),
            shortTermDebt: parseNumber(report.shortTermDebt),
            totalNonCurrentLiabilities: parseNumber(report.totalNonCurrentLiabilities),
            longTermDebt: parseNumber(report.longTermDebt),
            // Equity
            totalShareholderEquity: parseNumber(report.totalShareholderEquity),
            retainedEarnings: parseNumber(report.retainedEarnings),
            commonStock: parseNumber(report.commonStock),
            treasuryStock: parseNumber(report.treasuryStock),
            // Ratios (calculated)
            currentRatio: calculateRatio(report.totalCurrentAssets, report.totalCurrentLiabilities),
            debtToEquity: calculateRatio(report.totalLiabilities, report.totalShareholderEquity),
            bookValue: parseNumber(report.totalShareholderEquity)
        });

        const result = {
            success: true,
            symbol,
            currency: annualReports[0]?.reportedCurrency || 'USD',
            annualReports: annualReports.slice(0, 5).map(formatReport),
            quarterlyReports: quarterlyReports.slice(0, 8).map(formatReport),
            lastUpdated: new Date().toISOString()
        };

        financialsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Financials] Balance sheet error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch balance sheet', error: error.message });
    }
});

/**
 * GET /api/financials/cashflow/:symbol
 * Get cash flow statement (annual and quarterly)
 */
router.get('/cashflow/:symbol', auth, async (req, res) => {
    try {
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({ success: false, message: validationError.message });
        }

        const cacheKey = `cashflow-${symbol}`;
        if (financialsCache[cacheKey] && Date.now() - financialsCache[cacheKey].timestamp < CACHE_DURATION) {
            console.log(`[Financials] Cache hit for cash flow: ${symbol}`);
            return res.json(financialsCache[cacheKey].data);
        }

        console.log(`[Financials] Fetching cash flow for ${symbol}`);

        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'CASH_FLOW',
                symbol: symbol,
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 15000
        });

        if (response.data['Error Message']) {
            return res.status(404).json({ success: false, message: 'Symbol not found' });
        }

        if (response.data['Note']) {
            return res.status(429).json({ success: false, message: 'API rate limit reached' });
        }

        const annualReports = response.data.annualReports || [];
        const quarterlyReports = response.data.quarterlyReports || [];

        const formatReport = (report) => ({
            fiscalDateEnding: report.fiscalDateEnding,
            reportedCurrency: report.reportedCurrency,
            // Operating Activities
            operatingCashflow: parseNumber(report.operatingCashflow),
            netIncome: parseNumber(report.netIncome),
            depreciation: parseNumber(report.depreciationDepletionAndAmortization),
            changeInReceivables: parseNumber(report.changeInReceivables),
            changeInInventory: parseNumber(report.changeInInventory),
            changeInAccountsPayable: parseNumber(report.changeInAccountPayables),
            // Investing Activities
            investingCashflow: parseNumber(report.cashflowFromInvestment),
            capitalExpenditures: parseNumber(report.capitalExpenditures),
            acquisitions: parseNumber(report.acquisitionsNet),
            purchaseOfInvestments: parseNumber(report.purchasesOfInvestments),
            saleOfInvestments: parseNumber(report.proceedsFromSaleOfInvestmentSecurities),
            // Financing Activities
            financingCashflow: parseNumber(report.cashflowFromFinancing),
            dividendsPaid: parseNumber(report.dividendPayout),
            dividendsCommon: parseNumber(report.dividendPayoutCommonStock),
            shareRepurchases: parseNumber(report.paymentsForRepurchaseOfCommonStock),
            debtRepayment: parseNumber(report.proceedsFromRepaymentsOfShortTermDebt),
            // Summary
            netChangeInCash: parseNumber(report.changeInCashAndCashEquivalents),
            freeCashFlow: calculateFreeCashFlow(report.operatingCashflow, report.capitalExpenditures)
        });

        const result = {
            success: true,
            symbol,
            currency: annualReports[0]?.reportedCurrency || 'USD',
            annualReports: annualReports.slice(0, 5).map(formatReport),
            quarterlyReports: quarterlyReports.slice(0, 8).map(formatReport),
            lastUpdated: new Date().toISOString()
        };

        financialsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Financials] Cash flow error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch cash flow statement', error: error.message });
    }
});

/**
 * GET /api/financials/overview/:symbol
 * Get all financial statements summary
 */
router.get('/overview/:symbol', auth, async (req, res) => {
    try {
        let symbol;
        try {
            symbol = sanitizeSymbol(req.params.symbol);
        } catch (validationError) {
            return res.status(400).json({ success: false, message: validationError.message });
        }

        const cacheKey = `overview-${symbol}`;
        if (financialsCache[cacheKey] && Date.now() - financialsCache[cacheKey].timestamp < CACHE_DURATION) {
            return res.json(financialsCache[cacheKey].data);
        }

        console.log(`[Financials] Fetching overview for ${symbol}`);

        // Fetch company overview from Alpha Vantage
        const overviewResponse = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'OVERVIEW',
                symbol: symbol,
                apikey: ALPHA_VANTAGE_API_KEY
            },
            timeout: 15000
        });

        const data = overviewResponse.data;

        if (!data.Symbol) {
            return res.status(404).json({ success: false, message: 'Symbol not found' });
        }

        const result = {
            success: true,
            symbol: data.Symbol,
            name: data.Name,
            description: data.Description,
            sector: data.Sector,
            industry: data.Industry,
            exchange: data.Exchange,
            currency: data.Currency,
            country: data.Country,
            // Valuation
            marketCap: parseNumber(data.MarketCapitalization),
            peRatio: parseNumber(data.PERatio),
            pegRatio: parseNumber(data.PEGRatio),
            priceToBook: parseNumber(data.PriceToBookRatio),
            priceToSales: parseNumber(data.PriceToSalesRatioTTM),
            evToRevenue: parseNumber(data.EVToRevenue),
            evToEbitda: parseNumber(data.EVToEBITDA),
            // Profitability
            profitMargin: parseNumber(data.ProfitMargin),
            operatingMargin: parseNumber(data.OperatingMarginTTM),
            returnOnAssets: parseNumber(data.ReturnOnAssetsTTM),
            returnOnEquity: parseNumber(data.ReturnOnEquityTTM),
            // Income
            revenue: parseNumber(data.RevenueTTM),
            revenuePerShare: parseNumber(data.RevenuePerShareTTM),
            grossProfit: parseNumber(data.GrossProfitTTM),
            ebitda: parseNumber(data.EBITDA),
            netIncome: parseNumber(data.NetIncomeTTM) || parseNumber(data.EPS) * parseNumber(data.SharesOutstanding),
            eps: parseNumber(data.EPS),
            epsGrowth: parseNumber(data.QuarterlyEarningsGrowthYOY),
            // Dividends
            dividendPerShare: parseNumber(data.DividendPerShare),
            dividendYield: parseNumber(data.DividendYield),
            payoutRatio: parseNumber(data.PayoutRatio),
            exDividendDate: data.ExDividendDate,
            // Balance Sheet
            bookValue: parseNumber(data.BookValue),
            // Shares
            sharesOutstanding: parseNumber(data.SharesOutstanding),
            sharesFloat: parseNumber(data.SharesFloat),
            // Growth
            revenueGrowth: parseNumber(data.QuarterlyRevenueGrowthYOY),
            earningsGrowth: parseNumber(data.QuarterlyEarningsGrowthYOY),
            // Targets
            analystTargetPrice: parseNumber(data.AnalystTargetPrice),
            // Dates
            fiscalYearEnd: data.FiscalYearEnd,
            latestQuarter: data.LatestQuarter,
            lastUpdated: new Date().toISOString()
        };

        financialsCache[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);

    } catch (error) {
        console.error('[Financials] Overview error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch company overview', error: error.message });
    }
});

// Helper functions
function parseNumber(value) {
    if (!value || value === 'None' || value === '-') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
}

function calculateMargin(numerator, denominator) {
    const num = parseNumber(numerator);
    const denom = parseNumber(denominator);
    if (!num || !denom || denom === 0) return null;
    return ((num / denom) * 100).toFixed(2);
}

function calculateRatio(numerator, denominator) {
    const num = parseNumber(numerator);
    const denom = parseNumber(denominator);
    if (!num || !denom || denom === 0) return null;
    return (num / denom).toFixed(2);
}

function calculateFreeCashFlow(operatingCashflow, capex) {
    const ocf = parseNumber(operatingCashflow);
    const ce = parseNumber(capex);
    if (ocf === null) return null;
    // CapEx is typically negative, so we add it
    return ocf + (ce || 0);
}

module.exports = router;
