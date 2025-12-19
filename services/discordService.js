// Discord Bot Service for Nexus Signal Notifications
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');
const DiscordServer = require('../models/DiscordServer');
const axios = require('axios');

let client = null;

// In-memory cache for linked servers (synced with MongoDB)
let linkedServers = new Map(); // `${guildId}-${channelId}` -> { guildName, channelName, linkedAt, linkedBy, notifications }

// Initialize the Discord bot
const initializeBot = async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!token || !clientId) {
        console.log('[Discord] DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID not set - Discord notifications disabled');
        return null;
    }

    try {
        client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // Register slash commands
        await registerSlashCommands(token, clientId);

        // Handle interaction events (slash commands)
        client.on('interactionCreate', handleInteraction);

        // Bot ready event
        client.on('ready', async () => {
            console.log(`[Discord] Bot logged in as ${client.user.tag}`);
            // Load servers from DB
            await loadServersFromDB();
        });

        // Error handling
        client.on('error', (error) => {
            console.error('[Discord] Client error:', error);
        });

        // Login to Discord
        await client.login(token);

        console.log('[Discord] Bot initialized successfully');
        return client;
    } catch (error) {
        console.error('[Discord] Failed to initialize bot:', error);
        return null;
    }
};

// Register slash commands with Discord API
const registerSlashCommands = async (token, clientId) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('predict')
            .setDescription('Get ML prediction for a stock or crypto')
            .addStringOption(option =>
                option.setName('symbol')
                    .setDescription('Stock/crypto symbol (e.g., AAPL, BTC)')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('timeframe')
                    .setDescription('Prediction timeframe')
                    .setRequired(false)
                    .addChoices(
                        { name: '7 days (short-term)', value: '7' },
                        { name: '30 days (medium-term)', value: '30' },
                        { name: '90 days (long-term)', value: '90' }
                    )),
        new SlashCommandBuilder()
            .setName('price')
            .setDescription('Get current price for a stock or crypto')
            .addStringOption(option =>
                option.setName('symbol')
                    .setDescription('Stock/crypto symbol (e.g., AAPL, BTC)')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('link')
            .setDescription('Link your Nexus Signal account')
            .addStringOption(option =>
                option.setName('token')
                    .setDescription('Your link token from Nexus Signal settings')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('unlink')
            .setDescription('Unlink your Nexus Signal account'),
        new SlashCommandBuilder()
            .setName('status')
            .setDescription('View your notification preferences'),
        new SlashCommandBuilder()
            .setName('subscribe')
            .setDescription('Subscribe this channel to Nexus Signal alerts (admin only)')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Channel to subscribe (defaults to current)')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('unsubscribe')
            .setDescription('Unsubscribe this channel from alerts (admin only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Show available Nexus Signal commands')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);
    const guildId = process.env.DISCORD_GUILD_ID;

    try {
        console.log('[Discord] Registering slash commands...');

        if (guildId) {
            // Guild-specific commands (instant)
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log(`[Discord] Slash commands registered to guild ${guildId} (instant)`);
        } else {
            // Global commands (takes up to 1 hour)
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log('[Discord] Slash commands registered globally (may take up to 1 hour)');
        }
    } catch (error) {
        console.error('[Discord] Error registering slash commands:', error);
    }
};

// Handle slash command interactions
const handleInteraction = async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'predict':
                await handlePredictCommand(interaction);
                break;
            case 'price':
                await handlePriceCommand(interaction);
                break;
            case 'link':
                await handleLinkCommand(interaction);
                break;
            case 'unlink':
                await handleUnlinkCommand(interaction);
                break;
            case 'status':
                await handleStatusCommand(interaction);
                break;
            case 'subscribe':
                await handleSubscribeCommand(interaction);
                break;
            case 'unsubscribe':
                await handleUnsubscribeCommand(interaction);
                break;
            case 'help':
                await handleHelpCommand(interaction);
                break;
            default:
                await interaction.reply({ content: 'Unknown command', ephemeral: true });
        }
    } catch (error) {
        console.error(`[Discord] Error handling command ${commandName}:`, error);
        const reply = { content: 'An error occurred while processing your command.', ephemeral: true };
        if (interaction.deferred) {
            await interaction.editReply(reply);
        } else {
            await interaction.reply(reply);
        }
    }
};

