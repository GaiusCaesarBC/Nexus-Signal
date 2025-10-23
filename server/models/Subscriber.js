const mongoose = require('mongoose');

const SubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // Don't allow the same email to sign up twice
    lowercase: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Subscriber = mongoose.model('subscriber', SubscriberSchema);
