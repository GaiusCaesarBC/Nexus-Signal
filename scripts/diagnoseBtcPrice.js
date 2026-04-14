// Run: node scripts/diagnoseBtcPrice.js
// Pings each price source for BTC and prints what it returns, so we can see
// whether the "stuck price" issue is bad source data, stale priceService cache,
// or something inside /refresh-prices.

require('dotenv').config();
const axios = require('axios');
const priceService = require('../services/priceService');

const SYMBOL = process.argv[2] || 'BTC';

(async () => {
    console.log(`\n=== Diagnosing ${SYMBOL} price sources ===\n`);

    // 1. CryptoCompare batch (what /refresh-prices uses)
    try {
        const r = await axios.get(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${SYMBOL}&tsyms=USD`, { timeout: 8000 });
        console.log(`[CryptoCompare batch] ${SYMBOL} →`, r.data?.[SYMBOL]?.USD ?? '(nothing)');
    } catch (e) { console.log(`[CryptoCompare batch] FAILED: ${e.message}`); }

    // 2. CryptoCompare single
    try {
        const r = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${SYMBOL}&tsyms=USD`, { timeout: 5000 });
        console.log(`[CryptoCompare single] ${SYMBOL} →`, r.data?.USD ?? '(nothing)');
    } catch (e) { console.log(`[CryptoCompare single] FAILED: ${e.message}`); }

    // 3. Binance Global
    try {
        const r = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${SYMBOL}USDT`, { timeout: 5000 });
        console.log(`[Binance Global] ${SYMBOL}USDT →`, r.data?.price ?? '(nothing)');
    } catch (e) { console.log(`[Binance Global] FAILED: ${e.message}`); }

    // 4. Binance US
    try {
        const r = await axios.get(`https://api.binance.us/api/v3/ticker/price?symbol=${SYMBOL}USDT`, { timeout: 5000 });
        console.log(`[Binance US] ${SYMBOL}USDT →`, r.data?.price ?? '(nothing)');
    } catch (e) { console.log(`[Binance US] FAILED: ${e.message}`); }

    // 5. CoinGecko
    try {
        const r = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`, { timeout: 8000 });
        console.log(`[CoinGecko] bitcoin →`, r.data?.bitcoin?.usd ?? '(nothing)');
    } catch (e) { console.log(`[CoinGecko] FAILED: ${e.message}`); }

    // 6. priceService end-to-end (this is what /buy and the new individual fallback use)
    try {
        const r = await priceService.getCurrentPrice(SYMBOL, 'crypto');
        console.log(`[priceService.getCurrentPrice] ${SYMBOL} →`, r);
    } catch (e) { console.log(`[priceService] FAILED: ${e.message}`); }

    console.log('\nDone. The first column = source, second = price it returned.');
    console.log('If every source shows current real BTC but priceService shows old → cache bug.');
    console.log('If sources themselves show old → API/network problem.');
    console.log('If sources show real price but /refresh-prices doesn\'t update → middleware bug; share server logs from a refresh tick.\n');
    process.exit(0);
})();
