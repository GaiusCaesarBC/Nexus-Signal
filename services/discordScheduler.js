// Discord Notification Scheduler
// Handles scheduled notifications: economic events, daily summaries, whale alerts, ML predictions

const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const discordService = require('./discordService');

// Track sent reminders to avoid duplicates
const sentEconomicReminders = new Set();
const sentWhaleAlerts = new Set();

// ==================== ECONOMIC CALENDAR REMINDERS ====================

// Check for upcoming economic events every 5 minutes
const startEconomicEventReminders = () => {
    console.log('[Discord] Economic event reminder scheduler started');

    cron.schedule('*/5 * * * *', async () => {
        try {
            const axios = require('axios');
            const response = await axios.get('https://finnhub.io/api/v1/calendar/economic', {
                params: { token: process.env.FINNHUB_API_KEY }
            }).catch(() => null);

            if (!response || !response.data?.economicCalendar) return;

            const events = response.data.economicCalendar || [];
            const now = new Date();

            for (const event of events) {
                const eventTime = new Date(event.time);
                const minutesUntil = (eventTime - now) / (1000 * 60);

                // Send reminder 30 minutes before high-impact events
                if (minutesUntil > 0 && minutesUntil <= 30 && event.impact === 3) {
                    const eventKey = `discord-${event.event}-${event.time}`;

                    if (!sentEconomicReminders.has(eventKey)) {
                        sentEconomicReminders.add(eventKey);

                        // Get users who want economic event notifications
                        const users = await User.find({
                            discordUserId: { $ne: null },
                            'discordNotifications.economicEvents': { $ne: false }
                        }).select('_id discordUserId');

                        console.log(`[Discord] Sending economic event: ${event.event} to ${users.length} users`);

                        const embed = new EmbedBuilder()
                            .setTitle('📅 Economic Event Reminder')
                            .setColor(0xffa500)
                            .addFields(
                                { name: 'Event', value: event.event, inline: false },
                                { name: '🕐 Time', value: eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }), inline: true },
                                { name: '📍 Country', value: event.country || 'US', inline: true },
                                { name: '⚡ Impact', value: 'High', inline: true }
                            );

                        if (event.prev) embed.addFields({ name: '📊 Previous', value: String(event.prev), inline: true });
                        if (event.estimate) embed.addFields({ name: '🎯 Forecast', value: String(event.estimate), inline: true });

                        embed.setFooter({ text: `Event starts in ${Math.round(minutesUntil)} minutes` });

                        // Send to users
                        for (const user of users) {
                            await discordService.sendToUser(user._id, embed);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }

                        // Send to all subscribed servers
                        const serverResults = await discordService.sendToAllServers(embed, 'economicEvents');
                        if (serverResults.sent > 0) {
                            console.log(`[Discord] Economic event sent to ${serverResults.sent} servers`);
                        }

                        // Clean up after 1 hour
                        setTimeout(() => sentEconomicReminders.delete(eventKey), 60 * 60 * 1000);
                    }
                }
            }
        } catch (error) {
            console.error('[Discord] Error in economic event scheduler:', error.message);
        }
    });
};

// ==================== DAILY MARKET SUMMARY ====================

// Send daily summary at 8 AM EST
const startDailySummaryScheduler = () => {
    console.log('[Discord] Daily summary scheduler started');

    // Run at 8 AM EST (13:00 UTC) Monday-Friday
    cron.schedule('0 13 * * 1-5', async () => {
        try {
            console.log('[Discord] Sending daily market summaries...');

            // Get users who want daily summaries
            const users = await User.find({
                discordUserId: { $ne: null },
                'discordNotifications.dailySummary': { $ne: false }
            }).select('_id discordUserId');

            if (users.length === 0) {
                console.log('[Discord] No users subscribed to daily summaries');
                return;
            }

            // Generate market summary
            const summary = await generateDailySummary();
            const embed = createDailySummaryEmbed(summary);

            // Send to users
            for (const user of users) {
                await discordService.sendToUser(user._id, embed);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`[Discord] Daily summaries sent to ${users.length} users`);

            // Send to all subscribed servers
            const serverResults = await discordService.sendToAllServers(embed, 'dailySummary');
            if (serverResults.sent > 0) {
                console.log(`[Discord] Daily summary sent to ${serverResults.sent} servers`);
            }
        } catch (error) {
            console.error('[Discord] Error sending daily summaries:', error.message);
        }
    });
};

