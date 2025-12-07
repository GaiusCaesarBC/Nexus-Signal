#!/usr/bin/env node
/**
 * Grant The Architect badge to a specific user (founders only)
 *
 * Usage: node scripts/grant-architect.js <username or email>
 * Example: node scripts/grant-architect.js cody@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const BadgeService = require('../services/badgeService');

async function grantArchitectBadge() {
    const userIdentifier = process.argv[2];

    if (!userIdentifier) {
        console.error('Usage: node scripts/grant-architect.js <username or email>');
        process.exit(1);
    }

    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MongoDB URI not found in environment variables');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find user by username or email
        const user = await User.findOne({
            $or: [
                { username: userIdentifier },
                { email: userIdentifier }
            ]
        });

        if (!user) {
            console.error(`User not found: ${userIdentifier}`);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`Found user: ${user.username || user.email}`);

        // Check if already has The Architect badge
        if (user.gamification?.badges?.includes('badge-the-architect')) {
            console.log('User already has The Architect badge!');
            await mongoose.disconnect();
            process.exit(0);
        }

        // Initialize gamification if needed
        if (!user.gamification) {
            user.gamification = {
                level: 1,
                xp: 0,
                nexusCoins: 0,
                badges: [],
                achievements: []
            };
        }
        if (!user.gamification.badges) {
            user.gamification.badges = [];
        }

        // Initialize vault if needed
        if (!user.vault) {
            user.vault = {
                ownedItems: ['border-bronze', 'theme-default'],
                equippedBorder: 'border-bronze',
                equippedTheme: 'theme-default',
                equippedBadges: [],
                activePerks: []
            };
        }
        if (!user.vault.ownedItems) {
            user.vault.ownedItems = ['border-bronze', 'theme-default'];
        }
        if (!user.vault.equippedBadges) {
            user.vault.equippedBadges = [];
        }

        // Grant The Architect badge
        const badgeId = 'badge-the-architect';

        // Add to gamification.badges
        user.gamification.badges.push(badgeId);
        user.gamification.badgesEarned = (user.gamification.badgesEarned || 0) + 1;

        // Add to vault.ownedItems
        if (!user.vault.ownedItems.includes(badgeId)) {
            user.vault.ownedItems.push(badgeId);
        }

        // Add to vault.equippedBadges (auto-equip as first badge slot)
        if (!user.vault.equippedBadges.includes(badgeId)) {
            // Put it first for prominence
            user.vault.equippedBadges.unshift(badgeId);
            // Keep max 5
            if (user.vault.equippedBadges.length > 5) {
                user.vault.equippedBadges = user.vault.equippedBadges.slice(0, 5);
            }
        }

        await user.save();

        console.log('\n=== The Architect Badge Granted ===');
        console.log(`User: ${user.username || user.email}`);
        console.log(`Badge ID: ${badgeId}`);
        console.log(`Total badges: ${user.gamification.badges.length}`);
        console.log(`Equipped badges: ${user.vault.equippedBadges.join(', ')}`);
        console.log('\nThe Architect badge has been granted and equipped!');

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error granting badge:', error);
        process.exit(1);
    }
}

grantArchitectBadge();
