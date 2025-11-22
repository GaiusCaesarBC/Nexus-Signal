const User = require('../models/User');
const Portfolio = require('../models/Portfolio');

/**
 * Calculate and update user stats from their portfolio
 */
const updateUserStats = async (userId) => {
    try {
        const user = await User.findById(userId);
        const portfolio = await Portfolio.findOne({ user: userId });

        if (!user) {
            console.error('[StatsService] User not found:', userId);
            return;
        }

        if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
            // User has no holdings, set stats to zero
            user.stats = {
                totalTrades: 0,
                winRate: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                bestTrade: 0,
                worstTrade: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastUpdated: Date.now()
            };
            await user.save();
            console.log(`[StatsService] Reset stats for user ${userId} (no holdings)`);
            return;
        }

        // Calculate stats from holdings
        let totalGainLoss = 0;
        let totalCost = 0;
        let wins = 0;
        let losses = 0;
        let bestTradePercent = 0;
        let worstTradePercent = 0;

        portfolio.holdings.forEach(holding => {
            const currentValue = holding.currentPrice * holding.shares;
            const costBasis = holding.averagePrice * holding.shares;
            const gainLoss = currentValue - costBasis;
            const gainLossPercent = costBasis > 0 ? ((gainLoss / costBasis) * 100) : 0;

            totalGainLoss += gainLoss;
            totalCost += costBasis;

            if (gainLoss > 0) wins++;
            if (gainLoss < 0) losses++;

            // Track best and worst trades
            if (gainLossPercent > bestTradePercent) bestTradePercent = gainLossPercent;
            if (gainLossPercent < worstTradePercent) worstTradePercent = gainLossPercent;
        });

        // Update user stats
        user.stats.totalTrades = portfolio.holdings.length;
        user.stats.totalReturn = totalGainLoss;
        user.stats.totalReturnPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        user.stats.winRate = user.stats.totalTrades > 0 ? (wins / user.stats.totalTrades) * 100 : 0;
        user.stats.bestTrade = bestTradePercent;
        user.stats.worstTrade = worstTradePercent;
        user.stats.lastUpdated = Date.now();

        // Calculate streak (simplified - you can make this more sophisticated)
        if (wins > losses) {
            user.stats.currentStreak = wins - losses;
        } else {
            user.stats.currentStreak = 0;
        }

        if (user.stats.currentStreak > user.stats.longestStreak) {
            user.stats.longestStreak = user.stats.currentStreak;
        }

        await user.save();
        console.log(`[StatsService] Updated stats for user ${userId}: ${user.stats.totalReturnPercent.toFixed(2)}% return`);

    } catch (error) {
        console.error('[StatsService] Error updating stats for user:', userId, error);
    }
};

/**
 * Update stats for all users (use sparingly - for admin or cron jobs)
 */
const updateAllUserStats = async () => {
    try {
        const users = await User.find({});
        console.log(`[StatsService] Updating stats for ${users.length} users...`);

        for (const user of users) {
            await updateUserStats(user._id);
        }

        console.log('[StatsService] Finished updating all user stats');
    } catch (error) {
        console.error('[StatsService] Error updating all stats:', error);
    }
};

module.exports = {
    updateUserStats,
    updateAllUserStats
};