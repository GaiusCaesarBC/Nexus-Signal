// client/src/pages/PricingPage.js
import React from 'react';
import styled from 'styled-components';
import { Check, X } from 'lucide-react'; // Assuming you have lucide-react installed

const PricingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height)); /* Account for navbar height */
    background: linear-gradient(135deg, #1e3a5f 0%, #0d1a2f 100%); /* Darker, more intense gradient */
    color: #ecf0f1;
`;

const Title = styled.h1`
    font-size: 3.5rem;
    margin-bottom: 1.5rem;
    color: #e0e0e0;
    text-shadow: 0 0 15px rgba(52, 152, 219, 0.4); /* Subtle blue glow */
    text-align: center;

    @media (max-width: 768px) {
        font-size: 2.8rem;
    }
`;

const Subtitle = styled.p`
    font-size: 1.3rem;
    color: #bdc3c7;
    margin-bottom: 3rem;
    max-width: 800px;
    text-align: center;
    line-height: 1.6;
`;

const PricingCards = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2.5rem;
    max-width: 1200px;
    width: 100%;

    @media (max-width: 1024px) {
        grid-template-columns: 1fr;
        padding: 0 1rem;
    }
`;

const Card = styled.div`
    background-color: #1a2a3a; /* Slightly lighter dark blue for cards */
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(52, 152, 219, 0.15);
    text-align: center;
    transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    border: 1px solid rgba(52, 152, 219, 0.3); /* Subtle border */
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    &:hover {
        transform: translateY(-10px);
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(52, 152, 219, 0.3);
    }

    ${props => props.featured && `
        background: linear-gradient(45deg, #2c3e50, #1c2838); /* More distinct background for featured */
        border-color: #3498db;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7), 0 0 40px rgba(52, 152, 219, 0.5);
        transform: scale(1.02);

        &:hover {
            transform: translateY(-15px) scale(1.03);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 50px rgba(52, 152, 219, 0.7);
        }
    `}
`;

const PlanName = styled.h2`
    font-size: 2.2rem;
    color: #3498db;
    margin-bottom: 1.5rem;
    text-shadow: 0 0 8px rgba(52, 152, 219, 0.3);
`;

const Price = styled.div`
    font-size: 3.5rem;
    font-weight: bold;
    color: #ecf0f1;
    margin-bottom: 1rem;
    span {
        font-size: 1.5rem;
        font-weight: normal;
        color: #bdc3c7;
    }
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 2rem 0;
    flex-grow: 1; /* Allow list to take up available space */
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    color: #bdc3c7;
    margin-bottom: 1rem;
    gap: 0.8rem;

    svg {
        color: ${props => props.included ? '#2ecc71' : '#e74c3c'}; /* Green for check, Red for X */
        min-width: 20px; /* Ensure icon doesn't shrink */
    }
`;

const ActionButton = styled.button`
    background: linear-gradient(90deg, #3498db, #2980b9);
    border: none;
    border-radius: 8px;
    color: white;
    padding: 1rem 2rem;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
    width: 100%;
    margin-top: 1.5rem; /* Ensure space from features */

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.6);
        background: linear-gradient(90deg, #2980b9, #3498db); /* Slightly shift gradient */
    }

    &:disabled {
        background: #7f8c8d; /* Grey out when disabled */
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
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
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <--- MODIFIED HERE */}
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
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <--- MODIFIED HERE */}
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
                    <ActionButton disabled>Coming Soon</ActionButton> {/* <--- MODIFIED HERE */}
                </Card>
            </PricingCards>
        </PricingContainer>
    );
};

export default PricingPage;