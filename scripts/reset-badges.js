#!/usr/bin/env node
/**
 * Reset all badge data for all users
 * This clears gamification.badges, vault.ownedItems (badge-*), and vault.equippedBadges
 *
 * Usage: node scripts/reset-badges.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function resetBadges() {
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

        // Find all users
        const users = await User.find({});
        console.log(`Found ${users.length} users to reset`);

        let updatedCount = 0;

        for (const user of users) {
            let userUpdated = false;

            // Reset gamification badges
            if (user.gamification?.badges?.length > 0) {
                console.log(`  Resetting ${user.gamification.badges.length} gamification badges for ${user.username || user.email}`);
                user.gamification.badges = [];
                user.gamification.badgesEarned = 0;
                userUpdated = true;
            }

            // Reset vault equippedBadges
            if (user.vault?.equippedBadges?.length > 0) {
                console.log(`  Resetting ${user.vault.equippedBadges.length} equipped badges for ${user.username || user.email}`);
                user.vault.equippedBadges = [];
                userUpdated = true;
            }

            // Remove badge-* items from vault.ownedItems (keep borders and themes)
            if (user.vault?.ownedItems?.length > 0) {
                const badgeItems = user.vault.ownedItems.filter(id => id.startsWith('badge-'));
                if (badgeItems.length > 0) {
                    console.log(`  Removing ${badgeItems.length} badge items from ownedItems for ${user.username || user.email}`);
                    user.vault.ownedItems = user.vault.ownedItems.filter(id => !id.startsWith('badge-'));
                    userUpdated = true;
                }
            }

            if (userUpdated) {
                await user.save();
                updatedCount++;
            }
        }

        console.log('\n=== Reset Complete ===');
        console.log(`Users updated: ${updatedCount}`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error resetting badges:', error);
        process.exit(1);
    }
}

resetBadges();
