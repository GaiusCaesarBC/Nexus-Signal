// server/services/copyTradingService.js - Auto-Copy Trading Service
// Handles automatic copying of predictions from followed traders

const CopyTrade = require('../models/CopyTrade');
const CopiedPrediction = require('../models/CopiedPrediction');
const Prediction = require('../models/Prediction');
const PaperTradingAccount = require('../models/PaperTradingAccount');
const NotificationService = require('./notificationService');

const SIGNAL_STRENGTH_PRIORITY = {
    'strong': 3,
    'moderate': 2,
    'weak': 1
};

/**
 * Process a new prediction and copy it to all active copiers
 * @param {Object} prediction - The newly created prediction
 * @param {String} traderId - The user ID of the trader who made the prediction
 */
async function processPredictionForCopiers(prediction, traderId) {
    try {
        // Find all active copy trade relationships for this trader
        const activeCopyTrades = await CopyTrade.find({
            trader: traderId,
            status: 'active'
        }).populate('copier', 'username');

        if (activeCopyTrades.length === 0) {
            return { copied: 0, skipped: 0 };
        }

        console.log(`[CopyTrading] Processing prediction ${prediction._id} for ${activeCopyTrades.length} copiers`);

        let copied = 0;
        let skipped = 0;

        for (const copyTrade of activeCopyTrades) {
            try {
                const result = await copyPredictionForUser(prediction, copyTrade);
                if (result.copied) {
                    copied++;
                } else {
                    skipped++;
                    console.log(`[CopyTrading] Skipped for ${copyTrade.copier.username}: ${result.reason}`);
                }
            } catch (error) {
                console.error(`[CopyTrading] Error copying for user ${copyTrade.copier._id}:`, error);
                skipped++;
            }
        }

        console.log(`[CopyTrading] Prediction ${prediction._id}: ${copied} copied, ${skipped} skipped`);
        return { copied, skipped };

    } catch (error) {
        console.error('[CopyTrading] Error processing prediction for copiers:', error);
        throw error;
    }
}

/**
 * Copy a prediction for a specific user based on their copy trade settings
 * @param {Object} prediction - The prediction to copy
 * @param {Object} copyTrade - The CopyTrade document with settings
 */
async function copyPredictionForUser(prediction, copyTrade) {
    const settings = copyTrade.settings;

    // Check if already copied
    const alreadyCopied = await CopiedPrediction.alreadyCopied(copyTrade.copier._id, prediction._id);
    if (alreadyCopied) {
        return { copied: false, reason: 'Already copied' };
    }

    // Check asset type filter
    const assetType = prediction.assetType || 'stock';
    if (assetType === 'stock' && !settings.copyAssetTypes.stocks) {
        return { copied: false, reason: 'Stocks not enabled' };
    }
    if (assetType === 'crypto' && !settings.copyAssetTypes.crypto) {
        return { copied: false, reason: 'Crypto not enabled' };
    }
    if (assetType === 'dex' && !settings.copyAssetTypes.dex) {
        return { copied: false, reason: 'DEX tokens not enabled' };
    }

    // Check direction filter
    const direction = prediction.direction;
    if (direction === 'UP' && !settings.copyDirections.up) {
        return { copied: false, reason: 'UP predictions not enabled' };
    }
    if (direction === 'DOWN' && !settings.copyDirections.down) {
        return { copied: false, reason: 'DOWN predictions not enabled' };
    }
    if (direction === 'NEUTRAL') {
        return { copied: false, reason: 'NEUTRAL predictions not copied' };
    }

    // Check confidence threshold
    if (prediction.confidence < settings.minConfidence) {
        return { copied: false, reason: `Confidence ${prediction.confidence}% below minimum ${settings.minConfidence}%` };
    }

    // Check signal strength threshold
    const predSignalPriority = SIGNAL_STRENGTH_PRIORITY[prediction.signalStrength] || 0;
    const minSignalPriority = SIGNAL_STRENGTH_PRIORITY[settings.minSignalStrength] || 0;
    if (predSignalPriority < minSignalPriority) {
        return { copied: false, reason: `Signal strength ${prediction.signalStrength} below minimum ${settings.minSignalStrength}` };
    }

    // Check max active trades
    const activeCopies = await CopiedPrediction.countDocuments({
        copier: copyTrade.copier._id,
        status: { $in: ['pending', 'active'] }
    });
    if (activeCopies >= settings.maxActiveTrades) {
        return { copied: false, reason: `Max active trades (${settings.maxActiveTrades}) reached` };
    }

    // Get copier's paper trading account for allocation calculation
    let allocationDetails = {
        percentUsed: settings.allocationPercent,
        amountAllocated: settings.maxAmountPerTrade,
        sharesOrUnits: 0
    };

    try {
        const paperAccount = await PaperTradingAccount.findOne({ user: copyTrade.copier._id });
        if (paperAccount) {
            const availableBalance = paperAccount.cashBalance || paperAccount.portfolioValue * 0.1;
            const allocatedAmount = Math.min(
                availableBalance * (settings.allocationPercent / 100),
                settings.maxAmountPerTrade
            );
            const sharesOrUnits = prediction.currentPrice > 0 ? allocatedAmount / prediction.currentPrice : 0;

            allocationDetails = {
                percentUsed: settings.allocationPercent,
                amountAllocated: allocatedAmount,
                sharesOrUnits: Math.floor(sharesOrUnits * 1000) / 1000 // Round to 3 decimal places
            };
        }
    } catch (error) {
        console.warn('[CopyTrading] Could not calculate allocation:', error.message);
    }

    // Create the copied prediction record
    const copiedPrediction = await CopiedPrediction.create({
        copyTrade: copyTrade._id,
        copier: copyTrade.copier._id,
        trader: copyTrade.trader,
        originalPrediction: prediction._id,
        copierPrediction: prediction._id, // For now, they share the same prediction
        copyDetails: {
            symbol: prediction.symbol,
            assetType: prediction.assetType || 'stock',
            direction: prediction.direction,
            entryPrice: prediction.currentPrice,
            targetPrice: prediction.targetPrice,
            confidence: prediction.confidence,
            signalStrength: prediction.signalStrength,
            timeframe: prediction.timeframe
        },
        allocationDetails,
        status: 'active'
    });

    // Update copy trade stats
    copyTrade.stats.lastCopiedAt = new Date();
    await copyTrade.save();

    // Send notification to the copier
    if (settings.notifyOnCopy) {
        await NotificationService.createNotification(
            copyTrade.copier._id,
            'copy_executed',
            'Trade Copied',
            `Copied ${prediction.direction} prediction for ${prediction.symbol} from trader`,
            {
                symbol: prediction.symbol,
                direction: prediction.direction,
                confidence: prediction.confidence,
                predictionId: prediction._id,
                copiedPredictionId: copiedPrediction._id
            }
        );
    }

    console.log(`[CopyTrading] Created copy for ${copyTrade.copier.username}: ${prediction.symbol} ${prediction.direction}`);

    return { copied: true, copiedPredictionId: copiedPrediction._id };
}

