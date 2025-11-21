// server/routes/calculatorRoutes.js

const express = require('express');
const router = express.Router();
//const auth = require('../middleware/auth'); // Optional: add auth if you want to track user calculations

// Position Size Calculator
router.post('/position-size', async (req, res) => {
    try {
        const { accountSize, riskPercentage, entryPrice, stopLoss } = req.body;

        // Validation
        if (!accountSize || !riskPercentage || !entryPrice || !stopLoss) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const accountSizeNum = parseFloat(accountSize);
        const riskPercentageNum = parseFloat(riskPercentage);
        const entryPriceNum = parseFloat(entryPrice);
        const stopLossNum = parseFloat(stopLoss);

        // Validate numbers
        if (isNaN(accountSizeNum) || isNaN(riskPercentageNum) || isNaN(entryPriceNum) || isNaN(stopLossNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const riskAmount = accountSizeNum * (riskPercentageNum / 100);
        const priceRisk = Math.abs(entryPriceNum - stopLossNum);
        const positionSize = riskAmount / priceRisk;
        const positionValue = positionSize * entryPriceNum;
        const percentOfAccount = (positionValue / accountSizeNum) * 100;

        res.json({
            success: true,
            data: {
                positionSize: Math.floor(positionSize),
                positionValue: positionValue.toFixed(2),
                riskAmount: riskAmount.toFixed(2),
                percentOfAccount: percentOfAccount.toFixed(2),
                sharePrice: entryPriceNum,
                stopLossPrice: stopLossNum,
                riskPerShare: priceRisk.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Position Size Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Risk/Reward Calculator
router.post('/risk-reward', async (req, res) => {
    try {
        const { entryPrice, stopLoss, targetPrice, positionSize } = req.body;

        if (!entryPrice || !stopLoss || !targetPrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const entryPriceNum = parseFloat(entryPrice);
        const stopLossNum = parseFloat(stopLoss);
        const targetPriceNum = parseFloat(targetPrice);
        const positionSizeNum = positionSize ? parseFloat(positionSize) : null;

        // Validate numbers
        if (isNaN(entryPriceNum) || isNaN(stopLossNum) || isNaN(targetPriceNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const risk = Math.abs(entryPriceNum - stopLossNum);
        const reward = Math.abs(targetPriceNum - entryPriceNum);
        const riskRewardRatio = (reward / risk).toFixed(2);
        
        let assessment = '';
        if (riskRewardRatio >= 3) assessment = 'Excellent';
        else if (riskRewardRatio >= 2) assessment = 'Good';
        else if (riskRewardRatio >= 1) assessment = 'Acceptable';
        else assessment = 'Poor';

        const result = {
            riskAmount: risk.toFixed(2),
            rewardAmount: reward.toFixed(2),
            ratio: riskRewardRatio,
            assessment: assessment
        };

        if (positionSizeNum && !isNaN(positionSizeNum)) {
            result.potentialLoss = (risk * positionSizeNum).toFixed(2);
            result.potentialProfit = (reward * positionSizeNum).toFixed(2);
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Risk/Reward Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Compound Interest Calculator
router.post('/compound-interest', async (req, res) => {
    try {
        const { 
            principal, 
            monthlyContribution, 
            annualRate, 
            years, 
            compoundFrequency = 12 // monthly by default
        } = req.body;

        if (!principal || !annualRate || !years) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const principalNum = parseFloat(principal);
        const monthlyContributionNum = monthlyContribution ? parseFloat(monthlyContribution) : 0;
        const annualRateNum = parseFloat(annualRate);
        const yearsNum = parseFloat(years);
        const compoundFrequencyNum = parseFloat(compoundFrequency);

        // Validate numbers
        if (isNaN(principalNum) || isNaN(annualRateNum) || isNaN(yearsNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const rate = annualRateNum / 100;
        const n = compoundFrequencyNum;
        const t = yearsNum;
        
        // Future value with compound interest
        const futureValue = principalNum * Math.pow(1 + rate / n, n * t);
        
        // Future value with monthly contributions
        let futureValueWithContributions = futureValue;
        if (monthlyContributionNum > 0) {
            const monthlyRate = rate / 12;
            const months = yearsNum * 12;
            futureValueWithContributions = futureValue + 
                (monthlyContributionNum * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate));
        }

        const totalContributions = principalNum + monthlyContributionNum * yearsNum * 12;
        const totalInterest = futureValueWithContributions - totalContributions;

        // Year by year breakdown
        const yearlyBreakdown = [];
        for (let year = 1; year <= yearsNum; year++) {
            const yearValue = principalNum * Math.pow(1 + rate / n, n * year);
            const yearContributions = monthlyContributionNum * year * 12;
            const monthlyRate = rate / 12;
            const months = year * 12;
            const contributionValue = monthlyContributionNum > 0 ? 
                (monthlyContributionNum * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)) : 0;
            
            yearlyBreakdown.push({
                year: year,
                value: (yearValue + contributionValue).toFixed(2),
                totalContributions: (principalNum + yearContributions).toFixed(2),
                interest: (yearValue + contributionValue - principalNum - yearContributions).toFixed(2)
            });
        }

        res.json({
            success: true,
            data: {
                futureValue: futureValueWithContributions.toFixed(2),
                totalContributions: totalContributions.toFixed(2),
                totalInterest: totalInterest.toFixed(2),
                effectiveRate: ((futureValueWithContributions / totalContributions - 1) * 100).toFixed(2),
                yearlyBreakdown: yearlyBreakdown
            }
        });
    } catch (error) {
        console.error('Compound Interest Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Retirement Planning Calculator
router.post('/retirement', async (req, res) => {
    try {
        const { 
            currentAge, 
            retirementAge, 
            currentSavings, 
            monthlyContribution,
            expectedReturn,
            inflationRate = 3,
            desiredMonthlyIncome
        } = req.body;

        if (!currentAge || !retirementAge || !currentSavings || !monthlyContribution || !expectedReturn) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert all inputs to numbers
        const currentAgeNum = parseFloat(currentAge);
        const retirementAgeNum = parseFloat(retirementAge);
        const currentSavingsNum = parseFloat(currentSavings);
        const monthlyContributionNum = parseFloat(monthlyContribution);
        const expectedReturnNum = parseFloat(expectedReturn);
        const inflationRateNum = parseFloat(inflationRate);
        const desiredMonthlyIncomeNum = desiredMonthlyIncome ? parseFloat(desiredMonthlyIncome) : 0;

        // Validate numbers
        if (isNaN(currentAgeNum) || isNaN(retirementAgeNum) || isNaN(currentSavingsNum) || 
            isNaN(monthlyContributionNum) || isNaN(expectedReturnNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const yearsToRetirement = retirementAgeNum - currentAgeNum;
        const monthsToRetirement = yearsToRetirement * 12;
        const monthlyRate = (expectedReturnNum / 100) / 12;

        // Calculate future value at retirement
        const futureValue = currentSavingsNum * Math.pow(1 + monthlyRate, monthsToRetirement) +
            monthlyContributionNum * ((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate);

        // Calculate required savings for desired income (4% rule adjusted for inflation)
        let requiredSavings = 0;
        let shortfall = 0;
        let monthlyIncomeAtRetirement = 0;

        if (desiredMonthlyIncomeNum > 0) {
            const realReturn = ((1 + expectedReturnNum / 100) / (1 + inflationRateNum / 100) - 1);
            
            // Prevent division by zero
            if (realReturn > 0) {
                requiredSavings = (desiredMonthlyIncomeNum * 12) / realReturn;
                shortfall = Math.max(0, requiredSavings - futureValue);
                
                // Calculate what monthly income the future value can support
                monthlyIncomeAtRetirement = (futureValue * realReturn) / 12;
            } else {
                // If real return is 0 or negative, use simple calculation
                requiredSavings = desiredMonthlyIncomeNum * 12 * 25; // 4% rule
                shortfall = Math.max(0, requiredSavings - futureValue);
                monthlyIncomeAtRetirement = futureValue * 0.04 / 12; // 4% rule
            }
        }

        const totalContributions = currentSavingsNum + (monthlyContributionNum * monthsToRetirement);
        const totalGrowth = futureValue - totalContributions;

        res.json({
            success: true,
            data: {
                projectedValue: futureValue.toFixed(2),
                totalContributions: totalContributions.toFixed(2),
                totalGrowth: totalGrowth.toFixed(2),
                yearsToRetirement: yearsToRetirement,
                monthlyIncomeAtRetirement: monthlyIncomeAtRetirement.toFixed(2),
                requiredSavings: requiredSavings.toFixed(2),
                shortfall: shortfall.toFixed(2),
                onTrack: shortfall === 0
            }
        });
    } catch (error) {
        console.error('Retirement Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Options Profit Calculator
router.post('/options-profit', async (req, res) => {
    try {
        const { 
            optionType, // 'call' or 'put'
            strikePrice,
            premium,
            contracts = 1,
            stockPrice
        } = req.body;

        if (!optionType || !strikePrice || !premium || !stockPrice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const strikePriceNum = parseFloat(strikePrice);
        const premiumNum = parseFloat(premium);
        const contractsNum = parseInt(contracts) || 1;
        const stockPriceNum = parseFloat(stockPrice);

        // Validate numbers
        if (isNaN(strikePriceNum) || isNaN(premiumNum) || isNaN(stockPriceNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const contractMultiplier = 100;
        const totalPremium = premiumNum * contractsNum * contractMultiplier;
        let profitLoss = 0;
        let breakEvenPrice = 0;

        if (optionType.toLowerCase() === 'call') {
            breakEvenPrice = strikePriceNum + premiumNum;
            if (stockPriceNum > strikePriceNum) {
                profitLoss = ((stockPriceNum - strikePriceNum) * contractsNum * contractMultiplier) - totalPremium;
            } else {
                profitLoss = -totalPremium;
            }
        } else if (optionType.toLowerCase() === 'put') {
            breakEvenPrice = strikePriceNum - premiumNum;
            if (stockPriceNum < strikePriceNum) {
                profitLoss = ((strikePriceNum - stockPriceNum) * contractsNum * contractMultiplier) - totalPremium;
            } else {
                profitLoss = -totalPremium;
            }
        }

        const returnOnInvestment = ((profitLoss / totalPremium) * 100).toFixed(2);

        res.json({
            success: true,
            data: {
                profitLoss: profitLoss.toFixed(2),
                totalPremiumPaid: totalPremium.toFixed(2),
                breakEvenPrice: breakEvenPrice.toFixed(2),
                returnOnInvestment: returnOnInvestment,
                status: profitLoss > 0 ? 'Profit' : profitLoss < 0 ? 'Loss' : 'Break Even'
            }
        });
    } catch (error) {
        console.error('Options Profit Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Crypto Staking Rewards Calculator
router.post('/staking-rewards', async (req, res) => {
    try {
        const { 
            stakingAmount,
            apy,
            stakingPeriodDays,
            compoundFrequency = 'daily', // daily, weekly, monthly, yearly
            tokenPrice
        } = req.body;

        if (!stakingAmount || !apy || !stakingPeriodDays) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const stakingAmountNum = parseFloat(stakingAmount);
        const apyNum = parseFloat(apy);
        const stakingPeriodDaysNum = parseFloat(stakingPeriodDays);
        const tokenPriceNum = tokenPrice ? parseFloat(tokenPrice) : null;

        // Validate numbers
        if (isNaN(stakingAmountNum) || isNaN(apyNum) || isNaN(stakingPeriodDaysNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        const rate = apyNum / 100;
        const years = stakingPeriodDaysNum / 365;
        
        let n; // compounds per year
        switch(compoundFrequency) {
            case 'daily': n = 365; break;
            case 'weekly': n = 52; break;
            case 'monthly': n = 12; break;
            case 'yearly': n = 1; break;
            default: n = 365;
        }

        // Compound interest formula
        const finalAmount = stakingAmountNum * Math.pow(1 + rate / n, n * years);
        const totalRewards = finalAmount - stakingAmountNum;

        // Calculate in USD if token price provided
        let usdValue = null;
        if (tokenPriceNum && !isNaN(tokenPriceNum)) {
            usdValue = {
                initialValue: (stakingAmountNum * tokenPriceNum).toFixed(2),
                finalValue: (finalAmount * tokenPriceNum).toFixed(2),
                rewardsValue: (totalRewards * tokenPriceNum).toFixed(2)
            };
        }

        res.json({
            success: true,
            data: {
                initialAmount: stakingAmountNum.toFixed(4),
                finalAmount: finalAmount.toFixed(4),
                totalRewards: totalRewards.toFixed(4),
                apy: apyNum,
                stakingPeriod: stakingPeriodDaysNum,
                compoundFrequency: compoundFrequency,
                ...(usdValue && { usdValue })
            }
        });
    } catch (error) {
        console.error('Staking Rewards Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

// Dollar Cost Averaging Calculator
router.post('/dca', async (req, res) => {
    try {
        const { 
            investmentAmount,
            frequency, // 'daily', 'weekly', 'monthly'
            duration, // in days
            priceHistory // array of prices (optional, for historical analysis)
        } = req.body;

        if (!investmentAmount || !frequency || !duration) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Convert to numbers
        const investmentAmountNum = parseFloat(investmentAmount);
        const durationNum = parseFloat(duration);

        // Validate numbers
        if (isNaN(investmentAmountNum) || isNaN(durationNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid numeric values'
            });
        }

        let investmentIntervals;
        switch(frequency) {
            case 'daily': investmentIntervals = durationNum; break;
            case 'weekly': investmentIntervals = Math.floor(durationNum / 7); break;
            case 'monthly': investmentIntervals = Math.floor(durationNum / 30); break;
            default: investmentIntervals = durationNum;
        }

        const totalInvested = investmentAmountNum * investmentIntervals;

        // If price history is provided, calculate actual results
        let results = {
            totalInvested: totalInvested.toFixed(2),
            numberOfInvestments: investmentIntervals,
            amountPerInvestment: investmentAmountNum.toFixed(2),
            frequency: frequency
        };

        if (priceHistory && priceHistory.length > 0) {
            let totalShares = 0;
            const purchases = [];

            // Simulate DCA purchases
            for (let i = 0; i < investmentIntervals && i < priceHistory.length; i++) {
                const price = parseFloat(priceHistory[i]);
                if (isNaN(price)) continue;
                
                const shares = investmentAmountNum / price;
                totalShares += shares;
                
                purchases.push({
                    interval: i + 1,
                    price: price.toFixed(2),
                    shares: shares.toFixed(4),
                    invested: investmentAmountNum.toFixed(2)
                });
            }

            const currentPrice = parseFloat(priceHistory[priceHistory.length - 1]);
            if (!isNaN(currentPrice) && totalShares > 0) {
                const currentValue = totalShares * currentPrice;
                const averageCost = totalInvested / totalShares;
                const profitLoss = currentValue - totalInvested;
                const roi = ((profitLoss / totalInvested) * 100).toFixed(2);

                results = {
                    ...results,
                    totalShares: totalShares.toFixed(4),
                    averageCost: averageCost.toFixed(2),
                    currentPrice: currentPrice.toFixed(2),
                    currentValue: currentValue.toFixed(2),
                    profitLoss: profitLoss.toFixed(2),
                    roi: roi,
                    purchases: purchases
                };
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('DCA Calculator Error:', error);
        res.status(500).json({
            success: false,
            error: 'Calculation failed'
        });
    }
});

module.exports = router;