const safety = require('./runtimeSafety');
// Lazy construction permits a billing-disabled service without Stripe credentials.
function createStripeClient(factory = key => require('stripe')(key)) {
    let client;
    function wrap(parts = []) {
        return new Proxy(function () {}, {
            get(_target, property) {
                if (property === 'then') return undefined;
                return wrap([...parts, property]);
            },
            apply(_target, _this, args) {
                safety.assertIntegration('ENABLE_BILLING');
                if (!client) client = factory(process.env.STRIPE_SECRET_KEY);
                let owner = client;
                for (const part of parts.slice(0, -1)) owner = owner[part];
                return owner[parts.at(-1)](...args);
            }
        });
    }
    return wrap();
}
module.exports = { createStripeClient };
