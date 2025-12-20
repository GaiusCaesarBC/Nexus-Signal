// services/websocketPriceService.js - Real-time price streaming via WebSockets
// Alpaca for stocks (free), Binance for crypto (free)

const WebSocket = require('ws');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { sendPriceAlertEmail } = require('./emailService');

// Configuration
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const ALPACA_WS_URL = process.env.ALPACA_WS_URL || 'wss://stream.data.alpaca.markets/v2/iex';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

// Price cache for quick lookups
const priceCache = new Map(); // symbol -> { price, timestamp }

// Active subscriptions
const stockSubscriptions = new Set();
const cryptoSubscriptions = new Set();

// WebSocket connections
let alpacaWs = null;
let binanceWs = null;

// Reconnection state
let alpacaReconnectAttempts = 0;
let binanceReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

// ==================== ALPACA (STOCKS) ====================

function connectAlpaca() {
    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
        console.log('[WebSocket] Alpaca credentials not configured, skipping stock streaming');
        return;
    }

    console.log('[WebSocket] Connecting to Alpaca...');

    alpacaWs = new WebSocket(ALPACA_WS_URL);

    alpacaWs.on('open', () => {
        console.log('[WebSocket] Alpaca connected');
        alpacaReconnectAttempts = 0;

        // Authenticate
        alpacaWs.send(JSON.stringify({
            action: 'auth',
            key: ALPACA_API_KEY,
            secret: ALPACA_SECRET_KEY
        }));
    });

    alpacaWs.on('message', async (data) => {
        try {
            const messages = JSON.parse(data);

            for (const msg of messages) {
                if (msg.T === 'success' && msg.msg === 'authenticated') {
                    console.log('[WebSocket] Alpaca authenticated');
                    // Subscribe to any pending symbols
                    subscribeToStocks([...stockSubscriptions]);
                }

                if (msg.T === 't') {
                    // Trade update - real-time price
                    const symbol = msg.S;
                    const price = msg.p;

                    priceCache.set(symbol, { price, timestamp: Date.now() });

                    // Check alerts for this symbol
                    await checkPriceAlerts(symbol, price, 'stock');
                }

                if (msg.T === 'q') {
                    // Quote update
                    const symbol = msg.S;
                    const price = (msg.bp + msg.ap) / 2; // Mid price

                    priceCache.set(symbol, { price, timestamp: Date.now() });
                    await checkPriceAlerts(symbol, price, 'stock');
                }
            }
        } catch (error) {
            console.error('[WebSocket] Alpaca message error:', error.message);
        }
    });

    alpacaWs.on('close', () => {
        console.log('[WebSocket] Alpaca disconnected');
        reconnectAlpaca();
    });

    alpacaWs.on('error', (error) => {
        console.error('[WebSocket] Alpaca error:', error.message);
    });
}

function reconnectAlpaca() {
    if (alpacaReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max Alpaca reconnect attempts reached');
        return;
    }

    alpacaReconnectAttempts++;
    console.log(`[WebSocket] Reconnecting to Alpaca (attempt ${alpacaReconnectAttempts})...`);

    setTimeout(() => {
        connectAlpaca();
    }, RECONNECT_DELAY * alpacaReconnectAttempts);
}

function subscribeToStocks(symbols) {
    if (!alpacaWs || alpacaWs.readyState !== WebSocket.OPEN) {
        // Queue for later
        symbols.forEach(s => stockSubscriptions.add(s));
        return;
    }

    if (symbols.length === 0) return;

    console.log(`[WebSocket] Subscribing to stocks: ${symbols.join(', ')}`);

    alpacaWs.send(JSON.stringify({
        action: 'subscribe',
        trades: symbols,
        quotes: symbols
    }));

    symbols.forEach(s => stockSubscriptions.add(s));
}

function unsubscribeFromStocks(symbols) {
    if (!alpacaWs || alpacaWs.readyState !== WebSocket.OPEN) return;

    alpacaWs.send(JSON.stringify({
        action: 'unsubscribe',
        trades: symbols,
        quotes: symbols
    }));

    symbols.forEach(s => stockSubscriptions.delete(s));
}

// ==================== BINANCE (CRYPTO) ====================

function connectBinance() {
    console.log('[WebSocket] Connecting to Binance...');

    // Build stream URL for subscribed symbols
    const streams = [...cryptoSubscriptions].map(s => `${s.toLowerCase()}usdt@trade`);

    if (streams.length === 0) {
        // Connect to BTC as default to keep connection alive
        binanceWs = new WebSocket(`${BINANCE_WS_URL}/btcusdt@trade`);
    } else {
        binanceWs = new WebSocket(`${BINANCE_WS_URL}/${streams.join('/')}`);
    }

    binanceWs.on('open', () => {
        console.log('[WebSocket] Binance connected');
        binanceReconnectAttempts = 0;
    });

    binanceWs.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.e === 'trade') {
                // Extract symbol (remove USDT suffix)
                const symbol = msg.s.replace('USDT', '');
                const price = parseFloat(msg.p);

                priceCache.set(symbol, { price, timestamp: Date.now() });

                // Check alerts for this crypto
                await checkPriceAlerts(symbol, price, 'crypto');
            }
        } catch (error) {
            console.error('[WebSocket] Binance message error:', error.message);
        }
    });

    binanceWs.on('close', () => {
        console.log('[WebSocket] Binance disconnected');
        reconnectBinance();
    });

    binanceWs.on('error', (error) => {
        console.error('[WebSocket] Binance error:', error.message);
    });
}

