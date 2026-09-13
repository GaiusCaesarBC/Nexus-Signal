const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const safety = require('../config/runtimeSafety');
const prices = require('../config/stripePrices');

function withEnvironment(values, fn) {
    const old = { ...process.env };
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, values);
    return Promise.resolve().then(fn).finally(() => {
        for (const key of Object.keys(process.env)) delete process.env[key];
        Object.assign(process.env, old);
    });
}

test('price catalog requires all eight unique configured prices and rejects unknown IDs', () => {
    const env = {};
    for (const tier of ['STARTER','PRO','PREMIUM','ELITE']) for (const period of ['MONTHLY','YEARLY']) env[`STRIPE_PRICE_${tier}_${period}`] = 'price_' + tier + period;
    assert.equal(prices.getPlanFromPriceId(env.STRIPE_PRICE_PRO_YEARLY, env), 'pro');
    assert.throws(() => prices.getPlanFromPriceId('unconfigured', env));
    delete env.STRIPE_PRICE_STARTER_MONTHLY;
    assert.throws(() => prices.getPriceCatalog(env), /STRIPE_PRICE_STARTER_MONTHLY/);
    env.STRIPE_PRICE_STARTER_MONTHLY = env.STRIPE_PRICE_PRO_MONTHLY;
    assert.throws(() => prices.getPriceCatalog(env));
});

test('staging defaults disable jobs, notifications, billing and brokerage', () => {
    for (const flag of ['ENABLE_SCHEDULED_JOBS','ENABLE_NOTIFICATIONS','ENABLE_BILLING','ENABLE_BROKERAGE_SYNC','ENABLE_MEDIA_UPLOADS']) assert.equal(safety.enabled(flag, {APP_ENV:'staging'}), false);
    assert.throws(() => safety.environment({NODE_ENV:'production'}), /APP_ENV/);
    assert.throws(() => safety.enabled('ENABLE_SCHEDULED_JOBS', {APP_ENV:'staging',ENABLE_SCHEDULED_JOBS:'yes'}));
});

test('staging rejects unsafe database aliases, production URLs and live credentials', () => {
    const env = {APP_ENV:'staging',NODE_ENV:'production',MONGODB_URI:'mongodb://127.0.0.1/nexus_staging',STAGING_DB_NAME:'nexus_staging',JWT_SECRET:'fixture',BROKERAGE_ENCRYPTION_KEY:'fixture',ML_API_KEY:'fixture',CLIENT_URL:'https://frontend.invalid',API_URL:'https://backend.invalid',ML_SERVICE_URL:'https://ml.invalid',CORS_ALLOWED_ORIGINS:'https://frontend.invalid'};
    assert.equal(safety.validateRuntime(env).ENABLE_BILLING, false);
    for (const bad of [{MONGO_URI:'unexpected'}, {MONGODB_URI:'mongodb://127.0.0.1/production'}, {CLIENT_URL:'https://nexussignal.ai'}, {STRIPE_SECRET_KEY:['sk','live','fixture'].join('_')}, {PLAID_ENV:'production'}, {TELEGRAM_BOT_TOKEN:'fixture'}]) assert.throws(() => safety.validateRuntime({...env,...bad}));
});

test('disabled or live-mode staging Stripe cannot reach a mocked Stripe client', async () => {
    await withEnvironment({APP_ENV:'staging'}, () => {
        let calls = 0;
        const stripe = require('../config/stripeClient').createStripeClient(() => {calls++; return {checkout:{sessions:{create(){calls++;}}}};});
        assert.throws(() => stripe.checkout.sessions.create({}), /disabled/);
        process.env.ENABLE_BILLING = 'true';
        process.env.STRIPE_SECRET_KEY = ['sk','live','fixture'].join('_');
        assert.throws(() => stripe.checkout.sessions.create({}), /test mode/);
        assert.equal(calls, 0);
        process.env.STRIPE_SECRET_KEY = ['sk','test','fixture'].join('_');
        stripe.checkout.sessions.create({});
        assert.equal(calls, 2);
    });
});

test('staging Kraken private API rejects before axios and exposes no order execution method', async () => {
    await withEnvironment({APP_ENV:'staging',ENABLE_BROKERAGE_SYNC:'true',PLAID_ENV:'sandbox'}, async () => {
        const kraken = require('../services/krakenService');
        const axios = require('axios');
        const old = axios.post;
        let requests = 0;
        axios.post = () => {requests++; throw new Error('Unexpected network');};
        try {
            await assert.rejects(kraken.getBalance('fixture', 'fixture'), /disabled outside production/);
            assert.equal(requests, 0);
            assert.ok(!Object.keys(kraken).some(name => /submit|cancel|createOrder|addOrder|editOrder/i.test(name)));
        } finally {axios.post = old;}
    });
});

test('notification opt-in cannot send email outside explicit staging recipient list', () => {
    const env = {APP_ENV:'staging',ENABLE_NOTIFICATIONS:'true',STAGING_EMAIL_RECIPIENTS:'tester@example.invalid'};
    assert.doesNotThrow(() => safety.assertEmailRecipients({to:'tester@example.invalid'}, env));
    assert.throws(() => safety.assertEmailRecipients({to:'tester@example.invalid',bcc:'other@example.invalid'}, env));
    assert.throws(() => safety.assertEmailRecipients({to:'tester@example.invalid'}, {...env,ENABLE_NOTIFICATIONS:'false'}));
});

test('every scheduler start entry point is inert under staging defaults', () => {
    const files = {
        alertChecker:'startAlertChecker',predictionChecker:'startPredictionChecker',signalGenerator:'startSignalGenerator',signalResultChecker:'startSignalResultChecker',websocketPriceService:'startWebSocketService',discordScheduler:'initializeSchedulers',telegramScheduler:'initializeSchedulers',xPosterService:'startXPoster',telegramBot:'initializeTelegramBot'
    };
    for (const [file, start] of Object.entries(files)) {
        let work = 0;
        const noop = new Proxy(function(){ return noop; }, {get:(_t,k)=>k==='then'?undefined:noop});
        const sandbox = {module:{exports:{}},process:{env:{APP_ENV:'staging'}},console:{log(){},info(){},warn(){},error(){}},Map,Set,Date,Buffer,URL,URLSearchParams,
            setTimeout(){work++;},setInterval(){work++;},clearTimeout(){},clearInterval(){},
            require(name){if(name.includes('runtimeSafety'))return {enabled:()=>false,environment:()=> 'staging'};if(name==='node-cron')return {schedule(){work++;}};return noop;}};
        vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services',file+'.js'),'utf8'),sandbox,{filename:file});
        sandbox.module.exports[start]();
        assert.equal(work,0,file+' must not schedule work');
    }
});

test('staging default blocks Cloudinary uploads and deletes before SDK transport', async () => {
    await withEnvironment({APP_ENV:'staging'}, () => {
        const { cloudinary } = require('../config/cloudinaryConfig');
        assert.throws(() => cloudinary.uploader.upload_stream({}, () => {}), /ENABLE_MEDIA_UPLOADS is disabled/);
        assert.throws(() => cloudinary.uploader.destroy('fixture'), /ENABLE_MEDIA_UPLOADS is disabled/);
    });
});
