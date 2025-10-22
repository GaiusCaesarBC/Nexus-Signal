import React from 'react';
import styled, { keyframes } from 'styled-components';
// Import the chart component
import PerformanceComparisonChart from '../components/PerformanceComparisonChart';
// Import icons that might be used for metrics or placeholders (not currently used, but keep if needed later)
// import { Percent, Zap } from 'lucide-react';

// --- Animations ---
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// --- Styled Components ---
const PerformanceContainer = styled.div`
    padding: 3rem 2rem;
    animation: ${fadeIn} 0.6s ease-out;
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 4rem;
`;

const Title = styled.h1`
    font-size: 3rem;
    color: #ecf0f1;
    margin-bottom: 1rem;
    text-shadow: 0 0 15px rgba(52, 152, 219, 0.5);
`;

const Subtitle = styled.p`
    font-size: 1.2rem;
    color: #bdc3c7;
    max-width: 700px;
    margin: 0 auto;
`;

// GlassCard style for consistency
const GlassCard = styled.div`
    background: rgba(44, 62, 80, 0.75);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    padding: 1.5rem;
`;

// Container for the top metrics
const ScorecardContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    max-width: 1000px;
    margin: 0 auto 4rem auto; // Space below the scorecard
`;

// Individual metric card
const MetricCard = styled(GlassCard)`
    padding: 2rem;
    text-align: center;
`;

const MetricValue = styled.h2`
    font-size: 2.5rem;
    color: #3498db;
    margin: 0 0 0.5rem 0;
    text-shadow: 0 0 8px rgba(52, 152, 219, 0.7);
`;

const MetricLabel = styled.p`
    color: #bdc3c7;
    margin: 0;
    font-size: 1rem;
`;

// Container for the chart
const ChartSectionContainer = styled(GlassCard)` // Use GlassCard style
    max-width: 1200px;
    margin: 0 auto; // Center the chart container
    padding: 2rem;
`;

const ChartTitle = styled.h2`
    text-align: center;
    color: #ecf0f1;
    margin-top: 0;
    margin-bottom: 2rem; // Space below title, above chart
`;

// The main Performance component
const Performance = () => {
    return (
        <PerformanceContainer>
            <Header>
                <Title>Model Performance</Title>
                <Subtitle>Our commitment to transparency means showing you our results. Here's a look at how the Nexus Signal AI model has performed in backtested simulations.</Subtitle>
            </Header>

            {/* Scorecard Section - This brings back the original metrics */}
            <ScorecardContainer>
                <MetricCard>
                    {/* Placeholder value - update later */}
                    <MetricValue>78.2%</MetricValue>
                    <MetricLabel>Signal Win Rate (Backtested)</MetricLabel>
                </MetricCard>
                <MetricCard>
                    {/* Placeholder value - update later */}
                    <MetricValue>1.62</MetricValue>
                    <MetricLabel>Sharpe Ratio (Simulated)</MetricLabel>
                </MetricCard>
                <MetricCard>
                    {/* Placeholder value - update later */}
                    <MetricValue>+127%</MetricValue>
                    <MetricLabel>Simulated 3-Year Return</MetricLabel>
                </MetricCard>
            </ScorecardContainer>

            {/* Chart Section - This uses the new chart component */}
            <ChartSectionContainer>
                <ChartTitle>Historical Simulation vs. S&P 500</ChartTitle>
                {/* Ensure PerformanceComparisonChart.js exists in ../components/ */}
                <PerformanceComparisonChart />
            </ChartSectionContainer>

        </PerformanceContainer>
    );
};

export default Performance;

