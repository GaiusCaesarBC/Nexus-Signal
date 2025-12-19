// server/services/sentimentService.js - Financial News Sentiment Analysis

const axios = require('axios');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const NEWS_API_KEY = process.env.NEWS_API_KEY || 'demo'; // We'll use free sources first
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const newsCache = new Map();

// Properly sanitize HTML - strip tags AND decode common HTML entities
// Uses iterative stripping to handle nested/malformed tags
function sanitizeHtml(text) {
    if (!text || typeof text !== 'string') return '';

    // Iteratively strip HTML tags until none remain (handles nested tags)
    let stripped = text;
    let previous;
    do {
        previous = stripped;
        stripped = stripped.replace(/<[^>]*>/g, '');
    } while (stripped !== previous);

    // Entity decode map - single pass to avoid double-decoding
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
        '&#x27;': "'",
        '&#x2F;': '/',
        '&apos;': "'"
    };

    // Single-pass replacement using regex alternation
    const entityPattern = /&(?:amp|lt|gt|quot|nbsp|apos|#39|#x27|#x2F);/g;
    const decoded = stripped.replace(entityPattern, match => entities[match] || match);

    return decoded.trim();
}

/**
 * Fetch news articles for a stock symbol
 */
async function fetchNewsArticles(symbol) {
    try {
        const cacheKey = `news-${symbol}`;
        const cached = newsCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[Sentiment] Using cached news for ${symbol}`);
            return cached.articles;
        }

        console.log(`[Sentiment] Fetching news for ${symbol}`);
        
        const articles = [];
        
        // Method 1: Yahoo Finance RSS (Free, no API key needed)
        try {
            const yahooUrl = `https://finance.yahoo.com/rss/headline?s=${symbol}`;
            const response = await axios.get(yahooUrl, { timeout: 5000 });
            
            // Parse RSS feed (simple XML parsing)
            const items = response.data.match(/<item>(.*?)<\/item>/gs) || [];
            
            for (const item of items.slice(0, 10)) { // Take top 10
                const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
                const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
                
                if (titleMatch && descMatch) {
                    articles.push({
                        title: sanitizeHtml(titleMatch[1]),
                        description: sanitizeHtml(descMatch[1]),
                        source: 'Yahoo Finance'
                    });
                }
            }
        } catch (error) {
            console.log(`[Sentiment] Yahoo RSS failed for ${symbol}:`, error.message);
        }

        // Method 2: Fallback to Google News (Free, scraping)
        if (articles.length === 0) {
            try {
                const query = encodeURIComponent(`${symbol} stock`);
                const googleNewsUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
                
                const response = await axios.get(googleNewsUrl, { timeout: 5000 });
                const items = response.data.match(/<item>(.*?)<\/item>/gs) || [];
                
                for (const item of items.slice(0, 10)) {
                    const titleMatch = item.match(/<title>(.*?)<\/title>/);
                    const descMatch = item.match(/<description>(.*?)<\/description>/);
                    
                    if (titleMatch) {
                        articles.push({
                            title: sanitizeHtml(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '')),
                            description: descMatch ? sanitizeHtml(descMatch[1]) : '',
                            source: 'Google News'
                        });
                    }
                }
            } catch (error) {
                console.log(`[Sentiment] Google News failed for ${symbol}:`, error.message);
            }
        }

        // Cache the results
        if (articles.length > 0) {
            newsCache.set(cacheKey, {
                articles,
                timestamp: Date.now()
            });
        }

        console.log(`[Sentiment] Found ${articles.length} articles for ${symbol}`);
        return articles;

    } catch (error) {
        console.error(`[Sentiment] Error fetching news for ${symbol}:`, error.message);
        return [];
    }
}

/**
 * Analyze sentiment of text
 */
function analyzeSentiment(text) {
    const result = sentiment.analyze(text);
    
    // Normalize score to -1 to 1 range
    const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
    
    let label = 'NEUTRAL';
    if (normalizedScore > 0.2) label = 'POSITIVE';
    if (normalizedScore < -0.2) label = 'NEGATIVE';
    
    return {
        score: normalizedScore,
        label,
        comparative: result.comparative,
        positive: result.positive,
        negative: result.negative
    };
}

/**
 * Get overall sentiment for a stock based on recent news
 */
async function getStockSentiment(symbol) {
    try {
        const articles = await fetchNewsArticles(symbol);
        
        if (articles.length === 0) {
            return {
                score: 0,
                label: 'NEUTRAL',
                confidence: 0,
                articlesAnalyzed: 0,
                summary: 'No recent news found'
            };
        }

        let totalScore = 0;
        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;
        const sentiments = [];

        // Analyze each article
        for (const article of articles) {
            const text = `${article.title} ${article.description}`;
            const sentiment = analyzeSentiment(text);
            
            sentiments.push({
                ...sentiment,
                title: article.title
            });

            totalScore += sentiment.score;
            
            if (sentiment.label === 'POSITIVE') positiveCount++;
            else if (sentiment.label === 'NEGATIVE') negativeCount++;
            else neutralCount++;
        }

        // Calculate average sentiment
        const avgScore = totalScore / articles.length;
        
        // Determine overall label
        let overallLabel = 'NEUTRAL';
        if (avgScore > 0.15) overallLabel = 'POSITIVE';
        if (avgScore < -0.15) overallLabel = 'NEGATIVE';

        // Calculate confidence based on agreement between articles
        const maxCount = Math.max(positiveCount, negativeCount, neutralCount);
        const confidence = (maxCount / articles.length) * 100;

        return {
            score: avgScore,
            label: overallLabel,
            confidence: Math.round(confidence),
            articlesAnalyzed: articles.length,
            breakdown: {
                positive: positiveCount,
                negative: negativeCount,
                neutral: neutralCount
            },
            summary: generateSummary(overallLabel, positiveCount, negativeCount, neutralCount),
            topSentiments: sentiments.slice(0, 5) // Top 5 for debugging
        };

    } catch (error) {
        console.error(`[Sentiment] Error analyzing ${symbol}:`, error.message);
        return {
            score: 0,
            label: 'NEUTRAL',
            confidence: 0,
            articlesAnalyzed: 0,
            summary: 'Error analyzing sentiment'
        };
    }
}

/**
 * Generate human-readable summary
 */
function generateSummary(label, positive, negative, neutral) {
    const total = positive + negative + neutral;
    
    if (label === 'POSITIVE') {
        return `Strong positive sentiment: ${positive}/${total} articles are bullish`;
    } else if (label === 'NEGATIVE') {
        return `Strong negative sentiment: ${negative}/${total} articles are bearish`;
    } else {
        return `Mixed sentiment: Market opinion is divided`;
    }
}

/**
 * Get sentiment signal for predictions (-1 to 1)
 * This will be used to adjust our predictions
 */
async function getSentimentSignal(symbol) {
    const sentiment = await getStockSentiment(symbol);
    
    // Weight the signal by confidence
    const weightedScore = sentiment.score * (sentiment.confidence / 100);
    
    return {
        signal: weightedScore, // -1 (very bearish) to 1 (very bullish)
        confidence: sentiment.confidence,
        label: sentiment.label,
        summary: sentiment.summary
    };
}

module.exports = {
    fetchNewsArticles,
    analyzeSentiment,
    getStockSentiment,
    getSentimentSignal
};