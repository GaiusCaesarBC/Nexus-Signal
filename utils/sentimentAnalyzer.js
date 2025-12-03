// server/utils/sentimentAnalyzer.js - FREE Keyword-Based Analysis

// Keywords for sentiment classification
const BULLISH_KEYWORDS = [
    'bullish', 'buy', 'long', 'calls', 'moon', 'rocket', '🚀', '📈', 
    'breakout', 'strong', 'pump', 'rally', 'surge', 'gains', 'uptrend',
    'support', 'accumulation', 'buying', 'momentum', 'squeeze'
];

const BEARISH_KEYWORDS = [
    'bearish', 'sell', 'short', 'puts', 'crash', 'dump', 'drop', 'fall',
    'weak', 'decline', 'downtrend', 'resistance', 'selling', 'profit',
    'warning', 'concern', 'risk', 'pullback', 'correction'
];

/**
 * Analyze sentiment of a single tweet using keywords
 */
const analyzeTweet = (tweetText) => {
    const lowerText = tweetText.toLowerCase();
    
    // Count keyword matches
    const bullishCount = BULLISH_KEYWORDS.filter(word => lowerText.includes(word)).length;
    const bearishCount = BEARISH_KEYWORDS.filter(word => lowerText.includes(word)).length;
    
    // Determine sentiment
    let sentiment = 'NEUTRAL';
    let confidence = 50;
    
    if (bullishCount > bearishCount) {
        sentiment = 'BULLISH';
        confidence = Math.min(50 + (bullishCount * 15), 95);
    } else if (bearishCount > bullishCount) {
        sentiment = 'BEARISH';
        confidence = Math.min(50 + (bearishCount * 15), 95);
    } else if (bullishCount === 0 && bearishCount === 0) {
        confidence = 30; // Low confidence if no keywords
    }
    
    return {
        sentiment,
        confidence,
        reasoning: `Detected ${bullishCount} bullish, ${bearishCount} bearish keywords`
    };
};

/**
 * Analyze sentiment for multiple tweets
 */
const analyzeTweetsBatch = (tweets) => {
    return tweets.map(tweet => ({
        ...tweet,
        sentimentData: analyzeTweet(tweet.text)
    }));
};

/**
 * Calculate overall sentiment from analyzed tweets
 */
const calculateOverallSentiment = (analyzedTweets) => {
    if (!analyzedTweets || analyzedTweets.length === 0) {
        return {
            overallSentiment: 'NEUTRAL',
            bullishPercent: 0,
            bearishPercent: 0,
            neutralPercent: 0,
            totalMentions: 0,
            avgConfidence: 0,
            topTweets: []
        };
    }

    // Weight by engagement
    const weighted = analyzedTweets.map(tweet => {
        const engagement = 
            (tweet.likes || 0) * 1 + 
            (tweet.retweets || 0) * 2 + 
            (tweet.replies || 0) * 0.5;
        
        return {
            ...tweet,
            weight: Math.log(engagement + 1) + 1
        };
    });

    // Count sentiments
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalWeight = 0;
    let weightedBullish = 0;
    let weightedBearish = 0;
    let totalConfidence = 0;

    weighted.forEach(tweet => {
        const sentiment = tweet.sentimentData.sentiment;
        const weight = tweet.weight;
        
        totalWeight += weight;
        totalConfidence += tweet.sentimentData.confidence;

        if (sentiment === 'BULLISH') {
            bullishCount++;
            weightedBullish += weight;
        } else if (sentiment === 'BEARISH') {
            bearishCount++;
            weightedBearish += weight;
        } else {
            neutralCount++;
        }
    });

    // Calculate percentages (weighted)
    const bullishPercent = Math.round((weightedBullish / totalWeight) * 100) || 0;
    const bearishPercent = Math.round((weightedBearish / totalWeight) * 100) || 0;
    const neutralPercent = 100 - bullishPercent - bearishPercent;

    // Determine overall sentiment
    let overallSentiment = 'NEUTRAL';
    if (bullishPercent > 60) overallSentiment = 'BULLISH';
    else if (bearishPercent > 60) overallSentiment = 'BEARISH';
    else if (bullishPercent > bearishPercent + 20) overallSentiment = 'BULLISH';
    else if (bearishPercent > bullishPercent + 20) overallSentiment = 'BEARISH';

    return {
        overallSentiment,
        bullishPercent,
        bearishPercent,
        neutralPercent,
        totalMentions: analyzedTweets.length,
        avgConfidence: Math.round(totalConfidence / analyzedTweets.length),
        topTweets: weighted
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10)
    };
};

/**
 * Main function: Analyze stock sentiment from tweets
 */
const analyzeStockSentiment = (tweets) => {
    console.log(`[Sentiment] Analyzing ${tweets.length} tweets with keyword analysis...`);
    
    const startTime = Date.now();
    
    const analyzedTweets = analyzeTweetsBatch(tweets);
    const sentiment = calculateOverallSentiment(analyzedTweets);
    
    const duration = Date.now() - startTime;
    console.log(`[Sentiment] Analysis complete in ${duration}ms`);
    
    return {
        ...sentiment,
        analyzedAt: new Date(),
        processingTime: duration
    };
};

module.exports = {
    analyzeTweet,
    analyzeTweetsBatch,
    analyzeStockSentiment,
    calculateOverallSentiment
};