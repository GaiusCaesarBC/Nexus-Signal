// server/services/twitterSentimentService.js - REAL TWITTER SENTIMENT ANALYSIS

const { TwitterApi } = require('twitter-api-v2');
const Sentiment = require('sentiment');

const sentiment = new Sentiment();

class TwitterSentimentService {
    constructor() {
        this.client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
        this.readOnlyClient = this.client.readOnly;
    }

    /**
     * Search tweets for a specific stock/crypto symbol
     */
    async searchTweets(symbol, maxResults = 100) {
        try {
            const query = `$${symbol.toUpperCase()} -is:retweet lang:en`;
            
            console.log(`🐦 Searching Twitter for: ${query}`);
            
            const tweets = await this.readOnlyClient.v2.search({
                query: query,
                max_results: Math.min(maxResults, 100),
                'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
                expansions: ['author_id'],
                'user.fields': ['username', 'name', 'verified']
            });

            const results = [];
            
            for await (const tweet of tweets) {
                const author = tweets.includes?.users?.find(u => u.id === tweet.author_id);
                
                results.push({
                    id: tweet.id,
                    text: tweet.text,
                    created_at: tweet.created_at,
                    likes: tweet.public_metrics?.like_count || 0,
                    retweets: tweet.public_metrics?.retweet_count || 0,
                    replies: tweet.public_metrics?.reply_count || 0,
                    author: {
                        username: author?.username || 'unknown',
                        name: author?.name || 'Unknown',
                        verified: author?.verified || false
                    }
                });
            }

            console.log(`✅ Found ${results.length} tweets for $${symbol}`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Twitter search error for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Analyze sentiment of tweets
     */
    analyzeSentiment(tweets) {
        if (!tweets || tweets.length === 0) {
            return {
                overall: 'neutral',
                score: 0,
                bullish: 0,
                bearish: 0,
                neutral: 0,
                total: 0
            };
        }

        let bullishCount = 0;
        let bearishCount = 0;
        let neutralCount = 0;
        let totalScore = 0;

        const analyzedTweets = tweets.map(tweet => {
            const analysis = sentiment.analyze(tweet.text);
            const score = analysis.score;
            
            // Classify sentiment
            let classification;
            if (score > 2) {
                classification = 'bullish';
                bullishCount++;
            } else if (score < -2) {
                classification = 'bearish';
                bearishCount++;
            } else {
                classification = 'neutral';
                neutralCount++;
            }

            totalScore += score;

            return {
                ...tweet,
                sentiment: {
                    score: score,
                    classification: classification,
                    positive: analysis.positive,
                    negative: analysis.negative
                }
            };
        });

        const total = tweets.length;
        const averageScore = totalScore / total;
        
        // Determine overall sentiment
        let overall;
        if (bullishCount > bearishCount * 1.5) {
            overall = 'bullish';
        } else if (bearishCount > bullishCount * 1.5) {
            overall = 'bearish';
        } else {
            overall = 'neutral';
        }

        const bullishPercentage = (bullishCount / total) * 100;
        const bearishPercentage = (bearishCount / total) * 100;
        const neutralPercentage = (neutralCount / total) * 100;

        return {
            overall: overall,
            score: averageScore,
            bullish: bullishCount,
            bearish: bearishCount,
            neutral: neutralCount,
            total: total,
            bullishPercentage: parseFloat(bullishPercentage.toFixed(1)),
            bearishPercentage: parseFloat(bearishPercentage.toFixed(1)),
            neutralPercentage: parseFloat(neutralPercentage.toFixed(1)),
            tweets: analyzedTweets
        };
    }

    /**
     * Get trending stocks from Twitter
     */
    async getTrendingStocks(limit = 10) {
        try {
            // Popular stock ticker symbols to check
            const popularTickers = [
                'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META',
                'AMD', 'NFLX', 'DIS', 'GME', 'AMC', 'PLTR', 'BABA',
                'SPY', 'QQQ', 'COIN', 'RBLX', 'SNAP', 'UBER'
            ];

            console.log('🔥 Fetching trending stocks from Twitter...');

            const trending = [];

            // Check mentions for each ticker
            for (const ticker of popularTickers.slice(0, limit)) {
                try {
                    const query = `$${ticker} -is:retweet lang:en`;
                    
                    const tweets = await this.readOnlyClient.v2.search({
                        query: query,
                        max_results: 10,
                        'tweet.fields': ['created_at', 'public_metrics']
                    });

                    let count = 0;
                    let totalEngagement = 0;

                    for await (const tweet of tweets) {
                        count++;
                        totalEngagement += (tweet.public_metrics?.like_count || 0) + 
                                         (tweet.public_metrics?.retweet_count || 0);
                    }

                    if (count > 0) {
                        trending.push({
                            symbol: ticker,
                            mentions: count,
                            engagement: totalEngagement,
                            score: count + (totalEngagement / 10) // Weighted score
                        });
                    }

                    // Rate limiting - wait between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.log(`⚠️ Skipping ${ticker}:`, error.message);
                }
            }

            // Sort by score
            trending.sort((a, b) => b.score - a.score);

            console.log(`✅ Found ${trending.length} trending stocks`);

            return trending.slice(0, limit);
            
        } catch (error) {
            console.error('❌ Error fetching trending stocks:', error);
            throw error;
        }
    }

    /**
     * Get crypto sentiment from Twitter
     */
    async getCryptoSentiment(symbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'MATIC']) {
        try {
            console.log('💰 Fetching crypto sentiment from Twitter...');

            const results = [];

            for (const symbol of symbols) {
                try {
                    const tweets = await this.searchTweets(symbol, 50);
                    const analysis = this.analyzeSentiment(tweets);

                    results.push({
                        symbol: symbol,
                        sentiment: analysis.overall,
                        score: analysis.score,
                        bullishPercentage: analysis.bullishPercentage,
                        bearishPercentage: analysis.bearishPercentage,
                        tweetCount: analysis.total
                    });

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.log(`⚠️ Skipping ${symbol}:`, error.message);
                }
            }

            console.log(`✅ Analyzed ${results.length} cryptos`);

            return results;
            
        } catch (error) {
            console.error('❌ Error fetching crypto sentiment:', error);
            throw error;
        }
    }

    /**
     * Get overall market sentiment
     */
    async getMarketSentiment() {
        try {
            console.log('📊 Analyzing overall market sentiment...');

            // Check major index tickers
            const indices = ['SPY', 'QQQ', 'DIA'];
            const allTweets = [];

            for (const index of indices) {
                try {
                    const tweets = await this.searchTweets(index, 30);
                    allTweets.push(...tweets);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log(`⚠️ Skipping ${index}`);
                }
            }

            const analysis = this.analyzeSentiment(allTweets);

            console.log(`✅ Market sentiment: ${analysis.overall.toUpperCase()}`);

            return {
                overall: analysis.overall,
                bullishPercentage: analysis.bullishPercentage,
                bearishPercentage: analysis.bearishPercentage,
                neutralPercentage: analysis.neutralPercentage,
                totalTweets: analysis.total,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error getting market sentiment:', error);
            throw error;
        }
    }
}

module.exports = new TwitterSentimentService();