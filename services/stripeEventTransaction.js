// Event receipt and entitlement changes commit together. A failure rolls both back.
// Requires a replica set (Atlas); never falls back to nontransactional writes.
async function processStripeEvent({ event, connection, Event, apply }) {
    await Event.init();
    try {
        await connection.transaction(async session => {
            if (await Event.findById(event.id).session(session)) return;
            await Event.create([{ _id: event.id, type: event.type, processedAt: new Date() }], { session });
            const user = await apply(session);
            if (user) await Event.updateOne({ _id: event.id }, {
                $set: { roleSyncUserId: user._id }
            }, { session });
        });
    } catch (error) {
        // Concurrent duplicate deliveries may race on the unique event _id.
        if (error.code !== 11000 || !await Event.findById(event.id)) throw error;
    }
}
module.exports = { processStripeEvent };
