// server/services/alertChecker.js - Alert Monitoring Service

const cron = require('node-cron');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const User = require('../models/User');
const axios = require('axios');
const { sendPriceAlertEmail } = require('./emailService');
const { calculateRSI, calculateMACD, calculateBollingerBands } = require('../utils/indicators');
const { detectSpecificPattern, detectAllPatterns } = require('../utils/patternRecognition');
const { getChartData } = require('./chartService');

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

// Technical indicator cache (stores previous values for crossover detection)
const indicatorStateCache = new Map(); // symbol -> { rsi, macdLine, macdSignal, bollingerUpper, bollingerLower, price, timestamp }
const INDICATOR_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
        // Price alerts
        case 'price_above':
            return `🚀 ${alert.symbol} Price Alert`;
        case 'price_below':
            return `📉 ${alert.symbol} Price Alert`;
        case 'percent_change':
            return `📊 ${alert.symbol} Movement Alert`;

        // System alerts
        case 'prediction_expiry':
            return `⏰ Prediction Expiring Soon`;
        case 'portfolio_value':
            return `💼 Portfolio Milestone`;

        // RSI alerts
        case 'rsi_oversold':
            return `📉 ${alert.symbol} RSI Oversold`;
        case 'rsi_overbought':
            return `📈 ${alert.symbol} RSI Overbought`;

        // MACD alerts
        case 'macd_bullish_crossover':
            return `✨ ${alert.symbol} MACD Bullish Crossover`;
        case 'macd_bearish_crossover':
            return `⚠️ ${alert.symbol} MACD Bearish Crossover`;

        // Bollinger alerts
        case 'bollinger_upper_breakout':
            return `🔥 ${alert.symbol} Bollinger Upper Breakout`;
        case 'bollinger_lower_breakout':
            return `❄️ ${alert.symbol} Bollinger Lower Breakout`;

        // Support/Resistance alerts
        case 'support_test':
            return `🛡️ ${alert.symbol} Testing Support`;
        case 'resistance_test':
            return `🎯 ${alert.symbol} Testing Resistance`;

        // Pattern recognition alerts
        case 'head_shoulders':
            return `📉 ${alert.symbol} Head & Shoulders Pattern`;
        case 'inverse_head_shoulders':
            return `📈 ${alert.symbol} Inverse Head & Shoulders`;
        case 'double_top':
            return `🔻 ${alert.symbol} Double Top Pattern`;
        case 'double_bottom':
            return `🔺 ${alert.symbol} Double Bottom Pattern`;
        case 'ascending_triangle':
            return `△ ${alert.symbol} Ascending Triangle`;
        case 'descending_triangle':
            return `▽ ${alert.symbol} Descending Triangle`;
        case 'symmetrical_triangle':
            return `◇ ${alert.symbol} Symmetrical Triangle`;
        case 'bull_flag':
            return `🚩 ${alert.symbol} Bull Flag Pattern`;
        case 'bear_flag':
            return `🏴 ${alert.symbol} Bear Flag Pattern`;
        case 'rising_wedge':
            return `⬆️ ${alert.symbol} Rising Wedge`;
        case 'falling_wedge':
            return `⬇️ ${alert.symbol} Falling Wedge`;

        default:
            return 'Alert Triggered';
    }
}

