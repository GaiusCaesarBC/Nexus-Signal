// No credential values may appear in configuration errors or status logs.
function environment(env = process.env) {
    const name = env.APP_ENV || (env.NODE_ENV === 'production' ? '' : 'development');
    if (!['development', 'test', 'staging', 'production'].includes(name)) {
        throw new Error('APP_ENV must explicitly identify staging or production for a hosted server');
    }
    return name;
}

function enabled(name, env = process.env) {
    if (env[name] !== undefined && !['true', 'false'].includes(env[name])) throw new Error(`${name} must be true or false`);
    return env[name] === 'true' || (env[name] === undefined && environment(env) === 'production');
}

function assertIntegration(name, env = process.env) {
    if (!enabled(name, env)) throw new Error(`${name} is disabled`);
    if (name === 'ENABLE_BILLING') {
        const mode = environment(env) === 'production' ? 'live' : 'test';
        if (!new RegExp(`^(sk|rk)_${mode}_`).test(env.STRIPE_SECRET_KEY || '')) throw new Error(`STRIPE_SECRET_KEY must use ${mode} mode`);
    }
    if (name === 'ENABLE_BROKERAGE_SYNC' && environment(env) !== 'production' && env.PLAID_ENV !== 'sandbox') {
        throw new Error('Non-production Plaid requires PLAID_ENV=sandbox');
    }
    if (name === 'ENABLE_BROKERAGE_SYNC' && environment(env) === 'production' && !['sandbox', 'production'].includes(env.PLAID_ENV)) {
        throw new Error('PLAID_ENV must be explicit when brokerage is enabled');
    }
    if (name === 'ENABLE_BROKERAGE_SYNC') {
        for (const name of ['PLAID_WEBHOOK_URL', 'PLAID_REDIRECT_URI']) if (env[name]) serviceUrl(name, env);
    }
}

function assertKrakenPrivate(env = process.env) {
    if (environment(env) !== 'production') throw new Error('Private Kraken calls are disabled outside production');
    assertIntegration('ENABLE_BROKERAGE_SYNC', env);
}

function assertEmailRecipients(message, env = process.env) {
    assertIntegration('ENABLE_NOTIFICATIONS', env);
    if (environment(env) === 'production') return;
    const allowed = (env.STAGING_EMAIL_RECIPIENTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    const recipients = [message.to, message.cc, message.bcc].flat().filter(Boolean).map(x => typeof x === 'string' ? x : x.email);
    if (!recipients.length || recipients.some(x => !allowed.includes(String(x).toLowerCase()))) {
        throw new Error('Email recipient is not on STAGING_EMAIL_RECIPIENTS');
    }
}

function serviceUrl(name, env = process.env) {
    const value = env[name];
    let url;
    try { url = new URL(value); } catch { throw new Error(`${name} must be an explicit service URL`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${name} must be an HTTP service URL without credentials`);
    if (environment(env) === 'staging' && ['nexussignal.ai', 'www.nexussignal.ai', 'api.nexussignal.ai', 'nexus-signal-ml.onrender.com', 'quantum-trade-server.onrender.com'].includes(url.hostname)) {
        throw new Error(`${name} cannot target a production service in staging`);
    }
    return value.replace(/\/$/, '');
}

function validateRuntime(env = process.env) {
    const stage = environment(env);
    const hosted = ['staging', 'production'].includes(stage);
    const flags = ['ENABLE_SCHEDULED_JOBS', 'ENABLE_NOTIFICATIONS', 'ENABLE_BILLING', 'ENABLE_BROKERAGE_SYNC', 'ENABLE_MEDIA_UPLOADS'];
    for (const flag of flags) enabled(flag, env);
    if (hosted) {
        if (env.NODE_ENV !== 'production') throw new Error('Hosted runtime requires NODE_ENV=production');
        for (const name of ['MONGODB_URI', 'JWT_SECRET', 'BROKERAGE_ENCRYPTION_KEY']) if (!env[name]) throw new Error(`${name} is required`);
        if (env.MONGO_URI) throw new Error('MONGO_URI must be unset; only MONGODB_URI is supported for hosted startup');
        for (const name of ['CLIENT_URL', 'API_URL', 'ML_SERVICE_URL']) serviceUrl(name, env);
        if (!env.ML_API_KEY) throw new Error('ML_API_KEY is required');
        if (!env.CORS_ALLOWED_ORIGINS) throw new Error('CORS_ALLOWED_ORIGINS is required');
        for (const origin of env.CORS_ALLOWED_ORIGINS.split(',')) serviceUrl('origin', {...env, origin: origin.trim()});
    }
    if (stage === 'staging') {
        if (env.PLAID_ENV && env.PLAID_ENV !== 'sandbox') throw new Error('Staging requires PLAID_ENV=sandbox');
        // An explicit target name prevents a missing DB path or default database.
        const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(env.MONGODB_URI || '');
        if (!env.STAGING_DB_NAME || !match || decodeURIComponent(match[1]) !== env.STAGING_DB_NAME || !/staging/i.test(env.STAGING_DB_NAME)) {
            throw new Error('MONGODB_URI must explicitly name STAGING_DB_NAME containing staging');
        }
        if (env.STRIPE_SECRET_KEY && !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)) throw new Error('Staging rejects live Stripe credentials');
        // Bots, SMS and push lack staging recipient allowlists: keep them unavailable.
        for (const name of ['TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN', 'X_API_KEY', 'X_ACCESS_TOKEN', 'TWILIO_AUTH_TOKEN', 'VAPID_PRIVATE_KEY']) {
            if (env[name]) throw new Error(`${name} must be unset in staging`);
        }
    }
    if (enabled('ENABLE_BILLING', env)) {
        assertIntegration('ENABLE_BILLING', env);
        require('./stripePrices').getPriceCatalog(env);
        if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required when billing is enabled');
    }
    if (enabled('ENABLE_BROKERAGE_SYNC', env)) assertIntegration('ENABLE_BROKERAGE_SYNC', env);
    if (stage === 'staging' && enabled('ENABLE_NOTIFICATIONS', env)) {
        for (const name of ['SENDGRID_API_KEY', 'EMAIL_FROM', 'STAGING_EMAIL_RECIPIENTS']) {
            if (!env[name]) throw new Error(`${name} is required for staging email opt-in`);
        }
    }
    return Object.fromEntries(flags.map(name => [name, enabled(name, env)]));
}

module.exports = { environment, enabled, assertIntegration, assertKrakenPrivate, assertEmailRecipients, serviceUrl, validateRuntime };
