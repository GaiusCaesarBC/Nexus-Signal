// server/services/predictionChecker.js - Check Expired Predictions and Calculate Accuracy

const cron = require('node-cron');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

// Map crypto symbols to CoinGecko IDs
const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
    ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot',
    BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap',
    MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron',
    AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
};

// Fetch current stock price from Alpha Vantage
async function fetchStockPrice(symbol) {
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        const data = response.data;

        if (data['Global Quote'] && data['Global Quote']['05. price']) {
            return parseFloat(data['Global Quote']['05. price']);
        }

        console.error(`[PredictionChecker] No price data for stock ${symbol}`);
        return null;
    } catch (error) {
        console.error(`[PredictionChecker] Error fetching stock price for ${symbol}:`, error.message);
        return null;
    }
}

// Fetch current crypto price from CoinGecko
async function fetchCryptoPrice(symbol) {
    try {
        const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
        const params = { ids: coinGeckoId, vs_currencies: 'usd' };

        if (COINGECKO_API_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
        }

        const url = `${COINGECKO_BASE_URL}/simple/price`;
        const response = await axios.get(url, { params });
        const data = response.data;

        if (data[coinGeckoId] && data[coinGeckoId].usd) {
            return data[coinGeckoId].usd;
        }

        console.error(`[PredictionChecker] No price data for crypto ${symbol}`);
        return null;
    } catch (error) {
        console.error(`[PredictionChecker] Error fetching crypto price for ${symbol}:`, error.message);
        return null;
    }
}

// Fetch current price based on asset type
async function fetchCurrentPrice(symbol, assetType) {
    if (assetType === 'crypto') {
        return await fetchCryptoPrice(symbol);
    } else {
        return await fetchStockPrice(symbol);
    }
}

// Check a single prediction
async function checkPrediction(prediction) {
    try {
        console.log(`[PredictionChecker] Checking prediction ${prediction._id} for ${prediction.symbol}`);

        const currentPrice = await fetchCurrentPrice(prediction.symbol, prediction.assetType);

        if (currentPrice === null) {
            console.log(`[PredictionChecker] Could not fetch price for ${prediction.symbol}, skipping...`);
            return false;
        }

        // Calculate outcome
        await prediction.calculateOutcome(currentPrice);

        console.log(`[PredictionChecker] Prediction ${prediction._id} checked: ${prediction.status}`);
        return true;

    } catch (error) {
        console.error(`[PredictionChecker] Error checking prediction ${prediction._id}:`, error.message);
        return false;
    }
}

// Main function to check all expired predictions
async function checkExpiredPredictions() {
    try {
        console.log('[PredictionChecker] Starting check for expired predictions...');

        // Find all pending predictions that have expired
        const expiredPredictions = await Prediction.find({
            status: 'pending',
            expiresAt: { $lte: new Date() }
        }).limit(50); // Process 50 at a time to avoid overwhelming APIs

        if (expiredPredictions.length === 0) {
            console.log('[PredictionChecker] No expired predictions found.');
            return;
        }

        console.log(`[PredictionChecker] Found ${expiredPredictions.length} expired predictions to check`);

        let checkedCount = 0;
        let successCount = 0;
        let failCount = 0;

        // Check each prediction with a delay to respect API rate limits
        for (const prediction of expiredPredictions) {
            const success = await checkPrediction(prediction);

            if (success) {
                successCount++;
                if (prediction.status === 'correct') checkedCount++;
            } else {
                failCount++;
            }

            // Add delay between API calls (Alpha Vantage: 75/min, CoinGecko: 500/min)
            // Using 1 second delay to be safe
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[PredictionChecker] Check complete: ${successCount} checked, ${failCount} failed, ${checkedCount} correct`);

        // Update user stats for affected users
        const affectedUserIds = [...new Set(expiredPredictions.map(p => p.user.toString()))];
        await updateUserStats(affectedUserIds);

    } catch (error) {
        console.error('[PredictionChecker] Error in checkExpiredPredictions:', error.message);
    }
}

// Update stats for users who had predictions checked
async function updateUserStats(userIds) {
    try {
        console.log(`[PredictionChecker] Updating stats for ${userIds.length} users`);

        for (const userId of userIds) {
            const user = await User.findById(userId);
            if (user) {
                const accuracy = await Prediction.getUserAccuracy(userId);

                // Update user's prediction stats
                user.stats.totalTrades = accuracy.totalPredictions;
                user.stats.winRate = accuracy.accuracy;

                // Calculate streak
                const recentPredictions = await Prediction.find({
                    user: userId,
                    status: { $in: ['correct', 'incorrect'] }
                }).sort({ 'outcome.checkedAt': -1 }).limit(10);

                let currentStreak = 0;
                for (const pred of recentPredictions) {
                    if (pred.status === 'correct') {
                        currentStreak++;
                    } else {
                        break;
                    }
                }

                user.stats.currentStreak = currentStreak;
                user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, currentStreak);
                user.stats.lastUpdated = Date.now();

                await user.save();
                console.log(`[PredictionChecker] Updated stats for user ${userId}`);
            }
        }

    } catch (error) {
        console.error('[PredictionChecker] Error updating user stats:', error.message);
    }
}

// Mark very old pending predictions as expired (cleanup)
async function markStaleAsExpired() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await Prediction.updateMany(
            {
                status: 'pending',
                expiresAt: { $lte: thirtyDaysAgo }
            },
            {
                $set: { status: 'expired' }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[PredictionChecker] Marked ${result.modifiedCount} stale predictions as expired`);
        }
    } catch (error) {
        console.error('[PredictionChecker] Error marking stale predictions:', error.message);
    }
}

// Schedule the cron jobs
function startPredictionChecker() {
    console.log('[PredictionChecker] Starting prediction checker service...');

    // Check expired predictions every hour
    cron.schedule('0 * * * *', async () => {
        console.log('[PredictionChecker] Running hourly check...');
        await checkExpiredPredictions();
    });

    // Mark stale predictions as expired once per day at 2 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('[PredictionChecker] Running daily cleanup...');
        await markStaleAsExpired();
    });

    // Optional: Run immediately on startup for testing
    if (process.env.CHECK_PREDICTIONS_ON_STARTUP === 'true') {
        console.log('[PredictionChecker] Running initial check on startup...');
        setTimeout(async () => {
            await checkExpiredPredictions();
        }, 5000); // Wait 5 seconds after startup
    }

    console.log('[PredictionChecker] Cron jobs scheduled:');
    console.log('  - Check expired predictions: Every hour (0 * * * *)');
    console.log('  - Mark stale as expired: Daily at 2 AM (0 2 * * *)');
}

// Manual trigger function (for testing or admin endpoints)
async function manualCheck() {
    console.log('[PredictionChecker] Manual check triggered');
    await checkExpiredPredictions();
}

module.exports = {
    startPredictionChecker,
    checkExpiredPredictions,
    manualCheck
};