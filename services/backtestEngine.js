// server/services/backtestEngine.js - Core Backtesting Logic
const axios = require('axios');

class BacktestEngine {
    constructor(options = {}) {
        this.commissionRate = options.commissionRate || 0.001; // 0.1% per trade
        this.slippage = options.slippage || 0.0005; // 0.05% slippage
    }

    // Fetch historical price data
    async fetchHistoricalData(symbol, startDate, endDate, assetType = 'stock') {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const period1 = Math.floor(start.getTime() / 1000);
            const period2 = Math.floor(end.getTime() / 1000);

            // Use Yahoo Finance for stocks
            const response = await axios.get(
                `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`,
                {
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                }
            );

            const result = response.data?.chart?.result?.[0];
            if (!result || !result.timestamp) {
                throw new Error(`No data available for ${symbol}`);
            }

            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];
            const adjClose = result.indicators.adjclose?.[0]?.adjclose || quotes.close;

            const data = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (quotes.close[i] && quotes.open[i] && quotes.high[i] && quotes.low[i]) {
                    data.push({
                        date: new Date(timestamps[i] * 1000),
                        open: quotes.open[i],
                        high: quotes.high[i],
                        low: quotes.low[i],
                        close: quotes.close[i],
                        adjClose: adjClose[i] || quotes.close[i],
                        volume: quotes.volume[i] || 0
                    });
                }
            }

            return data;
        } catch (error) {
            console.error(`[Backtest] Error fetching data for ${symbol}:`, error.message);
            throw new Error(`Failed to fetch historical data for ${symbol}`);
        }
    }

    // Calculate technical indicators
    calculateIndicators(data, params = {}) {
        const indicators = {
            sma: {},
            ema: {},
            rsi: [],
            macd: { line: [], signal: [], histogram: [] },
            bollinger: { upper: [], middle: [], lower: [] },
            atr: []
        };

        const closes = data.map(d => d.close);

        // Simple Moving Averages
        [10, 20, 50, 200].forEach(period => {
            indicators.sma[period] = this.calculateSMA(closes, period);
        });

        // Exponential Moving Averages
        [12, 26].forEach(period => {
            indicators.ema[period] = this.calculateEMA(closes, period);
        });

        // RSI
        indicators.rsi = this.calculateRSI(closes, params.rsiPeriod || 14);

        // MACD
        const macd = this.calculateMACD(closes, 12, 26, 9);
        indicators.macd = macd;

        // Bollinger Bands
        indicators.bollinger = this.calculateBollingerBands(closes, params.bbPeriod || 20, params.bbStdDev || 2);

        // ATR
        indicators.atr = this.calculateATR(data, 14);

        return indicators;
    }

    calculateSMA(data, period) {
        const sma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sma.push(null);
            } else {
                const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                sma.push(sum / period);
            }
        }
        return sma;
    }

    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                ema.push(null);
            } else if (i === period - 1) {
                const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
                ema.push(sum / period);
            } else {
                ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
            }
        }
        return ema;
    }

    calculateRSI(data, period = 14) {
        const rsi = [];
        const gains = [];
        const losses = [];

        for (let i = 1; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                rsi.push(null);
            } else {
                const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
                const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

                if (avgLoss === 0) {
                    rsi.push(100);
                } else {
                    const rs = avgGain / avgLoss;
                    rsi.push(100 - (100 / (1 + rs)));
                }
            }
        }
        return rsi;
    }

    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const emaFast = this.calculateEMA(data, fastPeriod);
        const emaSlow = this.calculateEMA(data, slowPeriod);

        const macdLine = emaFast.map((fast, i) => {
            if (fast === null || emaSlow[i] === null) return null;
            return fast - emaSlow[i];
        });

        const validMacd = macdLine.filter(v => v !== null);
        const signalLine = this.calculateEMA(validMacd, signalPeriod);

        // Pad signal line with nulls
        const paddedSignal = new Array(macdLine.length - signalLine.length).fill(null).concat(signalLine);

        const histogram = macdLine.map((macd, i) => {
            if (macd === null || paddedSignal[i] === null) return null;
            return macd - paddedSignal[i];
        });

        return { line: macdLine, signal: paddedSignal, histogram };
    }

    calculateBollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(data, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                upper.push(null);
                lower.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const mean = sma[i];
                const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
                const std = Math.sqrt(variance);
                upper.push(mean + stdDev * std);
                lower.push(mean - stdDev * std);
            }
        }

        return { upper, middle: sma, lower };
    }

    calculateATR(data, period = 14) {
        const tr = [];
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                tr.push(data[i].high - data[i].low);
            } else {
                const hl = data[i].high - data[i].low;
                const hc = Math.abs(data[i].high - data[i - 1].close);
                const lc = Math.abs(data[i].low - data[i - 1].close);
                tr.push(Math.max(hl, hc, lc));
            }
        }
        return this.calculateSMA(tr, period);
    }

    // Strategy implementations
    executeStrategy(strategy, data, indicators, params) {
        switch (strategy) {
            case 'ma-crossover':
                return this.maCrossoverStrategy(data, indicators, params);
            case 'rsi-reversal':
                return this.rsiReversalStrategy(data, indicators, params);
            case 'macd-crossover':
                return this.macdCrossoverStrategy(data, indicators, params);
            case 'bollinger-bands':
                return this.bollingerBandsStrategy(data, indicators, params);
            case 'breakout':
                return this.breakoutStrategy(data, indicators, params);
            case 'mean-reversion':
                return this.meanReversionStrategy(data, indicators, params);
            default:
                throw new Error(`Unknown strategy: ${strategy}`);
        }
    }

    maCrossoverStrategy(data, indicators, params = {}) {
        const fastPeriod = params.fastPeriod || 10;
        const slowPeriod = params.slowPeriod || 30;
        const fastMA = this.calculateSMA(data.map(d => d.close), fastPeriod);
        const slowMA = this.calculateSMA(data.map(d => d.close), slowPeriod);

        const signals = [];
        for (let i = 1; i < data.length; i++) {
            if (fastMA[i] === null || slowMA[i] === null || fastMA[i-1] === null || slowMA[i-1] === null) {
                signals.push({ signal: 'hold', reason: 'Waiting for MA' });
            } else if (fastMA[i-1] <= slowMA[i-1] && fastMA[i] > slowMA[i]) {
                signals.push({ signal: 'buy', reason: `Fast MA crossed above Slow MA` });
            } else if (fastMA[i-1] >= slowMA[i-1] && fastMA[i] < slowMA[i]) {
                signals.push({ signal: 'sell', reason: `Fast MA crossed below Slow MA` });
            } else {
                signals.push({ signal: 'hold', reason: 'No crossover' });
            }
        }
        return [{ signal: 'hold', reason: 'Initial' }, ...signals];
    }

    rsiReversalStrategy(data, indicators, params = {}) {
        const oversold = params.oversold || 30;
        const overbought = params.overbought || 70;
        const rsi = indicators.rsi;

        const signals = [];
        for (let i = 0; i < data.length; i++) {
            if (rsi[i] === null) {
                signals.push({ signal: 'hold', reason: 'Waiting for RSI' });
            } else if (rsi[i] < oversold) {
                signals.push({ signal: 'buy', reason: `RSI oversold at ${rsi[i].toFixed(1)}` });
            } else if (rsi[i] > overbought) {
                signals.push({ signal: 'sell', reason: `RSI overbought at ${rsi[i].toFixed(1)}` });
            } else {
                signals.push({ signal: 'hold', reason: `RSI neutral at ${rsi[i].toFixed(1)}` });
            }
        }
        return signals;
    }

    macdCrossoverStrategy(data, indicators, params = {}) {
        const { line, signal } = indicators.macd;
        const signals = [];

        for (let i = 1; i < data.length; i++) {
            if (line[i] === null || signal[i] === null || line[i-1] === null || signal[i-1] === null) {
                signals.push({ signal: 'hold', reason: 'Waiting for MACD' });
            } else if (line[i-1] <= signal[i-1] && line[i] > signal[i]) {
                signals.push({ signal: 'buy', reason: 'MACD bullish crossover' });
            } else if (line[i-1] >= signal[i-1] && line[i] < signal[i]) {
                signals.push({ signal: 'sell', reason: 'MACD bearish crossover' });
            } else {
                signals.push({ signal: 'hold', reason: 'No MACD crossover' });
            }
        }
        return [{ signal: 'hold', reason: 'Initial' }, ...signals];
    }

    bollingerBandsStrategy(data, indicators, params = {}) {
        const { upper, lower } = indicators.bollinger;
        const signals = [];

        for (let i = 0; i < data.length; i++) {
            if (upper[i] === null || lower[i] === null) {
                signals.push({ signal: 'hold', reason: 'Waiting for Bollinger Bands' });
            } else if (data[i].close < lower[i]) {
                signals.push({ signal: 'buy', reason: 'Price below lower band' });
            } else if (data[i].close > upper[i]) {
                signals.push({ signal: 'sell', reason: 'Price above upper band' });
            } else {
                signals.push({ signal: 'hold', reason: 'Price within bands' });
            }
        }
        return signals;
    }

    breakoutStrategy(data, indicators, params = {}) {
        const lookback = params.lookbackPeriod || 20;
        const threshold = params.breakoutThreshold || 1.02;
        const signals = [];

        for (let i = 0; i < data.length; i++) {
            if (i < lookback) {
                signals.push({ signal: 'hold', reason: 'Waiting for lookback period' });
            } else {
                const recentHigh = Math.max(...data.slice(i - lookback, i).map(d => d.high));
                const recentLow = Math.min(...data.slice(i - lookback, i).map(d => d.low));

                if (data[i].close > recentHigh * threshold) {
                    signals.push({ signal: 'buy', reason: `Breakout above ${recentHigh.toFixed(2)}` });
                } else if (data[i].close < recentLow / threshold) {
                    signals.push({ signal: 'sell', reason: `Breakdown below ${recentLow.toFixed(2)}` });
                } else {
                    signals.push({ signal: 'hold', reason: 'No breakout' });
                }
            }
        }
        return signals;
    }

    meanReversionStrategy(data, indicators, params = {}) {
        const period = params.period || 20;
        const stdDevs = params.stdDevs || 2;
        const sma = indicators.sma[period] || this.calculateSMA(data.map(d => d.close), period);
        const signals = [];

        for (let i = 0; i < data.length; i++) {
            if (sma[i] === null) {
                signals.push({ signal: 'hold', reason: 'Waiting for SMA' });
            } else {
                const deviation = (data[i].close - sma[i]) / sma[i];
                const threshold = stdDevs * 0.02; // Approximate 2% per std dev

                if (deviation < -threshold) {
                    signals.push({ signal: 'buy', reason: `Price ${(deviation * 100).toFixed(1)}% below mean` });
                } else if (deviation > threshold) {
                    signals.push({ signal: 'sell', reason: `Price ${(deviation * 100).toFixed(1)}% above mean` });
                } else {
                    signals.push({ signal: 'hold', reason: 'Price near mean' });
                }
            }
        }
        return signals;
    }

    // Run the backtest
    async runBacktest(options) {
        const {
            symbol,
            strategy,
            startDate,
            endDate,
            initialCapital = 10000,
            parameters = {},
            assetType = 'stock'
        } = options;

        // Fetch historical data
        const data = await this.fetchHistoricalData(symbol, startDate, endDate, assetType);

        if (data.length < 50) {
            throw new Error('Insufficient data for backtesting (need at least 50 data points)');
        }

        // Calculate indicators
        const indicators = this.calculateIndicators(data, parameters);

        // Execute strategy
        const signals = this.executeStrategy(strategy, data, indicators, parameters);

        // Simulate trades
        const simulation = this.simulateTrades(data, signals, initialCapital);

        // Calculate performance metrics
        const metrics = this.calculateMetrics(simulation, data, initialCapital);

        // Generate monthly performance
        const monthlyPerformance = this.calculateMonthlyPerformance(simulation.trades, data);

        // Generate equity curve
        const equityCurve = simulation.equityCurve;

        return {
            results: metrics,
            trades: simulation.trades,
            equityCurve,
            monthlyPerformance,
            dataPoints: data.length
        };
    }

    simulateTrades(data, signals, initialCapital) {
        let cash = initialCapital;
        let shares = 0;
        let position = null;
        const trades = [];
        const equityCurve = [];

        for (let i = 0; i < data.length; i++) {
            const price = data[i].close;
            const signal = signals[i];
            const portfolioValue = cash + shares * price;

            equityCurve.push({
                date: data[i].date,
                value: portfolioValue,
                benchmark: (data[i].close / data[0].close) * initialCapital
            });

            if (signal.signal === 'buy' && shares === 0) {
                // Apply slippage
                const executionPrice = price * (1 + this.slippage);
                // Calculate commission
                const maxShares = Math.floor(cash / executionPrice);
                const commission = maxShares * executionPrice * this.commissionRate;
                shares = Math.floor((cash - commission) / executionPrice);
                const value = shares * executionPrice + commission;
                cash -= value;

                position = {
                    entryDate: data[i].date,
                    entryPrice: executionPrice,
                    shares,
                    signal: signal.reason
                };

                trades.push({
                    date: data[i].date,
                    type: 'buy',
                    price: executionPrice,
                    shares,
                    value,
                    signal: signal.reason,
                    portfolioValue
                });
            } else if (signal.signal === 'sell' && shares > 0 && position) {
                // Apply slippage
                const executionPrice = price * (1 - this.slippage);
                const value = shares * executionPrice;
                const commission = value * this.commissionRate;
                cash += value - commission;

                const profit = (executionPrice - position.entryPrice) * shares - commission;
                const profitPercent = ((executionPrice / position.entryPrice) - 1) * 100;

                trades.push({
                    date: data[i].date,
                    type: 'sell',
                    price: executionPrice,
                    shares,
                    value: value - commission,
                    signal: signal.reason,
                    profit,
                    profitPercent,
                    portfolioValue: cash
                });

                shares = 0;
                position = null;
            }
        }

        // Close any open position at end
        if (shares > 0) {
            const finalPrice = data[data.length - 1].close * (1 - this.slippage);
            const value = shares * finalPrice;
            const commission = value * this.commissionRate;
            cash += value - commission;

            if (position) {
                const profit = (finalPrice - position.entryPrice) * shares - commission;
                trades.push({
                    date: data[data.length - 1].date,
                    type: 'sell',
                    price: finalPrice,
                    shares,
                    value: value - commission,
                    signal: 'End of backtest',
                    profit,
                    profitPercent: ((finalPrice / position.entryPrice) - 1) * 100,
                    portfolioValue: cash
                });
            }
        }

        return { trades, equityCurve, finalValue: cash };
    }

    calculateMetrics(simulation, data, initialCapital) {
        const { trades, equityCurve, finalValue } = simulation;

        const totalReturn = finalValue - initialCapital;
        const totalReturnPercent = (totalReturn / initialCapital) * 100;

        // Annualized return
        const days = (data[data.length - 1].date - data[0].date) / (1000 * 60 * 60 * 24);
        const years = days / 365;
        const annualizedReturn = years > 0 ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100 : 0;

        // Trade statistics
        const sellTrades = trades.filter(t => t.type === 'sell');
        const profitableTrades = sellTrades.filter(t => t.profit > 0);
        const losingTrades = sellTrades.filter(t => t.profit <= 0);

        const winRate = sellTrades.length > 0 ? (profitableTrades.length / sellTrades.length) * 100 : 0;

        const avgWin = profitableTrades.length > 0
            ? profitableTrades.reduce((sum, t) => sum + t.profitPercent, 0) / profitableTrades.length
            : 0;
        const avgLoss = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + t.profitPercent, 0) / losingTrades.length
            : 0;

        const largestWin = profitableTrades.length > 0
            ? Math.max(...profitableTrades.map(t => t.profitPercent))
            : 0;
        const largestLoss = losingTrades.length > 0
            ? Math.min(...losingTrades.map(t => t.profitPercent))
            : 0;

        // Profit factor
        const totalGains = profitableTrades.reduce((sum, t) => sum + t.profit, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
        const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0;

        // Drawdown
        let maxValue = initialCapital;
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;

        for (const point of equityCurve) {
            if (point.value > maxValue) maxValue = point.value;
            const drawdown = maxValue - point.value;
            const drawdownPercent = (drawdown / maxValue) * 100;
            if (drawdownPercent > maxDrawdownPercent) {
                maxDrawdown = drawdown;
                maxDrawdownPercent = drawdownPercent;
            }
        }

        // Volatility (daily returns std dev * sqrt(252))
        const returns = [];
        for (let i = 1; i < equityCurve.length; i++) {
            returns.push((equityCurve[i].value / equityCurve[i - 1].value) - 1);
        }
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

        // Sharpe Ratio (assuming risk-free rate of 2%)
        const riskFreeRate = 0.02;
        const excessReturn = (annualizedReturn / 100) - riskFreeRate;
        const sharpeRatio = volatility > 0 ? (excessReturn / (volatility / 100)) : 0;

        // Calmar Ratio
        const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;

        return {
            finalValue: Math.round(finalValue * 100) / 100,
            totalReturn: Math.round(totalReturn * 100) / 100,
            totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
            annualizedReturn: Math.round(annualizedReturn * 100) / 100,
            sharpeRatio: Math.round(sharpeRatio * 100) / 100,
            maxDrawdown: Math.round(maxDrawdown * 100) / 100,
            maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
            winRate: Math.round(winRate * 100) / 100,
            totalTrades: sellTrades.length,
            profitableTrades: profitableTrades.length,
            losingTrades: losingTrades.length,
            averageWin: Math.round(avgWin * 100) / 100,
            averageLoss: Math.round(avgLoss * 100) / 100,
            largestWin: Math.round(largestWin * 100) / 100,
            largestLoss: Math.round(largestLoss * 100) / 100,
            profitFactor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
            volatility: Math.round(volatility * 100) / 100,
            calmarRatio: Math.round(calmarRatio * 100) / 100
        };
    }

    calculateMonthlyPerformance(trades, data) {
        const monthly = {};

        // Group trades by month
        for (const trade of trades) {
            if (trade.type !== 'sell') continue;
            const key = `${trade.date.getFullYear()}-${String(trade.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) {
                monthly[key] = { trades: 0, returns: [] };
            }
            monthly[key].trades++;
            monthly[key].returns.push(trade.profitPercent);
        }

        // Calculate monthly stats
        return Object.entries(monthly).map(([key, stats]) => {
            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
                month: monthNames[parseInt(month) - 1],
                year: parseInt(year),
                return: Math.round(stats.returns.reduce((a, b) => a + b, 0) * 100) / 100,
                trades: stats.trades,
                winRate: Math.round((stats.returns.filter(r => r > 0).length / stats.returns.length) * 100)
            };
        }).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return new Date(`${a.month} 1, 2000`) - new Date(`${b.month} 1, 2000`);
        });
    }
}

module.exports = BacktestEngine;
