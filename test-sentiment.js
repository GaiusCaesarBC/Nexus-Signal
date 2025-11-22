// server/test-sentiment.js - Test sentiment analysis

const { getStockSentiment } = require('./services/sentimentService');

async function test() {
    console.log('Testing sentiment analysis...\n');
    
    const symbols = ['AAPL', 'TSLA', 'NVDA'];
    
    for (const symbol of symbols) {
        console.log(`\n========== ${symbol} ==========`);
        const sentiment = await getStockSentiment(symbol);
        console.log(JSON.stringify(sentiment, null, 2));
    }
}

test();