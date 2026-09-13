const TIERS = ['starter', 'pro', 'premium', 'elite'];
const INTERVALS = ['monthly', 'yearly'];

function getPriceCatalog(env = process.env) {
    const catalog = {};
    const seen = new Set();
    for (const tier of TIERS) {
        catalog[tier] = {};
        for (const interval of INTERVALS) {
            const name = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
            const value = env[name];
            if (!/^price_[A-Za-z0-9]+$/.test(value || '') || seen.has(value)) {
                throw new Error(`Configure a unique valid ${name}`);
            }
            seen.add(value);
            catalog[tier][interval] = value;
        }
    }
    return catalog;
}

function getPlanFromPriceId(priceId, env = process.env) {
    const catalog = getPriceCatalog(env);
    const tier = TIERS.find(tier => Object.values(catalog[tier]).includes(priceId));
    if (!tier) throw new Error('Stripe price is not in the configured catalog');
    return tier;
}

module.exports = { getPriceCatalog, getPlanFromPriceId };