function reconnectBinance() {
    if (binanceReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max Binance reconnect attempts reached');
        return;
    }

    binanceReconnectAttempts++;
    console.log(`[WebSocket] Reconnecting to Binance (attempt ${binanceReconnectAttempts})...`);

    setTimeout(() => {
        connectBinance();
    }, RECONNECT_DELAY * binanceReconnectAttempts);
}

function subscribeToCrypto(symbols) {
    symbols.forEach(s => cryptoSubscriptions.add(s.toUpperCase()));

    // Reconnect with new subscriptions
    if (binanceWs) {
        binanceWs.close();
    }
    connectBinance();
}

// ==================== ALERT CHECKING ====================

async function checkPriceAlerts(symbol, currentPrice, assetType) {
    try {
        // Find active price alerts for this symbol
        const alerts = await Alert.find({
            symbol: symbol.toUpperCase(),
            assetType: assetType,
            type: { $in: ['price_above', 'price_below'] },
            status: 'active'
        });

        for (const alert of alerts) {
            let triggered = false;

            if (alert.type === 'price_above' && currentPrice >= alert.targetPrice) {
                triggered = true;
            } else if (alert.type === 'price_below' && currentPrice <= alert.targetPrice) {
                triggered = true;
            }

            if (triggered) {
                console.log(`[WebSocket] 🔔 Alert triggered: ${symbol} ${alert.type} $${alert.targetPrice} (current: $${currentPrice})`);

                // Update alert
                alert.status = 'triggered';
                alert.triggeredAt = new Date();
                alert.triggeredPrice = currentPrice;
                await alert.save();

                // Create notification
                await createNotification(alert, currentPrice);

                // Send email if enabled
                if (alert.notifyVia?.email) {
                    try {
                        await sendPriceAlertEmail(alert);
                    } catch (emailError) {
                        console.error('[WebSocket] Email error:', emailError.message);
                    }
                }

                // Send Telegram if enabled
                try {
                    const { sendPriceAlertNotification } = require('./telegramScheduler');
                    await sendPriceAlertNotification(alert.user, alert);
                } catch (telegramError) {
                    // Telegram not configured, ignore
                }
            }
        }
    } catch (error) {
        console.error('[WebSocket] Alert check error:', error.message);
    }
}

async function createNotification(alert, currentPrice) {
    try {
        const notification = new Notification({
            user: alert.user,
            type: 'alert',
            title: `${alert.symbol} Price Alert`,
            message: alert.type === 'price_above'
                ? `${alert.symbol} is now above $${alert.targetPrice} (Current: $${currentPrice.toFixed(2)})`
                : `${alert.symbol} is now below $${alert.targetPrice} (Current: $${currentPrice.toFixed(2)})`,
            data: {
                alertId: alert._id,
                symbol: alert.symbol,
                targetPrice: alert.targetPrice,
                triggeredPrice: currentPrice
            }
        });

        await notification.save();
    } catch (error) {
        console.error('[WebSocket] Notification error:', error.message);
    }
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

async function syncSubscriptions() {
    try {
        // Get all active price alerts
        const alerts = await Alert.find({
            type: { $in: ['price_above', 'price_below'] },
            status: 'active'
        }).distinct('symbol');

        // Get asset types for each symbol
        const stockSymbols = [];
        const cryptoSymbols = [];

        for (const symbol of alerts) {
            const alert = await Alert.findOne({ symbol, status: 'active' });
            if (alert?.assetType === 'crypto') {
                cryptoSymbols.push(symbol);
            } else {
                stockSymbols.push(symbol);
            }
        }

        // Subscribe to stocks
        if (stockSymbols.length > 0) {
            subscribeToStocks(stockSymbols);
        }

        // Subscribe to crypto
        if (cryptoSymbols.length > 0) {
            subscribeToCrypto(cryptoSymbols);
        }

        console.log(`[WebSocket] Synced subscriptions: ${stockSymbols.length} stocks, ${cryptoSymbols.length} crypto`);
    } catch (error) {
        console.error('[WebSocket] Sync error:', error.message);
    }
}

// ==================== PUBLIC API ====================

function getCurrentPrice(symbol) {
    const cached = priceCache.get(symbol.toUpperCase());
    if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.price;
    }
    return null;
}

function startWebSocketService() {
    console.log('[WebSocket] Starting real-time price streaming service...');

    // Connect to exchanges
    connectAlpaca();
    connectBinance();

    // Sync subscriptions from database
    setTimeout(syncSubscriptions, 5000);

    // Resync subscriptions every 5 minutes
    setInterval(syncSubscriptions, 5 * 60 * 1000);

    console.log('[WebSocket] Service started');
    console.log('  - Alpaca (stocks): ' + (ALPACA_API_KEY ? 'configured' : 'not configured'));
    console.log('  - Binance (crypto): ready');
}

function stopWebSocketService() {
    if (alpacaWs) alpacaWs.close();
    if (binanceWs) binanceWs.close();
    console.log('[WebSocket] Service stopped');
}

module.exports = {
    startWebSocketService,
    stopWebSocketService,
    subscribeToStocks,
    subscribeToCrypto,
    getCurrentPrice,
    syncSubscriptions,
    priceCache
};
