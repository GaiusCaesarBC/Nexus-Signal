// server/services/predictionChecker.js - FIXED VERSION
// Uses correct priceService functions and properly updates user stats

const cron = require('node-cron');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const GamificationService = require('./gamificationService');

// ✅ USE CENTRALIZED PRICE SERVICE
const priceService = require('./priceService');

// ✅ Track checker statistics
const checkerStats = {
    lastRun: null,
    totalChecked: 0,
    successCount: 0,
    errorCount: 0,
    correctPredictions: 0,
    incorrectPredictions: 0
};

// Check a single prediction
async function checkPrediction(prediction) {
    try {
        // ✅ Use centralized detection
        const isCrypto = priceService.isCryptoSymbol(prediction.symbol);
        const typeLabel = isCrypto ? 'crypto' : prediction.assetType;
        console.log(`[PredictionChecker] Checking ${prediction.symbol} (${typeLabel})`);

        // ✅ Use centralized price fetching
        const priceResult = await priceService.getCurrentPrice(prediction.symbol, prediction.assetType);

        if (priceResult.price === null) {
            console.log(`[PredictionChecker] ❌ Could not fetch price for ${prediction.symbol}, skipping...`);
            checkerStats.errorCount++;
            return { success: false, prediction };
        }

        console.log(`[PredictionChecker] Price for ${prediction.symbol}: $${priceResult.price} (source: ${priceResult.source})`);

        // Calculate outcome
        await prediction.calculateOutcome(priceResult.price);

        // Update statistics
        checkerStats.successCount++;
        checkerStats.totalChecked++;
        
        if (prediction.status === 'correct') {
            checkerStats.correctPredictions++;
            console.log(`[PredictionChecker] ✅ ${prediction.symbol}: CORRECT (${prediction.outcome.accuracy.toFixed(1)}% accurate)`);
        } else {
            checkerStats.incorrectPredictions++;
            console.log(`[PredictionChecker] ❌ ${prediction.symbol}: INCORRECT (${prediction.outcome.accuracy.toFixed(1)}% accurate)`);
        }

        return { success: true, prediction };

    } catch (error) {
        console.error(`[PredictionChecker] Error checking prediction ${prediction._id}:`, error.message);
        checkerStats.errorCount++;
        return { success: false, prediction };
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
        }).limit(50);

        if (expiredPredictions.length === 0) {
            console.log('[PredictionChecker] ✨ No expired predictions found.');
            console.log('================================\n');
            return;
        }

        console.log(`[PredictionChecker] Found ${expiredPredictions.length} expired predictions to check`);
        
        // Log what symbols we're checking
        const symbols = [...new Set(expiredPredictions.map(p => p.symbol))];
        console.log(`[PredictionChecker] Unique symbols: ${symbols.join(', ')}`);

        // ✅ FIXED: Use getBatchPrices instead of fetchCoinGeckoPricesBatch
        // Pre-fetch all prices in batch for efficiency
        console.log(`[PredictionChecker] Pre-fetching prices for ${symbols.length} symbols...`);
        await priceService.getBatchPrices(symbols);

        // Reset run statistics
        const runStats = {
            checked: 0,
            success: 0,
            errors: 0,
            correct: 0,
            incorrect: 0
        };

        // ✅ Track which users need gamification updates
        const userResults = new Map(); // userId -> { correct: number, incorrect: number }

        // Check each prediction with a delay to respect API rate limits
        for (const prediction of expiredPredictions) {
            const result = await checkPrediction(prediction);

            if (result.success) {
                runStats.success++;
                
                const userId = prediction.user.toString();
                if (!userResults.has(userId)) {
                    userResults.set(userId, { correct: 0, incorrect: 0 });
                }
                
                if (prediction.status === 'correct') {
                    runStats.correct++;
                    userResults.get(userId).correct++;
                } else if (prediction.status === 'incorrect') {
                    runStats.incorrect++;
                    userResults.get(userId).incorrect++;
                }
            } else {
                runStats.errors++;
            }

            runStats.checked++;

            // Add delay between API calls (reduced since we have caching now)
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Update global statistics
        checkerStats.lastRun = new Date();

        // ✅ Update gamification for affected users
        await updateGamificationStats(userResults);

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
        console.log(`  💾 Cache size: ${priceService.getCacheStats().size} entries`);
        console.log('================================\n');

    } catch (error) {
        console.error('[PredictionChecker] ❌ Error in checkExpiredPredictions:', error.message);
    }
}