// ==================== COMMAND HANDLERS ====================

// /predict <symbol> [timeframe]
const handlePredictCommand = async (interaction) => {
    await interaction.deferReply();

    const symbol = interaction.options.getString('symbol').toUpperCase();
    const timeframeOption = interaction.options.getString('timeframe');
    const days = timeframeOption ? parseInt(timeframeOption, 10) : 7;  // Default to 7 days
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

    // Timeframe labels for display
    const timeframeLabels = {
        7: 'short-term',
        30: 'medium-term',
        90: 'long-term'
    };

    try {
        // For non-default timeframes, skip cache and go directly to ML service
        if (days !== 7) {
            console.log(`[Discord] ${days}-day prediction for ${symbol}, calling ML service...`);

            const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
                symbol: symbol,
                days: days
            }, { timeout: 30000 });

            if (!mlResponse.data || mlResponse.data.error) {
                await interaction.editReply({
                    content: `Could not generate ${days}-day prediction for ${symbol}. ${mlResponse.data?.error || 'The symbol may not be supported.'}`
                });
                return;
            }

            const mlData = mlResponse.data;
            const factors = buildFactorsFromMLData(mlData);

            const prediction = {
                symbol: symbol,
                direction: mlData.prediction?.direction || mlData.direction || 'neutral',
                confidence: mlData.prediction?.confidence || mlData.confidence || 50,
                currentPrice: mlData.current_price || mlData.currentPrice,
                targetPrice: mlData.prediction?.target_price || mlData.targetPrice,
                timeframe: `${days} days (${timeframeLabels[days] || 'custom'})`,
                factors: factors.length > 0 ? factors : ['Technical analysis', 'Price momentum', 'ML model analysis']
            };

            const embed = createPredictionEmbed(prediction);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // For 7-day predictions, try cache first
        const cacheResponse = await axios.get(`http://localhost:${process.env.PORT || 5000}/api/predictions/active/${symbol}`);

        if (cacheResponse.data.success && cacheResponse.data.exists && cacheResponse.data.prediction) {
            // Use cached prediction
            const data = cacheResponse.data.prediction;
            const factors = buildFactorsFromData(data);

            const prediction = {
                symbol: data.symbol,
                direction: data.prediction?.direction || 'neutral',
                confidence: data.liveConfidence || data.prediction?.confidence || 0,
                currentPrice: data.current_price,
                targetPrice: data.prediction?.target_price,
                timeframe: data.prediction?.days ? `${data.prediction.days} days` : '7 days',
                factors: factors.length > 0 ? factors : ['Technical analysis', 'Price momentum']
            };

            const embed = createPredictionEmbed(prediction);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // No cached prediction - generate a fresh one from ML service
        console.log(`[Discord] No cached prediction for ${symbol}, calling ML service...`);

        // Call the ML service directly
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
            symbol: symbol,
            days: days
        }, { timeout: 30000 });

        if (!mlResponse.data || mlResponse.data.error) {
            await interaction.editReply({
                content: `Could not generate prediction for ${symbol}. ${mlResponse.data?.error || 'The symbol may not be supported.'}`
            });
            return;
        }

        const mlData = mlResponse.data;
        const factors = buildFactorsFromMLData(mlData);

        const prediction = {
            symbol: symbol,
            direction: mlData.prediction?.direction || mlData.direction || 'neutral',
            confidence: mlData.prediction?.confidence || mlData.confidence || 50,
            currentPrice: mlData.current_price || mlData.currentPrice,
            targetPrice: mlData.prediction?.target_price || mlData.targetPrice,
            timeframe: mlData.prediction?.days ? `${mlData.prediction.days} days` : '7 days',
            factors: factors.length > 0 ? factors : ['Technical analysis', 'Price momentum', 'ML model analysis']
        };

        const embed = createPredictionEmbed(prediction);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(`[Discord] Error fetching prediction for ${symbol}:`, error.message);

        // Provide more helpful error messages
        if (error.code === 'ECONNREFUSED') {
            await interaction.editReply({ content: `ML service is temporarily unavailable. Please try again later.` });
        } else if (error.response?.status === 400) {
            await interaction.editReply({ content: `Invalid symbol: ${symbol}. Please check the ticker and try again.` });
        } else {
            await interaction.editReply({ content: `Could not fetch prediction for ${symbol}. Please try again later.` });
        }
    }
};

