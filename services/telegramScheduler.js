// Telegram Notification Scheduler
// Handles scheduled notifications: economic events, daily summaries, whale alerts

const cron = require('node-cron');
const User = require('../models/User');
const telegramService = require('./telegramService');

// Track sent reminders to avoid duplicates
const sentEconomicReminders = new Set();
const sentWhaleAlerts = new Set();

// ==================== ECONOMIC CALENDAR REMINDERS ====================

// Check for upcoming economic events every 5 minutes
const startEconomicEventReminders = () => {
    console.log('📅 Telegram: Economic event reminder scheduler started');

    cron.schedule('*/5 * * * *', async () => {
        try {
            // Get upcoming events from the economic calendar
            const axios = require('axios');
            const today = new Date();
            const endDate = new Date(today.getTime() + 60 * 60 * 1000); // Next hour

            // Fetch events from our own API or external source
            // For now, we'll check against stored events
            const response = await axios.get('https://finnhub.io/api/v1/calendar/economic', {
                params: {
                    token: process.env.FINNHUB_API_KEY
                }
            }).catch(() => null);

            if (!response || !response.data?.economicCalendar) return;

            const events = response.data.economicCalendar || [];
            const now = new Date();

            for (const event of events) {
                const eventTime = new Date(event.time);
                const minutesUntil = (eventTime - now) / (1000 * 60);

                // Send reminder 30 minutes before high-impact events
                if (minutesUntil > 0 && minutesUntil <= 30 && event.impact === 3) {
                    const eventKey = `${event.event}-${event.time}`;

                    if (!sentEconomicReminders.has(eventKey)) {
                        sentEconomicReminders.add(eventKey);

                        // Get users who want economic event notifications
                        const users = await User.find({
                            telegramChatId: { $ne: null },
                            'telegramNotifications.economicEvents': { $ne: false }
                        }).select('_id telegramChatId');

                        console.log(`📅 Sending economic event reminder: ${event.event} to ${users.length} users`);

                        const eventData = {
                            title: event.event,
                            time: eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
                            country: event.country,
                            impact: 'High',
                            previous: event.prev,
                            forecast: event.estimate,
                            minutesUntil: Math.round(minutesUntil)
                        };

                        for (const user of users) {
                            await telegramService.sendEconomicEventReminder(user._id, eventData);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }

                        // Also send to all linked groups
                        const groupMessage =
                            `📅 *Economic Event Reminder*\n\n` +
                            `*${eventData.title}*\n` +
                            `🕐 Time: ${eventData.time}\n` +
                            `📍 Country: ${eventData.country || 'US'}\n` +
                            `⚡ Impact: ${eventData.impact}\n` +
                            `${eventData.previous ? `📊 Previous: ${eventData.previous}\n` : ''}` +
                            `${eventData.forecast ? `🎯 Forecast: ${eventData.forecast}\n` : ''}\n` +
                            `_Event starts in ${eventData.minutesUntil} minutes_`;

                        const groupResults = await telegramService.sendToAllGroups(groupMessage, 'economicEvents');
                        if (groupResults.sent > 0) {
                            console.log(`📅 Economic event reminder sent to ${groupResults.sent} groups`);
                        }

                        // Clean up old reminders after 1 hour
                        setTimeout(() => sentEconomicReminders.delete(eventKey), 60 * 60 * 1000);
                    }
                }
            }
        } catch (error) {
            console.error('Error in economic event reminder scheduler:', error.message);
        }
    });
};

// ==================== DAILY MARKET SUMMARY ====================

