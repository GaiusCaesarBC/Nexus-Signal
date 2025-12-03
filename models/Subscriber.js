// server/models/Subscriber.js
const mongoose = require('mongoose');

const SubscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true, // Prevents duplicate emails
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please fill a valid email address',
        ],
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Subscriber', SubscriberSchema);