// Helper function to build factors from ML response
const buildFactorsFromMLData = (mlData) => {
    const factors = [];
    if (mlData.indicators && typeof mlData.indicators === 'object') {
        Object.entries(mlData.indicators).forEach(([name, indicator]) => {
            if (indicator && typeof indicator === 'object') {
                const value = indicator.value !== undefined ? indicator.value : indicator;
                const signal = indicator.signal || '';
                factors.push(`${name}: ${value}${signal ? ` (${signal})` : ''}`);
            } else if (indicator !== null && indicator !== undefined) {
                factors.push(`${name}: ${indicator}`);
            }
        });
    }
    if (mlData.analysis && typeof mlData.analysis === 'object') {
        if (mlData.analysis.trend) factors.push(`Trend: ${mlData.analysis.trend}`);
        if (mlData.analysis.volatility) factors.push(`Volatility: ${mlData.analysis.volatility}`);
    }
    return factors;
};

// Helper function to build factors from prediction data
const buildFactorsFromData = (data) => {
    const factors = [];
    if (data.indicators && typeof data.indicators === 'object') {
        Object.entries(data.indicators).forEach(([name, indicator]) => {
            if (indicator && typeof indicator === 'object') {
                const value = indicator.value !== undefined ? indicator.value : indicator;
                const signal = indicator.signal || '';
                factors.push(`${name}: ${value}${signal ? ` (${signal})` : ''}`);
            } else if (indicator !== null && indicator !== undefined) {
                factors.push(`${name}: ${indicator}`);
            }
        });
    }
    // Add analysis info if no indicators
    if (factors.length === 0 && data.analysis && typeof data.analysis === 'object') {
        if (data.analysis.trend) factors.push(`Trend: ${data.analysis.trend}`);
        if (data.analysis.volatility) factors.push(`Volatility: ${data.analysis.volatility}`);
    }
    return factors;
};

