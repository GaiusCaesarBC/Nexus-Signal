// server/services/alertChecker.js - Alert Monitoring Service

const cron = require('node-cron');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification'); // We'll create this next
const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = process.env.COINGECKO_BASE_URL || 'https://pro-api.coingecko.com/api/v3';

// Map crypto symbols to CoinGecko IDs
const cryptoSymbolMap = {
    BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
    ADA: 'cardano', SOL: 'solana', DOGE: 'dogecoin', DOT: 'polkadot',
    BNB: 'binancecoin', LINK: 'chainlink', UNI: 'uniswap',
    MATIC: 'matic-network', SHIB: 'shiba-inu', TRX: 'tron',
    AVAX: 'avalanche-2', ATOM: 'cosmos', XMR: 'monero',
};

// Price cache to avoid excessive API calls
const priceCache = {};
const CACHE_DURATION = 60000; // 1 minute

// Fetch stock price from Alpha Vantage
async function fetchStockPrice(symbol) {
    const cacheKey = `stock-${symbol}`;
    
    if (priceCache[cacheKey] && Date.now() - priceCache[cacheKey].timestamp < CACHE_DURATION) {
        return priceCache[cacheKey].price;
    }

    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        const data = response.data;

        if (data['Global Quote'] && data['Global Quote']['05. price']) {
            const price = parseFloat(data['Global Quote']['05. price']);
            priceCache[cacheKey] = { price, timestamp: Date.now() };
            return price;
        }

        return null;
    } catch (error) {
        console.error(`[AlertChecker] Error fetching stock price for ${symbol}:`, error.message);
        return null;
    }
}

// Fetch crypto price from CoinGecko
async function fetchCryptoPrice(symbol) {
    const cacheKey = `crypto-${symbol}`;
    
    if (priceCache[cacheKey] && Date.now() - priceCache[cacheKey].timestamp < CACHE_DURATION) {
        return priceCache[cacheKey].price;
    }

    try {
        const coinGeckoId = cryptoSymbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
        const params = { ids: coinGeckoId, vs_currencies: 'usd' };

        if (COINGECKO_API_KEY) {
            params['x_cg_pro_api_key'] = COINGECKO_API_KEY;
        }

        const url = `${COINGECKO_BASE_URL}/simple/price`;
        const response = await axios.get(url, { params });
        const data = response.data;

        if (data[coinGeckoId] && data[coinGeckoId].usd) {
            const price = data[coinGeckoId].usd;
            priceCache[cacheKey] = { price, timestamp: Date.now() };
            return price;
        }

        return null;
    } catch (error) {
        console.error(`[AlertChecker] Error fetching crypto price for ${symbol}:`, error.message);
        return null;
    }
}

// Fetch current price based on asset type
async function fetchCurrentPrice(symbol, assetType) {
    if (assetType === 'crypto') {
        return await fetchCryptoPrice(symbol);
    } else {
        return await fetchStockPrice(symbol);
    }
}

// Create notification for triggered alert
async function createNotification(alert) {
    try {
        const notification = new Notification({
            user: alert.user,
            type: 'alert_triggered',
            title: getAlertTitle(alert),
            message: getAlertMessage(alert),
            data: {
                alertId: alert._id,
                symbol: alert.symbol,
                type: alert.type,
                triggeredPrice: alert.triggeredPrice
            },
            priority: 'high'
        });

        await notification.save();
        console.log(`[AlertChecker] Created notification for alert ${alert._id}`);

        // TODO: Send email if enabled
        if (alert.notifyVia.email) {
            await sendEmailNotification(alert);
        }

        // TODO: Send push notification if enabled
        if (alert.notifyVia.push) {
            await sendPushNotification(alert);
        }

        return notification;
    } catch (error) {
        console.error('[AlertChecker] Error creating notification:', error.message);
        return null;
    }
}

function getAlertTitle(alert) {
    switch (alert.type) {
        case 'price_above':
            return `🚀 ${alert.symbol} Price Alert`;
        case 'price_below':
            return `📉 ${alert.symbol} Price Alert`;
        case 'percent_change':
            return `📊 ${alert.symbol} Movement Alert`;
        case 'prediction_expiry':
            return `⏰ Prediction Expiring Soon`;
        case 'portfolio_value':
            return `💼 Portfolio Milestone`;
        default:
            return 'Alert Triggered';
    }
}

function getAlertMessage(alert) {
    if (alert.customMessage) return alert.customMessage;

    switch (alert.type) {
        case 'price_above':
            return `${alert.symbol} reached $${alert.triggeredPrice?.toFixed(2)} (Target: $${alert.targetPrice})`;
        case 'price_below':
            return `${alert.symbol} dropped to $${alert.triggeredPrice?.toFixed(2)} (Target: $${alert.targetPrice})`;
        case 'percent_change':
            return `${alert.symbol} changed ${alert.percentChange > 0 ? '+' : ''}${alert.percentChange}% in ${alert.timeframe}`;
        case 'prediction_expiry':
            return 'Your prediction is about to expire';
        case 'portfolio_value':
            return `Your portfolio reached $${alert.portfolioThreshold}`;
        default:
            return 'Your alert condition has been met';
    }
}

async function sendEmailNotification(alert) {
    // TODO: Implement email sending using nodemailer
    console.log(`[AlertChecker] Would send email for alert ${alert._id}`);
}

async function sendPushNotification(alert) {
    // TODO: Implement push notifications
    console.log(`[AlertChecker] Would send push notification for alert ${alert._id}`);
}

