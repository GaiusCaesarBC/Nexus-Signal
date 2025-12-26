// services/websocketPriceService.js - Real-time price streaming via WebSockets
// Alpaca for stocks (free), Binance for crypto (free)

const WebSocket = require('ws');
const axios = require('axios');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { sendPriceAlertEmail } = require('./emailService');

// Configuration
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const ALPACA_WS_URL = process.env.ALPACA_WS_URL || 'wss://stream.data.alpaca.markets/v2/iex';

// Use Binance US for US-based servers (global Binance returns 451 from US)
const BINANCE_WS_URL = 'wss://stream.binance.us:9443/ws';

// Price cache for quick lookups
const priceCache = new Map(); // symbol -> { price, timestamp }

// Active subscriptions
const stockSubscriptions = new Set();
const cryptoSubscriptions = new Set();

// SSE clients for live streaming to frontend
const sseClients = new Map(); // symbol -> Set of response objects

// WebSocket connections
let alpacaWs = null;
let binanceWs = null;

// Reconnection state
let alpacaReconnectAttempts = 0;
let binanceReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

// Flags to prevent double reconnection when intentionally closing
let binanceIntentionalClose = false;
let alpacaIntentionalClose = false;

// Pending subscriptions while WebSocket is connecting
let pendingCryptoSubscriptions = [];
let binanceConnecting = false;

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
                // Log all message types for debugging
                if (msg.T !== 't' && msg.T !== 'q') {
                    console.log(`[WebSocket] Alpaca message: ${JSON.stringify(msg)}`);
                }

                if (msg.T === 'success' && msg.msg === 'authenticated') {
                    console.log('[WebSocket] Alpaca authenticated');
                    // Subscribe to any pending symbols
                    subscribeToStocks([...stockSubscriptions]);
                }

                if (msg.T === 'error') {
                    console.error(`[WebSocket] Alpaca error message: ${msg.msg} (code: ${msg.code})`);
                }

                if (msg.T === 'subscription') {
                    console.log(`[WebSocket] Alpaca subscribed - trades: ${msg.trades?.join(', ') || 'none'}, quotes: ${msg.quotes?.join(', ') || 'none'}`);
                }

                if (msg.T === 't') {
                    // Trade update - real-time price
                    const symbol = msg.S;
                    const price = msg.p;

                    priceCache.set(symbol, { price, timestamp: Date.now() });

                    // Log price updates when there are SSE clients
                    const clients = sseClients.get(symbol);
                    if (clients && clients.size > 0) {
                        console.log(`[WebSocket] 💰 ${symbol}: $${price.toFixed(2)} → ${clients.size} SSE clients`);
                    }

                    // Broadcast to SSE clients
                    broadcastPrice(symbol, price, 'stock');

                    // Check alerts for this symbol
                    await checkPriceAlerts(symbol, price, 'stock');
                }

                if (msg.T === 'q') {
                    // Quote update
                    const symbol = msg.S;
                    const price = (msg.bp + msg.ap) / 2; // Mid price

                    priceCache.set(symbol, { price, timestamp: Date.now() });

                    // Broadcast to SSE clients
                    broadcastPrice(symbol, price, 'stock');

                    await checkPriceAlerts(symbol, price, 'stock');
                }
            }
        } catch (error) {
            console.error('[WebSocket] Alpaca message error:', error.message);
        }
    });

    alpacaWs.on('close', (code, reason) => {
        console.log(`[WebSocket] Alpaca disconnected (code: ${code}, reason: ${reason || 'none'})`);
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
    // Prevent duplicate connection attempts
    if (binanceConnecting) {
        console.log('[WebSocket] Binance connection already in progress, skipping');
        return;
    }

    // If already connected and open, don't reconnect
    if (binanceWs && binanceWs.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Binance already connected');
        return;
    }

    binanceConnecting = true;
    console.log('[WebSocket] Connecting to Binance...');

    // Always start with a single stream, then dynamically subscribe to others
    // This is more reliable than combined stream URLs
    const wsUrl = `${BINANCE_WS_URL}/btcusdt@trade`;

    console.log(`[WebSocket] Binance URL: ${wsUrl}`);

    try {
        binanceWs = new WebSocket(wsUrl);
    } catch (error) {
        console.error('[WebSocket] Failed to create Binance WebSocket:', error.message);
        binanceConnecting = false;
        setTimeout(connectBinance, 5000);
        return;
    }

    binanceWs.on('open', () => {
        console.log('[WebSocket] Binance connected');
        binanceReconnectAttempts = 0;
        binanceConnecting = false;

        // Subscribe to all pending and existing subscriptions
        const allSymbols = [...new Set([...cryptoSubscriptions, ...pendingCryptoSubscriptions])];
        pendingCryptoSubscriptions = [];

        if (allSymbols.length > 0) {
            const streams = allSymbols.map(s => `${s.toLowerCase()}usdt@trade`);
            const subscribeMsg = {
                method: 'SUBSCRIBE',
                params: streams,
                id: Date.now()
            };
            console.log(`[WebSocket] Binance subscribing to: ${streams.join(', ')}`);
            binanceWs.send(JSON.stringify(subscribeMsg));
            allSymbols.forEach(s => cryptoSubscriptions.add(s.toUpperCase()));
        }
    });

    binanceWs.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);

            // Handle subscription response
            if (msg.result === null && msg.id) {
                console.log(`[WebSocket] Binance subscription confirmed (id: ${msg.id})`);
                return;
            }

            // Handle subscription error
            if (msg.error) {
                console.error(`[WebSocket] Binance error: ${msg.error.msg} (code: ${msg.error.code})`);
                return;
            }

            if (msg.e === 'trade') {
                // Extract symbol (remove USDT suffix)
                const symbol = msg.s.replace('USDT', '');
                const price = parseFloat(msg.p);

                priceCache.set(symbol, { price, timestamp: Date.now() });

                // Check if we have SSE clients for this symbol
                const clients = sseClients.get(symbol);
                if (clients && clients.size > 0) {
                    console.log(`[WebSocket] 💰 ${symbol}: $${price.toFixed(2)} → ${clients.size} SSE clients`);
                }

                // Broadcast to SSE clients
                broadcastPrice(symbol, price, 'crypto');

                // Check alerts for this crypto
                await checkPriceAlerts(symbol, price, 'crypto');
            }
        } catch (error) {
            console.error('[WebSocket] Binance message error:', error.message);
        }
    });

    binanceWs.on('close', (code, reason) => {
        console.log(`[WebSocket] Binance disconnected (code: ${code}, reason: ${reason || 'none'})`);
        binanceConnecting = false;
        if (binanceIntentionalClose) {
            binanceIntentionalClose = false;
            console.log('[WebSocket] Binance close was intentional, not reconnecting');
        } else {
            reconnectBinance();
        }
    });

    binanceWs.on('error', (error) => {
        console.error('[WebSocket] Binance error:', error.message);
        console.error('[WebSocket] Binance error code:', error.code);
        binanceConnecting = false;
    });
}

