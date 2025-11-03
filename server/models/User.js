const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    username: { // <-- ADD THIS FIELD OR ENSURE IT'S CONFIGURED CORRECTLY
        type: String,
        required: true, // Make it required for registration
        unique: true    // Keep it unique if you want unique usernames
    },
    date: {
        type: Date,
        default: Date.now
    }
    // Add other fields as necessary (e.g., notifications, appPreferences from update-profile)
    // notifications: {
    //     type: Object, // Or specific schema
    //     default: {}
    // },
    // appPreferences: {
    //     type: Object, // Or specific schema
    //     default: {}
    // }
});

module.exports = mongoose.model('User', UserSchema);