function getAlertMessage(alert) {
    if (alert.customMessage) return alert.customMessage;

    const triggerData = alert.technicalTriggerData || {};
    const params = alert.technicalParams || {};

    switch (alert.type) {
        // Price alerts
        case 'price_above':
            return `${alert.symbol} reached $${alert.triggeredPrice?.toFixed(2)} (Target: $${alert.targetPrice})`;
        case 'price_below':
            return `${alert.symbol} dropped to $${alert.triggeredPrice?.toFixed(2)} (Target: $${alert.targetPrice})`;
        case 'percent_change':
            return `${alert.symbol} changed ${alert.percentChange > 0 ? '+' : ''}${alert.percentChange}% in ${alert.timeframe}`;

        // System alerts
        case 'prediction_expiry':
            return 'Your prediction is about to expire';
        case 'portfolio_value':
            return `Your portfolio reached $${alert.portfolioThreshold}`;

        // RSI alerts
        case 'rsi_oversold':
            return `${alert.symbol} RSI dropped to ${triggerData.indicatorValue?.toFixed(1) || 'N/A'} (below ${params.rsiThreshold || 30}) - Oversold territory`;
        case 'rsi_overbought':
            return `${alert.symbol} RSI rose to ${triggerData.indicatorValue?.toFixed(1) || 'N/A'} (above ${params.rsiThreshold || 70}) - Overbought territory`;

        // MACD alerts
        case 'macd_bullish_crossover':
            return `${alert.symbol} MACD line crossed above signal line - Bullish momentum`;
        case 'macd_bearish_crossover':
            return `${alert.symbol} MACD line crossed below signal line - Bearish momentum`;

        // Bollinger alerts
        case 'bollinger_upper_breakout':
            return `${alert.symbol} broke above upper Bollinger Band at $${alert.triggeredPrice?.toFixed(2)} - Potential breakout`;
        case 'bollinger_lower_breakout':
            return `${alert.symbol} broke below lower Bollinger Band at $${alert.triggeredPrice?.toFixed(2)} - Potential breakdown`;

        // Support/Resistance alerts
        case 'support_test':
            return `${alert.symbol} testing support at $${params.supportLevel?.toFixed(2)} (Current: $${alert.triggeredPrice?.toFixed(2)})`;
        case 'resistance_test':
            return `${alert.symbol} testing resistance at $${params.resistanceLevel?.toFixed(2)} (Current: $${alert.triggeredPrice?.toFixed(2)})`;

        // Pattern recognition alerts
        case 'head_shoulders': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Head & Shoulders detected (${patternData.confidence || 0}% confidence) - Bearish reversal signal. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'inverse_head_shoulders': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Inverse Head & Shoulders detected (${patternData.confidence || 0}% confidence) - Bullish reversal signal. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'double_top': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Double Top pattern detected (${patternData.confidence || 0}% confidence) - Bearish reversal. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'double_bottom': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Double Bottom pattern detected (${patternData.confidence || 0}% confidence) - Bullish reversal. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'ascending_triangle': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Ascending Triangle detected (${patternData.confidence || 0}% confidence) - Bullish breakout likely. Breakout level: $${patternData.breakoutLevel?.toFixed(2) || 'N/A'}`;
        }
        case 'descending_triangle': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Descending Triangle detected (${patternData.confidence || 0}% confidence) - Bearish breakdown likely. Breakout level: $${patternData.breakoutLevel?.toFixed(2) || 'N/A'}`;
        }
        case 'symmetrical_triangle': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Symmetrical Triangle detected (${patternData.confidence || 0}% confidence) - Breakout imminent in either direction`;
        }
        case 'bull_flag': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Bull Flag pattern detected (${patternData.confidence || 0}% confidence) - Bullish continuation. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'bear_flag': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Bear Flag pattern detected (${patternData.confidence || 0}% confidence) - Bearish continuation. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'rising_wedge': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Rising Wedge detected (${patternData.confidence || 0}% confidence) - Bearish reversal pattern. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }
        case 'falling_wedge': {
            const patternData = alert.patternTriggerData || {};
            return `${alert.symbol} Falling Wedge detected (${patternData.confidence || 0}% confidence) - Bullish reversal pattern. Target: $${patternData.priceTarget?.toFixed(2) || 'N/A'}`;
        }

        default:
            return 'Your alert condition has been met';
    }
}

async function sendEmailNotification(alert) {
    try {
        // Get user's email
        const user = await User.findById(alert.user).select('email username');
        if (!user || !user.email) {
            console.log(`[AlertChecker] No email found for user ${alert.user}`);
            return false;
        }

        const result = await sendPriceAlertEmail(
            user.email,
            user.username || 'Trader',
            alert
        );

        if (result) {
            console.log(`[AlertChecker] Email sent to ${user.email} for ${alert.symbol} alert`);
        }
        return result;
    } catch (error) {
        console.error(`[AlertChecker] Error sending email notification:`, error.message);
        return false;
    }
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

// ==================== TECHNICAL ALERT CHECKING ====================

// Calculate indicators for a symbol
async function calculateIndicatorsForSymbol(symbol) {
    try {
        // Fetch chart data (daily candles)
        const chartResult = await getChartData(symbol, '1D');

        if (!chartResult.success || !chartResult.data || chartResult.data.length < 30) {
            console.log(`[AlertChecker] Insufficient data for ${symbol} indicators`);
            return null;
        }

        const candles = chartResult.data;
        const closes = candles.map(c => c.close);
        const currentPrice = closes[closes.length - 1];

        // Calculate indicators
        const rsi = calculateRSI(closes, 14);
        const macd = calculateMACD(closes, 12, 26, 9);
        const bollinger = calculateBollingerBands(candles, 20, 2);

        return {
            rsi,
            macdLine: macd.macd,
            macdSignal: macd.signal,
            macdHistogram: macd.histogram,
            bollingerUpper: bollinger.upper,
            bollingerMid: bollinger.mid,
            bollingerLower: bollinger.lower,
            currentPrice,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error(`[AlertChecker] Error calculating indicators for ${symbol}:`, error.message);
        return null;
    }
}

// Check a single technical alert
async function checkTechnicalAlert(alert, indicators, previousState) {
    try {
        const params = alert.technicalParams || {};
        let triggered = false;
        let triggerData = {};

        switch (alert.type) {
            case 'rsi_oversold': {
                const threshold = params.rsiThreshold || 30;
                if (indicators.rsi !== null && indicators.rsi <= threshold) {
                    // Only trigger if RSI wasn't already below threshold (to avoid repeated triggers)
                    const wasAbove = !previousState || previousState.rsi > threshold;
                    if (wasAbove) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.rsi,
                            indicatorName: 'RSI',
                            signalDescription: `RSI dropped below ${threshold}`
                        };
                    }
                }
                break;
            }

            case 'rsi_overbought': {
                const threshold = params.rsiThreshold || 70;
                if (indicators.rsi !== null && indicators.rsi >= threshold) {
                    const wasBelow = !previousState || previousState.rsi < threshold;
                    if (wasBelow) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.rsi,
                            indicatorName: 'RSI',
                            signalDescription: `RSI rose above ${threshold}`
                        };
                    }
                }
                break;
            }

            case 'macd_bullish_crossover': {
                if (indicators.macdLine !== null && indicators.macdSignal !== null && previousState) {
                    const crossedAbove = indicators.macdLine > indicators.macdSignal &&
                        previousState.macdLine <= previousState.macdSignal;
                    if (crossedAbove) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.macdLine,
                            indicatorName: 'MACD',
                            signalDescription: 'MACD line crossed above signal line'
                        };
                    }
                }
                break;
            }

            case 'macd_bearish_crossover': {
                if (indicators.macdLine !== null && indicators.macdSignal !== null && previousState) {
                    const crossedBelow = indicators.macdLine < indicators.macdSignal &&
                        previousState.macdLine >= previousState.macdSignal;
                    if (crossedBelow) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.macdLine,
                            indicatorName: 'MACD',
                            signalDescription: 'MACD line crossed below signal line'
                        };
                    }
                }
                break;
            }

            case 'bollinger_upper_breakout': {
                if (indicators.bollingerUpper !== null && previousState) {
                    const brokeAbove = indicators.currentPrice > indicators.bollingerUpper &&
                        previousState.currentPrice <= previousState.bollingerUpper;
                    if (brokeAbove) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.bollingerUpper,
                            indicatorName: 'Bollinger Bands',
                            signalDescription: 'Price broke above upper band'
                        };
                    }
                }
                break;
            }

            case 'bollinger_lower_breakout': {
                if (indicators.bollingerLower !== null && previousState) {
                    const brokeBelow = indicators.currentPrice < indicators.bollingerLower &&
                        previousState.currentPrice >= previousState.bollingerLower;
                    if (brokeBelow) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: indicators.bollingerLower,
                            indicatorName: 'Bollinger Bands',
                            signalDescription: 'Price broke below lower band'
                        };
                    }
                }
                break;
            }

            case 'support_test': {
                const supportLevel = params.supportLevel;
                const tolerance = (params.tolerance || 2) / 100; // Convert percentage to decimal
                if (supportLevel && indicators.currentPrice) {
                    const withinTolerance = Math.abs(indicators.currentPrice - supportLevel) / supportLevel <= tolerance;
                    const wasAbove = !previousState || previousState.currentPrice > supportLevel * (1 + tolerance);
                    if (withinTolerance && wasAbove) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: supportLevel,
                            indicatorName: 'Support Level',
                            signalDescription: `Price approaching support at $${supportLevel.toFixed(2)}`
                        };
                    }
                }
                break;
            }

            case 'resistance_test': {
                const resistanceLevel = params.resistanceLevel;
                const tolerance = (params.tolerance || 2) / 100;
                if (resistanceLevel && indicators.currentPrice) {
                    const withinTolerance = Math.abs(indicators.currentPrice - resistanceLevel) / resistanceLevel <= tolerance;
                    const wasBelow = !previousState || previousState.currentPrice < resistanceLevel * (1 - tolerance);
                    if (withinTolerance && wasBelow) {
                        triggered = true;
                        triggerData = {
                            indicatorValue: resistanceLevel,
                            indicatorName: 'Resistance Level',
                            signalDescription: `Price approaching resistance at $${resistanceLevel.toFixed(2)}`
                        };
                    }
                }
                break;
            }
        }

        if (triggered) {
            // Update alert status
            alert.status = 'triggered';
            alert.triggeredAt = new Date();
            alert.triggeredPrice = indicators.currentPrice;
            alert.technicalTriggerData = triggerData;
            alert.lastChecked = new Date();
            alert.checkCount = (alert.checkCount || 0) + 1;

            // Store previous indicator values
            alert.technicalParams = {
                ...alert.technicalParams,
                lastRsi: indicators.rsi,
                lastMacdLine: indicators.macdLine,
                lastMacdSignal: indicators.macdSignal,
                lastBollingerUpper: indicators.bollingerUpper,
                lastBollingerLower: indicators.bollingerLower
            };

            await alert.save();
            await createNotification(alert);

            // Send Telegram notification if user has it enabled
            try {
                const { sendTechnicalAlertNotification } = require('./telegramScheduler');
                await sendTechnicalAlertNotification(alert.user, alert);
            } catch (telegramError) {
                console.error(`[AlertChecker] Error sending Telegram notification:`, telegramError.message);
            }

            console.log(`[AlertChecker] ✅ Technical alert triggered: ${alert.type} for ${alert.symbol}`);
            return true;
        }

        // Update lastChecked even if not triggered
        alert.lastChecked = new Date();
        alert.checkCount = (alert.checkCount || 0) + 1;
        alert.currentPrice = indicators.currentPrice;
        await alert.save();

        return false;

    } catch (error) {
        console.error(`[AlertChecker] Error checking technical alert ${alert._id}:`, error.message);
        return false;
    }
}

// Main function to check all technical alerts
async function checkTechnicalAlerts() {
    try {
        console.log('[AlertChecker] Starting technical alert check...');

        // Get all active technical alerts
        const technicalAlerts = await Alert.getActiveTechnicalAlerts();

        if (technicalAlerts.length === 0) {
            console.log('[AlertChecker] No active technical alerts to check');
            return;
        }

        console.log(`[AlertChecker] Checking ${technicalAlerts.length} technical alerts...`);

        // Group alerts by symbol to minimize API calls
        const alertsBySymbol = {};
        technicalAlerts.forEach(alert => {
            if (!alertsBySymbol[alert.symbol]) {
                alertsBySymbol[alert.symbol] = [];
            }
            alertsBySymbol[alert.symbol].push(alert);
        });

        let triggeredCount = 0;

        // Process each symbol
        for (const [symbol, symbolAlerts] of Object.entries(alertsBySymbol)) {
            console.log(`[AlertChecker] Calculating indicators for ${symbol}...`);

            // Calculate indicators for this symbol
            const indicators = await calculateIndicatorsForSymbol(symbol);

            if (!indicators) {
                console.log(`[AlertChecker] Skipping ${symbol} - could not calculate indicators`);
                continue;
            }

            // Get previous state from cache
            const previousState = indicatorStateCache.get(symbol);

            console.log(`[AlertChecker] ${symbol}: RSI=${indicators.rsi?.toFixed(1)}, MACD=${indicators.macdLine?.toFixed(2)}, Price=$${indicators.currentPrice?.toFixed(2)}`);

            // Check each alert for this symbol
            for (const alert of symbolAlerts) {
                const triggered = await checkTechnicalAlert(alert, indicators, previousState);
                if (triggered) triggeredCount++;
            }

            // Update cache with current state
            indicatorStateCache.set(symbol, {
                rsi: indicators.rsi,
                macdLine: indicators.macdLine,
                macdSignal: indicators.macdSignal,
                bollingerUpper: indicators.bollingerUpper,
                bollingerLower: indicators.bollingerLower,
                currentPrice: indicators.currentPrice,
                timestamp: Date.now()
            });

            // Rate limiting between symbols
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`[AlertChecker] Technical check complete: ${triggeredCount} alerts triggered`);

    } catch (error) {
        console.error('[AlertChecker] Error in checkTechnicalAlerts:', error.message);
    }
}

// ==================== PATTERN RECOGNITION ALERT CHECKING ====================

// Pattern state cache to avoid repeated triggering
const patternStateCache = new Map(); // symbol -> { lastPatternType, lastDetectedTime }
const PATTERN_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours between same pattern triggers

// Prepare candle data for pattern recognition
function prepareCandleData(chartData) {
    return chartData.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
    }));
}

// Check a single pattern alert
async function checkPatternAlert(alert, candleData) {
    try {
        const patternType = alert.type;
        const params = alert.patternParams || {};
        const minConfidence = params.minConfidence || 70;
        const lookback = params.lookbackPeriod || 50;

        // Check if this pattern was recently triggered for this symbol
        const cacheKey = `${alert.symbol}-${patternType}`;
        const patternState = patternStateCache.get(cacheKey);
        if (patternState && Date.now() - patternState.lastDetectedTime < PATTERN_COOLDOWN) {
            // Pattern was recently triggered, skip to avoid spam
            return false;
        }

        // Detect the specific pattern
        const patternResult = detectSpecificPattern(candleData, patternType, { lookback });

        if (!patternResult || patternResult.confidence < minConfidence) {
            // Pattern not detected or confidence too low
            alert.lastChecked = new Date();
            alert.checkCount = (alert.checkCount || 0) + 1;
            await alert.save();
            return false;
        }

        // Pattern detected with sufficient confidence!
        console.log(`[AlertChecker] Pattern detected: ${patternType} on ${alert.symbol} (${patternResult.confidence}% confidence)`);

        // Update alert as triggered
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        alert.triggeredPrice = patternResult.currentPrice;
        alert.patternTriggerData = {
            patternName: patternResult.pattern,
            confidence: patternResult.confidence,
            priceTarget: patternResult.priceTarget,
            stopLoss: patternResult.stopLoss,
            breakoutLevel: patternResult.breakoutLevel,
            patternStartDate: new Date(),
            patternEndDate: new Date(),
            direction: patternResult.direction
        };
        alert.lastChecked = new Date();
        alert.checkCount = (alert.checkCount || 0) + 1;

        await alert.save();
        await createNotification(alert);

        // Update pattern cache to prevent re-triggering
        patternStateCache.set(cacheKey, {
            lastPatternType: patternType,
            lastDetectedTime: Date.now()
        });

        // Send Telegram notification if enabled
        try {
            const { sendTechnicalAlertNotification } = require('./telegramScheduler');
            await sendTechnicalAlertNotification(alert.user, alert);
        } catch (telegramError) {
            console.error(`[AlertChecker] Error sending Telegram notification:`, telegramError.message);
        }

        console.log(`[AlertChecker] ✅ Pattern alert triggered: ${patternType} for ${alert.symbol}`);
        return true;

    } catch (error) {
        console.error(`[AlertChecker] Error checking pattern alert ${alert._id}:`, error.message);
        return false;
    }
}

// Main function to check all pattern alerts
async function checkPatternAlerts() {
    try {
        console.log('[AlertChecker] Starting pattern alert check...');

        // Get all active pattern alerts
        const patternAlerts = await Alert.getActivePatternAlerts();

        if (patternAlerts.length === 0) {
            console.log('[AlertChecker] No active pattern alerts to check');
            return;
        }

        console.log(`[AlertChecker] Checking ${patternAlerts.length} pattern alerts...`);

        // Group alerts by symbol to minimize API calls
        const alertsBySymbol = {};
        patternAlerts.forEach(alert => {
            if (!alertsBySymbol[alert.symbol]) {
                alertsBySymbol[alert.symbol] = [];
            }
            alertsBySymbol[alert.symbol].push(alert);
        });

        let triggeredCount = 0;

        // Process each symbol
        for (const [symbol, symbolAlerts] of Object.entries(alertsBySymbol)) {
            console.log(`[AlertChecker] Fetching chart data for ${symbol} pattern analysis...`);

            // Fetch chart data (daily candles for pattern recognition)
            const chartResult = await getChartData(symbol, '1D');

            if (!chartResult.success || !chartResult.data || chartResult.data.length < 30) {
                console.log(`[AlertChecker] Insufficient data for ${symbol} pattern analysis`);
                continue;
            }

            const candleData = prepareCandleData(chartResult.data);

            console.log(`[AlertChecker] ${symbol}: Analyzing ${candleData.length} candles for patterns`);

            // Check each alert for this symbol
            for (const alert of symbolAlerts) {
                const triggered = await checkPatternAlert(alert, candleData);
                if (triggered) triggeredCount++;
            }

            // Rate limiting between symbols
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`[AlertChecker] Pattern check complete: ${triggeredCount} alerts triggered`);

    } catch (error) {
        console.error('[AlertChecker] Error in checkPatternAlerts:', error.message);
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

    // Check technical alerts every 5 minutes (less frequent due to API limits)
    cron.schedule('*/5 * * * *', async () => {
        console.log('[AlertChecker] Running technical alert check...');
        await checkTechnicalAlerts();
    });

    // Check pattern alerts every 15 minutes (computationally intensive)
    cron.schedule('*/15 * * * *', async () => {
        console.log('[AlertChecker] Running pattern alert check...');
        await checkPatternAlerts();
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
            await checkTechnicalAlerts();
            await checkPatternAlerts();
        }, 10000); // Wait 10 seconds after startup
    }

    console.log('[AlertChecker] Cron jobs scheduled:');
    console.log('  - Price alerts: Every minute (* * * * *)');
    console.log('  - Technical alerts: Every 5 minutes (*/5 * * * *)');
    console.log('  - Pattern alerts: Every 15 minutes (*/15 * * * *)');
    console.log('  - Prediction expiry: Every 10 minutes (*/10 * * * *)');
    console.log('  - Cleanup: Daily at 3 AM (0 3 * * *)');
}

// Manual trigger function
async function manualCheck() {
    console.log('[AlertChecker] Manual check triggered');
    await checkAllAlerts();
    await checkTechnicalAlerts();
    await checkPatternAlerts();
    await checkPredictionExpiryAlerts();
}

module.exports = {
    startAlertChecker,
    checkAllAlerts,
    checkTechnicalAlerts,
    checkPatternAlerts,
    checkPredictionExpiryAlerts,
    manualCheck,
    fetchCurrentPrice, // Export for use in other services
    calculateIndicatorsForSymbol // Export for testing/debugging
};