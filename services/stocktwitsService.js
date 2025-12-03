// server/services/stocktwitsService.js - FREE StockTwits API Integration

const axios = require('axios');

class StockTwitsService {
    constructor() {
        this.baseURL = 'https://api.stocktwits.com/api/2';
    }

    /**
     * Get stream of messages for a specific symbol
     */
    async getSymbolStream(symbol, limit = 30) {
        try {
            console.log(`📊 Fetching StockTwits data for $${symbol}...`);
            
            const response = await axios.get(`${this.baseURL}/streams/symbol/${symbol}.json`, {
                params: { limit: Math.min(limit, 30) }
            });

            const messages = response.data.messages || [];
            
            console.log(`✅ Found ${messages.length} messages for $${symbol}`);
            
            return messages.map(msg => ({
                id: msg.id,
                text: msg.body,
                created_at: msg.created_at,
                sentiment: msg.entities?.sentiment?.basic || 'neutral', // bullish/bearish/neutral
                likes: msg.likes?.total || 0,
                reshares: msg.reshares?.reshare_count || 0,
                author: {
                    username: msg.user?.username || 'unknown',
                    name: msg.user?.name || 'Unknown',
                    followers: msg.user?.followers || 0,
                    verified: msg.user?.official || false
                },
                source: 'stocktwits'
            }));
            
        } catch (error) {
            console.error(`❌ StockTwits error for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Analyze sentiment from StockTwits messages
     */
    analyzeSentiment(messages) {
        if (!messages || messages.length === 0) {
            return {
                overall: 'neutral',
                bullish: 0,
                bearish: 0,
                neutral: 0,
                total: 0,
                bullishPercentage: 0,
                bearishPercentage: 0,
                neutralPercentage: 0,
                tweets: []
            };
        }

        let bullishCount = 0;
        let bearishCount = 0;
        let neutralCount = 0;

        // StockTwits provides sentiment labels
        const analyzedMessages = messages.map(msg => {
            const sentiment = msg.sentiment?.toLowerCase() || 'neutral';
            
            if (sentiment === 'bullish') {
                bullishCount++;
            } else if (sentiment === 'bearish') {
                bearishCount++;
            } else {
                neutralCount++;
            }

            return {
                ...msg,
                sentiment: {
                    classification: sentiment,
                    score: sentiment === 'bullish' ? 1 : sentiment === 'bearish' ? -1 : 0
                }
            };
        });

        const total = messages.length;
        const bullishPercentage = (bullishCount / total) * 100;
        const bearishPercentage = (bearishCount / total) * 100;
        const neutralPercentage = (neutralCount / total) * 100;

        // Determine overall sentiment
        let overall = 'neutral';
        if (bullishPercentage > 50) {
            overall = 'bullish';
        } else if (bearishPercentage > 50) {
            overall = 'bearish';
        } else if (bullishPercentage > bearishPercentage + 15) {
            overall = 'bullish';
        } else if (bearishPercentage > bullishPercentage + 15) {
            overall = 'bearish';
        }

        return {
            overall,
            bullish: bullishCount,
            bearish: bearishCount,
            neutral: neutralCount,
            total,
            bullishPercentage: parseFloat(bullishPercentage.toFixed(1)),
            bearishPercentage: parseFloat(bearishPercentage.toFixed(1)),
            neutralPercentage: parseFloat(neutralPercentage.toFixed(1)),
            tweets: analyzedMessages
        };
    }

    /**
     * Get trending symbols
     */
    async getTrending(limit = 10) {
        try {
            console.log('🔥 Fetching trending symbols from StockTwits...');
            
            const response = await axios.get(`${this.baseURL}/trending/symbols.json`, {
                params: { limit: Math.min(limit, 30) }
            });

            const symbols = response.data.symbols || [];
            
            console.log(`✅ Found ${symbols.length} trending symbols`);
            
            return symbols.map(s => ({
                symbol: s.symbol,
                title: s.title,
                mentions: s.watchlist_count || 0,
                score: s.watchlist_count || 0
            }));
            
        } catch (error) {
            console.error('❌ StockTwits trending error:', error.message);
            throw error;
        }
    }
}

module.exports = new StockTwitsService();