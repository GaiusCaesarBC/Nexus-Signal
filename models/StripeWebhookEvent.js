const mongoose = require('mongoose');
// No payloads, secrets, card information or TTL: old events must stay deduplicated.
const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, required: true },
    roleSyncUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    roleSyncedAt: { type: Date, default: null },
    roleSyncLeaseUntil: { type: Date, default: null }
}, { versionKey: false });
module.exports = mongoose.model('StripeWebhookEvent', schema);
