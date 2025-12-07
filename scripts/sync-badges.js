#!/usr/bin/env node
/**
 * One-time script to sync gamification.badges to vault.ownedItems
 * Run this to fix existing users who have badges that aren't showing as "owned"
 *
 * Usage: node scripts/sync-badges.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function syncBadges() {
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

        // Find all users with gamification badges
        const users = await User.find({
            'gamification.badges': { $exists: true, $ne: [] }
        });

        console.log(`Found ${users.length} users with badges to sync`);

        let updatedCount = 0;
        let badgesSynced = 0;

        for (const user of users) {
            const gamificationBadges = user.gamification?.badges || [];

            if (gamificationBadges.length === 0) continue;

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

            let userUpdated = false;

            // Sync each badge to vault.ownedItems
            for (const badgeId of gamificationBadges) {
                if (!user.vault.ownedItems.includes(badgeId)) {
                    user.vault.ownedItems.push(badgeId);
                    badgesSynced++;
                    userUpdated = true;
                    console.log(`  Syncing badge ${badgeId} for user ${user.username || user.email}`);
                }
            }

            if (userUpdated) {
                await user.save();
                updatedCount++;
            }
        }

        console.log('\n=== Sync Complete ===');
        console.log(`Users updated: ${updatedCount}`);
        console.log(`Badges synced: ${badgesSynced}`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error syncing badges:', error);
        process.exit(1);
    }
}

syncBadges();
