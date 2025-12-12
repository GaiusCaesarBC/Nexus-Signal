// scripts/resetAccuracy.js - Reset prediction accuracy by deleting evaluated predictions
// Run with: node scripts/resetAccuracy.js

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function resetAccuracy() {
    console.log('=== PREDICTION ACCURACY RESET ===\n');

    if (!MONGODB_URI) {
        console.error('ERROR: MONGODB_URI not found in environment');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB\n');

        const Prediction = require('../models/Prediction');

        // Get counts before deletion
        const correctCount = await Prediction.countDocuments({ status: 'correct' });
        const incorrectCount = await Prediction.countDocuments({ status: 'incorrect' });
        const pendingCount = await Prediction.countDocuments({ status: 'pending' });

        console.log('Current prediction stats:');
        console.log(`  - Correct: ${correctCount}`);
        console.log(`  - Incorrect: ${incorrectCount}`);
        console.log(`  - Pending: ${pendingCount}`);
        console.log(`  - Old accuracy: ${correctCount + incorrectCount > 0 ? ((correctCount / (correctCount + incorrectCount)) * 100).toFixed(1) : 0}%\n`);

        // Delete evaluated predictions
        const result = await Prediction.deleteMany({
            status: { $in: ['correct', 'incorrect'] }
        });

        console.log(`Deleted ${result.deletedCount} evaluated predictions\n`);

        // Verify
        const newCorrect = await Prediction.countDocuments({ status: 'correct' });
        const newIncorrect = await Prediction.countDocuments({ status: 'incorrect' });
        const newPending = await Prediction.countDocuments({ status: 'pending' });

        console.log('New prediction stats:');
        console.log(`  - Correct: ${newCorrect}`);
        console.log(`  - Incorrect: ${newIncorrect}`);
        console.log(`  - Pending: ${newPending}`);
        console.log('\nAccuracy has been reset! New predictions will build fresh stats.');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

resetAccuracy();