// /price <symbol>
const handlePriceCommand = async (interaction) => {
    await interaction.deferReply();

    const symbol = interaction.options.getString('symbol').toUpperCase();

    try {
        // Try Finnhub API for stocks
        const response = await axios.get('https://finnhub.io/api/v1/quote', {
            params: { symbol, token: process.env.FINNHUB_API_KEY }
        });

        if (response.data && response.data.c && response.data.c !== 0) {
            const price = response.data.c;
            const previousClose = response.data.pc;
            const change = price - previousClose;
            const changePercent = previousClose ? ((change / previousClose) * 100) : 0;

            const embed = new EmbedBuilder()
                .setTitle(`${symbol} Price`)
                .setColor(changePercent >= 0 ? 0x00ff00 : 0xff0000)
                .addFields(
                    { name: 'Current Price', value: `$${formatNumber(price)}`, inline: true },
                    { name: 'Change', value: `${changePercent >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`, inline: true },
                    { name: 'Previous Close', value: `$${formatNumber(previousClose)}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Nexus Signal' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: `Could not find price for ${symbol}. Make sure the symbol is correct.` });
        }
    } catch (error) {
        console.error(`[Discord] Error fetching price for ${symbol}:`, error.message);
        await interaction.editReply({ content: `Could not fetch price for ${symbol}. Please try again later.` });
    }
};

// /link <token>
const handleLinkCommand = async (interaction) => {
    const token = interaction.options.getString('token');
    const userId = interaction.user.id;
    const username = interaction.user.username;

    try {
        // Find user by link token
        const user = await User.findOne({
            discordLinkToken: token,
            discordLinkTokenExpires: { $gt: new Date() }
        });

        if (!user) {
            await interaction.reply({
                content: 'Invalid or expired link token. Please generate a new one from Nexus Signal settings.',
                ephemeral: true
            });
            return;
        }

        // Link the Discord account
        user.discordUserId = userId;
        user.discordUsername = username;
        user.discordLinkedAt = new Date();
        user.discordLinkToken = null;
        user.discordLinkTokenExpires = null;
        await user.save();

        const embed = new EmbedBuilder()
            .setTitle('Account Linked Successfully!')
            .setColor(0x00ff00)
            .setDescription(`Welcome to Nexus Signal notifications, ${user.username}!`)
            .addFields(
                { name: "You'll now receive:", value:
                    '📅 Economic Calendar Reminders\n' +
                    '🐋 Whale Alerts\n' +
                    '📊 Daily Market Summaries\n' +
                    '🤖 ML Prediction Alerts'
                }
            )
            .setFooter({ text: 'Manage preferences in Nexus Signal app settings' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('[Discord] Error linking account:', error);
        await interaction.reply({
            content: 'An error occurred while linking your account. Please try again.',
            ephemeral: true
        });
    }
};

// /unlink
const handleUnlinkCommand = async (interaction) => {
    const userId = interaction.user.id;

    try {
        const user = await User.findOne({ discordUserId: userId });

        if (!user) {
            await interaction.reply({
                content: 'No account is linked to your Discord. Use /link to connect your Nexus Signal account.',
                ephemeral: true
            });
            return;
        }

        user.discordUserId = null;
        user.discordUsername = null;
        user.discordLinkedAt = null;
        await user.save();

        await interaction.reply({
            content: '👋 **Account Unlinked**\n\nYou will no longer receive notifications from Nexus Signal.\nYou can link your account again anytime using /link.',
            ephemeral: true
        });
    } catch (error) {
        console.error('[Discord] Error unlinking account:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true
        });
    }
};

// /status
const handleStatusCommand = async (interaction) => {
    const userId = interaction.user.id;

    try {
        const user = await User.findOne({ discordUserId: userId });

        if (!user) {
            await interaction.reply({
                content: '❓ No account linked. Use /link with your token from Nexus Signal settings.',
                ephemeral: true
            });
            return;
        }

        const prefs = user.discordNotifications || {};
        const embed = new EmbedBuilder()
            .setTitle('📱 Notification Status')
            .setColor(0x5865f2)
            .addFields(
                { name: 'Account', value: user.username, inline: true },
                { name: 'Linked', value: user.discordLinkedAt ? user.discordLinkedAt.toLocaleDateString() : 'Unknown', inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Notification Preferences', value:
                    `📅 Economic Events: ${prefs.economicEvents !== false ? '✅' : '❌'}\n` +
                    `🐋 Whale Alerts: ${prefs.whaleAlerts !== false ? '✅' : '❌'}\n` +
                    `📊 Daily Summary: ${prefs.dailySummary !== false ? '✅' : '❌'}\n` +
                    `🤖 ML Predictions: ${prefs.mlPredictions !== false ? '✅' : '❌'}\n` +
                    `🔔 Price Alerts: ${prefs.priceAlerts !== false ? '✅' : '❌'}`
                }
            )
            .setFooter({ text: 'Update preferences in Nexus Signal app settings' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('[Discord] Error getting status:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true
        });
    }
};

// /subscribe
const handleSubscribeCommand = async (interaction) => {
    // Must be in a guild
    if (!interaction.guild) {
        await interaction.reply({
            content: 'This command only works in servers.',
            ephemeral: true
        });
        return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const guildId = interaction.guild.id;
    const channelId = channel.id;

    try {
        const serverData = {
            guildName: interaction.guild.name,
            channelName: channel.name,
            linkedBy: interaction.user.username,
            linkedByUserId: interaction.user.id,
            notifications: {
                economicEvents: true,
                whaleAlerts: true,
                dailySummary: true,
                mlPredictions: true,
                priceAlerts: true
            }
        };

        // Save to memory cache
        linkedServers.set(`${guildId}-${channelId}`, serverData);

        // Save to MongoDB
        await DiscordServer.linkServer(guildId, channelId, serverData);

        const embed = new EmbedBuilder()
            .setTitle('✅ Channel Subscribed!')
            .setColor(0x00ff00)
            .setDescription(`#${channel.name} will now receive Nexus Signal alerts:`)
            .addFields(
                { name: 'Active Notifications', value:
                    '📅 Economic Calendar Reminders\n' +
                    '🐋 Whale Alerts\n' +
                    '📊 Daily Market Summaries\n' +
                    '🤖 ML Prediction Alerts\n' +
                    '🔔 Price Alerts'
                }
            )
            .setFooter({ text: 'Use /unsubscribe to stop receiving alerts' });

        await interaction.reply({ embeds: [embed] });
        console.log(`[Discord] Server subscribed: ${interaction.guild.name} #${channel.name}`);
    } catch (error) {
        console.error('[Discord] Error subscribing channel:', error);
        await interaction.reply({
            content: 'Failed to subscribe channel. Please try again.',
            ephemeral: true
        });
    }
};

// /unsubscribe
const handleUnsubscribeCommand = async (interaction) => {
    if (!interaction.guild) {
        await interaction.reply({
            content: 'This command only works in servers.',
            ephemeral: true
        });
        return;
    }

    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;
    const key = `${guildId}-${channelId}`;

    try {
        if (!linkedServers.has(key)) {
            await interaction.reply({
                content: 'This channel is not subscribed to alerts. Use /subscribe to start receiving them.',
                ephemeral: true
            });
            return;
        }

        linkedServers.delete(key);
        await DiscordServer.unlinkServer(guildId, channelId);

        await interaction.reply({
            content: '👋 **Channel Unsubscribed**\n\nThis channel will no longer receive Nexus Signal alerts.\nUse /subscribe to reconnect anytime.',
            ephemeral: false
        });

        console.log(`[Discord] Server unsubscribed: ${interaction.guild.name} #${interaction.channel.name}`);
    } catch (error) {
        console.error('[Discord] Error unsubscribing channel:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true
        });
    }
};

// /help
const handleHelpCommand = async (interaction) => {
    const isGuild = !!interaction.guild;

    const embed = new EmbedBuilder()
        .setTitle('📚 Nexus Signal Bot - Commands')
        .setColor(0x5865f2)
        .addFields(
            { name: '📊 Market Data', value:
                '`/predict <symbol>` - Get ML prediction\n' +
                '`/price <symbol>` - Get current price'
            },
            { name: '🔗 Account', value:
                '`/link <token>` - Link your Nexus Signal account\n' +
                '`/unlink` - Unlink your account\n' +
                '`/status` - View notification preferences'
            }
        );

    if (isGuild) {
        embed.addFields({
            name: '⚙️ Server Management (Admin)', value:
                '`/subscribe [channel]` - Subscribe channel to alerts\n' +
                '`/unsubscribe` - Remove channel subscription'
        });
    }

    embed.addFields({
        name: '🔔 Notifications You Can Receive', value:
            '📅 Economic Calendar Reminders\n' +
            '🐋 Whale Alerts\n' +
            '📊 Daily Market Summaries\n' +
            '🤖 ML Prediction Alerts\n' +
            '🔔 Price Alerts'
    });

    embed.setFooter({ text: 'Get your link token from Nexus Signal app settings' });

    await interaction.reply({ embeds: [embed] });
};

// ==================== NOTIFICATION FUNCTIONS ====================

// Send message to a specific user by MongoDB ID
const sendToUser = async (userId, embed) => {
    if (!client) return false;

    try {
        const user = await User.findById(userId);
        if (!user || !user.discordUserId) return false;

        const discordUser = await client.users.fetch(user.discordUserId);
        await discordUser.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`[Discord] Error sending message to user ${userId}:`, error.message);
        return false;
    }
};

// Send message to a channel
const sendToChannel = async (channelId, embed) => {
    if (!client) return false;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return false;

        await channel.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`[Discord] Error sending to channel ${channelId}:`, error.message);
        return false;
    }
};

