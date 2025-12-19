// server/models/Subscriber.js
const mongoose = require('mongoose');

const SubscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true, // Prevents duplicate emails
        lowercase: true,
        trim: true,
        // Simplified email regex to prevent ReDoS attacks
        match: [
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            'Please fill a valid email address',
        ],
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Subscriber', SubscriberSchema);