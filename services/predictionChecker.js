// server/services/predictionChecker.js - ENHANCED WITH BETTER LOGGING & ERROR HANDLING

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

// ✅ ENHANCED: Track checker statistics
const checkerStats = {
    lastRun: null,
    totalChecked: 0,
    successCount: 0,
    errorCount: 0,
    correctPredictions: 0,
    incorrectPredictions: 0
};

// Fetch current stock price from Alpha Vantage
async function fetchStockPrice(symbol) {
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url, { timeout: 10000 });
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
        const response = await axios.get(url, { params, timeout: 10000 });
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
        console.log(`[PredictionChecker] Checking ${prediction.symbol} (${prediction.assetType})`);

        const currentPrice = await fetchCurrentPrice(prediction.symbol, prediction.assetType);

        if (currentPrice === null) {
            console.log(`[PredictionChecker] ❌ Could not fetch price for ${prediction.symbol}, skipping...`);
            checkerStats.errorCount++;
            return false;
        }

        // Calculate outcome
        await prediction.calculateOutcome(currentPrice);

        // ✅ Update statistics
        checkerStats.successCount++;
        checkerStats.totalChecked++;
        
        if (prediction.status === 'correct') {
            checkerStats.correctPredictions++;
            console.log(`[PredictionChecker] ✅ ${prediction.symbol}: CORRECT (${prediction.outcome.accuracy.toFixed(1)}% accurate)`);
        } else {
            checkerStats.incorrectPredictions++;
            console.log(`[PredictionChecker] ❌ ${prediction.symbol}: INCORRECT (${prediction.outcome.accuracy.toFixed(1)}% accurate)`);
        }

        return true;

    } catch (error) {
        console.error(`[PredictionChecker] Error checking prediction ${prediction._id}:`, error.message);
        checkerStats.errorCount++;
        return false;
    }
}

// Main function to check all expired predictions
async function checkExpiredPredictions() {
    try {
        const startTime = Date.now();
        console.log('\n================================');
        console.log('[PredictionChecker] 🔍 Starting check for expired predictions...');
        console.log(`[PredictionChecker] Time: ${new Date().toLocaleString()}`);

        // Find all pending predictions that have expired
        const expiredPredictions = await Prediction.find({
            status: 'pending',
            expiresAt: { $lte: new Date() }
        }).limit(50); // Process 50 at a time to avoid overwhelming APIs

        if (expiredPredictions.length === 0) {
            console.log('[PredictionChecker] ✨ No expired predictions found.');
            console.log('================================\n');
            return;
        }

        console.log(`[PredictionChecker] Found ${expiredPredictions.length} expired predictions to check`);

        // Reset run statistics
        const runStats = {
            checked: 0,
            success: 0,
            errors: 0,
            correct: 0,
            incorrect: 0
        };

        // Check each prediction with a delay to respect API rate limits
        for (const prediction of expiredPredictions) {
            const success = await checkPrediction(prediction);

            if (success) {
                runStats.success++;
                if (prediction.status === 'correct') {
                    runStats.correct++;
                } else if (prediction.status === 'incorrect') {
                    runStats.incorrect++;
                }
            } else {
                runStats.errors++;
            }

            runStats.checked++;

            // Add delay between API calls
            // Alpha Vantage: 75/min = 800ms between calls
            // CoinGecko: 500/min = 120ms between calls
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Update global statistics
        checkerStats.lastRun = new Date();

        // Update user stats for affected users
        const affectedUserIds = [...new Set(expiredPredictions.map(p => p.user.toString()))];
        await updateUserStats(affectedUserIds);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('\n[PredictionChecker] 📊 Run Summary:');
        console.log(`  ✅ Success: ${runStats.success}`);
        console.log(`  ❌ Errors: ${runStats.errors}`);
        console.log(`  🎯 Correct: ${runStats.correct}`);
        console.log(`  ⚠️  Incorrect: ${runStats.incorrect}`);
        console.log(`  ⏱️  Duration: ${duration}s`);
        console.log(`  👥 Users affected: ${affectedUserIds.length}`);
        console.log('================================\n');

    } catch (error) {
        console.error('[PredictionChecker] ❌ Error in checkExpiredPredictions:', error.message);
    }
}

// Update stats for users who had predictions checked
async function updateUserStats(userIds) {
    try {
        console.log(`[PredictionChecker] 🔄 Updating stats for ${userIds.length} users...`);

        for (const userId of userIds) {
            try {
                const user = await User.findById(userId);
                if (!user) {
                    console.log(`[PredictionChecker] User ${userId} not found`);
                    continue;
                }

                const accuracy = await Prediction.getUserAccuracy(userId);

                // Update user's prediction stats
                user.stats.totalTrades = accuracy.totalPredictions || user.stats.totalTrades || 0;
                user.stats.winRate = accuracy.accuracy || user.stats.winRate || 0;

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
                console.log(`[PredictionChecker]   ✅ Updated user ${userId} - ${accuracy.accuracy.toFixed(1)}% accuracy`);
                
            } catch (userError) {
                console.error(`[PredictionChecker]   ❌ Error updating user ${userId}:`, userError.message);
            }
        }

        console.log(`[PredictionChecker] ✨ User stats update complete`);

    } catch (error) {
        console.error('[PredictionChecker] ❌ Error updating user stats:', error.message);
    }
}

// Mark very old pending predictions as expired (cleanup)
async function markStaleAsExpired() {
    try {
        console.log('[PredictionChecker] 🧹 Running daily cleanup...');
        
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
            console.log(`[PredictionChecker] ✨ Marked ${result.modifiedCount} stale predictions as expired`);
        } else {
            console.log(`[PredictionChecker] No stale predictions found`);
        }
    } catch (error) {
        console.error('[PredictionChecker] ❌ Error marking stale predictions:', error.message);
    }
}

