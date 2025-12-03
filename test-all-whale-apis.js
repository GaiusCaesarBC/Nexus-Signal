// server/test-all-whale-apis.js
// Comprehensive test script for SEC API, Whale Alert API, and QuiverQuant API

require('dotenv').config();
const whaleService = require('./services/whaleService');

console.log('🐋 Testing ALL Whale Alert APIs\n');
console.log('═══════════════════════════════════════════════════════════════\n');

// Check which API keys are configured
const hasSecAPI = !!process.env.SEC_API_KEY;
const hasWhaleAlert = !!process.env.WHALE_ALERT_API_KEY;
const hasQuiverQuant = !!process.env.QUIVER_API_KEY;

console.log('📋 API Key Status:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`  SEC API (Insider Trading):     ${hasSecAPI ? '✅ Configured' : '❌ Missing'}`);
console.log(`  Whale Alert (Crypto Whales):   ${hasWhaleAlert ? '✅ Configured' : '❌ Missing'}`);
console.log(`  QuiverQuant (Congress Trades): ${hasQuiverQuant ? '✅ Configured' : '❌ Missing'}`);
console.log('');

if (!hasSecAPI && !hasWhaleAlert && !hasQuiverQuant) {
    console.log('❌ ERROR: No API keys found in .env file');
    console.log('');
    console.log('Please add your API keys to .env:');
    console.log('  SEC_API_KEY=your_sec_api_key');
    console.log('  WHALE_ALERT_API_KEY=your_whale_alert_key');
    console.log('  QUIVER_API_KEY=your_quiver_key');
    console.log('');
    process.exit(1);
}

// Test function
async function testAllAPIs() {
    let testsRun = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        // Test 1: SEC Insider Trading
        if (hasSecAPI) {
            console.log('📊 TEST 1: SEC Insider Trading API');
            console.log('─────────────────────────────────────────────────────────────');
            testsRun++;
            
            try {
                const insiderTrades = await whaleService.fetchSECInsiderTrades(10);
                
                if (insiderTrades && insiderTrades.length > 0) {
                    console.log(`✅ SUCCESS: Fetched ${insiderTrades.length} insider trades`);
                    testsPassed++;
                    
                    const firstTrade = insiderTrades[0];
                    console.log('');
                    console.log('📋 Sample Insider Trade:');
                    console.log(`   Company: ${firstTrade.companyName} (${firstTrade.symbol})`);
                    console.log(`   Insider: ${firstTrade.insiderName}`);
                    console.log(`   Title: ${firstTrade.insiderTitle}`);
                    console.log(`   Type: ${firstTrade.transactionType}`);
                    console.log(`   Shares: ${firstTrade.shares.toLocaleString()}`);
                    console.log(`   Price: $${firstTrade.pricePerShare}`);
                    console.log(`   Total Value: $${firstTrade.totalValue.toLocaleString()}`);
                    console.log(`   Significance: ${firstTrade.significance}`);
                    console.log(`   Date: ${firstTrade.transactionDate}`);
                } else {
                    console.log('⚠️  WARNING: No insider trades returned (might be mock data)');
                    testsFailed++;
                }
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}`);
                testsFailed++;
            }
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }
        
        // Test 2: Whale Alert Crypto
        if (hasWhaleAlert) {
            console.log('📊 TEST 2: Whale Alert Crypto API');
            console.log('─────────────────────────────────────────────────────────────');
            testsRun++;
            
            try {
                const cryptoWhales = await whaleService.fetchCryptoWhaleAlerts(10);
                
                if (cryptoWhales && cryptoWhales.length > 0) {
                    console.log(`✅ SUCCESS: Fetched ${cryptoWhales.length} crypto whale transactions`);
                    testsPassed++;
                    
                    const firstWhale = cryptoWhales[0];
                    console.log('');
                    console.log('🐋 Sample Crypto Whale:');
                    console.log(`   Cryptocurrency: ${firstWhale.symbol} (${firstWhale.blockchain})`);
                    console.log(`   Type: ${firstWhale.type}`);
                    console.log(`   Amount: ${firstWhale.amount.toLocaleString()} ${firstWhale.symbol}`);
                    console.log(`   USD Value: $${firstWhale.amountUsd.toLocaleString()}`);
                    console.log(`   From: ${firstWhale.from.name}`);
                    console.log(`   To: ${firstWhale.to.name}`);
                    console.log(`   Significance: ${firstWhale.significance}`);
                    console.log(`   Signal: ${firstWhale.type === 'exchange_outflow' ? '📤 Accumulation' : '📥 Distribution'}`);
                    console.log(`   Time: ${firstWhale.timestamp}`);
                } else {
                    console.log('⚠️  WARNING: No crypto whales returned (might be mock data)');
                    testsFailed++;
                }
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}`);
                testsFailed++;
            }
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }
        
        // Test 3: QuiverQuant Congress Trading
        if (hasQuiverQuant) {
            console.log('📊 TEST 3: QuiverQuant Congress Trading API');
            console.log('─────────────────────────────────────────────────────────────');
            testsRun++;
            
            try {
                const congressTrades = await whaleService.fetchCongressTrades(10);
                
                if (congressTrades && congressTrades.length > 0) {
                    console.log(`✅ SUCCESS: Fetched ${congressTrades.length} congress trades`);
                    testsPassed++;
                    
                    const firstTrade = congressTrades[0];
                    console.log('');
                    console.log('🏛️ Sample Congress Trade:');
                    console.log(`   Politician: ${firstTrade.politicianName} (${firstTrade.party}-${firstTrade.state})`);
                    console.log(`   Chamber: ${firstTrade.chamber}`);
                    console.log(`   Symbol: ${firstTrade.symbol}`);
                    console.log(`   Company: ${firstTrade.companyName}`);
                    console.log(`   Type: ${firstTrade.transactionType}`);
                    console.log(`   Amount: ${firstTrade.amountRange}`);
                    console.log(`   Owner: ${firstTrade.owner}`);
                    console.log(`   Significance: ${firstTrade.significance}`);
                    console.log(`   Disclosed: ${firstTrade.disclosureDate}`);
                } else {
                    console.log('⚠️  WARNING: No congress trades returned (might be mock data)');
                    testsFailed++;
                }
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}`);
                testsFailed++;
            }
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }
        
        // Test 4: Whale Summary (combines all sources)
        console.log('📊 TEST 4: Whale Summary (Combined Data)');
        console.log('─────────────────────────────────────────────────────────────');
        testsRun++;
        
        try {
            const summary = await whaleService.getAllAlerts({ limit: 30, types: ['insider', 'crypto', 'congress'] });
            
            if (summary && summary.length > 0) {
                console.log(`✅ SUCCESS: Fetched ${summary.length} combined alerts`);
                testsPassed++;
                
                // Count by type
                const insiderCount = summary.filter(a => a.alertType === 'insider').length;
                const cryptoCount = summary.filter(a => a.alertType === 'crypto').length;
                const congressCount = summary.filter(a => a.alertType === 'congress').length;
                
                console.log('');
                console.log('📈 Alert Breakdown:');
                console.log(`   Insider Trades: ${insiderCount}`);
                console.log(`   Crypto Whales: ${cryptoCount}`);
                console.log(`   Congress Trades: ${congressCount}`);
            } else {
                console.log('⚠️  WARNING: No combined alerts returned');
                testsFailed++;
            }
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            testsFailed++;
        }
        
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        
        // Final Results
        console.log('📊 FINAL TEST RESULTS');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`  Tests Run: ${testsRun}`);
        console.log(`  Tests Passed: ${testsPassed} ✅`);
        console.log(`  Tests Failed: ${testsFailed} ${testsFailed > 0 ? '❌' : ''}`);
        console.log('');
        
        if (testsPassed === testsRun) {
            console.log('🎉 ALL TESTS PASSED!');
            console.log('');
            console.log('Your whale alert integrations are working perfectly!');
            console.log('');
            console.log('Next steps:');
            console.log('  1. Start your server: npm start');
            console.log('  2. Visit: http://localhost:3000/whale-alerts');
            console.log('  3. See REAL data from all sources! 🚀');
            console.log('');
        } else {
            console.log('⚠️  Some tests failed or returned mock data');
            console.log('');
            console.log('Possible issues:');
            console.log('  • Check API keys are correct in .env');
            console.log('  • Verify API subscriptions are active');
            console.log('  • Check rate limits (wait and retry)');
            console.log('  • Review server logs for errors');
            console.log('');
        }
        
        // Show which APIs are working vs mock
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        console.log('💡 Data Source Status:');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`  Insider Trading: ${hasSecAPI && testsPassed >= 1 ? '✅ REAL DATA' : '⚠️  Mock Data'}`);
        console.log(`  Crypto Whales: ${hasWhaleAlert && testsPassed >= 2 ? '✅ REAL DATA' : '⚠️  Mock Data'}`);
        console.log(`  Congress Trades: ${hasQuiverQuant && testsPassed >= 3 ? '✅ REAL DATA' : '⚠️  Mock Data'}`);
        console.log('');
        
    } catch (error) {
        console.log('');
        console.log('❌ CRITICAL ERROR during testing:');
        console.log('Message:', error.message);
        console.log('');
        
        if (error.stack) {
            console.log('Stack trace:');
            console.log(error.stack);
        }
        
        process.exit(1);
    }
}

// Run all tests
testAllAPIs();