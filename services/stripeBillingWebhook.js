const { stripeId, subscriptionPeriod, invoiceSubscriptionId } = require('../config/stripeObjects');
const { processStripeEvent } = require('./stripeEventTransaction');
const { getPlanFromPriceId } = require('../config/stripePrices');
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const handled = new Set(['checkout.session.completed', 'customer.subscription.created',
    'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid',
    'invoice.payment_succeeded', 'invoice.payment_failed']);

function createBillingWebhook({ stripe, User, Event, connection, safety,
    planFromPrice = getPlanFromPriceId, syncRole = async () => {} }) {
    return async (req, res) => {
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
            if (event.livemode !== (safety.environment() === 'production')) throw new Error('Mode mismatch');
        } catch {
            return res.status(400).json({ error: 'Webhook signature verification failed' });
        }
        if (!event.id || typeof event.type !== 'string' || !event.data?.object) {
            return res.status(400).json({ error: 'Invalid webhook event' });
        }
        if (!handled.has(event.type)) return res.json({ received: true });
        const object = event.data.object;
        const deleted = event.type === 'customer.subscription.deleted';
        const checkout = event.type === 'checkout.session.completed';
        const invoiceEvent = event.type.startsWith('invoice.');
        const subscriptionId = invoiceEvent ? invoiceSubscriptionId(object)
            : checkout ? stripeId(object.subscription) : object.id;
        if (!subscriptionId) {
            if (invoiceEvent || checkout) return res.json({ received: true });
            return res.status(400).json({ error: 'Missing subscription ID' });
        }
        try {
            // Fetch current state, not an older event snapshot, to prevent replay resurrection.
            // A completed duplicate does not need any Stripe network calls.
            const existing = await Event.findById(event.id);
            if (!existing) {
                const subscription = deleted ? object : await stripe.subscriptions.retrieve(subscriptionId);
                const customerId = stripeId(subscription.customer);
                if (!customerId || subscription.id !== subscriptionId) throw new Error('Invalid subscription ownership');
                if (object.customer && stripeId(object.customer) !== customerId) throw new Error('Customer mismatch');
                if (subscription.livemode !== event.livemode) throw new Error('Subscription mode mismatch');
                const metadataUserId = subscription.metadata?.userId;
                const checkoutUserId = checkout ? object.metadata?.userId || object.client_reference_id : null;
                const active = ['active', 'trialing'].includes(subscription.status);
                let period, priceId, plan, paid = false;
                if (active) {
                    period = subscriptionPeriod(subscription);
                    priceId = subscription.items.data[0].price.id;
                    plan = planFromPrice(priceId);
                    if (subscription.status === 'trialing') paid = true;
                    else {
                        const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice
                            : subscription.latest_invoice ? await stripe.invoices.retrieve(subscription.latest_invoice) : null;
                        paid = invoice?.paid === true || invoice?.status === 'paid';
                    }
                }
                await processStripeEvent({ event, connection, Event, apply: async session => {
                    // Customer must already be attached by authenticated server-side checkout.
                    const user = await User.findOne({ 'subscription.stripeCustomerId': customerId }).session(session);
                    if (!user) throw new Error('No attached user for customer');
                    if ((metadataUserId && String(user._id) !== metadataUserId) ||
                        (checkoutUserId && String(user._id) !== checkoutUserId)) throw new Error('User ownership mismatch');
                    const current = user.subscription || {};
                    if (!deleted && current.canceledSubscriptionId === subscriptionId && active) return null;
                    // An old cancellation/update must never replace or clear a newer subscription.
                    if (current.stripeSubscriptionId && current.stripeSubscriptionId !== subscriptionId) return null;
                    if (deleted && current.stripeSubscriptionId !== subscriptionId) return null;
                    const set = { 'subscription.paymentStatus': active && !paid
                        ? current.paymentStatus || subscription.status : subscription.status };
                    if (deleted || ['canceled', 'incomplete_expired'].includes(subscription.status)) {
                        Object.assign(set, { 'subscription.status': 'free', 'subscription.stripeSubscriptionId': null,
                            'subscription.stripePriceId': null, 'subscription.currentPeriodStart': null,
                            'subscription.currentPeriodEnd': null, 'subscription.cancelAtPeriodEnd': false,
                            'subscription.canceledSubscriptionId': subscriptionId,
                            'subscription.billingInterval': null, 'subscription.graceEndsAt': null });
                    } else if (active && paid) {
                        const interval = subscription.items.data[0].price.recurring?.interval;
                        if (!['month', 'year'].includes(interval)) throw new Error('Invalid billing interval');
                        Object.assign(set, { 'subscription.status': plan, 'subscription.stripeSubscriptionId': subscriptionId,
                            'subscription.stripePriceId': priceId, 'subscription.currentPeriodStart': period.start,
                            'subscription.currentPeriodEnd': period.end, 'subscription.billingInterval': interval,
                            'subscription.cancelAtPeriodEnd': !!subscription.cancel_at_period_end,
                            'subscription.graceEndsAt': null });
                    } else if (['past_due', 'unpaid'].includes(subscription.status) ||
                        (event.type === 'invoice.payment_failed' && !paid)) {
                        // Never derive grace from the failed/new invoice period or delivery time.
                        const paidEnd = current.currentPeriodEnd && new Date(current.currentPeriodEnd).getTime();
                        set['subscription.paymentStatus'] = ['past_due', 'unpaid'].includes(subscription.status) ? subscription.status : 'past_due';
                        set['subscription.graceEndsAt'] = Number.isFinite(paidEnd) && paidEnd > 0
                            ? new Date(paidEnd + GRACE_MS) : null;
                    }
                    const updated = await User.updateOne({ _id: user._id, 'subscription.stripeCustomerId': customerId,
                        'subscription.stripeSubscriptionId': current.stripeSubscriptionId || null }, { $set: set }, { session, runValidators: true });
                    if (updated.matchedCount !== 1) throw new Error('Concurrent subscription change');
                    return user;
                } });
            }
            const receipt = await Event.findById(event.id);
            // Durable pending role reconciliation survives a failed delivery. The role operation
            // sets desired state and must stay idempotent across a crash after provider success.
            if (receipt?.roleSyncUserId && !receipt.roleSyncedAt) {
                const now = new Date();
                const claimed = await Event.findOneAndUpdate({ _id: event.id, roleSyncedAt: null,
                    $or: [{ roleSyncLeaseUntil: null }, { roleSyncLeaseUntil: { $lte: now } }]
                }, { $set: { roleSyncLeaseUntil: new Date(now.getTime() + 60000) } }, { new: true });
                if (!claimed) {
                    if (!(await Event.findById(event.id))?.roleSyncedAt) return res.status(503).json({ error: 'Reconciliation pending' });
                } else {
                    try {
                        if (safety.enabled('ENABLE_NOTIFICATIONS')) await syncRole(receipt.roleSyncUserId);
                        await Event.updateOne({ _id: event.id }, { $set: { roleSyncedAt: new Date(), roleSyncLeaseUntil: null } });
                    } catch (error) {
                        await Event.updateOne({ _id: event.id }, { $set: { roleSyncLeaseUntil: null } });
                        throw error;
                    }
                }
            }
            return res.json({ received: true });
        } catch {
            // Stripe SDK errors can contain request information: do not log full error objects.
            console.error('[Stripe Webhook] Processing failed; delivery may be retried');
            return res.status(500).json({ error: 'Webhook handler failed' });
        }
    };
}
module.exports = { createBillingWebhook, GRACE_MS };
