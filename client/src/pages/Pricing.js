
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, XCircle, Zap, Shield, Star, BarChartHorizontal } from 'lucide-react';

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
    align-items: center;
`;

const TierCard = styled.div`
    background: rgba(44, 62, 80, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
    width: 100%;
    max-width: 320px;
    min-height: 600px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;

    &:hover {
        transform: translateY(-10px);
        box-shadow: 0 25px 45px rgba(0, 0, 0, 0.8);
    }
`;

const BestValueBadge = styled.div`
    position: absolute;
    top: -15px;
    background: linear-gradient(45deg, #f1c40f, #f39c12);
    color: #1c2833;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: bold;
    box-shadow: 0 5px 10px rgba(241, 196, 15, 0.4);
`;

const TierTitle = styled.h2`
    color: #ecf0f1;
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
`;

const TierPrice = styled.p`
    color: #3498db;
    font-size: 2.2rem;
    font-weight: bold;
    margin: 0;
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
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 0;
    color: #95a5a6;
    border-bottom: 1px solid #34495e;
    font-size: 0.9rem;
    text-align: left;

    &.included {
        color: #ecf0f1;
        font-weight: 500;
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
    margin-top: auto; /* Pushes button to the bottom */
    width: 100%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    }
`;

const Pricing = () => {
    return (
        <PricingContainer>
            <Header>
                <Title>Pricing & Tiers</Title>
                <Subtitle>Choose the plan that fits your trading strategy. Unlock the full power of Nexus Signal AI and gain your edge.</Subtitle>
            </Header>
            <TiersContainer>
                {/* Free Tier */}
                <TierCard>
                    <TierTitle>Free</TierTitle>
                    <TierPrice>$0 <span>/ forever</span></TierPrice>
                    <FeatureList>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> 5 Predictions per day</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Historical Data Charts</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Personalized Watchlist</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Ad-Free Experience</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> AI Prediction Confidence Score</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Signal Rationale (SMA, RSI, MACD)</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Nexus AI Copilot Access</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Email & SMS Alerts</FeatureItem>
                    </FeatureList>
                    <Button disabled style={{ background: '#7f8c8d', cursor: 'default', boxShadow: 'none', transform: 'none' }}>Your Current Plan</Button>
                </TierCard>

                {/* Pro Weekly */}
                <TierCard>
                    <TierTitle>Pro Weekly</TierTitle>
                    <TierPrice>$14 <span>/ week</span></TierPrice>
                    <FeatureList>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Unlimited Predictions</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> AI Prediction Confidence Score</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Signal Rationale (SMA, RSI, MACD)</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Ad-Free Experience</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Historical Data Charts</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Personalized Watchlist</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Nexus AI Copilot Access</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Email & SMS Alerts</FeatureItem>
                    </FeatureList>
                    <Button><Zap size={18}/> Get Weekly</Button>
                </TierCard>

                {/* Pro Monthly */}
                <TierCard>
                    <TierTitle>Pro Monthly</TierTitle>
                    <TierPrice>$50 <span>/ month</span></TierPrice>
                    <FeatureList>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> All Pro Weekly Features</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Nexus AI Copilot Access</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Email & SMS Alerts</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Access to Backtest Results</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Advanced Charting Tools</FeatureItem>
                        <FeatureItem><XCircle color="#e74c3c" size={18}/> Export Data (CSV)</FeatureItem>
                    </FeatureList>
                    <Button><Shield size={18}/> Go Pro Monthly</Button>
                </TierCard>

                {/* Pro Yearly */}
                <TierCard style={{ border: '2px solid #f1c40f' }}>
                    <BestValueBadge>Best Value</BestValueBadge>
                    <TierTitle>Pro Yearly</TierTitle>
                    <TierPrice>$500 <span>/ year</span></TierPrice>
                    <FeatureList>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> All Pro Monthly Features</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Advanced Charting Tools</FeatureItem>
                        <FeatureItem className="included"><CheckCircle color="#2ecc71" size={18}/> Export Data (CSV)</FeatureItem>
                        <FeatureItem className="included"><Star color="#f1c40f" size={18}/> Early access to new features</FeatureItem>
                    </FeatureList>
                    <Button style={{ background: 'linear-gradient(45deg, #f1c40f, #f39c12)' }}><Star size={18}/> Go Pro Yearly</Button>
                </TierCard>
            </TiersContainer>
        </PricingContainer>
    );
};

export default Pricing;

