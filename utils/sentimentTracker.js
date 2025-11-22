// server/utils/sentimentTracker.js - Track aggregate sentiment across platform

class SentimentTracker {
    constructor() {
        this.reset();
    }

    reset() {
        this.totalSearches = 0;
        this.totalTweets = 0;
        this.totalBullish = 0;
        this.totalBearish = 0;
        this.totalNeutral = 0;
        this.lastReset = new Date();
    }

    addSearch(sentimentData) {
        this.totalSearches++;
        this.totalTweets += sentimentData.total || 0;
        this.totalBullish += sentimentData.bullish || 0;
        this.totalBearish += sentimentData.bearish || 0;
        this.totalNeutral += sentimentData.neutral || 0;

        console.log(`[Tracker] Updated: ${this.totalSearches} searches, ${this.totalTweets} tweets analyzed`);
    }

    getStats() {
        if (this.totalTweets === 0) {
            return {
                bullishPercentage: 0,
                bearishPercentage: 0,
                neutralPercentage: 0,
                totalTweets: 0,
                totalSearches: 0,
                overall: 'neutral'
            };
        }

        const bullishPercentage = Math.round((this.totalBullish / this.totalTweets) * 100);
        const bearishPercentage = Math.round((this.totalBearish / this.totalTweets) * 100);
        const neutralPercentage = 100 - bullishPercentage - bearishPercentage;

        let overall = 'neutral';
        if (bullishPercentage > 50) overall = 'bullish';
        else if (bearishPercentage > 50) overall = 'bearish';
        else if (bullishPercentage > bearishPercentage + 15) overall = 'bullish';
        else if (bearishPercentage > bullishPercentage + 15) overall = 'bearish';

        return {
            bullishPercentage,
            bearishPercentage,
            neutralPercentage,
            totalTweets: this.totalTweets,
            totalSearches: this.totalSearches,
            overall,
            lastReset: this.lastReset
        };
    }
}

module.exports = new SentimentTracker();