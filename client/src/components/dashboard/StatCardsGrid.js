// client/src/components/dashboard/StatCardsGrid.js
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { TrendingUp, Clock, Activity, Zap } from 'lucide-react';

const fadeIn = keyframes` /* Re-declare if needed, or import from a shared style if you make one */
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

const StatCardsGrid = ({ activeSignals, portfolioGrowth, marketVolatility, lastUpdate, error }) => {
    return (
        <>
            {error && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{error}</p>}
            <StatGrid>
                <StatCard>
                    <h3><Activity size={24} color="#00adef" /> Active Signals</h3>
                    <p>{activeSignals}</p>
                    <span>Today's AI-driven trade recommendations</span>
                </StatCard>
                <StatCard>
                    <h3><TrendingUp size={24} color="#4CAF50" /> Portfolio Growth</h3>
                    <p>{portfolioGrowth}</p>
                    <span>Last 30 days (mock data)</span>
                </StatCard>
                <StatCard>
                    <h3><Zap size={24} color="#f97316" /> Market Volatility</h3>
                    <p>{marketVolatility}</p>
                    <span>Current AI sentiment (mock data)</span>
                </StatCard>
                <StatCard>
                    <h3><Clock size={24} color="#94a3b8" /> Last Update</h3>
                    <p>{lastUpdate}</p>
                    <span>Real-time data stream</span>
                </StatCard>
            </StatGrid>
        </>
    );
};

export default StatCardsGrid;