// Create daily summary embed
const createDailySummaryEmbed = (summary) => {
    const marketEmoji = summary.marketTrend === 'bullish' ? '📈' : summary.marketTrend === 'bearish' ? '📉' : '📊';

    const embed = new EmbedBuilder()
        .setTitle('☀️ Daily Market Summary')
        .setColor(summary.marketTrend === 'bullish' ? 0x00ff00 : summary.marketTrend === 'bearish' ? 0xff0000 : 0x808080)
        .setDescription(`${marketEmoji} ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);

    // Major indices
    if (summary.indices && summary.indices.length > 0) {
        const indicesText = summary.indices.map(idx => {
            const emoji = idx.change >= 0 ? '🟢' : '🔴';
            const sign = idx.change >= 0 ? '+' : '';
            return `${emoji} ${idx.name}: ${sign}${idx.change.toFixed(2)}%`;
        }).join('\n');
        embed.addFields({ name: 'Major Indices', value: indicesText, inline: false });
    }

    // Top gainers
    if (summary.topGainers && summary.topGainers.length > 0) {
        const gainersText = summary.topGainers.slice(0, 3).map(s =>
            `🚀 ${s.symbol}: +${s.change.toFixed(2)}%`
        ).join('\n');
        embed.addFields({ name: 'Top Gainers', value: gainersText, inline: true });
    }

    // Top losers
    if (summary.topLosers && summary.topLosers.length > 0) {
        const losersText = summary.topLosers.slice(0, 3).map(s =>
            `📉 ${s.symbol}: ${s.change.toFixed(2)}%`
        ).join('\n');
        embed.addFields({ name: 'Top Losers', value: losersText, inline: true });
    }

    embed.setFooter({ text: 'Have a great trading day! 🎯' });
    embed.setTimestamp();

    return embed;
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
                if (response.data && response.data.c && response.data.pc) {
                    indicesData.push({
                        name: idx.name,
                        change: ((response.data.c - response.data.pc) / response.data.pc * 100)
                    });
                }
            } catch (e) {
                console.error(`[Discord] Error fetching ${idx.symbol}:`, e.message);
            }
        }

        // Fetch popular stocks
        const popularStocks = [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'NFLX', 'INTC',
            'JPM', 'V', 'MA', 'DIS', 'PYPL', 'CRM', 'UBER', 'COIN', 'SQ', 'SHOP',
            'BA', 'GS', 'MS', 'WMT', 'TGT', 'HD', 'NKE', 'SBUX', 'MCD', 'KO'
        ];

        const stockData = [];

        for (const symbol of popularStocks) {
            try {
                const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
                    params: { symbol, token: process.env.FINNHUB_API_KEY }
                });

                if (response.data && response.data.c && response.data.pc && response.data.pc !== 0) {
                    const change = ((response.data.c - response.data.pc) / response.data.pc * 100);
                    stockData.push({ symbol, price: response.data.c, change });
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                // Skip failed fetches
            }
        }

        // Sort for gainers/losers
        const sortedByChange = [...stockData].sort((a, b) => b.change - a.change);
        const topGainers = sortedByChange.filter(s => s.change > 0).slice(0, 5);
        const topLosers = sortedByChange.filter(s => s.change < 0).slice(-5).reverse();

        // Determine market trend
        const avgChange = indicesData.length > 0
            ? indicesData.reduce((sum, idx) => sum + idx.change, 0) / indicesData.length
            : 0;
        const marketTrend = avgChange > 0.5 ? 'bullish' : avgChange < -0.5 ? 'bearish' : 'neutral';

        return { marketTrend, indices: indicesData, topGainers, topLosers, upcomingEvents: [] };
    } catch (error) {
        console.error('[Discord] Error generating daily summary:', error.message);
        return { marketTrend: 'neutral', indices: [], topGainers: [], topLosers: [], upcomingEvents: [] };
    }
};

// ==================== WHALE ALERT NOTIFICATIONS ====================

// Helper to format numbers
const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num >= 100) return num.toFixed(2);
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.01) return num.toFixed(6);
    if (num >= 0.0001) return num.toFixed(8);
    return num.toFixed(10);
};

// Send whale alert to Discord subscribers
const sendWhaleAlertToSubscribers = async (alert) => {
    try {
        const alertKey = `discord-${alert.symbol}-${alert.amount}-${Date.now()}`;

        if (sentWhaleAlerts.has(alertKey)) return;
        sentWhaleAlerts.add(alertKey);

        // Get users who want whale alerts
        const users = await User.find({
            discordUserId: { $ne: null },
            'discordNotifications.whaleAlerts': { $ne: false }
        }).select('_id');

        console.log(`[Discord] Sending whale alert: ${alert.symbol} $${alert.amount} to ${users.length} users`);

        const isBuy = alert.type === 'buy';
        const embed = new EmbedBuilder()
            .setTitle('🐋 Whale Alert!')
            .setColor(isBuy ? 0x00ff00 : 0xff0000)
            .setDescription(`${isBuy ? '🟢' : '🔴'} Large ${alert.assetType || 'crypto'} movement detected!`)
            .addFields(
                { name: 'Symbol', value: alert.symbol, inline: true },
                { name: '💰 Amount', value: `$${formatNumber(alert.amount)}`, inline: true },
                { name: '📊 Quantity', value: formatNumber(alert.quantity), inline: true },
                { name: '💵 Price', value: `$${formatNumber(alert.price)}`, inline: true },
                { name: '📈 Action', value: isBuy ? 'BOUGHT' : 'SOLD', inline: true }
            );

        if (alert.exchange) embed.addFields({ name: '🏦 Exchange', value: alert.exchange, inline: true });
        embed.setFooter({ text: `Detected ${alert.timeAgo || 'just now'}` });
        embed.setTimestamp();

        // Send to users
        for (const user of users) {
            await discordService.sendToUser(user._id, embed);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send to servers
        const serverResults = await discordService.sendToAllServers(embed, 'whaleAlerts');
        if (serverResults.sent > 0) {
            console.log(`[Discord] Whale alert sent to ${serverResults.sent} servers`);
        }

        // Clean up after 5 minutes
        setTimeout(() => sentWhaleAlerts.delete(alertKey), 5 * 60 * 1000);
    } catch (error) {
        console.error('[Discord] Error sending whale alerts:', error.message);
    }
};

// ==================== ML PREDICTION ALERTS ====================

// Send ML prediction alert to Discord subscribers
const sendMLPredictionAlert = async (prediction) => {
    try {
        // Only alert for high confidence predictions (>70%)
        if (prediction.confidence < 70) return;

        // Get users who want ML prediction alerts
        const users = await User.find({
            discordUserId: { $ne: null },
            'discordNotifications.mlPredictions': { $ne: false }
        }).select('_id');

        console.log(`[Discord] Sending ML prediction: ${prediction.symbol} to ${users.length} users`);

        const embed = discordService.createPredictionEmbed(prediction);

        // Send to users
        for (const user of users) {
            await discordService.sendToUser(user._id, embed);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send to servers
        const serverResults = await discordService.sendToAllServers(embed, 'mlPredictions');
        if (serverResults.sent > 0) {
            console.log(`[Discord] ML prediction sent to ${serverResults.sent} servers`);
        }
    } catch (error) {
        console.error('[Discord] Error sending ML prediction alerts:', error.message);
    }
};

// ==================== PRICE ALERT NOTIFICATIONS ====================

// Send price alert when triggered
const sendPriceAlertNotification = async (userId, alert) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.discordUserId) return;
        if (user.discordNotifications?.priceAlerts === false) return;

        await discordService.sendPriceAlert(userId, alert);
        console.log(`[Discord] Price alert sent to user ${userId}: ${alert.symbol}`);
    } catch (error) {
        console.error('[Discord] Error sending price alert:', error.message);
    }
};

// ==================== TECHNICAL ALERT NOTIFICATIONS ====================

// Send technical alert when triggered
const sendTechnicalAlertNotification = async (userId, alert) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.discordUserId) return;
        if (user.discordNotifications?.priceAlerts === false) return;

        await discordService.sendTechnicalAlert(userId, alert);
        console.log(`[Discord] Technical alert sent to user ${userId}: ${alert.type} for ${alert.symbol}`);
    } catch (error) {
        console.error('[Discord] Error sending technical alert:', error.message);
    }
};

// ==================== INITIALIZE ALL SCHEDULERS ====================

const initializeSchedulers = () => {
    if (!discordService.isBotActive()) {
        console.log('[Discord] Bot not active, schedulers not started');
        return;
    }

    startEconomicEventReminders();
    startDailySummaryScheduler();

    console.log('[Discord] All notification schedulers initialized');
};

module.exports = {
    initializeSchedulers,
    sendWhaleAlertToSubscribers,
    sendMLPredictionAlert,
    sendPriceAlertNotification,
    sendTechnicalAlertNotification
};
