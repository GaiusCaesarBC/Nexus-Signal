// models/PendingXPost.js — Pending X Post Approval Queue
const mongoose = require('mongoose');

const PendingXPostSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['new_signal', 'best_setup', 'result_update', 'daily_recap'],
        required: true
    },
    signalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prediction',
        default: null
    },
    content: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'posted', 'failed'],
        default: 'pending'
    },
    telegramMessageId: { type: Number, default: null },
    telegramChatId: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    xPostId: { type: String, default: null },
    error: { type: String, default: null },
}, { timestamps: true });

// Idempotency: prevent duplicate pending posts for same signal+type
PendingXPostSchema.index({ signalId: 1, type: 1, status: 1 });
// Cleanup old posts after 7 days
PendingXPostSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });

module.exports = mongoose.model('PendingXPost', PendingXPostSchema);
