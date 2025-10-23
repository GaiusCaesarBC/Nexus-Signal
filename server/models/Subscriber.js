const mongoose = require('mongoose');

const SubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // Prevents duplicate emails
    lowercase: true,
    trim: true,
    // Simple regex for basic email validation
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

// The collection will be named "subscribers" in MongoDB
module.exports = mongoose.model('Subscriber', SubscriberSchema);

