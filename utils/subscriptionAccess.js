function paidAccessExpired(subscription = {}, now = Date.now()) {
    if (['canceled', 'incomplete', 'incomplete_expired', 'paused'].includes(subscription.paymentStatus)) return true;
    const failed = ['past_due', 'unpaid'].includes(subscription.paymentStatus);
    const end = failed ? subscription.graceEndsAt : subscription.currentPeriodEnd;
    if (failed && !end) return true;
    // Preserve non-Stripe synthetic/manual premium accounts with no period.
    if (!end) return !!subscription.stripeSubscriptionId;
    const timestamp = new Date(end).getTime();
    return !Number.isFinite(timestamp) || now >= timestamp;
}
module.exports = { paidAccessExpired };