// Log when module loads
console.log('[WebSocket] websocketPriceService module loaded');

function reconnectBinance() {
    if (binanceReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max Binance reconnect attempts reached');
        binanceConnecting = false;
        return;
    }

    binanceReconnectAttempts++;
    binanceConnecting = false; // Reset before attempting reconnection
    console.log(`[WebSocket] Reconnecting to Binance (attempt ${binanceReconnectAttempts})...`);

    setTimeout(() => {
        connectBinance();
    }, RECONNECT_DELAY * binanceReconnectAttempts);
}

function subscribeToCrypto(symbols) {
    const newSymbols = symbols.filter(s => !cryptoSubscriptions.has(s.toUpperCase()));

    if (newSymbols.length === 0) {
        console.log('[WebSocket] All crypto symbols already subscribed');
        return;
    }

    console.log(`[WebSocket] Adding crypto subscriptions: ${newSymbols.join(', ')}`);

    // If connection is open, use dynamic subscription
    if (binanceWs && binanceWs.readyState === WebSocket.OPEN) {
        newSymbols.forEach(s => cryptoSubscriptions.add(s.toUpperCase()));
        const streams = newSymbols.map(s => `${s.toLowerCase()}usdt@trade`);
        const subscribeMsg = {
            method: 'SUBSCRIBE',
            params: streams,
            id: Date.now()
        };
        console.log(`[WebSocket] Sending Binance SUBSCRIBE for: ${streams.join(', ')}`);
        binanceWs.send(JSON.stringify(subscribeMsg));
    } else if (binanceConnecting) {
        // Connection is in progress, queue the subscriptions
        console.log(`[WebSocket] Binance connecting, queuing: ${newSymbols.join(', ')}`);
        pendingCryptoSubscriptions.push(...newSymbols.map(s => s.toUpperCase()));
    } else {
        // No connection yet, queue symbols and start connection
        pendingCryptoSubscriptions.push(...newSymbols.map(s => s.toUpperCase()));
        connectBinance();
    }
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

// ==================== FALLBACK REST API POLLING ====================

// Polling interval for fallback (when WebSocket fails)
let fallbackPollingInterval = null;
let lastPolledSymbols = new Set();

async function fetchCryptoPriceREST(symbol) {
    try {
        // Try Binance US first, fall back to global Binance
        const urls = [
            `https://api.binance.us/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`,
            `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`
        ];

        for (const url of urls) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.data && response.data.price) {
                    return parseFloat(response.data.price);
                }
            } catch (e) {
                // Try next URL
            }
        }
        return null;
    } catch (error) {
        console.error(`[REST Fallback] Error fetching ${symbol}:`, error.message);
        return null;
    }
}

