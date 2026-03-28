// server/middleware/subscriptionMiddleware.js - Feature Gating System

const User = require('../models/User');

// Plan limits configuration
const PLAN_LIMITS = {
    // ═══════════════════════════════════════════════════════
    // FREE — Paper trading, gamification, social. No signals.
    // ═══════════════════════════════════════════════════════
    free: {
        // Limits
        dailySignals: 0,
        watchlists: 0,
        watchlistAssets: 0,
        predictionsPerMonth: 0,
        // Free features (available to all)
        hasGamification: true,
        hasPaperTrading: true,
        hasSocialFeed: true,
        // Gated features
        hasScreener: false,
        hasNewsFeed: false,
        hasTradeJournal: false,
        hasStockDetails: false,
        hasSentimentAnalysis: false,
        hasAdvancedAnalysis: false,
        hasHeatmap: false,
        hasTechnicalIndicators: false,
        hasStockComparison: false,
        hasSwingTrading: false,
        hasPriceAlerts: false,
        hasAIChat: false,
        hasAIChatGPT4: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasPredictionHistory: false,
        hasAccuracyAnalytics: false,
        hasPatternRecognition: false,
        hasLiveData: false,
        hasSectorAnalysis: false,
        hasDiscoveryPage: false,
        hasDarkPoolFlow: false,
        hasInstitutionalActivity: false,
        hasCongressionalTrades: false,
        hasWhaleAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasUltraLowLatency: false,
        hasInstitutionalAnalytics: false,
        hasMultiAccount: false,
        hasCustomResearch: false,
        hasMentorship: false,
        hasWhiteLabel: false,
        hasDedicatedManager: false,
        hasVIPCommunity: false,
        hasWhaleWebhooks: false,
        hasEarlyAccess: false,
    },
    // ═══════════════════════════════════════════════════════
    // STARTER — 5 signals/day, screener, news, watchlist
    // ═══════════════════════════════════════════════════════
    starter: {
        dailySignals: 5,
        watchlists: 1,
        watchlistAssets: 10,
        predictionsPerMonth: 3,
        // Free features
        hasGamification: true,
        hasPaperTrading: true,
        hasSocialFeed: true,
        // Starter features
        hasScreener: true,
        hasNewsFeed: true,
        hasTradeJournal: true,
        hasStockDetails: true,
        hasSentimentAnalysis: true,
        // Not yet
        hasAdvancedAnalysis: false,
        hasHeatmap: false,
        hasTechnicalIndicators: false,
        hasStockComparison: false,
        hasSwingTrading: false,
        hasPriceAlerts: false,
        hasAIChat: false,
        hasAIChatGPT4: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasPredictionHistory: false,
        hasAccuracyAnalytics: false,
        hasPatternRecognition: false,
        hasLiveData: false,
        hasSectorAnalysis: false,
        hasDiscoveryPage: false,
        hasDarkPoolFlow: false,
        hasInstitutionalActivity: false,
        hasCongressionalTrades: false,
        hasWhaleAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasUltraLowLatency: false,
        hasInstitutionalAnalytics: false,
        hasMultiAccount: false,
        hasCustomResearch: false,
        hasMentorship: false,
        hasWhiteLabel: false,
        hasDedicatedManager: false,
        hasVIPCommunity: false,
        hasWhaleWebhooks: false,
        hasEarlyAccess: false,
    },
    // ═══════════════════════════════════════════════════════
    // PRO — 15 signals, AI chat, heatmap, pattern scanner, alerts
    // ═══════════════════════════════════════════════════════
    pro: {
        dailySignals: 15,
        watchlists: 3,
        watchlistAssets: 30,
        predictionsPerMonth: 10,
        // Free + Starter
        hasGamification: true,
        hasPaperTrading: true,
        hasSocialFeed: true,
        hasScreener: true,
        hasNewsFeed: true,
        hasTradeJournal: true,
        hasStockDetails: true,
        hasSentimentAnalysis: true,
        // Pro features
        hasAdvancedAnalysis: true,
        hasHeatmap: true,
        hasTechnicalIndicators: true,
        hasStockComparison: true,
        hasSwingTrading: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        // Not yet
        hasAIChatGPT4: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasPredictionHistory: false,
        hasAccuracyAnalytics: false,
        hasPatternRecognition: false,
        hasLiveData: false,
        hasSectorAnalysis: false,
        hasDiscoveryPage: false,
        hasDarkPoolFlow: false,
        hasInstitutionalActivity: false,
        hasCongressionalTrades: false,
        hasWhaleAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasUltraLowLatency: false,
        hasInstitutionalAnalytics: false,
        hasMultiAccount: false,
        hasCustomResearch: false,
        hasMentorship: false,
        hasWhiteLabel: false,
        hasDedicatedManager: false,
        hasVIPCommunity: false,
        hasWhaleWebhooks: false,
        hasEarlyAccess: false,
    },
    // ═══════════════════════════════════════════════════════
    // PREMIUM — Unlimited signals, whale intel, portfolio, GPT-4
    // ═══════════════════════════════════════════════════════
    premium: {
        dailySignals: -1,
        watchlists: -1,
        watchlistAssets: -1,
        predictionsPerMonth: -1,
        // All lower tiers
        hasGamification: true,
        hasPaperTrading: true,
        hasSocialFeed: true,
        hasScreener: true,
        hasNewsFeed: true,
        hasTradeJournal: true,
        hasStockDetails: true,
        hasSentimentAnalysis: true,
        hasAdvancedAnalysis: true,
        hasHeatmap: true,
        hasTechnicalIndicators: true,
        hasStockComparison: true,
        hasSwingTrading: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        // Premium features
        hasAIChatGPT4: true,
        hasPortfolioTracking: true,
        hasCustomAlerts: true,
        hasPredictionHistory: true,
        hasAccuracyAnalytics: true,
        hasPatternRecognition: true,
        hasLiveData: true,
        hasSectorAnalysis: true,
        hasDiscoveryPage: true,
        hasDarkPoolFlow: true,
        hasInstitutionalActivity: true,
        hasCongressionalTrades: true,
        hasWhaleAlerts: true,
        // Not yet
        hasAPIAccess: false,
        hasBacktesting: false,
        hasUltraLowLatency: false,
        hasInstitutionalAnalytics: false,
        hasMultiAccount: false,
        hasCustomResearch: false,
        hasMentorship: false,
        hasWhiteLabel: false,
        hasDedicatedManager: false,
        hasVIPCommunity: false,
        hasWhaleWebhooks: false,
        hasEarlyAccess: false,
    },
    // ═══════════════════════════════════════════════════════
    // ELITE — Everything + API, backtesting, mentorship, VIP
    // ═══════════════════════════════════════════════════════
    elite: {
        dailySignals: -1,
        watchlists: -1,
        watchlistAssets: -1,
        predictionsPerMonth: -1,
        // All features enabled
        hasGamification: true,
        hasPaperTrading: true,
        hasSocialFeed: true,
        hasScreener: true,
        hasNewsFeed: true,
        hasTradeJournal: true,
        hasStockDetails: true,
        hasSentimentAnalysis: true,
        hasAdvancedAnalysis: true,
        hasHeatmap: true,
        hasTechnicalIndicators: true,
        hasStockComparison: true,
        hasSwingTrading: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        hasAIChatGPT4: true,
        hasPortfolioTracking: true,
        hasCustomAlerts: true,
        hasPredictionHistory: true,
        hasAccuracyAnalytics: true,
        hasPatternRecognition: true,
        hasLiveData: true,
        hasSectorAnalysis: true,
        hasDiscoveryPage: true,
        hasDarkPoolFlow: true,
        hasInstitutionalActivity: true,
        hasCongressionalTrades: true,
        hasWhaleAlerts: true,
        // Elite features
        hasAPIAccess: true,
        hasBacktesting: true,
        hasUltraLowLatency: true,
        hasInstitutionalAnalytics: true,
        hasMultiAccount: true,
        hasCustomResearch: true,
        hasMentorship: true,
        hasWhiteLabel: true,
        hasDedicatedManager: true,
        hasVIPCommunity: true,
        hasWhaleWebhooks: true,
        hasEarlyAccess: true,
    }
};

