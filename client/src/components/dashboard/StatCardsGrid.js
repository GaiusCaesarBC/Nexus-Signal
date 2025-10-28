// client/src/components/dashboard/StatCardsGrid.js
import React from 'react';
import styled, { keyframes } from 'styled-components'; // Ensure keyframes is imported here

// COMBINED ALL LUCIDE REACT ICONS INTO ONE IMPORT STATEMENT
import {
    DollarSign,
    TrendingUp,
    BarChart2, // Default icon for unknown
    BriefcaseBusiness, // For 'assets'
    Activity, // For 'active_signals'
    Zap, // For 'market_volatility'
    Clock, // For 'last_update'
    Wallet, // For 'portfolio_value'
    Signal, // For 'active_signals'
    Smile, // For 'AI_sentiment' or similar
    Landmark,
    LineChart,
    Gauge // Another option for volatility
} from 'lucide-react';

// A mapping object to get the right icon component based on a string name
const iconMap = {
    'portfolio_value': Wallet,
    'active_signals': Signal,
    'ai_sentiment': Smile,
    'market_volatility': Gauge,
    'last_update': Clock,
    'total_assets': BriefcaseBusiness,
    'portfolio_growth': TrendingUp,
    'dollar': DollarSign,
    'trending-up': TrendingUp, // Alias for portfolio_growth
    'activity': Activity,
    'zap': Zap,
    'clock': Clock,
    'line-chart': LineChart
    // Add more mappings as needed, matching the 'icon' string from your backend data
};

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const StatGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    margin-bottom: 2.5rem;
`;

const StatCard = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid rgba(0, 173, 237, 0.2);

    &:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    }

    h3 {
        font-size: 1.4rem;
        color: #e0e0e0;
        margin-bottom: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    p {
        font-size: 2.2rem;
        font-weight: bold;
        color: #00adef; /* Nexus blue */
        margin-bottom: 0.5rem;
        text-shadow: 0 0 10px rgba(0, 173, 237, 0.4);
    }
    span {
        font-size: 0.95rem;
        color: #94a3b8;
    }
`;

// StatCardsGrid component
const StatCardsGrid = ({ summary, error }) => {
    // Ensure summary is an array, even if it's null/undefined
    const metricsToDisplay = Array.isArray(summary) ? summary : [];

    return (
        <>
            {error && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{error}</p>}
            <StatGrid>
                {metricsToDisplay.map(metric => {
                    const IconComponent = iconMap[metric.icon] || BarChart2; // Default to BarChart2 if icon not found
                    const changeColor = metric.changeType === 'increase' ? '#4CAF50' : metric.changeType === 'decrease' ? '#ff6b6b' : '#94a3b8';

                    return (
                        <StatCard key={metric.id}>
                            <h3>
                                <IconComponent size={24} color={changeColor} /> {metric.label}
                            </h3>
                            <p style={{ color: changeColor }}>{metric.value}</p>
                            {metric.change && (
                                <span>
                                    {metric.changeType === 'increase' ? '+' : ''}{metric.change}{metric.timeframe ? ` ${metric.timeframe}` : ''}
                                </span>
                            )}
                            {!metric.change && metric.timeframe && (
                                <span>{metric.timeframe}</span>
                            )}
                        </StatCard>
                    );
                })}
            </StatGrid>
        </>
    );
};

export default StatCardsGrid;