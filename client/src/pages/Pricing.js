import React from 'react';
import styled, { keyframes } from 'styled-components';
// Only import used icons
import { CheckCircle, Star } from 'lucide-react';

// Animations
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

// Styled Components
const PricingContainer = styled.div`
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

const TiersContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: stretch;
`;

const TierCard = styled.div`
    background: rgba(44, 62, 80, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    /* Base shadow - will be overridden by inline style for glowing cards */
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
    width: 100%;
    max-width: 340px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;

    &:hover {
        transform: translateY(-10px);
        /* Keep hover shadow consistent or enhance it */
        box-shadow: 0 25px 45px rgba(0, 0, 0, 0.8);
    }
`;

const PopularBadge = styled.div`
    position: absolute;
    top: -15px;
    background: linear-gradient(45deg, #f39c12, #e67e22);
    color: #1c2833;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: bold;
    box-shadow: 0 5px 10px rgba(243, 156, 18, 0.4);
`;

const TierTitle = styled.h2`
    color: #ecf0f1;
    font-size: 1.6rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
`;

const TierDescription = styled.p`
    color: #95a5a6;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    min-height: 40px;
    text-align: center;
`;

const TierPrice = styled.p`
    color: #3498db;
    font-size: 2.2rem;
    font-weight: bold;
    margin: 0.5rem 0;
    span {
        font-size: 1rem;
        color: #bdc3c7;
        font-weight: normal;
    }
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    width: 100%;
    text-align: left;
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.6rem 0;
    color: #bdc3c7;
    border-bottom: 1px solid #34495e;
    font-size: 0.9rem;

    &:last-child {
        border-bottom: none;
    }
`;

const Button = styled.button`
    background: linear-gradient(45deg, #3498db, #2980b9);
    border: none;
    border-radius: 5px;
    color: white;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    transition: all 0.3s ease-in-out;
    margin-top: auto;
    width: 100%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    }
`;


const Pricing = () => {
    // Define the glow shadow styles
    const premiumGlow = '0 0 15px 2px #f39c12'; // Orange glow
    const eliteGlow = '0 0 15px 2px #9b59b6'; // Purple glow
    const baseShadow = '0 15px 35px rgba(0, 0, 0, 0.7)'; // Original shadow

    return (
        <PricingContainer>
            <Header>
                <Title>Unlock Your Trading Edge</Title>
                <Subtitle>Nexus Signal.AI Pricing! Choose the plan that empowers your market strategy.</Subtitle>
            </Header>
            <TiersContainer>
                {/* Basic Tier (Free Trial) */}
                <TierCard> {/* No glow style here */}
                    <TierTitle>Basic</TierTitle>
                    <TierDescription>Explore the Fundamentals</TierDescription>
                    <TierPrice>7-Day Free Trial</TierPrice>
                    <span style={{color: '#95a5a6', fontSize: '0.9rem', marginBottom: '1.5rem'}}>(No Credit Card Required)</span>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Limited Daily Signals (2/day)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> 1 Watchlist (up to 10 assets)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Basic Market Overviews</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Email Support (Standard)</FeatureItem>
                    </FeatureList>
                    <Button>Start Free Trial</Button>
                </TierCard>

                {/* Premium Tier - Added box-shadow */}
                <TierCard style={{
                    border: '2px solid #f39c12',
                    boxShadow: `${premiumGlow}, ${baseShadow}` // Combine glow and base shadow
                 }}>
                    <PopularBadge>MOST POPULAR</PopularBadge>
                    <TierTitle>Premium</TierTitle>
                    <TierDescription>Master Your Trades</TierDescription>
                    <TierPrice>$49 <span>/ month</span></TierPrice>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Comprehensive Daily Signals</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Live Market Data (Minute)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Real-Time Price & Insights</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Algorithmic Analysis</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> In-depth Sector Analysis</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Priority Email Support</FeatureItem>
                    </FeatureList>
                    <Button style={{ background: 'linear-gradient(45deg, #f39c12, #e67e22)' }}>Choose Plan</Button>
                </TierCard>

                {/* Elite Tier - Added box-shadow */}
                <TierCard style={{
                    border: '2px solid #9b59b6',
                    boxShadow: `${eliteGlow}, ${baseShadow}` // Combine glow and base shadow
                }}>
                    <TierTitle>Elite</TierTitle>
                     <TierDescription>For the Ultimate Market Edge</TierDescription>
                    <TierPrice>$125 <span>/ month</span></TierPrice>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> All Premium Features +</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Ultra-Low Latency Data</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> API Access</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Unlimited Literacy Reports</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Custom Research Insights</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Personalized Mentorship</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> 24/7 Dedicated Account Manager</FeatureItem>
                    </FeatureList>
                    <Button style={{ background: 'linear-gradient(45deg, #9b59b6, #8e44ad)' }}><Star size={18}/> Go Elite</Button>
                </TierCard>

            </TiersContainer>
        </PricingContainer>
    );
};

export default Pricing;

