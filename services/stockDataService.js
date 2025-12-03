// server/services/stockDataService.js - REAL STOCK DATA FROM ALPHA VANTAGE

const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

class StockDataService {
    /**
     * Get current stock price
     */
    async getCurrentPrice(symbol) {
        try {
            const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
                params: {
                    function: 'GLOBAL_QUOTE',
                    symbol: symbol,
                    apikey: ALPHA_VANTAGE_API_KEY
                },
                timeout: 10000
            });

            const quote = response.data['Global Quote'];
            
            if (!quote || !quote['05. price']) {
                throw new Error('No price data available');
            }

            return {
                symbol: symbol,
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
                volume: parseInt(quote['06. volume']),
                previousClose: parseFloat(quote['08. previous close']),
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                timestamp: quote['07. latest trading day']
            };
        } catch (error) {
            console.error(`❌ Error fetching price for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get historical daily data for predictions
     */
    async getHistoricalData(symbol, days = 100) {
        try {
            const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
                params: {
                    function: 'TIME_SERIES_DAILY',
                    symbol: symbol,
                    apikey: ALPHA_VANTAGE_API_KEY,
                    outputsize: days > 100 ? 'full' : 'compact'
                },
                timeout: 15000
            });

            const timeSeries = response.data['Time Series (Daily)'];
            
            if (!timeSeries) {
                throw new Error('No historical data available');
            }

            // Convert to array format
            const historicalData = Object.entries(timeSeries)
                .slice(0, days)
                .map(([date, data]) => ({
                    date: date,
                    open: parseFloat(data['1. open']),
                    high: parseFloat(data['2. high']),
                    low: parseFloat(data['3. low']),
                    close: parseFloat(data['4. close']),
                    volume: parseInt(data['5. volume'])
                }))
                .reverse(); // Oldest to newest

            return historicalData;
        } catch (error) {
            console.error(`❌ Error fetching historical data for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get intraday data (for short-term predictions)
     */
    async getIntradayData(symbol, interval = '5min') {
        try {
            const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
                params: {
                    function: 'TIME_SERIES_INTRADAY',
                    symbol: symbol,
                    interval: interval,
                    apikey: ALPHA_VANTAGE_API_KEY,
                    outputsize: 'compact'
                },
                timeout: 15000
            });

            const timeSeries = response.data[`Time Series (${interval})`];
            
            if (!timeSeries) {
                throw new Error('No intraday data available');
            }

            const intradayData = Object.entries(timeSeries)
                .slice(0, 100)
                .map(([datetime, data]) => ({
                    datetime: datetime,
                    open: parseFloat(data['1. open']),
                    high: parseFloat(data['2. high']),
                    low: parseFloat(data['3. low']),
                    close: parseFloat(data['4. close']),
                    volume: parseInt(data['5. volume'])
                }))
                .reverse();

            return intradayData;
        } catch (error) {
            console.error(`❌ Error fetching intraday data for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Calculate technical indicators
     */
    calculateIndicators(historicalData) {
        const closes = historicalData.map(d => d.close);
        
        // RSI (Relative Strength Index)
        const rsi = this.calculateRSI(closes, 14);
        
        // Moving Averages
        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        
        // MACD
        const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
        
        // Bollinger Bands
        const bb = this.calculateBollingerBands(closes, 20, 2);
        
        // Volume analysis
        const volumes = historicalData.map(d => d.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];
        
        return {
            rsi: {
                value: rsi[rsi.length - 1].toFixed(2),
                signal: rsi[rsi.length - 1] > 70 ? 'SELL' : rsi[rsi.length - 1] < 30 ? 'BUY' : 'HOLD'
            },
            macd: {
                value: macd.toFixed(2),
                signal: macd > 0 ? 'BUY' : 'SELL'
            },
            sma20: {
                value: sma20[sma20.length - 1].toFixed(2),
                signal: closes[closes.length - 1] > sma20[sma20.length - 1] ? 'BUY' : 'SELL'
            },
            sma50: {
                value: sma50[sma50.length - 1].toFixed(2),
                signal: closes[closes.length - 1] > sma50[sma50.length - 1] ? 'BUY' : 'SELL'
            },
            bollingerBands: {
                upper: bb.upper.toFixed(2),
                middle: bb.middle.toFixed(2),
                lower: bb.lower.toFixed(2),
                signal: closes[closes.length - 1] > bb.upper ? 'SELL' : 
                        closes[closes.length - 1] < bb.lower ? 'BUY' : 'HOLD'
            },
            volume: {
                current: currentVolume,
                average: Math.round(avgVolume),
                signal: currentVolume > avgVolume * 1.5 ? 'HIGH' : 'NORMAL'
            }
        };
    }

    // Technical indicator calculations
    calculateRSI(closes, period = 14) {
        const rsi = [];
        const gains = [];
        const losses = [];

        for (let i = 1; i < closes.length; i++) {
            const difference = closes[i] - closes[i - 1];
            gains.push(difference > 0 ? difference : 0);
            losses.push(difference < 0 ? Math.abs(difference) : 0);
        }

        for (let i = period; i < gains.length; i++) {
            const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b) / period;
            const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b) / period;
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }

        return rsi;
    }

    calculateSMA(data, period) {
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
            sma.push(sum / period);
        }
        return sma;
    }

    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        ema[0] = data[0];

        for (let i = 1; i < data.length; i++) {
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }

        return ema;
    }

    calculateBollingerBands(data, period, stdDev) {
        const sma = this.calculateSMA(data, period);
        const lastSMA = sma[sma.length - 1];
        
        const squaredDifferences = data.slice(-period).map(val => Math.pow(val - lastSMA, 2));
        const variance = squaredDifferences.reduce((a, b) => a + b) / period;
        const standardDeviation = Math.sqrt(variance);
        
        return {
            upper: lastSMA + (standardDeviation * stdDev),
            middle: lastSMA,
            lower: lastSMA - (standardDeviation * stdDev)
        };
    }
}

module.exports = new StockDataService();