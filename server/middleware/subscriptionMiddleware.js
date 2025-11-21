// server/middleware/subscriptionMiddleware.js - Feature Gating System

const User = require('../models/User');

// Plan limits configuration
const PLAN_LIMITS = {
    free: {
        dailySignals: 0,
        watchlists: 0,
        watchlistAssets: 0,
        predictionsPerMonth: 0,
        hasAdvancedAnalysis: false,
        hasPriceAlerts: false,
        hasAIChat: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasMultiAccount: false,
        hasMentorship: false,
        hasVIPCommunity: false
    },
    starter: {
        dailySignals: 5,
        watchlists: 1,
        watchlistAssets: 10,
        predictionsPerMonth: 3,
        hasAdvancedAnalysis: false,
        hasPriceAlerts: false,
        hasAIChat: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasMultiAccount: false,
        hasMentorship: false,
        hasVIPCommunity: false
    },
    pro: {
        dailySignals: 15,
        watchlists: 3,
        watchlistAssets: 30,
        predictionsPerMonth: 10,
        hasAdvancedAnalysis: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        hasAIChatGPT4: false,
        hasPortfolioTracking: false,
        hasCustomAlerts: false,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasMultiAccount: false,
        hasMentorship: false,
        hasVIPCommunity: false
    },
    premium: {
        dailySignals: -1, // -1 = unlimited
        watchlists: -1,
        watchlistAssets: -1,
        predictionsPerMonth: -1,
        hasAdvancedAnalysis: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        hasAIChatGPT4: true,
        hasPortfolioTracking: true,
        hasCustomAlerts: true,
        hasLiveData: true,
        hasPatternRecognition: true,
        hasSectorAnalysis: true,
        hasAPIAccess: false,
        hasBacktesting: false,
        hasMultiAccount: false,
        hasMentorship: false,
        hasVIPCommunity: false
    },
    elite: {
        dailySignals: -1,
        watchlists: -1,
        watchlistAssets: -1,
        predictionsPerMonth: -1,
        hasAdvancedAnalysis: true,
        hasPriceAlerts: true,
        hasAIChat: true,
        hasAIChatGPT4: true,
        hasPortfolioTracking: true,
        hasCustomAlerts: true,
        hasLiveData: true,
        hasPatternRecognition: true,
        hasSectorAnalysis: true,
        hasAPIAccess: true,
        hasUltraLowLatency: true,
        hasBacktesting: true,
        hasInstitutionalAnalytics: true,
        hasMultiAccount: true,
        hasCustomResearch: true,
        hasMentorship: true,
        hasWhiteLabel: true,
        hasDedicatedManager: true,
        hasVIPCommunity: true
    }
};

// Middleware to check if user has an active subscription
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

            const userPlan = user.subscription?.status || 'free';
            
            // Check if subscription is active
            if (userPlan !== 'free' && user.subscription?.currentPeriodEnd) {
                if (new Date() > user.subscription.currentPeriodEnd) {
                    // Subscription expired
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
            const userPlan = user.subscription?.status || 'free';
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
            const userPlan = user.subscription?.status || 'free';
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
    PLAN_LIMITS
};