// ✅ NEW: Update gamification stats when predictions are resolved
async function updateGamificationStats(userResults) {
    console.log(`[PredictionChecker] 🎮 Updating gamification for ${userResults.size} users...`);
    
    for (const [userId, results] of userResults) {
        try {
            // Award XP and track correct predictions
            if (results.correct > 0) {
                // Award XP for each correct prediction
                const xpAmount = results.correct * 50; // 50 XP per correct prediction
                await GamificationService.awardXP(
                    userId, 
                    xpAmount, 
                    `${results.correct} correct prediction(s)`
                );
                
                // Award bonus coins for correct predictions
                const coinAmount = results.correct * 25; // 25 coins per correct prediction
                await GamificationService.awardCoins(
                    userId,
                    coinAmount,
                    `${results.correct} correct prediction(s)`
                );
                
                console.log(`[PredictionChecker]   🎯 User ${userId}: +${xpAmount} XP, +${coinAmount} coins for ${results.correct} correct`);
            }
            
            if (results.incorrect > 0) {
                // Small consolation XP for participation
                const xpAmount = results.incorrect * 5; // 5 XP per incorrect (still participated)
                await GamificationService.awardXP(
                    userId,
                    xpAmount,
                    `${results.incorrect} prediction(s) resolved`
                );
                
                console.log(`[PredictionChecker]   📉 User ${userId}: +${xpAmount} XP for ${results.incorrect} incorrect`);
            }
            
            // Check achievements after updating
            await GamificationService.checkAchievements(userId);
            
        } catch (error) {
            console.error(`[PredictionChecker]   ❌ Gamification error for ${userId}:`, error.message);
        }
    }
}

// ✅ FIXED: Update stats for users who had predictions checked
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

                // Initialize stats if needed
                if (!user.stats) {
                    user.stats = {};
                }

                // Get accuracy stats from resolved predictions
                const accuracy = await Prediction.getUserAccuracy(userId);

                // Get TOTAL predictions count (including pending)
                const totalPredictionsCount = await Prediction.countDocuments({ user: userId });
                
                // Get resolved predictions count
                const resolvedCount = await Prediction.countDocuments({ 
                    user: userId, 
                    status: { $in: ['correct', 'incorrect'] } 
                });

                // ✅ Update ALL prediction-related stats
                user.stats.totalPredictions = totalPredictionsCount;
                user.stats.correctPredictions = accuracy.correctPredictions || 0;
                user.stats.predictionAccuracy = accuracy.accuracy || 0;
                
                // Also update legacy fields that might be used elsewhere
                user.stats.totalTrades = resolvedCount;
                user.stats.winRate = accuracy.accuracy || 0;

                // Calculate streak from recent resolved predictions
                const recentPredictions = await Prediction.find({
                    user: userId,
                    status: { $in: ['correct', 'incorrect'] }
                }).sort({ 'outcome.checkedAt': -1 }).limit(20);

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
                user.stats.lastPredictionDate = new Date();
                user.stats.lastUpdated = Date.now();

                await user.save();
                
                console.log(`[PredictionChecker]   ✅ Updated user ${userId}:`);
                console.log(`      - Total Predictions: ${totalPredictionsCount}`);
                console.log(`      - Resolved: ${resolvedCount}`);
                console.log(`      - Correct: ${accuracy.correctPredictions}`);
                console.log(`      - Accuracy: ${accuracy.accuracy.toFixed(1)}%`);
                console.log(`      - Current Streak: ${currentStreak}`);
                
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
        
        // ✅ Clear price cache during daily cleanup
        priceService.clearCache();
        console.log(`[PredictionChecker] 🗑️  Cleared price cache`);
        
    } catch (error) {
        console.error('[PredictionChecker] ❌ Error marking stale predictions:', error.message);
    }
}

// Get checker statistics
function getCheckerStats() {
    return {
        ...checkerStats,
        accuracyRate: checkerStats.totalChecked > 0 
            ? ((checkerStats.correctPredictions / checkerStats.totalChecked) * 100).toFixed(2) + '%'
            : 'N/A',
        uptime: checkerStats.lastRun 
            ? `Last run: ${new Date(checkerStats.lastRun).toLocaleString()}`
            : 'Not run yet',
        priceCache: priceService.getCacheStats()
    };
}

// ✅ Track if already started to prevent double initialization
let isStarted = false;

// Schedule the cron jobs
function startPredictionChecker() {
    // ✅ Prevent double initialization
    if (isStarted) {
        console.log('[PredictionChecker] ⚠️ Already started, skipping duplicate initialization');
        return;
    }
    isStarted = true;

    console.log('\n🚀 ================================');
    console.log('[PredictionChecker] Starting prediction checker service...');
    console.log('[PredictionChecker] Using centralized price service');
    console.log('[PredictionChecker] Gamification integration enabled');
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
        }, 5000);
    }
}

// Manual trigger function (for testing or admin endpoints)
async function manualCheck() {
    console.log('[PredictionChecker] 🔧 Manual check triggered');
    await checkExpiredPredictions();
}

// ✅ Export everything including price service helpers for backward compatibility
module.exports = {
    startPredictionChecker,
    checkExpiredPredictions,
    manualCheck,
    getCheckerStats,
    
    // Re-export from priceService for backward compatibility
    fetchCurrentPrice: priceService.getCurrentPrice,
    isCryptoSymbol: priceService.isCryptoSymbol
};