// Economic Event Reminder
const sendEconomicEventReminder = async (userId, event) => {
    const embed = new EmbedBuilder()
        .setTitle('📅 Economic Event Reminder')
        .setColor(0xffa500)
        .addFields(
            { name: 'Event', value: event.title, inline: false },
            { name: '🕐 Time', value: event.time, inline: true },
            { name: '📍 Country', value: event.country || 'US', inline: true },
            { name: '⚡ Impact', value: event.impact || 'High', inline: true }
        );

    if (event.previous) embed.addFields({ name: '📊 Previous', value: event.previous, inline: true });
    if (event.forecast) embed.addFields({ name: '🎯 Forecast', value: event.forecast, inline: true });

    embed.setFooter({ text: `Event starts in ${event.minutesUntil || 30} minutes` });

    return sendToUser(userId, embed);
};

// Whale Alert
const sendWhaleAlert = async (userId, alert) => {
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

    return sendToUser(userId, embed);
};

// Daily Market Summary
const sendDailySummary = async (userId, summary) => {
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

    return sendToUser(userId, embed);
};

// ML Prediction Alert
const sendMLPredictionAlert = async (userId, prediction) => {
    const isBullish = prediction.direction === 'bullish';
    const embed = createPredictionEmbed(prediction);
    return sendToUser(userId, embed);
};