// Send daily summary at 8 AM EST
const startDailySummaryScheduler = () => {
    console.log('☀️ Telegram: Daily summary scheduler started');

    // Run at 8 AM EST (13:00 UTC) Monday-Friday
    cron.schedule('0 13 * * 1-5', async () => {
        try {
            console.log('☀️ Sending daily market summaries...');

            // Get users who want daily summaries
            const users = await User.find({
                telegramChatId: { $ne: null },
                'telegramNotifications.dailySummary': { $ne: false }
            }).select('_id telegramChatId');

            if (users.length === 0) {
                console.log('No users subscribed to daily summaries');
                return;
            }

            // Fetch market data for summary
            const summary = await generateDailySummary();

            for (const user of users) {
                await telegramService.sendDailySummary(user._id, summary);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`☀️ Daily summaries sent to ${users.length} users`);

            // Also send to all linked groups
            const marketEmoji = summary.marketTrend === 'bullish' ? '📈' : summary.marketTrend === 'bearish' ? '📉' : '📊';
            let groupMessage =
                `☀️ *Daily Market Summary*\n` +
                `_${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}_\n\n` +
                `${marketEmoji} *Market Overview*\n`;

            if (summary.indices && summary.indices.length > 0) {
                groupMessage += `\n*Major Indices:*\n`;
                summary.indices.forEach(idx => {
                    const emoji = idx.change >= 0 ? '🟢' : '🔴';
                    const sign = idx.change >= 0 ? '+' : '';
                    groupMessage += `${emoji} ${idx.name}: ${sign}${idx.change.toFixed(2)}%\n`;
                });
            }

            if (summary.topGainers && summary.topGainers.length > 0) {
                groupMessage += `\n*Top Gainers:*\n`;
                summary.topGainers.slice(0, 3).forEach(stock => {
                    groupMessage += `🚀 ${stock.symbol}: +${stock.change.toFixed(2)}%\n`;
                });
            }

            if (summary.topLosers && summary.topLosers.length > 0) {
                groupMessage += `\n*Top Losers:*\n`;
                summary.topLosers.slice(0, 3).forEach(stock => {
                    groupMessage += `📉 ${stock.symbol}: ${stock.change.toFixed(2)}%\n`;
                });
            }

            groupMessage += `\n_Have a great trading day!_ 🎯`;

            const groupResults = await telegramService.sendToAllGroups(groupMessage, 'dailySummary');
            if (groupResults.sent > 0) {
                console.log(`☀️ Daily summary sent to ${groupResults.sent} groups`);
            }
        } catch (error) {
            console.error('Error sending daily summaries:', error.message);
        }
    });
};

// Generate market summary data
const generateDailySummary = async () => {
    const axios = require('axios');

    try {
        // Fetch major indices
        const indices = [
            { symbol: 'SPY', name: 'S&P 500' },
            { symbol: 'QQQ', name: 'NASDAQ' },
            { symbol: 'DIA', name: 'Dow Jones' }
        ];

        const indicesData = [];
        for (const idx of indices) {
            try {
                const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
                    params: { symbol: idx.symbol, token: process.env.FINNHUB_API_KEY }
                });
                if (response.data) {
                    indicesData.push({
                        name: idx.name,
                        change: ((response.data.c - response.data.pc) / response.data.pc * 100)
                    });
                }
            } catch (e) {
                // Skip failed fetches
            }
        }

        // Get top movers (simplified)
        const topGainers = [
            { symbol: 'EXAMPLE', change: 5.2 }
        ];

        const topLosers = [
            { symbol: 'EXAMPLE2', change: -3.1 }
        ];

        // Determine market trend
        const avgChange = indicesData.reduce((sum, idx) => sum + idx.change, 0) / indicesData.length;
        const marketTrend = avgChange > 0.5 ? 'bullish' : avgChange < -0.5 ? 'bearish' : 'neutral';

        return {
            marketTrend,
            indices: indicesData,
            topGainers,
            topLosers,
            upcomingEvents: []
        };
    } catch (error) {
        console.error('Error generating daily summary:', error.message);
        return {
            marketTrend: 'neutral',
            indices: [],
            topGainers: [],
            topLosers: [],
            upcomingEvents: []
        };
    }
};

// ==================== WHALE ALERT NOTIFICATIONS ====================

