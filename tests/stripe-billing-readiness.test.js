// Offline readiness gates. No application boot, real credentials, network, or database.
// Real handler and transaction coordinator, with isolated in-memory persistence and Stripe transport.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPlanFromPriceId } = require('../config/stripePrices');
const catalog = {};
for (const tier of ['starter', 'pro', 'premium', 'elite']) {
    for (const interval of ['monthly', 'yearly']) {
        const name = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
        catalog[name] = `price_${tier}${interval}`;
        test(`${tier} ${interval} configured mapping`, () => {
            assert.equal(getPlanFromPriceId(catalog[name], catalog), tier);
        });
    }
}
const signingSecret = 'whsec_offline_fixture_not_a_credential';
const verifier = require('stripe')('sk_test_offline_fixture_not_a_credential');
function harness() {
    const user = { _id: '000000000000000000000001', role: 'user', subscription: {
        status: 'free', stripeCustomerId: 'cus_fixture', stripeSubscriptionId: null
    }};
    const stats = { writes: 0, sideEffects: 0, retrieves: 0 };
    const receipts = new Map();
    const query = result => ({ session: async () => result, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) });
    const matches = (query) => Object.entries(query).every(([key, value]) =>
        (key === '_id' ? user._id : user.subscription[key.slice(13)]) === value);
    const User = {
        findOne: filter => query(matches(filter) ? structuredClone(user) : null),
        updateOne: async (filter, update) => {
            if (!matches(filter)) return { matchedCount: 0 };
            stats.writes++;
            for (const [key, value] of Object.entries(update.$set)) user.subscription[key.slice(13)] = value;
            return { matchedCount: 1 };
        }
    };
    const Event = {
        init: async () => {},
        findById: id => query(receipts.get(id)),
        create: async ([row]) => { if (receipts.has(row._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); receipts.set(row._id, {...row}); },
        updateOne: async (filter, update) => Object.assign(receipts.get(filter._id), update.$set),
        findOneAndUpdate: async (filter, update) => {
            const row = receipts.get(filter._id);
            if (row?.roleSyncedAt || row?.roleSyncLeaseUntil > new Date()) return null;
            return Object.assign(row, update.$set);
        }
    };
    let queue = Promise.resolve();
    const connection = { transaction(fn) {
        const task = queue.then(async () => {
            const before = structuredClone(user), events = structuredClone(receipts), writes = stats.writes;
            try { return await fn({}); } catch(error) {
                Object.assign(user, before); receipts.clear(); for (const [k,v] of events) receipts.set(k,v); stats.writes=writes; throw error;
            }
        }); queue = task.catch(() => {}); return task;
    } };
    const sub = { id: 'sub_fixture', customer: 'cus_fixture', status: 'active', livemode: false,
        metadata: { userId: user._id }, current_period_start: 1800000000,
        current_period_end: 1802678400, cancel_at_period_end: false, latest_invoice: { id:'in_fixture', paid:true },
        items: { data: [{ price: { id: 'price_startermonthly', recurring: { interval:'month' } },
            current_period_start: 1800000000, current_period_end: 1802678400 }] } };
    const stripe = { webhooks: verifier.webhooks,
        subscriptions: { retrieve: async () => { stats.retrieves++; return sub; } },
        invoices: { retrieve: async () => sub.latest_invoice } };
    const handler = require('../services/stripeBillingWebhook').createBillingWebhook({
        stripe, User, Event, connection, safety: { environment: () => 'staging', enabled: () => true },
        planFromPrice: id => getPlanFromPriceId(id, catalog), syncRole: async () => { stats.sideEffects++; }
    });
    async function deliver(type, object, options = {}) {
        const payload = options.payload ?? JSON.stringify({ id: options.id || 'evt_same_fixture', livemode: false, type, data: { object } });
        const signature = options.invalid ? 'invalid' : verifier.webhooks.generateTestHeaderString({ payload, secret: signingSecret });
        const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        process.env.STRIPE_WEBHOOK_SECRET = signingSecret;
        await handler({ headers: { 'stripe-signature': signature }, body: Buffer.from(payload) }, res);
        return res;
    }
    return { user, stats, sub, deliver, receipts, User, Event, connection, handler };
}
test('invalid signature rejects with 400 and no mutation', async () => {
    const h = harness();
    assert.equal((await h.deliver('customer.subscription.created', h.sub, { invalid: true })).code, 400);
    assert.equal(h.stats.writes, 0);
});
test('signed malformed JSON rejects with 400 and no mutation', async () => {
    const h = harness();
    assert.equal((await h.deliver('', {}, { payload: '{broken' })).code, 400);
    assert.equal(h.stats.writes, 0);
});
test('unknown signed event safely ignores without mutation', async () => {
    const h = harness();
    assert.equal((await h.deliver('fixture.unknown', {})).code, 200);
    assert.equal(h.stats.writes, 0);
});
test('known event with missing subscription id fails without mutation', async () => {
    const h = harness();
    assert.equal((await h.deliver('customer.subscription.created', {})).code, 400);
    assert.equal(h.stats.writes, 0);
});
test('legacy active subscription upgrades only tier, never admin', async () => {
    const h = harness(); h.sub.metadata.role = 'admin';
    assert.equal((await h.deliver('customer.subscription.created', h.sub)).code, 200);
    assert.equal(h.user.subscription.status, 'starter');
    assert.equal(h.user.role, 'user');
});
test('same valid webhook does not repeat writes or side effects', async () => {
    const h = harness();
    await h.deliver('customer.subscription.created', h.sub);
    await h.deliver('customer.subscription.created', h.sub);
    assert.equal(h.stats.writes, 1);
    assert.equal(h.stats.sideEffects, 1);
});
test('old cancellation cannot remove a newer subscription', async () => {
    const h = harness();
    h.user.subscription.status = 'pro'; h.user.subscription.stripeSubscriptionId = 'sub_newer';
    await h.deliver('customer.subscription.deleted', { ...h.sub, status: 'canceled' });
    assert.equal(h.user.subscription.stripeSubscriptionId, 'sub_newer');
    assert.equal(h.user.subscription.status, 'pro');
});
test('modern item-level subscription periods persist successfully', async () => {
    const h = harness(); delete h.sub.current_period_start; delete h.sub.current_period_end;
    assert.equal((await h.deliver('customer.subscription.updated', h.sub)).code, 200);
    assert.equal(h.user.subscription.currentPeriodEnd.getTime(), 1802678400000);
});
test('modern invoice parent subscription triggers renewal sync', async () => {
    const h = harness();
    await h.deliver('invoice.payment_succeeded', { customer: 'cus_fixture', parent: {
        type: 'subscription_details', subscription_details: { subscription: 'sub_fixture' }
    } });
    assert.equal(h.stats.retrieves, 1);
    assert.equal(h.user.subscription.status, 'starter');
});
test('unknown price cannot grant entitlement', async () => {
    const h = harness(); h.sub.items.data[0].price.id = 'price_hidden';
    assert.equal((await h.deliver('customer.subscription.created', h.sub)).code, 500);
    assert.equal(h.stats.writes, 0);
});

