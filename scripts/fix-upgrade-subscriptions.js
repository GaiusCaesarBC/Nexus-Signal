/**
 * Fix Upgrade Subscription Bug
 * 
 * Identifies and fixes users whose subscription status wasn't updated when they upgraded.
 * This can happen when:
 * 1. User had a free account and upgrades for the first time (stripeCustomerId wasn't set)
 * 2. Webhook failed to find user by stripeCustomerId
 * 3. User upgraded from one plan to another but DB wasn't updated
 */

require('dotenv').config();
require('../config/runtimeSafety').validateRuntime();

const mongoose = require('mongoose');
const stripe = require('../config/stripeClient').createStripeClient();
const User = require('../models/User');

const { getPlanFromPriceId } = require('../config/stripePrices');

async function fixUpgradeSubscriptions() {
    console.log('🔧 Starting subscription sync fix...\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all users with active Stripe subscriptions
        const users = await User.find({
            'subscription.stripeCustomerId': { $exists: true, $ne: null }
        });

        console.log(`Found ${users.length} users with Stripe subscriptions\n`);

        let fixed = 0;
        let errors = 0;
        const issues = [];

        for (const user of users) {
            try {
                const customerId = user.subscription.stripeCustomerId;

                // Get the latest subscription from Stripe
                const subscriptions = await stripe.subscriptions.list({
                    customer: customerId,
                    limit: 1,
                    status: 'active'
                });

                if (subscriptions.data.length === 0) {
                    // No active subscription in Stripe, but we have one in DB
                    if (user.subscription.status !== 'free') {
                        console.log(`⚠️  User ${user.email} (ID: ${user._id}): Has DB subscription but NO active Stripe subscription`);
                        issues.push({
                            type: 'orphaned_db_subscription',
                            email: user.email,
                            userId: user._id.toString(),
                            dbStatus: user.subscription.status
                        });
                    }
                    continue;
                }

                const stripeSubscription = subscriptions.data[0];
                const priceId = stripeSubscription.items.data[0].price.id;
                const latestPlan = getPlanFromPriceId(priceId);
                const dbPlan = user.subscription.status || 'free';

                // Check if DB is out of sync
                if (latestPlan !== dbPlan) {
                    console.log(`❌ User ${user.email} (ID: ${user._id})`);
                    console.log(`   Stripe has: ${latestPlan}, DB has: ${dbPlan}`);

                    // Update user to match Stripe
                    user.subscription.status = latestPlan;
                    user.subscription.stripeSubscriptionId = stripeSubscription.id;
                    user.subscription.stripePriceId = priceId;
                    user.subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
                    user.subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
                    user.subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

                    await user.save();

                    console.log(`✅ FIXED: ${dbPlan} → ${latestPlan}\n`);
                    fixed++;
                } else {
                    console.log(`✓  User ${user.email}: Subscription in sync (${dbPlan})\n`);
                }
            } catch (err) {
                console.error(`❌ Error processing user ${user.email}: ${err.message}\n`);
                errors++;
                issues.push({
                    type: 'processing_error',
                    email: user.email,
                    userId: user._id.toString(),
                    error: err.message
                });
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total users with Stripe subscriptions: ${users.length}`);
        console.log(`✅ Fixed: ${fixed}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`Issues found: ${issues.length}\n`);

        if (issues.length > 0) {
            console.log('⚠️  Issues that need manual intervention:');
            issues.forEach(issue => {
                console.log(`\n${issue.type} - ${issue.email}:`);
                if (issue.dbStatus) console.log(`  DB Status: ${issue.dbStatus}`);
                if (issue.error) console.log(`  Error: ${issue.error}`);
            });
        }

        console.log('\n✅ Fix complete!');
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
    }
}

// Run the fix
fixUpgradeSubscriptions().catch(console.error);
