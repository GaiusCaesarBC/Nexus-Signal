// client/src/pages/PricingPage.js - Reverted styling, only "Coming Soon" on buttons
import React from 'react';
import styled from 'styled-components';
import { Check, X } from 'lucide-react'; // Assuming lucide-react is installed

const PricingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background-color: #f4f7f6; /* Light background for contrast */
    color: #333; /* Dark text for readability */
`;

const Title = styled.h1`
    font-size: 2.8rem;
    margin-bottom: 1.5rem;
    color: #2c3e50;
    text-align: center;
`;

const Subtitle = styled.p`
    font-size: 1.1rem;
    color: #6c7a89;
    margin-bottom: 3rem;
    max-width: 800px;
    text-align: center;
    line-height: 1.6;
`;

const PricingCards = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    max-width: 1000px;
    width: 100%;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        padding: 0 1rem;
    }
`;

const Card = styled.div`
    background-color: #ffffff;
    border-radius: 10px;
    padding: 2rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    text-align: center;
    transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    &:hover {
        transform: translateY(-5px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    ${props => props.featured && `
        border: 2px solid #3498db;
        box-shadow: 0 6px 20px rgba(52, 152, 219, 0.2);
    `}
`;

const PlanName = styled.h2`
    font-size: 1.8rem;
    color: #34495e;
    margin-bottom: 1rem;
`;

const Price = styled.div`
    font-size: 3rem;
    font-weight: bold;
    color: #2c3e50;
    margin-bottom: 1rem;
    span {
        font-size: 1.2rem;
        font-weight: normal;
        color: #7f8c8d;
    }
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    flex-grow: 1;
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: #555;
    margin-bottom: 0.8rem;
    gap: 0.5rem;

    svg {
        color: ${props => props.included ? '#2ecc71' : '#e74c3c'};
        min-width: 18px;
    }
`;

const ActionButton = styled.button`
    background-color: #3498db;
    border: none;
    border-radius: 5px;
    color: white;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s ease;
    width: 100%;
    margin-top: 1rem;

    &:hover {
        background-color: #2980b9;
    }

    &:disabled {
        background-color: #cccccc; /* Grey out when disabled */
        cursor: not-allowed;
    }
`;

const PricingPage = () => {
    return (
        <PricingContainer>
            <Title>Simple, Transparent Pricing</Title>
            <Subtitle>
                Choose the plan that best fits your trading journey. From fundamental insights to advanced AI predictions, we have a solution for every level of expertise.
            </Subtitle>

            <PricingCards>
                {/* Free Tier Card */}
                <Card>
                    <PlanName>Free Tier</PlanName>
                    <Price>$0<span>/month</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={20} /> Limited Market Watchlist</FeatureItem>
                        <FeatureItem included><Check size={20} /> Basic News & Sentiment</FeatureItem>
                        <FeatureItem included><Check size={20} /> Daily Market Summaries</FeatureItem>
                        <FeatureItem included={false}><X size={20} /> Advanced AI Predictions</FeatureItem>
                        <FeatureItem included={false}><X size={20} /> Real-Time Strategy Backtesting</FeatureItem>
                        <FeatureItem included={false}><X size={20} /> Priority Support</FeatureItem>
                    </FeatureList>
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <-- ONLY CHANGE */}
                </Card>

                {/* Pro Tier Card */}
                <Card featured>
                    <PlanName>Pro Tier</PlanName>
                    <Price>$29<span>/month</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={20} /> Expanded Market Watchlist</FeatureItem>
                        <FeatureItem included><Check size={20} /> Comprehensive News & Sentiment</FeatureItem>
                        <FeatureItem included><Check size={20} /> Advanced AI Predictions</FeatureItem>
                        <FeatureItem included><Check size={20} /> Basic Strategy Backtesting</FeatureItem>
                        <FeatureItem included={false}><X size={20} /> Real-Time Strategy Optimization</FeatureItem>
                        <FeatureItem included={false}><X size={20} /> Dedicated Account Manager</FeatureItem>
                    </FeatureList>
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <-- ONLY CHANGE */}
                </Card>

                {/* Enterprise Tier Card */}
                <Card>
                    <PlanName>Enterprise</PlanName>
                    <Price>$99<span>/month</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={20} /> Unlimited Market Access</FeatureItem>
                        <FeatureItem included><Check size={20} /> Premium News & AI Insights</FeatureItem>
                        <FeatureItem included><Check size={20} /> Advanced AI Predictions & Custom Models</FeatureItem>
                        <FeatureItem included><Check size={20} /> Real-Time Strategy Optimization</FeatureItem>
                        <FeatureItem included><Check size={20} /> Dedicated Account Manager</FeatureItem>
                        <FeatureItem included><Check size={20} /> API Access & Integrations</FeatureItem>
                    </FeatureList>
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <-- ONLY CHANGE */}
                </Card>
            </PricingCards>
        </PricingContainer>
    );
};

export default PricingPage;