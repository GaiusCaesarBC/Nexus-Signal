// server/services/predictionEngine.js - REAL ML PREDICTIONS

const regression = require('regression');

class PredictionEngine {
    /**
     * Predict future price using linear regression on historical data
     */
    predictPrice(historicalData, daysAhead) {
        try {
            const closes = historicalData.map(d => d.close);
            
            // Prepare data for regression (x = day index, y = price)
            const data = closes.map((price, index) => [index, price]);
            
            // Perform linear regression
            const result = regression.linear(data);
            
            // Predict future price
            const futureIndex = data.length + daysAhead - 1;
            const predictedPrice = result.predict(futureIndex)[1];
            
            // Calculate trend strength
            const slope = result.equation[0];
            const r2 = result.r2; // Coefficient of determination (how good the fit is)
            
            // Determine direction
            const currentPrice = closes[closes.length - 1];
            const direction = predictedPrice > currentPrice ? 'UP' : 'DOWN';
            
            // Calculate confidence based on R² and volatility
            const volatility = this.calculateVolatility(closes);
            const baseConfidence = r2 * 100; // R² is between 0 and 1
            
            // Adjust confidence based on volatility (higher volatility = lower confidence)
            const volatilityPenalty = Math.min(volatility * 100, 30);
            const confidence = Math.max(50, Math.min(95, baseConfidence - volatilityPenalty));
            
            // Calculate price change
            const priceChange = predictedPrice - currentPrice;
            const priceChangePercent = (priceChange / currentPrice) * 100;
            
            // Generate prediction path (for charting)
            const predictionPath = this.generatePredictionPath(
                currentPrice,
                predictedPrice,
                daysAhead,
                volatility
            );
            
            return {
                current_price: currentPrice,
                target_price: predictedPrice,
                direction: direction,
                price_change: priceChange,
                price_change_percent: priceChangePercent,
                confidence: confidence,
                days: daysAhead,
                trend_strength: Math.abs(slope),
                r_squared: r2,
                volatility: volatility,
                prediction_path: predictionPath
            };
        } catch (error) {
            console.error('❌ Prediction error:', error);
            throw error;
        }
    }

    /**
     * Generate a realistic prediction path with noise
     */
    generatePredictionPath(startPrice, endPrice, days, volatility) {
        const path = [];
        const priceChange = endPrice - startPrice;
        
        for (let i = 0; i <= days; i++) {
            const progress = i / days;
            
            // Linear interpolation with some noise
            const basePrice = startPrice + (priceChange * progress);
            const noise = (Math.random() - 0.5) * (startPrice * volatility * 2);
            const price = basePrice + noise;
            
            path.push({
                day: i,
                price: parseFloat(price.toFixed(2)),
                date: this.addDays(new Date(), i).toISOString().split('T')[0]
            });
        }
        
        return path;
    }

    /**
     * Calculate volatility (standard deviation of returns)
     */
    calculateVolatility(closes) {
        if (closes.length < 2) return 0.05; // Default volatility
        
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
            returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }
        
        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Analyze trend using multiple indicators
     */
    analyzeTrend(historicalData, indicators) {
        const closes = historicalData.map(d => d.close);
        const currentPrice = closes[closes.length - 1];
        
        // Count bullish vs bearish signals
        let bullishSignals = 0;
        let bearishSignals = 0;
        
        Object.values(indicators).forEach(indicator => {
            if (indicator.signal === 'BUY') bullishSignals++;
            if (indicator.signal === 'SELL') bearishSignals++;
        });
        
        const totalSignals = bullishSignals + bearishSignals;
        const sentiment = bullishSignals > bearishSignals ? 'Bullish' : 
                         bearishSignals > bullishSignals ? 'Bearish' : 'Neutral';
        
        // Calculate trend strength
        const trendStrength = totalSignals > 0 ? 
            Math.abs(bullishSignals - bearishSignals) / totalSignals : 0.5;
        
        return {
            sentiment,
            strength: trendStrength > 0.6 ? 'Strong' : trendStrength > 0.3 ? 'Moderate' : 'Weak',
            bullish_signals: bullishSignals,
            bearish_signals: bearishSignals,
            total_signals: totalSignals
        };
    }

    /**
     * Determine risk level based on volatility and timeframe
     */
    calculateRiskLevel(volatility, days) {
        // Longer timeframes and higher volatility = higher risk
        const volatilityScore = volatility * 100;
        const timeScore = days / 30; // Normalize to 30 days
        const riskScore = (volatilityScore + timeScore) / 2;
        
        if (riskScore > 5) return 'High';
        if (riskScore > 3) return 'Medium';
        return 'Low';
    }

    /**
     * Generate support and resistance levels
     */
    calculateSupportResistance(historicalData) {
        const closes = historicalData.map(d => d.close);
        const highs = historicalData.map(d => d.high || d.close);
        const lows = historicalData.map(d => d.low || d.close);
        
        // Simple support/resistance based on recent highs and lows
        const recentHighs = highs.slice(-20).sort((a, b) => b - a);
        const recentLows = lows.slice(-20).sort((a, b) => a - b);
        
        return {
            resistance1: recentHighs[0],
            resistance2: recentHighs[Math.floor(recentHighs.length / 3)],
            support1: recentLows[0],
            support2: recentLows[Math.floor(recentLows.length / 3)],
            current: closes[closes.length - 1]
        };
    }

    /**
     * Add days to a date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Exponential smoothing for better predictions
     */
    exponentialSmoothing(data, alpha = 0.3) {
        if (data.length === 0) return [];
        
        const smoothed = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
            smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i - 1];
        }
        
        return smoothed;
    }
}

module.exports = new PredictionEngine();