// Check a single alert
async function checkAlert(alert) {
    try {
        if (!alert.symbol) return false;

        const currentPrice = await fetchCurrentPrice(alert.symbol, alert.assetType);

        if (currentPrice === null) {
            console.log(`[AlertChecker] Could not fetch price for ${alert.symbol}, skipping...`);
            return false;
        }

        // Check if condition is met
        const triggered = alert.checkCondition(currentPrice, alert.currentPrice);

        if (triggered) {
            await alert.save();
            await createNotification(alert);
            
            console.log(`[AlertChecker] ✅ Alert triggered: ${alert.type} for ${alert.symbol} at $${currentPrice}`);
            
            return true;
        }

        // Update current price even if not triggered
        await alert.save();
        return false;

    } catch (error) {
        console.error(`[AlertChecker] Error checking alert ${alert._id}:`, error.message);
        return false;
    }
}

// Main function to check all active alerts
async function checkAllAlerts() {
    try {
        console.log('[AlertChecker] Starting alert check...');

        // Find all active price alerts
        const alerts = await Alert.find({
            status: 'active',
            type: { $in: ['price_above', 'price_below', 'percent_change'] },
            expiresAt: { $gt: new Date() }
        }).limit(100); // Process 100 at a time

        if (alerts.length === 0) {
            console.log('[AlertChecker] No active alerts to check');
            return;
        }

        console.log(`[AlertChecker] Checking ${alerts.length} alerts...`);

        let triggeredCount = 0;

        // Group alerts by symbol to minimize API calls
        const alertsBySymbol = {};
        alerts.forEach(alert => {
            if (!alertsBySymbol[alert.symbol]) {
                alertsBySymbol[alert.symbol] = [];
            }
            alertsBySymbol[alert.symbol].push(alert);
        });

        // Check each symbol's alerts
        for (const [symbol, symbolAlerts] of Object.entries(alertsBySymbol)) {
            const assetType = symbolAlerts[0].assetType;
            const currentPrice = await fetchCurrentPrice(symbol, assetType);

            if (currentPrice === null) {
                console.log(`[AlertChecker] Skipping ${symbol} - price unavailable`);
                continue;
            }

            console.log(`[AlertChecker] ${symbol}: $${currentPrice.toFixed(2)}`);

            // Check all alerts for this symbol
            for (const alert of symbolAlerts) {
                const triggered = await checkAlert(alert);
                if (triggered) triggeredCount++;

                // Small delay to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[AlertChecker] Check complete: ${triggeredCount} alerts triggered`);

    } catch (error) {
        console.error('[AlertChecker] Error in checkAllAlerts:', error.message);
    }
}

// Check prediction expiry alerts
async function checkPredictionExpiryAlerts() {
    try {
        // Find predictions expiring in the next hour
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

        const expiringAlerts = await Alert.find({
            status: 'active',
            type: 'prediction_expiry',
            expiresAt: { $lte: oneHourFromNow, $gt: new Date() }
        }).populate('prediction');

        for (const alert of expiringAlerts) {
            if (alert.prediction) {
                alert.status = 'triggered';
                alert.triggeredAt = new Date();
                await alert.save();
                await createNotification(alert);
                
                console.log(`[AlertChecker] Prediction expiry alert triggered for ${alert.prediction.symbol}`);
            }
        }

    } catch (error) {
        console.error('[AlertChecker] Error checking prediction expiry:', error.message);
    }
}

// Clean up old triggered alerts
async function cleanupOldAlerts() {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await Alert.deleteMany({
            status: { $in: ['triggered', 'expired', 'cancelled'] },
            updatedAt: { $lte: thirtyDaysAgo }
        });

        if (result.deletedCount > 0) {
            console.log(`[AlertChecker] Cleaned up ${result.deletedCount} old alerts`);
        }
    } catch (error) {
        console.error('[AlertChecker] Error cleaning up old alerts:', error.message);
    }
}

// Start the alert checker service
function startAlertChecker() {
    console.log('[AlertChecker] Starting alert checker service...');

    // Check price alerts every 1 minute
    cron.schedule('* * * * *', async () => {
        console.log('[AlertChecker] Running price alert check...');
        await checkAllAlerts();
    });

    // Check prediction expiry every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        console.log('[AlertChecker] Running prediction expiry check...');
        await checkPredictionExpiryAlerts();
    });

    // Clean up old alerts once per day at 3 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('[AlertChecker] Running cleanup...');
        await cleanupOldAlerts();
    });

    // Optional: Run immediately on startup
    if (process.env.CHECK_ALERTS_ON_STARTUP === 'true') {
        console.log('[AlertChecker] Running initial check on startup...');
        setTimeout(async () => {
            await checkAllAlerts();
        }, 10000); // Wait 10 seconds after startup
    }

    console.log('[AlertChecker] Cron jobs scheduled:');
    console.log('  - Price alerts: Every minute (* * * * *)');
    console.log('  - Prediction expiry: Every 10 minutes (*/10 * * * *)');
    console.log('  - Cleanup: Daily at 3 AM (0 3 * * *)');
}

// Manual trigger function
async function manualCheck() {
    console.log('[AlertChecker] Manual check triggered');
    await checkAllAlerts();
    await checkPredictionExpiryAlerts();
}

module.exports = {
    startAlertChecker,
    checkAllAlerts,
    checkPredictionExpiryAlerts,
    manualCheck,
    fetchCurrentPrice // Export for use in other services
};