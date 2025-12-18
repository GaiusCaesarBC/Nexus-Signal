// Register Discord Slash Commands
// Run this script once to register commands: node scripts/registerDiscordCommands.js

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
    console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
    process.exit(1);
}

console.log('Token:', token.substring(0, 20) + '...');
console.log('Client ID:', clientId);
console.log('Guild ID:', guildId || '(none - will register globally)');

const commands = [
    new SlashCommandBuilder()
        .setName('predict')
        .setDescription('Get ML prediction for a stock or crypto')
        .addStringOption(option =>
            option.setName('symbol')
                .setDescription('Stock ticker or crypto symbol (e.g., AAPL, BTC)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get current price of a stock or crypto')
        .addStringOption(option =>
            option.setName('symbol')
                .setDescription('Stock ticker or crypto symbol')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Nexus Signal account')
        .addStringOption(option =>
            option.setName('token')
                .setDescription('Your link token from nexussignal.ai/settings')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unlink your Nexus Signal account'),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check your notification preferences'),
    new SlashCommandBuilder()
        .setName('subscribe')
        .setDescription('Subscribe this channel to Nexus Signal alerts (admin only)')
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

async function registerCommands() {
    try {
        console.log('\nRegistering slash commands...');

        if (guildId) {
            // Guild-specific commands (instant)
            const result = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log(`\nSuccess! Registered ${result.length} commands to guild ${guildId}`);
            console.log('Commands are available immediately in your server.');
        } else {
            // Global commands (takes up to 1 hour)
            const result = await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log(`\nSuccess! Registered ${result.length} commands globally`);
            console.log('Note: Global commands may take up to 1 hour to appear.');
        }

        console.log('\nRegistered commands:');
        commands.forEach(cmd => console.log(`  /${cmd.name} - ${cmd.description}`));
    } catch (error) {
        console.error('\nError registering commands:', error);
        if (error.code === 50001) {
            console.log('\nMake sure the bot has been invited to your server with the applications.commands scope!');
            console.log(`Invite URL: https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147485696&scope=bot%20applications.commands`);
        }
    }
}

registerCommands();
