// Telegram Bot Service for Nexus Signal Notifications
const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');

let bot = null;

// Initialize the Telegram bot
const initializeBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.log('⚠️ TELEGRAM_BOT_TOKEN not set - Telegram notifications disabled');
        return null;
    }

    try {
        bot = new TelegramBot(token, { polling: true });

        // Handle /start command - user links their account
        bot.onText(/\/start (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const linkToken = match[1];

            try {
                // Find user by link token
                const user = await User.findOne({ telegramLinkToken: linkToken });

                if (!user) {
                    bot.sendMessage(chatId, '❌ Invalid or expired link token. Please generate a new one from Nexus Signal settings.');
                    return;
                }

                // Link the Telegram account
                user.telegramChatId = chatId.toString();
                user.telegramUsername = msg.chat.username || null;
                user.telegramLinkedAt = new Date();
                user.telegramLinkToken = null; // Clear the token after use
                await user.save();

                bot.sendMessage(chatId,
                    `✅ *Account Linked Successfully!*\n\n` +
                    `Welcome to Nexus Signal notifications, ${user.username}!\n\n` +
                    `You'll now receive:\n` +
                    `📅 Economic Calendar Reminders\n` +
                    `🐋 Whale Alerts\n` +
                    `📊 Daily Market Summaries\n` +
                    `🤖 ML Prediction Alerts\n\n` +
                    `Manage your preferences in the Nexus Signal app settings.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error('Error linking Telegram account:', error);
                bot.sendMessage(chatId, '❌ An error occurred while linking your account. Please try again.');
            }
        });

        // Handle /start without token
        bot.onText(/^\/start$/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId,
                `👋 *Welcome to Nexus Signal Bot!*\n\n` +
                `To receive notifications, please link your account:\n\n` +
                `1. Go to Nexus Signal app\n` +
                `2. Navigate to Settings → Notifications\n` +
                `3. Click "Link Telegram"\n` +
                `4. Click the generated link or scan the QR code\n\n` +
                `Need help? Visit our website or contact support.`,
                { parse_mode: 'Markdown' }
            );
        });

        // Handle /stop command - unlink account
        bot.onText(/\/stop/, async (msg) => {
            const chatId = msg.chat.id;

            try {
                const user = await User.findOne({ telegramChatId: chatId.toString() });

                if (!user) {
                    bot.sendMessage(chatId, '❓ No account is linked to this chat.');
                    return;
                }

                user.telegramChatId = null;
                user.telegramUsername = null;
                user.telegramLinkedAt = null;
                await user.save();

                bot.sendMessage(chatId,
                    `👋 *Account Unlinked*\n\n` +
                    `You will no longer receive notifications from Nexus Signal.\n` +
                    `You can link your account again anytime from the app settings.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error('Error unlinking Telegram account:', error);
                bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
            }
        });

        // Handle /status command
        bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;

            try {
                const user = await User.findOne({ telegramChatId: chatId.toString() });

                if (!user) {
                    bot.sendMessage(chatId, '❓ No account linked. Use the link from Nexus Signal settings to connect.');
                    return;
                }

                const prefs = user.telegramNotifications || {};
                bot.sendMessage(chatId,
                    `📱 *Notification Status*\n\n` +
                    `Account: ${user.username}\n` +
                    `Linked: ${user.telegramLinkedAt ? user.telegramLinkedAt.toLocaleDateString() : 'Unknown'}\n\n` +
                    `*Notification Preferences:*\n` +
                    `📅 Economic Events: ${prefs.economicEvents !== false ? '✅' : '❌'}\n` +
                    `🐋 Whale Alerts: ${prefs.whaleAlerts !== false ? '✅' : '❌'}\n` +
                    `📊 Daily Summary: ${prefs.dailySummary !== false ? '✅' : '❌'}\n` +
                    `🤖 ML Predictions: ${prefs.mlPredictions !== false ? '✅' : '❌'}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error('Error getting status:', error);
                bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
            }
        });

        console.log('✅ Telegram bot initialized successfully');
        return bot;
    } catch (error) {
        console.error('❌ Failed to initialize Telegram bot:', error);
        return null;
    }
};

// Send message to a specific user
const sendToUser = async (userId, message, options = {}) => {
    if (!bot) return false;

    try {
        const user = await User.findById(userId);
        if (!user || !user.telegramChatId) return false;

        await bot.sendMessage(user.telegramChatId, message, {
            parse_mode: 'Markdown',
            ...options
        });
        return true;
    } catch (error) {
        console.error(`Error sending Telegram message to user ${userId}:`, error);
        return false;
    }
};

// Send message to chat ID directly
const sendToChatId = async (chatId, message, options = {}) => {
    if (!bot) return false;

    try {
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            ...options
        });
        return true;
    } catch (error) {
        console.error(`Error sending Telegram message to chat ${chatId}:`, error);
        return false;
    }
};

// ==================== NOTIFICATION FUNCTIONS ====================

// Economic Calendar Reminder
const sendEconomicEventReminder = async (userId, event) => {
    const message =
        `📅 *Economic Event Reminder*\n\n` +
        `*${event.title}*\n` +
        `🕐 Time: ${event.time}\n` +
        `📍 Country: ${event.country || 'US'}\n` +
        `⚡ Impact: ${event.impact || 'High'}\n` +
        `${event.previous ? `📊 Previous: ${event.previous}\n` : ''}` +
        `${event.forecast ? `🎯 Forecast: ${event.forecast}\n` : ''}\n` +
        `_Event starts in ${event.minutesUntil || 30} minutes_`;

    return sendToUser(userId, message);
};

// Whale Alert
const sendWhaleAlert = async (userId, alert) => {
    const emoji = alert.type === 'buy' ? '🟢' : '🔴';
    const action = alert.type === 'buy' ? 'BOUGHT' : 'SOLD';

    const message =
        `🐋 *Whale Alert!*\n\n` +
        `${emoji} Large ${alert.assetType || 'crypto'} movement detected!\n\n` +
        `*${alert.symbol}*\n` +
        `💰 Amount: $${formatNumber(alert.amount)}\n` +
        `📊 Quantity: ${formatNumber(alert.quantity)}\n` +
        `💵 Price: $${formatNumber(alert.price)}\n` +
        `📈 Action: ${action}\n` +
        `${alert.exchange ? `🏦 Exchange: ${alert.exchange}\n` : ''}` +
        `\n_Detected ${alert.timeAgo || 'just now'}_`;

    return sendToUser(userId, message);
};

// Daily Market Summary
const sendDailySummary = async (userId, summary) => {
    const marketEmoji = summary.marketTrend === 'bullish' ? '📈' : summary.marketTrend === 'bearish' ? '📉' : '📊';

    let message =
        `☀️ *Daily Market Summary*\n` +
        `_${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}_\n\n` +
        `${marketEmoji} *Market Overview*\n`;

    // Major indices
    if (summary.indices) {
        message += `\n*Major Indices:*\n`;
        summary.indices.forEach(idx => {
            const emoji = idx.change >= 0 ? '🟢' : '🔴';
            const sign = idx.change >= 0 ? '+' : '';
            message += `${emoji} ${idx.name}: ${sign}${idx.change.toFixed(2)}%\n`;
        });
    }

    // Top movers
    if (summary.topGainers && summary.topGainers.length > 0) {
        message += `\n*Top Gainers:*\n`;
        summary.topGainers.slice(0, 3).forEach(stock => {
            message += `🚀 ${stock.symbol}: +${stock.change.toFixed(2)}%\n`;
        });
    }

    if (summary.topLosers && summary.topLosers.length > 0) {
        message += `\n*Top Losers:*\n`;
        summary.topLosers.slice(0, 3).forEach(stock => {
            message += `📉 ${stock.symbol}: ${stock.change.toFixed(2)}%\n`;
        });
    }

    // Portfolio summary if available
    if (summary.portfolio) {
        const pnlEmoji = summary.portfolio.dailyPnL >= 0 ? '🟢' : '🔴';
        const sign = summary.portfolio.dailyPnL >= 0 ? '+' : '';
        message += `\n*Your Portfolio:*\n`;
        message += `${pnlEmoji} Daily P/L: ${sign}$${formatNumber(summary.portfolio.dailyPnL)}\n`;
        message += `💼 Total Value: $${formatNumber(summary.portfolio.totalValue)}\n`;
    }

    // Upcoming events
    if (summary.upcomingEvents && summary.upcomingEvents.length > 0) {
        message += `\n*Today's Key Events:*\n`;
        summary.upcomingEvents.slice(0, 3).forEach(event => {
            message += `📅 ${event.time} - ${event.title}\n`;
        });
    }

    message += `\n_Have a great trading day!_ 🎯`;

    return sendToUser(userId, message);
};

// ML Prediction Alert
const sendMLPredictionAlert = async (userId, prediction) => {
    const directionEmoji = prediction.direction === 'bullish' ? '📈' : '📉';
    const confidenceEmoji = prediction.confidence >= 0.8 ? '🔥' : prediction.confidence >= 0.6 ? '✨' : '💡';

    const message =
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

    return sendToUser(userId, message);
};

// Price Alert
const sendPriceAlert = async (userId, alert) => {
    const emoji = alert.condition === 'above' ? '📈' : '📉';
    const action = alert.condition === 'above' ? 'risen above' : 'fallen below';

    const message =
        `🔔 *Price Alert Triggered!*\n\n` +
        `${emoji} *${alert.symbol}* has ${action} your target!\n\n` +
        `🎯 Target: $${formatNumber(alert.targetPrice)}\n` +
        `💵 Current: $${formatNumber(alert.currentPrice)}\n` +
        `📊 Change: ${alert.changePercent >= 0 ? '+' : ''}${alert.changePercent.toFixed(2)}%\n\n` +
        `_Alert set on ${new Date(alert.createdAt).toLocaleDateString()}_`;

    return sendToUser(userId, message);
};

// Broadcast to all users with specific preference enabled
const broadcastToSubscribers = async (preferenceKey, message) => {
    if (!bot) return { sent: 0, failed: 0 };

    try {
        const query = {
            telegramChatId: { $ne: null },
            [`telegramNotifications.${preferenceKey}`]: { $ne: false }
        };

        const users = await User.find(query).select('telegramChatId');
        let sent = 0;
        let failed = 0;

        for (const user of users) {
            try {
                await bot.sendMessage(user.telegramChatId, message, { parse_mode: 'Markdown' });
                sent++;
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                failed++;
            }
        }

        return { sent, failed };
    } catch (error) {
        console.error('Error broadcasting to subscribers:', error);
        return { sent: 0, failed: 0 };
    }
};

// Helper function to format numbers
const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Get bot instance
const getBot = () => bot;

// Check if bot is active
const isBotActive = () => bot !== null;

module.exports = {
    initializeBot,
    getBot,
    isBotActive,
    sendToUser,
    sendToChatId,
    sendEconomicEventReminder,
    sendWhaleAlert,
    sendDailySummary,
    sendMLPredictionAlert,
    sendPriceAlert,
    broadcastToSubscribers
};
