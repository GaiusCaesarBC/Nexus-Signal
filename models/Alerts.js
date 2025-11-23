// server/services/alertChecker.js - UPDATED to work with YOUR Alert model

const cron = require('node-cron');
const Alert = require('../models/Alert');
const NotificationService = require('./notificationService');
const axios = require('axios');

let priceCheckJob = null;

// Helper to get current price
async function getCurrentPrice(symbol, assetType) {
  try {
    if (assetType === 'crypto') {
      const coinGeckoIds = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'XRP': 'ripple',
        'BNB': 'binancecoin',
        'SOL': 'solana',
        'ADA': 'cardano',
        'DOGE': 'dogecoin'
      };

      const coinId = coinGeckoIds[symbol.toUpperCase()] || symbol.toLowerCase();
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
      );

      return response.data[coinId]?.usd || null;
    } else {
      // Stock price - use your existing API
      const response = await axios.get(
        `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${process.env.FMP_API_KEY}`
      );
      
      return response.data[0]?.price || null;
    }
  } catch (error) {
    console.error(`[AlertChecker] Error fetching price for ${symbol}:`, error.message);
    return null;
  }
}

// Check all active alerts
async function checkAlerts() {
  try {
    const activeAlerts = await Alert.find({ 
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).populate('user', 'name email');

    if (activeAlerts.length === 0) return;

    console.log(`[AlertChecker] Checking ${activeAlerts.length} active alerts...`);

    for (const alert of activeAlerts) {
      try {
        // Skip if no symbol (portfolio/prediction alerts handled elsewhere)
        if (!alert.symbol) continue;

        const currentPrice = await getCurrentPrice(alert.symbol, alert.assetType);
        
        if (!currentPrice) continue;

        // Use the alert's built-in checkCondition method
        const triggered = alert.checkCondition(currentPrice, alert.currentPrice);

        if (triggered) {
          console.log(`[AlertChecker] Alert triggered! ${alert.symbol} for user ${alert.user._id}`);

          await alert.save();

          // Create message based on alert type
          let message = '';
          let title = '';

          switch (alert.type) {
            case 'price_above':
              title = '📈 Price Alert Triggered!';
              message = `${alert.symbol} hit your target price! Current: $${currentPrice.toFixed(2)}, Target: $${alert.targetPrice.toFixed(2)}`;
              break;

            case 'price_below':
              title = '📉 Price Alert Triggered!';
              message = `${alert.symbol} dropped below your target! Current: $${currentPrice.toFixed(2)}, Target: $${alert.targetPrice.toFixed(2)}`;
              break;

            case 'percent_change':
              title = '🚀 Price Change Alert!';
              const change = ((currentPrice - alert.currentPrice) / alert.currentPrice) * 100;
              message = `${alert.symbol} changed ${change > 0 ? '+' : ''}${change.toFixed(2)}% in ${alert.timeframe}`;
              break;

            default:
              title = '🔔 Alert Triggered!';
              message = alert.message || `Alert for ${alert.symbol} triggered`;
          }

          // 🔔 CREATE NOTIFICATION using NotificationService
          await NotificationService.createAlertNotification(
            alert.user._id,
            alert.type,
            title,
            message,
            alert._id
          );

          // Send email if enabled
          if (alert.notifyVia?.email) {
            // TODO: Implement email sending
            console.log(`[AlertChecker] Would send email to ${alert.user.email}`);
          }

          // Send push notification if enabled
          if (alert.notifyVia?.push) {
            // TODO: Implement push notification
            console.log(`[AlertChecker] Would send push notification to user ${alert.user._id}`);
          }
        }
      } catch (error) {
        console.error(`[AlertChecker] Error processing alert ${alert._id}:`, error);
      }
    }
  } catch (error) {
    console.error('[AlertChecker] Error in checkAlerts:', error);
  }
}

// Start the alert checker service
function startAlertChecker() {
  console.log('[AlertChecker] Starting alert checker service...');

  // Check alerts every minute
  priceCheckJob = cron.schedule('* * * * *', async () => {
    await checkAlerts();
  });

  console.log('[AlertChecker] Cron jobs scheduled:');
  console.log('  - Price alerts: Every minute');
  
  // Run once immediately
  checkAlerts();
}

// Stop the alert checker service
function stopAlertChecker() {
  if (priceCheckJob) {
    priceCheckJob.stop();
    console.log('[AlertChecker] Alert checker service stopped');
  }
}

module.exports = {
  startAlertChecker,
  stopAlertChecker,
  checkAlerts
};