// Price Alert
const sendPriceAlert = async (userId, alert) => {
    const isAbove = alert.condition === 'above';
    const embed = new EmbedBuilder()
        .setTitle('🔔 Price Alert Triggered!')
        .setColor(isAbove ? 0x00ff00 : 0xff0000)
        .setDescription(`${isAbove ? '📈' : '📉'} **${alert.symbol}** has ${isAbove ? 'risen above' : 'fallen below'} your target!`)
        .addFields(
            { name: '🎯 Target', value: `$${formatNumber(alert.targetPrice)}`, inline: true },
            { name: '💵 Current', value: `$${formatNumber(alert.currentPrice)}`, inline: true },
            { name: '📊 Change', value: `${alert.changePercent >= 0 ? '+' : ''}${alert.changePercent.toFixed(2)}%`, inline: true }
        )
        .setFooter({ text: `Alert set on ${new Date(alert.createdAt).toLocaleDateString()}` });

    return sendToUser(userId, embed);
};

// Technical Alert
const sendTechnicalAlert = async (userId, alert) => {
    const typeEmojis = {
        'rsi_oversold': '📉',
        'rsi_overbought': '📈',
        'macd_bullish_crossover': '✨',
        'macd_bearish_crossover': '⚠️',
        'bollinger_upper_breakout': '🔥',
        'bollinger_lower_breakout': '❄️',
        'support_test': '🛡️',
        'resistance_test': '🎯'
    };

    const typeNames = {
        'rsi_oversold': 'RSI Oversold',
        'rsi_overbought': 'RSI Overbought',
        'macd_bullish_crossover': 'MACD Bullish Crossover',
        'macd_bearish_crossover': 'MACD Bearish Crossover',
        'bollinger_upper_breakout': 'Bollinger Upper Breakout',
        'bollinger_lower_breakout': 'Bollinger Lower Breakout',
        'support_test': 'Support Level Test',
        'resistance_test': 'Resistance Level Test'
    };

    const emoji = typeEmojis[alert.type] || '📊';
    const typeName = typeNames[alert.type] || alert.type;

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Technical Alert Triggered!`)
        .setColor(0x5865f2)
        .addFields(
            { name: 'Symbol', value: alert.symbol, inline: true },
            { name: 'Alert Type', value: typeName, inline: true },
            { name: '💵 Price', value: `$${formatNumber(alert.triggeredPrice || alert.currentPrice)}`, inline: true }
        )
        .setFooter({ text: '⚠️ This is not financial advice. Trade responsibly.' });

    return sendToUser(userId, embed);
};

// ==================== BROADCAST FUNCTIONS ====================

// Broadcast to all users with specific preference enabled
const broadcastToSubscribers = async (preferenceKey, embed) => {
    if (!client) return { sent: 0, failed: 0 };

    try {
        const query = {
            discordUserId: { $ne: null },
            [`discordNotifications.${preferenceKey}`]: { $ne: false }
        };

        const users = await User.find(query).select('discordUserId');
        let sent = 0;
        let failed = 0;

        for (const user of users) {
            try {
                const discordUser = await client.users.fetch(user.discordUserId);
                await discordUser.send({ embeds: [embed] });
                sent++;
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                failed++;
            }
        }

        return { sent, failed };
    } catch (error) {
        console.error('[Discord] Error broadcasting to subscribers:', error);
        return { sent: 0, failed: 0 };
    }
};

// Send to all linked server channels
const sendToAllServers = async (embed, preferenceKey = null) => {
    if (!client) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;

    for (const [key, server] of linkedServers) {
        // Check if this notification type is enabled
        if (preferenceKey && server.notifications && server.notifications[preferenceKey] === false) {
            continue;
        }

        const channelId = key.split('-')[1];

        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                await channel.send({ embeds: [embed] });
                sent++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`[Discord] Error sending to channel ${channelId}:`, error.message);
            failed++;
            // If bot was removed from server, unlink
            if (error.code === 50001 || error.code === 10003) {
                const [guildId, chId] = key.split('-');
                linkedServers.delete(key);
                DiscordServer.unlinkServer(guildId, chId).catch(err => console.error(err));
            }
        }
    }

    return { sent, failed };
};

// Broadcast to both users and servers
const broadcastAlert = async (preferenceKey, embed) => {
    const userResults = await broadcastToSubscribers(preferenceKey, embed);
    const serverResults = await sendToAllServers(embed, preferenceKey);

    return {
        users: userResults,
        servers: serverResults,
        total: {
            sent: userResults.sent + serverResults.sent,
            failed: userResults.failed + serverResults.failed
        }
    };
};

// ==================== HELPER FUNCTIONS ====================

// Create prediction embed
const createPredictionEmbed = (prediction) => {
    const isBullish = prediction.direction === 'bullish';
    const confidenceEmoji = prediction.confidence >= 80 ? '🔥' : prediction.confidence >= 60 ? '✨' : '💡';

    const embed = new EmbedBuilder()
        .setTitle(`🤖 ML Prediction: ${prediction.symbol}`)
        .setColor(isBullish ? 0x00ff00 : 0xff0000)
        .addFields(
            { name: '📊 Direction', value: prediction.direction.toUpperCase(), inline: true },
            { name: `${confidenceEmoji} Confidence`, value: `${prediction.confidence.toFixed(1)}%`, inline: true },
            { name: '💵 Current Price', value: `$${formatNumber(prediction.currentPrice)}`, inline: true },
            { name: '🎯 Target', value: `$${formatNumber(prediction.targetPrice)}`, inline: true }
        );

    if (prediction.stopLoss) {
        embed.addFields({ name: '🛑 Stop Loss', value: `$${formatNumber(prediction.stopLoss)}`, inline: true });
    }

    embed.addFields({ name: '⏰ Timeframe', value: prediction.timeframe || '24h', inline: true });

    if (prediction.factors && prediction.factors.length > 0) {
        embed.addFields({ name: 'Key Factors', value: prediction.factors.map(f => `• ${f}`).join('\n'), inline: false });
    }

    embed.setFooter({ text: '⚠️ This is not financial advice. Trade responsibly.' });
    embed.setTimestamp();

    return embed;
};

// Format numbers
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

// Load servers from MongoDB
const loadServersFromDB = async () => {
    try {
        const servers = await DiscordServer.getActiveServers();
        linkedServers = new Map();

        for (const server of servers) {
            linkedServers.set(`${server.guildId}-${server.channelId}`, {
                guildName: server.guildName,
                channelName: server.channelName,
                linkedAt: server.linkedAt,
                linkedBy: server.linkedBy,
                linkedByUserId: server.linkedByUserId,
                notifications: server.notifications
            });
        }

        console.log(`[Discord] Loaded ${linkedServers.size} servers from database`);
    } catch (error) {
        console.error('[Discord] Error loading servers from DB:', error);
    }
};

// Get linked servers
const getLinkedServers = () => {
    return Array.from(linkedServers.entries()).map(([key, data]) => ({
        key,
        ...data
    }));
};

// Check if server is linked
const isServerLinked = (guildId, channelId) => {
    return linkedServers.has(`${guildId}-${channelId}`);
};

// Get bot instance
const getBot = () => client;

// Check if bot is active
const isBotActive = () => client !== null && client.isReady();

module.exports = {
    initializeBot,
    getBot,
    isBotActive,
    sendToUser,
    sendToChannel,
    sendEconomicEventReminder,
    sendWhaleAlert,
    sendDailySummary,
    sendMLPredictionAlert,
    sendPriceAlert,
    sendTechnicalAlert,
    broadcastToSubscribers,
    sendToAllServers,
    broadcastAlert,
    getLinkedServers,
    isServerLinked,
    createPredictionEmbed
};
