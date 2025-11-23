// server/services/notificationService.js
const Notification = require('../models/Notification');

class NotificationService {
    // Prediction notifications
    static async notifyPredictionCorrect(userId, predictionData) {
        return Notification.createNotification(userId, {
            type: 'success',
            category: 'prediction',
            title: 'AI Prediction Correct! 🎯',
            message: `Your ${predictionData.symbol} prediction hit the target price of $${predictionData.targetPrice}`,
            icon: 'TrendingUp',
            link: '/predict',
            metadata: predictionData
        });
    }

    static async notifyPredictionWrong(userId, predictionData) {
        return Notification.createNotification(userId, {
            type: 'warning',
            category: 'prediction',
            title: 'Prediction Missed',
            message: `Your ${predictionData.symbol} prediction didn't hit the target`,
            icon: 'TrendingDown',
            link: '/predict',
            metadata: predictionData
        });
    }

    // Portfolio notifications
    static async notifyPortfolioGain(userId, data) {
        return Notification.createNotification(userId, {
            type: 'success',
            category: 'portfolio',
            title: 'Portfolio Gain! 📈',
            message: `Your portfolio value increased by ${data.percentChange}% today`,
            icon: 'TrendingUp',
            link: '/portfolio',
            metadata: data
        });
    }

    static async notifyPortfolioLoss(userId, data) {
        return Notification.createNotification(userId, {
            type: 'warning',
            category: 'portfolio',
            title: 'Portfolio Update',
            message: `Your portfolio value decreased by ${Math.abs(data.percentChange)}% today`,
            icon: 'TrendingDown',
            link: '/portfolio',
            metadata: data
        });
    }

    // Watchlist notifications
    static async notifyPriceAlert(userId, data) {
        return Notification.createNotification(userId, {
            type: 'info',
            category: 'watchlist',
            title: 'Price Alert! 🔔',
            message: `${data.symbol} reached your target price of $${data.targetPrice}`,
            icon: 'AlertCircle',
            link: '/watchlist',
            metadata: data
        });
    }

    // Achievement notifications
    static async notifyAchievementUnlocked(userId, achievement) {
        return Notification.createNotification(userId, {
            type: 'success',
            category: 'achievement',
            title: 'Achievement Unlocked! 🏆',
            message: `You unlocked: ${achievement.name}`,
            icon: 'Trophy',
            link: '/achievements',
            metadata: achievement
        });
    }

    // Level up notifications
    static async notifyLevelUp(userId, data) {
        return Notification.createNotification(userId, {
            type: 'success',
            category: 'level',
            title: 'Level Up! 🎉',
            message: `Congratulations! You reached Level ${data.newLevel}`,
            icon: 'Star',
            link: '/achievements',
            metadata: data
        });
    }

    // Trade notifications
    static async notifyTradeProfitable(userId, data) {
        return Notification.createNotification(userId, {
            type: 'success',
            category: 'trade',
            title: 'Profitable Trade! 💰',
            message: `You made $${data.profit.toFixed(2)} profit on ${data.symbol}`,
            icon: 'DollarSign',
            link: '/portfolio',
            metadata: data
        });
    }

    static async notifyTradeLoss(userId, data) {
        return Notification.createNotification(userId, {
            type: 'warning',
            category: 'trade',
            title: 'Trade Closed',
            message: `You sold ${data.symbol} with a loss of $${Math.abs(data.profit).toFixed(2)}`,
            icon: 'AlertCircle',
            link: '/portfolio',
            metadata: data
        });
    }

    // System notifications
    static async notifySystem(userId, title, message) {
        return Notification.createNotification(userId, {
            type: 'info',
            category: 'system',
            title,
            message,
            icon: 'Bell'
        });
    }
}

module.exports = NotificationService;