// Helper to format numbers for messages
const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Function to send whale alert to subscribed users AND groups
const sendWhaleAlertToSubscribers = async (alert) => {
    try {
        const alertKey = `${alert.symbol}-${alert.amount}-${Date.now()}`;

        if (sentWhaleAlerts.has(alertKey)) return;
        sentWhaleAlerts.add(alertKey);

        // Get users who want whale alerts
        const users = await User.find({
            telegramChatId: { $ne: null },
            'telegramNotifications.whaleAlerts': { $ne: false }
        }).select('_id');

        console.log(`🐋 Sending whale alert: ${alert.symbol} $${alert.amount} to ${users.length} users`);

        for (const user of users) {
            await telegramService.sendWhaleAlert(user._id, alert);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Also send to all linked groups
        const emoji = alert.type === 'buy' ? '🟢' : '🔴';
        const action = alert.type === 'buy' ? 'BOUGHT' : 'SOLD';
        const groupMessage =
            `🐋 *Whale Alert!*\n\n` +
            `${emoji} Large ${alert.assetType || 'crypto'} movement detected!\n\n` +
            `*${alert.symbol}*\n` +
            `💰 Amount: $${formatNumber(alert.amount)}\n` +
            `📊 Quantity: ${formatNumber(alert.quantity)}\n` +
            `💵 Price: $${formatNumber(alert.price)}\n` +
            `📈 Action: ${action}\n` +
            `${alert.exchange ? `🏦 Exchange: ${alert.exchange}\n` : ''}` +
            `\n_Detected ${alert.timeAgo || 'just now'}_`;

        const groupResults = await telegramService.sendToAllGroups(groupMessage, 'whaleAlerts');
        if (groupResults.sent > 0) {
            console.log(`🐋 Whale alert sent to ${groupResults.sent} groups`);
        }

        // Clean up after 5 minutes
        setTimeout(() => sentWhaleAlerts.delete(alertKey), 5 * 60 * 1000);
    } catch (error) {
        console.error('Error sending whale alerts:', error.message);
    }
};

// ==================== ML PREDICTION ALERTS ====================

// Function to send ML prediction alert to subscribed users AND groups
const sendMLPredictionAlert = async (prediction) => {
    try {
        // Only alert for high confidence predictions (>70%)
        if (prediction.confidence < 0.7) return;

        // Get users who want ML prediction alerts
        const users = await User.find({
            telegramChatId: { $ne: null },
            'telegramNotifications.mlPredictions': { $ne: false }
        }).select('_id');

        console.log(`🤖 Sending ML prediction alert: ${prediction.symbol} to ${users.length} users`);

        for (const user of users) {
            await telegramService.sendMLPredictionAlert(user._id, prediction);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Also send to all linked groups
        const directionEmoji = prediction.direction === 'bullish' ? '📈' : '📉';
        const confidenceEmoji = prediction.confidence >= 0.8 ? '🔥' : prediction.confidence >= 0.6 ? '✨' : '💡';

        const groupMessage =
            `🤖 *New ML Prediction Alert*\n\n` +
            `${directionEmoji} *${prediction.symbol}*\n\n` +
            `📊 Prediction: *${prediction.direction.toUpperCase()}*\n` +
            `${confidenceEmoji} Confidence: ${(prediction.confidence * 100).toFixed(1)}%\n` +
            `💵 Current Price: $${formatNumber(prediction.currentPrice)}\n` +
            `🎯 Target: $${formatNumber(prediction.targetPrice)}\n` +
            `${prediction.stopLoss ? `🛑 Stop Loss: $${formatNumber(prediction.stopLoss)}\n` : ''}` +
            `⏰ Timeframe: ${prediction.timeframe || '24h'}\n\n` +
            `*Key Factors:*\n` +
            `${prediction.factors ? prediction.factors.map(f => `• ${f}`).join('\n') : '• Technical analysis\n• Market sentiment'}` +
            `\n\n_⚠️ This is not financial advice. Trade responsibly._`;

        const groupResults = await telegramService.sendToAllGroups(groupMessage, 'mlPredictions');
        if (groupResults.sent > 0) {
            console.log(`🤖 ML prediction alert sent to ${groupResults.sent} groups`);
        }
    } catch (error) {
        console.error('Error sending ML prediction alerts:', error.message);
    }
};

// ==================== PRICE ALERT NOTIFICATIONS ====================

// Function to send price alert when triggered
const sendPriceAlertNotification = async (userId, alert) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.telegramChatId) return;
        if (user.telegramNotifications?.priceAlerts === false) return;

        await telegramService.sendPriceAlert(userId, alert);
        console.log(`🔔 Price alert sent to user ${userId}: ${alert.symbol}`);
    } catch (error) {
        console.error('Error sending price alert notification:', error.message);
    }
};

// ==================== INITIALIZE ALL SCHEDULERS ====================

const initializeSchedulers = () => {
    if (!telegramService.isBotActive()) {
        console.log('⚠️ Telegram bot not active, schedulers not started');
        return;
    }

    startEconomicEventReminders();
    startDailySummaryScheduler();

    console.log('✅ All Telegram notification schedulers initialized');
};

module.exports = {
    initializeSchedulers,
    sendWhaleAlertToSubscribers,
    sendMLPredictionAlert,
    sendPriceAlertNotification
};
