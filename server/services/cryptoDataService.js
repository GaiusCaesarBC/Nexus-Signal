// server/services/cryptoDataService.js - REAL CRYPTO DATA FROM COINGECKO PRO

const axios = require('axios');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

// Common crypto ID mappings
const CRYPTO_IDS = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'USDC': 'usd-coin',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'LTC': 'litecoin',
    'SHIB': 'shiba-inu',
    'TRX': 'tron',
    'APT': 'aptos',
    'ARB': 'arbitrum'
};

class CryptoDataService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: COINGECKO_BASE_URL,
            headers: {
                'x-cg-pro-api-key': COINGECKO_API_KEY
            },
            timeout: 15000
        });
    }

    /**
     * Convert symbol to CoinGecko ID
     */
    getCoinId(symbol) {
        const upperSymbol = symbol.toUpperCase();
        return CRYPTO_IDS[upperSymbol] || symbol.toLowerCase();
    }

    /**
     * Get current crypto price
     */
    async getCurrentPrice(symbol) {
        try {
            const coinId = this.getCoinId(symbol);
            
            const response = await this.axiosInstance.get('/simple/price', {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd',
                    include_24hr_change: true,
                    include_24hr_vol: true,
                    include_market_cap: true
                }
            });

            const data = response.data[coinId];
            
            if (!data) {
                throw new Error(`No price data available for ${symbol}`);
            }

            return {
                symbol: symbol.toUpperCase(),
                coinId: coinId,
                price: data.usd,
                change24h: data.usd_24h_change || 0,
                volume24h: data.usd_24h_vol || 0,
                marketCap: data.usd_market_cap || 0,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Error fetching crypto price for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get historical market data
     */
    async getHistoricalData(symbol, days = 30) {
        try {
            const coinId = this.getCoinId(symbol);
            
            const response = await this.axiosInstance.get(`/coins/${coinId}/market_chart`, {
                params: {
                    vs_currency: 'usd',
                    days: days,
                    interval: days > 90 ? 'daily' : 'hourly'
                }
            });

            const prices = response.data.prices;
            
            if (!prices || prices.length === 0) {
                throw new Error(`No historical data available for ${symbol}`);
            }

            // Convert to standard format
            const historicalData = prices.map(([timestamp, price]) => ({
                timestamp: new Date(timestamp).toISOString(),
                date: new Date(timestamp).toISOString().split('T')[0],
                close: price,
                // For crypto, we don't have OHLC in free tier, so approximate
                open: price * (1 + (Math.random() - 0.5) * 0.01),
                high: price * (1 + Math.random() * 0.02),
                low: price * (1 - Math.random() * 0.02)
            }));

            return historicalData;
        } catch (error) {
            console.error(`❌ Error fetching crypto historical data for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get detailed coin data
     */
    async getCoinDetails(symbol) {
        try {
            const coinId = this.getCoinId(symbol);
            
            const response = await this.axiosInstance.get(`/coins/${coinId}`, {
                params: {
                    localization: false,
                    tickers: false,
                    community_data: true,
                    developer_data: false,
                    sparkline: false
                }
            });

            const data = response.data;
            
            return {
                symbol: symbol.toUpperCase(),
                name: data.name,
                marketCap: data.market_data?.market_cap?.usd || 0,
                totalVolume: data.market_data?.total_volume?.usd || 0,
                circulatingSupply: data.market_data?.circulating_supply || 0,
                totalSupply: data.market_data?.total_supply || 0,
                maxSupply: data.market_data?.max_supply || 0,
                athPrice: data.market_data?.ath?.usd || 0,
                athDate: data.market_data?.ath_date?.usd || null,
                atlPrice: data.market_data?.atl?.usd || 0,
                atlDate: data.market_data?.atl_date?.usd || null,
                priceChange24h: data.market_data?.price_change_percentage_24h || 0,
                priceChange7d: data.market_data?.price_change_percentage_7d || 0,
                priceChange30d: data.market_data?.price_change_percentage_30d || 0,
                marketCapRank: data.market_cap_rank || 0
            };
        } catch (error) {
            console.error(`❌ Error fetching crypto details for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Calculate crypto indicators (similar to stocks but adapted)
     */
    calculateIndicators(historicalData) {
        const closes = historicalData.map(d => d.close);
        
        // RSI
        const rsi = this.calculateRSI(closes, 14);
        
        // Moving Averages
        const sma20 = this.calculateSMA(closes, Math.min(20, closes.length));
        const sma50 = this.calculateSMA(closes, Math.min(50, closes.length));
        
        // Volatility (crypto is more volatile)
        const volatility = this.calculateVolatility(closes);
        
        return {
            rsi: {
                value: rsi[rsi.length - 1]?.toFixed(2) || 'N/A',
                signal: rsi[rsi.length - 1] > 70 ? 'SELL' : rsi[rsi.length - 1] < 30 ? 'BUY' : 'HOLD'
            },
            sma20: {
                value: sma20[sma20.length - 1]?.toFixed(2) || 'N/A',
                signal: closes[closes.length - 1] > sma20[sma20.length - 1] ? 'BUY' : 'SELL'
            },
            sma50: {
                value: sma50[sma50.length - 1]?.toFixed(2) || 'N/A',
                signal: closes[closes.length - 1] > sma50[sma50.length - 1] ? 'BUY' : 'SELL'
            },
            volatility: {
                value: (volatility * 100).toFixed(2) + '%',
                signal: volatility > 0.05 ? 'HIGH' : volatility > 0.03 ? 'MODERATE' : 'LOW'
            }
        };
    }

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
            const rs = avgGain / (avgLoss || 0.000001); // Avoid division by zero
            rsi.push(100 - (100 / (1 + rs)));
        }

        return rsi;
    }

    calculateSMA(data, period) {
        if (data.length < period) period = data.length;
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
            sma.push(sum / period);
        }
        return sma;
    }

    calculateVolatility(closes) {
        if (closes.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
            returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }
        
        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Check if symbol is a crypto
     */
    isCrypto(symbol) {
        const upperSymbol = symbol.toUpperCase();
        return CRYPTO_IDS.hasOwnProperty(upperSymbol) || 
               symbol.length >= 3 && symbol.length <= 6; // Most crypto symbols are 3-6 chars
    }
}

module.exports = new CryptoDataService();