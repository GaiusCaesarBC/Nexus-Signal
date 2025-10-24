const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: { // <-- ADDED THIS FIELD
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address'] // Optional: basic email format validation
  },
  password: {
    type: String,
    required: true,
  },
  watchlist: {
    type: [String],
    default: [],
  },
  stripeCustomerId: {
    type: String,
    // unique: true,
    // sparse: true
  },
  subscriptionTier: {
    type: String,
    default: 'free',
  },
  subscriptionStatus: {
    type: String,
    default: 'inactive',
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = User = mongoose.model('user', UserSchema);