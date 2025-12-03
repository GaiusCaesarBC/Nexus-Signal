// server/scripts/debugUserData.js
// Run this to see ALL fields on your user document
// Usage: node server/scripts/debugUserData.js

require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('MongoDB connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

const debugUser = async () => {
    await connectDB();
    
    const User = require('../models/User');
    
    // Find your user (change this to your email or username)
    const user = await User.findOne({ username: 'Cwatkins' }).lean();
    
    if (!user) {
        console.log('User not found!');
        process.exit(1);
    }
    
    console.log('\n========================================');
    console.log('FULL USER DOCUMENT DEBUG');
    console.log('========================================\n');
    
    // Print ALL top-level keys
    console.log('TOP-LEVEL KEYS:', Object.keys(user));
    console.log('\n');
    
    // Check specific fields
    console.log('--- GAMIFICATION ---');
    console.log('user.gamification:', JSON.stringify(user.gamification, null, 2));
    
    console.log('\n--- POSSIBLE COIN LOCATIONS ---');
    console.log('user.nexusCoins:', user.nexusCoins);
    console.log('user.coins:', user.coins);
    console.log('user.balance:', user.balance);
    console.log('user.credits:', user.credits);
    console.log('user.points:', user.points);
    console.log('user.gamification?.nexusCoins:', user.gamification?.nexusCoins);
    console.log('user.gamification?.coins:', user.gamification?.coins);
    
    console.log('\n--- POSSIBLE LEVEL LOCATIONS ---');
    console.log('user.level:', user.level);
    console.log('user.gamification?.level:', user.gamification?.level);
    console.log('user.stats?.level:', user.stats?.level);
    
    console.log('\n--- STATS ---');
    console.log('user.stats:', JSON.stringify(user.stats, null, 2));
    
    console.log('\n--- VAULT ---');
    console.log('user.vault:', JSON.stringify(user.vault, null, 2));
    
    // Search for any field containing "coin" or "level" or numbers matching 9300 or 13
    console.log('\n--- SEARCHING FOR 9300 AND 13 IN ALL FIELDS ---');
    const searchObject = (obj, path = '') => {
        for (const key in obj) {
            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;
            
            if (value === 9300 || value === '9300') {
                console.log(`FOUND 9300 at: ${currentPath}`);
            }
            if (value === 13 || value === '13') {
                console.log(`FOUND 13 at: ${currentPath}`);
            }
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                searchObject(value, currentPath);
            }
        }
    };
    searchObject(user);
    
    // Also check PaperTradingAccount
    console.log('\n--- PAPER TRADING ACCOUNT ---');
    try {
        const PaperTradingAccount = require('../models/PaperTradingAccount');
        const account = await PaperTradingAccount.findOne({ user: user._id }).lean();
        if (account) {
            console.log('Paper Trading Account found!');
            console.log('account.nexusCoins:', account.nexusCoins);
            console.log('account.coins:', account.coins);
            console.log('account.level:', account.level);
            console.log('Full account:', JSON.stringify(account, null, 2));
        } else {
            console.log('No paper trading account found');
        }
    } catch (e) {
        console.log('PaperTradingAccount model not found or error:', e.message);
    }
    
    // Check if there's a separate Gamification model
    console.log('\n--- SEPARATE GAMIFICATION MODEL ---');
    try {
        const Gamification = mongoose.model('Gamification');
        const gamification = await Gamification.findOne({ user: user._id }).lean();
        if (gamification) {
            console.log('Separate Gamification document found!');
            console.log(JSON.stringify(gamification, null, 2));
        }
    } catch (e) {
        console.log('No separate Gamification model');
    }
    
    mongoose.connection.close();
    console.log('\n========================================');
    console.log('Debug complete. Check output above.');
    console.log('========================================\n');
};

debugUser().catch(err => {
    console.error('Debug failed:', err);
    process.exit(1);
});