// Middleware to check if user has an active subscription
/**
 * Check if user has an active free trial
 */
function getEffectivePlan(user) {
    let plan = user.subscription?.status || 'free';

    // Check if paid subscription expired
    if (plan !== 'free' && user.subscription?.currentPeriodEnd) {
        if (new Date() > user.subscription.currentPeriodEnd) {
            return { plan: 'free', expired: true, trial: false };
        }
    }

    // Check active free trial (grants premium access)
    if (plan === 'free' && user.subscription?.trialEndsAt) {
        if (new Date() < user.subscription.trialEndsAt) {
            return { plan: 'premium', expired: false, trial: true };
        }
    }

    return { plan, expired: false, trial: false };
}

const requireSubscription = (minPlan = 'starter') => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const { plan: userPlan, expired, trial } = getEffectivePlan(user);

            // Handle expired paid subscription
            if (expired) {
                user.subscription.status = 'free';
                await user.save();

                return res.status(403).json({
                    success: false,
                    error: 'Subscription expired',
                    requiresUpgrade: true,
                    currentPlan: 'free',
                    requiredPlan: minPlan
                });
            }

            // Plan hierarchy: free < starter < pro < premium < elite
            const planHierarchy = ['free', 'starter', 'pro', 'premium', 'elite'];
            const userPlanLevel = planHierarchy.indexOf(userPlan);
            const requiredPlanLevel = planHierarchy.indexOf(minPlan);

            if (userPlanLevel < requiredPlanLevel) {
                return res.status(403).json({
                    success: false,
                    error: `This feature requires ${minPlan} plan or higher`,
                    requiresUpgrade: true,
                    currentPlan: userPlan,
                    requiredPlan: minPlan
                });
            }

            // Attach plan info to request
            req.userPlan = userPlan;
            req.planLimits = PLAN_LIMITS[userPlan];
            req.isTrialUser = trial;

            next();
        } catch (error) {
            console.error('Subscription check error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify subscription'
            });
        }
    };
};

