// server/utils/predictionCleanup.js - Cleanup invalid/old predictions

const Prediction = require('../models/Prediction');

/**
 * Mark old expired predictions for deletion
 * @param {number} hoursAfterExpiry - Hours after expiry to delete (default 24)
 */
async function markExpiredForDeletion(hoursAfterExpiry = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAfterExpiry);
    
    const deleteAt = new Date();
    deleteAt.setHours(deleteAt.getHours() + 1); // Delete in 1 hour
    
    const result = await Prediction.updateMany(
        {
            status: { $in: ['expired', 'correct', 'incorrect'] },
            expiresAt: { $lt: cutoffDate },
            deleteAfter: null // Not already marked
        },
        {
            $set: { deleteAfter: deleteAt }
        }
    );
    
    console.log(`[Cleanup] Marked ${result.modifiedCount} old predictions for deletion`);
    return result.modifiedCount;
}

/**
 * Delete predictions that have been pending for too long without valid price data
 * These are likely invalid tickers that slipped through
 * @param {number} hoursOld - Hours old to consider stale (default 24)
 */
async function deleteInvalidPredictions(hoursOld = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursOld);
    
    // Find predictions that are:
    // 1. Still pending but past their expiry
    // 2. Have no outcome data
    // 3. Created more than X hours ago
    const result = await Prediction.deleteMany({
        status: 'pending',
        expiresAt: { $lt: new Date() }, // Already expired
        'outcome.actualPrice': { $exists: false },
        createdAt: { $lt: cutoffDate }
    });
    
    console.log(`[Cleanup] Deleted ${result.deletedCount} invalid/stale predictions`);
    return result.deletedCount;
}

/**
 * Clean up the price cache (if using in-memory cache)
 */
function clearPriceCache() {
    try {
        const priceService = require('../services/priceService');
        if (priceService.clearCache) {
            priceService.clearCache();
            console.log('[Cleanup] Price cache cleared');
        }
    } catch (error) {
        console.log('[Cleanup] Could not clear price cache:', error.message);
    }
}

/**
 * Run full cleanup routine
 */
async function runFullCleanup() {
    console.log('[Cleanup] Starting full cleanup...');
    
    const invalidDeleted = await deleteInvalidPredictions(24);
    const expiredMarked = await markExpiredForDeletion(48);
    clearPriceCache();
    
    console.log('[Cleanup] Full cleanup complete');
    
    return {
        invalidDeleted,
        expiredMarked,
        cacheCleared: true
    };
}

/**
 * Get cleanup statistics
 */
async function getCleanupStats() {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const stats = {
        totalPredictions: await Prediction.countDocuments(),
        pendingPredictions: await Prediction.countDocuments({ status: 'pending' }),
        expiredPending: await Prediction.countDocuments({ 
            status: 'pending', 
            expiresAt: { $lt: now } 
        }),
        stalePredictions: await Prediction.countDocuments({
            status: 'pending',
            expiresAt: { $lt: now },
            createdAt: { $lt: oneDayAgo }
        }),
        markedForDeletion: await Prediction.countDocuments({
            deleteAfter: { $ne: null }
        })
    };
    
    return stats;
}

module.exports = {
    markExpiredForDeletion,
    deleteInvalidPredictions,
    clearPriceCache,
    runFullCleanup,
    getCleanupStats
};