/**
 * Update copied prediction outcome when the original prediction resolves
 * @param {Object} prediction - The resolved prediction
 */
async function updateCopiedPredictionOutcomes(prediction) {
    try {
        if (!prediction.outcome || prediction.status === 'pending') {
            return;
        }

        const copiedPredictions = await CopiedPrediction.find({
            originalPrediction: prediction._id,
            status: { $in: ['pending', 'active'] }
        }).populate('copyTrade');

        console.log(`[CopyTrading] Updating ${copiedPredictions.length} copied predictions for ${prediction._id}`);

        for (const cp of copiedPredictions) {
            const outcome = prediction.outcome;

            // Calculate P/L based on allocation
            const profitLossPercent = outcome.actualChangePercent || 0;
            const profitLoss = (cp.allocationDetails.amountAllocated || 0) * (profitLossPercent / 100);

            cp.outcome = {
                wasCorrect: outcome.wasCorrect,
                profitLoss,
                profitLossPercent,
                closedAt: new Date(),
                closeReason: prediction.status === 'correct' ? 'target_hit' : 'expired'
            };
            cp.status = 'completed';
            await cp.save();

            // Update the copy trade stats
            if (cp.copyTrade) {
                await cp.copyTrade.updateStats(profitLoss, profitLossPercent, outcome.wasCorrect);
            }

            // Notify the copier of the result
            await NotificationService.createNotification(
                cp.copier,
                'copy_completed',
                outcome.wasCorrect ? 'Copy Trade Won!' : 'Copy Trade Closed',
                `${cp.copyDetails.symbol} ${cp.copyDetails.direction} prediction ${outcome.wasCorrect ? 'was correct' : 'closed'}: ${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%`,
                {
                    symbol: cp.copyDetails.symbol,
                    direction: cp.copyDetails.direction,
                    wasCorrect: outcome.wasCorrect,
                    profitLossPercent
                }
            );
        }

    } catch (error) {
        console.error('[CopyTrading] Error updating copied prediction outcomes:', error);
    }
}

/**
 * Get copy trading statistics for a trader
 * @param {String} traderId - The trader's user ID
 */
async function getTraderCopyStats(traderId) {
    try {
        const copierCount = await CopyTrade.countDocuments({
            trader: traderId,
            status: 'active'
        });

        const totalCopiedPredictions = await CopiedPrediction.countDocuments({
            trader: traderId
        });

        const completedCopies = await CopiedPrediction.find({
            trader: traderId,
            status: 'completed'
        });

        const successfulCopies = completedCopies.filter(cp => cp.outcome?.wasCorrect).length;
        const totalProfitGenerated = completedCopies.reduce((sum, cp) => sum + (cp.outcome?.profitLoss || 0), 0);

        return {
            activeCopiers: copierCount,
            totalCopiedPredictions,
            successfulCopies,
            copySuccessRate: completedCopies.length > 0
                ? (successfulCopies / completedCopies.length) * 100
                : 0,
            totalProfitGenerated
        };
    } catch (error) {
        console.error('[CopyTrading] Error getting trader copy stats:', error);
        return null;
    }
}

module.exports = {
    processPredictionForCopiers,
    copyPredictionForUser,
    updateCopiedPredictionOutcomes,
    getTraderCopyStats
};