// Middleware to check specific feature access
const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);
            const { plan: userPlan } = getEffectivePlan(user);
            const limits = PLAN_LIMITS[userPlan];

            if (!limits[featureName]) {
                return res.status(403).json({
                    success: false,
                    error: `This feature is not available on your ${userPlan} plan`,
                    requiresUpgrade: true,
                    currentPlan: userPlan,
                    feature: featureName
                });
            }

            req.userPlan = userPlan;
            req.planLimits = limits;
            next();
        } catch (error) {
            console.error('Feature check error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify feature access'
            });
        }
    };
};

// Middleware to check usage limits (for countable features)
const checkUsageLimit = (limitType, modelName = null) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);
            const { plan: userPlan } = getEffectivePlan(user);
            const limits = PLAN_LIMITS[userPlan];

            const limit = limits[limitType];

            // -1 means unlimited
            if (limit === -1) {
                req.userPlan = userPlan;
                req.planLimits = limits;
                return next();
            }

            // Check current usage based on limit type
            let currentUsage = 0;

            switch (limitType) {
                case 'watchlists': {
                    const Watchlist = require('../models/Watchlist');
                    currentUsage = await Watchlist.countDocuments({ user: user._id });
                    break;
                }
                case 'predictionsPerMonth': {
                    const Prediction = require('../models/Prediction');
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
                    
                    currentUsage = await Prediction.countDocuments({ 
                        user: user._id,
                        createdAt: { $gte: startOfMonth }
                    });
                    break;
                }
                case 'dailySignals': {
                    // Check signals used today (implement based on your signal tracking)
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    
                    // This assumes you have a Signal model - adjust as needed
                    if (modelName) {
                        const Model = require(`../models/${modelName}`);
                        currentUsage = await Model.countDocuments({ 
                            user: user._id,
                            createdAt: { $gte: startOfDay }
                        });
                    }
                    break;
                }
            }

            if (currentUsage >= limit) {
                return res.status(403).json({
                    success: false,
                    error: `You've reached your ${limitType} limit`,
                    requiresUpgrade: true,
                    currentPlan: userPlan,
                    currentUsage,
                    limit,
                    limitType
                });
            }

            req.userPlan = userPlan;
            req.planLimits = limits;
            req.currentUsage = currentUsage;
            next();
        } catch (error) {
            console.error('Usage limit check error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to check usage limits' 
            });
        }
    };
};

// Helper function to get user's plan limits (for use in routes)
const getPlanLimits = async (userId) => {
    try {
        const user = await User.findById(userId);
        const userPlan = user?.subscription?.status || 'free';
        return {
            plan: userPlan,
            limits: PLAN_LIMITS[userPlan]
        };
    } catch (error) {
        console.error('Get plan limits error:', error);
        return {
            plan: 'free',
            limits: PLAN_LIMITS.free
        };
    }
};

// Helper to check if plan has feature (for frontend)
const hasFeature = (plan, featureName) => {
    return PLAN_LIMITS[plan]?.[featureName] || false;
};

module.exports = {
    requireSubscription,
    requireFeature,
    checkUsageLimit,
    getPlanLimits,
    hasFeature,
    getEffectivePlan,
    PLAN_LIMITS
};