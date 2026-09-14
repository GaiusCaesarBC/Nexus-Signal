// Stripe Basil+ moved periods to subscription items and invoice ownership to parent.
const stripeId = value => typeof value === 'string' ? value : value?.id;
function subscriptionPeriod(subscription) {
    if (subscription.items?.data?.length !== 1) throw new Error('Expected one subscription item');
    const item = subscription.items.data[0];
    const start = item.current_period_start ?? subscription.current_period_start;
    const end = item.current_period_end ?? subscription.current_period_end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start <= 0 || end <= start) {
        throw new Error('Invalid subscription billing period');
    }
    return { start: new Date(start * 1000), end: new Date(end * 1000) };
}
function invoiceSubscriptionId(invoice) {
    return stripeId(invoice.parent?.type === 'subscription_details'
        ? invoice.parent.subscription_details?.subscription : invoice.subscription);
}
module.exports = { stripeId, subscriptionPeriod, invoiceSubscriptionId };