// ✅ NEW: Get checker statistics
function getCheckerStats() {
    return {
        ...checkerStats,
        accuracyRate: checkerStats.totalChecked > 0 
            ? ((checkerStats.correctPredictions / checkerStats.totalChecked) * 100).toFixed(2) + '%'
            : 'N/A',
        uptime: checkerStats.lastRun 
            ? `Last run: ${new Date(checkerStats.lastRun).toLocaleString()}`
            : 'Not run yet'
    };
}

// Schedule the cron jobs
function startPredictionChecker() {
    console.log('\n🚀 ================================');
    console.log('[PredictionChecker] Starting prediction checker service...');
    console.log('================================\n');

    // Check expired predictions every hour
    cron.schedule('0 * * * *', async () => {
        console.log('[PredictionChecker] ⏰ Hourly check triggered...');
        await checkExpiredPredictions();
    });

    // Mark stale predictions as expired once per day at 2 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('[PredictionChecker] ⏰ Daily cleanup triggered...');
        await markStaleAsExpired();
    });

    console.log('[PredictionChecker] ✅ Cron jobs scheduled:');
    console.log('  • Check expired predictions: Every hour (0 * * * *)');
    console.log('  • Mark stale as expired: Daily at 2 AM (0 2 * * *)');
    console.log('');

    // Optional: Run immediately on startup for testing
    if (process.env.CHECK_PREDICTIONS_ON_STARTUP === 'true') {
        console.log('[PredictionChecker] 🏃 Running initial check on startup...');
        setTimeout(async () => {
            await checkExpiredPredictions();
        }, 5000); // Wait 5 seconds after startup
    }
}

// Manual trigger function (for testing or admin endpoints)
async function manualCheck() {
    console.log('[PredictionChecker] 🔧 Manual check triggered');
    await checkExpiredPredictions();
}

// ✅ NEW: Export statistics getter
module.exports = {
    startPredictionChecker,
    checkExpiredPredictions,
    manualCheck,
    getCheckerStats,
    fetchCurrentPrice // Expose for use in routes
};