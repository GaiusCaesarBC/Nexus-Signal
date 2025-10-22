const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  watchlist: {
    type: [String],
    default: [],
  },
  // --- NEW FIELDS ---
  stripeCustomerId: { // To link this user to a Stripe customer object
    type: String,
    // unique: true, // Customer ID should be unique if used
    // sparse: true  // Allows null/undefined values if not everyone is a customer
  },
  subscriptionTier: { // e.g., 'free', 'premium', 'elite'
    type: String,
    default: 'free', // Or maybe 'basic' depending on your trial logic
  },
  subscriptionStatus: { // e.g., 'active', 'trialing', 'canceled', 'past_due'
    type: String,
    default: 'inactive', // Or 'trialing' if they start with a trial
  },
  // --- END NEW FIELDS ---
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = User = mongoose.model('user', UserSchema);
