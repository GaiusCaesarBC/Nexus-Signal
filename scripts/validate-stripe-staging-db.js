// Run only inside the isolated staging backend. No Stripe transport or real user writes.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createBillingWebhook } = require('../services/stripeBillingWebhook');
async function main() {
    const env = process.env;
    const uri = new URL(env.MONGODB_URI);
    assert.equal(env.APP_ENV, 'staging');
    assert.equal(uri.hostname, 'nexus-signal-staging.ujnfudh.mongodb.net');
    assert.equal(uri.pathname, '/nexus_signal_staging');
    assert.equal(env.ENABLE_BILLING, 'false');
    const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
    const suffix = Date.now().toString(36);
    const users = `billing_validation_users_${suffix}`;
    const events = `billing_validation_events_${suffix}`;
    const User = connection.model('BillingValidationUser', new mongoose.Schema({subscription: {
        status:String, stripeCustomerId:String, stripeSubscriptionId:{type:String,default:null},
        stripePriceId:String, paymentStatus:String, currentPeriodStart:Date, currentPeriodEnd:Date,
        billingInterval:String, cancelAtPeriodEnd:Boolean, graceEndsAt:Date, canceledSubscriptionId:String
    }}), users);
    const Event = connection.model('BillingValidationEvent', require('../models/StripeWebhookEvent').schema.clone(), events);
    try {
        await Promise.all([User.init(), Event.init()]);
        const user = await User.create({subscription:{status:'free',stripeCustomerId:'cus_fixture'}});
        const subscription = {id:'sub_fixture',customer:'cus_fixture',status:'active',livemode:false,
            metadata:{userId:String(user._id)},latest_invoice:{paid:true},items:{data:[{
                price:{id:'price_fixture',recurring:{interval:'month'}},current_period_start:1800000000,current_period_end:1802678400}]}};
        const verifier = require('stripe')('sk_test_offline_fixture');
        const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_offline_fixture';
        let failAfterWrite = false;
        const dependencies = { User:{findOne:(...args)=>User.findOne(...args), updateOne:async(...args)=>{
            const result=await User.updateOne(...args); if(failAfterWrite) throw new Error('Injected rollback'); return result;
        }}, Event, connection, planFromPrice:()=> 'starter', safety:{environment:()=> 'staging',enabled:()=>false},
            stripe:{webhooks:verifier.webhooks,subscriptions:{retrieve:async()=>subscription}} };
        const handler=createBillingWebhook(dependencies);
        async function deliver(id){
            const payload=JSON.stringify({id,livemode:false,type:'customer.subscription.created',data:{object:subscription}});
            const signature=verifier.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
            const res={code:200,status(code){this.code=code;return this;},json(){return this;}};
            await handler({body:Buffer.from(payload),headers:{'stripe-signature':signature}},res); return res.code;
        }
        try {
            failAfterWrite=true;
            assert.equal(await deliver('evt_rollback'),500);
            assert.equal(await Event.countDocuments(),0);
            assert.equal((await User.findById(user._id)).subscription.status,'free');
            console.log('PASS transaction rollback: receipt and entitlement unchanged');
            failAfterWrite=false;
            assert.equal(await deliver('evt_rollback'),200);
            assert.equal((await User.findById(user._id)).subscription.status,'starter');
            console.log('PASS failed event retry commits');
            const results=await Promise.all(Array.from({length:8},()=>deliver('evt_concurrent')));
            assert.ok(results.every(code=>[200,503].includes(code)));
            assert.equal(await Event.countDocuments({_id:'evt_concurrent'}),1);
            assert.equal(await User.countDocuments(),1);
            console.log('PASS concurrent identical event: one receipt and one user');
            assert.equal(await deliver('evt_concurrent'),200);
            assert.equal(await Event.countDocuments(),2);
            console.log('PASS completed duplicate safely acknowledged');
            console.log('STRIPE_DATABASE_CHECKS 4 PASS 0 FAIL');
        } finally { process.env.STRIPE_WEBHOOK_SECRET = oldSecret; }
    } finally {
        // Only the two uniquely named disposable fixture collections created above.
        for (const name of [users,events]) {
            assert.ok(/^billing_validation_(users|events)_[a-z0-9]+$/.test(name));
            await connection.dropCollection(name);
        }
        await connection.close();
    }
}
main().catch(()=>{console.error('STRIPE_DATABASE_CHECKS FAILED (details withheld)');process.exitCode=1;});