test('concurrent identical deliveries commit entitlement once', async () => {
    const h = harness();
    const results = await Promise.all(Array.from({length: 8}, () => h.deliver('customer.subscription.created', h.sub)));
    assert.ok(results.every(r => [200,503].includes(r.code)));
    assert.equal(h.stats.writes, 1);
    assert.equal(h.stats.sideEffects, 1);
    assert.equal(h.receipts.size, 1);
});
test('failed transaction rolls back receipt and can retry successfully', async () => {
    const h = harness();
    const update = h.User.updateOne;
    h.User.updateOne = async (...args) => { await update(...args); throw new Error('fixture failure after write'); };
    assert.equal((await h.deliver('customer.subscription.created', h.sub)).code, 500);
    assert.equal(h.receipts.size, 0);
    assert.equal(h.user.subscription.status, 'free');
    h.User.updateOne = update;
    assert.equal((await h.deliver('customer.subscription.created', h.sub)).code, 200);
    assert.equal(h.stats.writes, 1);
});
test('three-day grace is anchored to the last paid period and does not slide on retries', async () => {
    const h = harness();
    await h.deliver('customer.subscription.created', h.sub, {id:'evt_paid'});
    const paidEnd = h.user.subscription.currentPeriodEnd.getTime();
    h.sub.status = 'past_due'; h.sub.latest_invoice.paid = false;
    h.sub.items.data[0].current_period_end += 2678400;
    for (const id of ['evt_failed','evt_failed_again']) {
        await h.deliver('invoice.payment_failed', {customer:'cus_fixture',subscription:'sub_fixture'}, {id});
        assert.equal(h.user.subscription.currentPeriodEnd.getTime(), paidEnd);
        assert.equal(h.user.subscription.graceEndsAt.getTime(), paidEnd + 3*86400000);
    }
    const {paidAccessExpired} = require('../utils/subscriptionAccess');
    assert.equal(paidAccessExpired(h.user.subscription, paidEnd+3*86400000-1), false);
    assert.equal(paidAccessExpired(h.user.subscription, paidEnd+3*86400000), true);
    const {getEffectivePlan} = require('../middleware/subscriptionMiddleware');
    const expired = {...h.user.subscription, graceEndsAt:new Date(Date.now()-1)};
    assert.equal(getEffectivePlan({subscription:expired}).plan,'free');
});
test('paid renewal clears grace and advances the paid period exactly once', async () => {
    const h = harness();
    await h.deliver('customer.subscription.created', h.sub, {id:'evt_initial'});
    h.user.subscription.paymentStatus='past_due'; h.user.subscription.graceEndsAt=new Date();
    h.sub.items.data[0].current_period_start += 2678400;
    h.sub.items.data[0].current_period_end += 2678400;
    const invoice={customer:'cus_fixture',parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}}};
    await h.deliver('invoice.paid', invoice, {id:'evt_renewal'});
    await h.deliver('invoice.paid', invoice, {id:'evt_renewal'});
    assert.equal(h.user.subscription.paymentStatus,'active');
    assert.equal(h.user.subscription.graceEndsAt,null);
    assert.equal(h.user.subscription.currentPeriodEnd.getTime(),h.sub.items.data[0].current_period_end*1000);
    assert.equal(h.stats.writes,2);
});
test('failed first invoice cannot grant paid access or fabricate grace', async () => {
    const h=harness(); h.sub.status='past_due'; h.sub.latest_invoice.paid=false;
    await h.deliver('invoice.payment_failed',{customer:'cus_fixture',subscription:'sub_fixture'});
    assert.equal(h.user.subscription.status,'free');
    assert.equal(h.user.subscription.graceEndsAt,null);
});
test('metadata cannot attach a customer to another user', async () => {
    const h=harness(); h.sub.metadata.userId='000000000000000000000002';
    assert.equal((await h.deliver('customer.subscription.created',h.sub)).code,500);
    assert.equal(h.stats.writes,0); assert.equal(h.receipts.size,0);
});
test('live subscription is rejected even inside a signed test event', async () => {
    const h=harness(); h.sub.livemode=true;
    assert.equal((await h.deliver('customer.subscription.created',h.sub)).code,500);
    assert.equal(h.stats.writes,0);
});
test('old active event cannot resurrect a currently canceled subscription', async () => {
    const h=harness(); await h.deliver('customer.subscription.created',h.sub,{id:'evt_initial'});
    const old=structuredClone(h.sub); h.sub.status='canceled';
    await h.deliver('customer.subscription.updated',old,{id:'evt_delayed'});
    assert.equal(h.user.subscription.status,'free');
    assert.equal(h.user.subscription.stripeSubscriptionId,null);
});
test('cancel-at-period-end retains access then deletion clears all subscription fields', async () => {
    const h=harness(); h.sub.cancel_at_period_end=true;
    await h.deliver('customer.subscription.updated',h.sub,{id:'evt_cancel_pending'});
    assert.equal(h.user.subscription.status,'starter');
    assert.equal(h.user.subscription.cancelAtPeriodEnd,true);
    await h.deliver('customer.subscription.deleted',{...h.sub,status:'canceled'},{id:'evt_deleted'});
    for(const key of ['stripeSubscriptionId','stripePriceId','currentPeriodStart','currentPeriodEnd','billingInterval','graceEndsAt']) assert.equal(h.user.subscription[key],null);
    assert.equal(h.user.subscription.status,'free');
    assert.equal(h.user.subscription.cancelAtPeriodEnd,false);
});
test('legacy top-level subscription dates remain supported', async () => {
    const h=harness(); delete h.sub.items.data[0].current_period_start; delete h.sub.items.data[0].current_period_end;
    assert.equal((await h.deliver('customer.subscription.created',h.sub)).code,200);
    assert.equal(h.user.subscription.currentPeriodEnd.getTime(),h.sub.current_period_end*1000);
});
test('HTTP raw-body transport validates signed bytes before JSON middleware', async () => {
    const express = require('express');
    const h=harness(), app=express();
    process.env.STRIPE_WEBHOOK_SECRET=signingSecret;
    app.post('/api/stripe/webhook',express.raw({type:'application/json'}),h.handler);
    app.use(express.json());
    const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
        const payload=JSON.stringify({id:'evt_http',livemode:false,type:'customer.subscription.created',data:{object:h.sub}},null,2);
        const signature=verifier.webhooks.generateTestHeaderString({payload,secret:signingSecret});
        const url=`http://127.0.0.1:${server.address().port}/api/stripe/webhook`;
        const headers={'content-type':'application/json','stripe-signature':signature};
        assert.equal((await fetch(url,{method:'POST',headers,body:payload})).status,200);
        assert.equal((await fetch(url,{method:'POST',headers,body:payload+' '})).status,400);
        assert.equal(h.stats.writes,1);
        const source=require('node:fs').readFileSync(require.resolve('../app'),'utf8');
        assert.ok(source.indexOf("app.post('/api/stripe/webhook'")<source.indexOf("app.use(express.json("));
    } finally { await new Promise(resolve=>server.close(resolve)); }
});