async function pollCryptoPrices() {
    // Get all symbols with active SSE clients
    const symbolsToFetch = [];
    const cryptoList = [
        'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
        'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
        'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'FET', 'INJ', 'SUI', 'SEI', 'TIA'
    ];

    for (const [symbol, clients] of sseClients) {
        if (clients.size > 0 && cryptoList.includes(symbol)) {
            symbolsToFetch.push(symbol);
        }
    }

    if (symbolsToFetch.length === 0) return;

    console.log(`[REST Fallback] Polling prices for: ${symbolsToFetch.join(', ')}`);

    for (const symbol of symbolsToFetch) {
        const price = await fetchCryptoPriceREST(symbol);
        if (price) {
            priceCache.set(symbol, { price, timestamp: Date.now() });
            broadcastPrice(symbol, price, 'crypto');
        }
    }
}

function startFallbackPolling() {
    if (fallbackPollingInterval) return;

    console.log('[REST Fallback] Starting fallback polling for crypto prices');
    fallbackPollingInterval = setInterval(pollCryptoPrices, 5000); // Every 5 seconds
}

function stopFallbackPolling() {
    if (fallbackPollingInterval) {
        clearInterval(fallbackPollingInterval);
        fallbackPollingInterval = null;
        console.log('[REST Fallback] Stopped fallback polling');
    }
}

// ==================== SSE BROADCASTING ====================

function broadcastPrice(symbol, price, assetType) {
    const upperSymbol = symbol.toUpperCase();
    const clients = sseClients.get(upperSymbol);

    if (!clients || clients.size === 0) return;

    const data = JSON.stringify({
        symbol: upperSymbol,
        price,
        timestamp: Date.now(),
        assetType
    });

    clients.forEach(res => {
        try {
            res.write(`data: ${data}\n\n`);
        } catch (error) {
            // Client disconnected, remove from set
            clients.delete(res);
        }
    });
}

function subscribeSSE(symbol, res) {
    const upperSymbol = symbol.toUpperCase();

    if (!sseClients.has(upperSymbol)) {
        sseClients.set(upperSymbol, new Set());
    }

    sseClients.get(upperSymbol).add(res);

    // Also subscribe to the WebSocket feed if not already
    // Check if it's a crypto symbol (expanded list matching frontend)
    const cryptoSymbols = [
        'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'DOGE', 'SHIB', 'XRP',
        'BNB', 'LINK', 'UNI', 'AAVE', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP',
        'PEPE', 'FLOKI', 'BONK', 'WIF', 'RENDER', 'FET', 'INJ', 'SUI', 'SEI', 'TIA',
        'ALGO', 'VET', 'FIL', 'THETA', 'EOS', 'XLM', 'TRX', 'XMR', 'HBAR', 'ICP'
    ];

    if (cryptoSymbols.includes(upperSymbol)) {
        subscribeToCrypto([upperSymbol]);
    } else {
        subscribeToStocks([upperSymbol]);
    }

    // Send current cached price immediately if available
    const cached = priceCache.get(upperSymbol);
    if (cached) {
        res.write(`data: ${JSON.stringify({
            symbol: upperSymbol,
            price: cached.price,
            timestamp: cached.timestamp,
            assetType: cryptoSymbols.includes(upperSymbol) ? 'crypto' : 'stock'
        })}\n\n`);
    }

    console.log(`[SSE] Client subscribed to ${upperSymbol} (${sseClients.get(upperSymbol).size} clients)`);
}

function unsubscribeSSE(symbol, res) {
    const upperSymbol = symbol.toUpperCase();
    const clients = sseClients.get(upperSymbol);

    if (clients) {
        clients.delete(res);
        console.log(`[SSE] Client unsubscribed from ${upperSymbol} (${clients.size} clients remaining)`);
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

    // Start fallback polling for crypto (runs alongside WebSocket)
    // This ensures prices are updated even if WebSocket has issues
    setTimeout(() => {
        startFallbackPolling();
    }, 10000); // Start after 10 seconds to give WebSocket time to connect

    // Sync subscriptions from database
    setTimeout(syncSubscriptions, 5000);

    // Resync subscriptions every 5 minutes
    setInterval(syncSubscriptions, 5 * 60 * 1000);

    console.log('[WebSocket] Service started');
    console.log('  - Alpaca (stocks): ' + (ALPACA_API_KEY ? 'configured' : 'not configured'));
    console.log('  - Binance (crypto): ready (with REST fallback)');
}

function stopWebSocketService() {
    if (alpacaWs) alpacaWs.close();
    if (binanceWs) binanceWs.close();
    stopFallbackPolling();
    console.log('[WebSocket] Service stopped');
}

module.exports = {
    startWebSocketService,
    stopWebSocketService,
    subscribeToStocks,
    subscribeToCrypto,
    getCurrentPrice,
    syncSubscriptions,
    priceCache,
    // SSE functions for frontend streaming
    subscribeSSE,
    unsubscribeSSE
};
