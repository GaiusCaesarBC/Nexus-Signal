// server/scripts/migrateNexusCoins.js
// Run this once to add nexusCoins to all existing users
// Usage: node server/scripts/migrateNexusCoins.js

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('MongoDB connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

const migrateUsers = async () => {
    await connectDB();
    
    const User = require('../models/User');
    
    console.log('Starting Nexus Coins migration...\n');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to check\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of users) {
        let needsUpdate = false;
        
        // Initialize gamification if missing
        if (!user.gamification) {
            user.gamification = {
                xp: 0,
                level: 1,
                title: 'Rookie Trader',
                nextLevelXp: 100,
                totalXpEarned: 0,
                nexusCoins: 1000,
                totalCoinsEarned: 1000,
                achievements: [],
                badges: [],
                loginStreak: 0,
                maxLoginStreak: 0
            };
            needsUpdate = true;
            console.log(`[${user.username}] Initialized gamification`);
        }
        
        // Add nexusCoins if missing
        if (user.gamification.nexusCoins === undefined || user.gamification.nexusCoins === null) {
            user.gamification.nexusCoins = 1000;
            user.gamification.totalCoinsEarned = (user.gamification.totalCoinsEarned || 0) + 1000;
            needsUpdate = true;
            console.log(`[${user.username}] Added 1000 Nexus Coins`);
        }
        
        // Initialize vault if missing
        if (!user.vault) {
            user.vault = {
                ownedItems: ['border-bronze', 'theme-default'],
                equippedBorder: 'border-bronze',
                equippedTheme: 'theme-default',
                equippedBadges: [],
                activePerks: [],
                purchaseHistory: []
            };
            needsUpdate = true;
            console.log(`[${user.username}] Initialized vault`);
        }
        
        // Initialize maxLoginStreak if missing
        if (user.gamification.maxLoginStreak === undefined) {
            user.gamification.maxLoginStreak = user.gamification.loginStreak || 0;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await user.save();
            updated++;
        } else {
            skipped++;
        }
    }
    
    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log(`Updated: ${updated} users`);
    console.log(`Skipped: ${skipped} users (already had coins)`);
    console.log('========================================\n');
    
    // Show current state of users
    console.log('Current User States:');
    const updatedUsers = await User.find({}).select('username gamification.level gamification.nexusCoins vault.ownedItems');
    for (const u of updatedUsers) {
        console.log(`- ${u.username}: Level ${u.gamification?.level || 1}, ${u.gamification?.nexusCoins || 0} coins, ${u.vault?.ownedItems?.length || 0} items owned`);
    }
    
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
};

migrateUsers().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});