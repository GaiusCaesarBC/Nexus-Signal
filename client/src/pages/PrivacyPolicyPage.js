// client/src/pages/PricingPage.js - Recreated based on provided image, buttons "Coming Soon", Header Icon replaced with Logo
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Check } from 'lucide-react'; // Removed ArrowUp as it's no longer used
import nexusSignalLogo from '../assets/nexus-signal-logo.png'; // <-- IMPORT YOUR LOGO

// --- Keyframes for subtle animations ---
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components based on the provided image ---

const PricingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(100vh - var(--navbar-height)); /* Ensure it fills screen below navbar */
    background-color: #0f172a; /* Dark background matching the image */
    color: #f8fafc; /* Light text color */
    padding: 4rem 1.5rem; /* Generous padding top/bottom */
    position: relative;
    overflow: hidden; /* Hide overflowing lines */

    /* Background glowing lines (simplified representation) */
    &::before, &::after {
        content: '';
        position: absolute;
        width: 150vw;
        height: 150vw;
        border-radius: 50%;
        opacity: 0.1;
        z-index: 0;
        filter: blur(80px); /* Soft glow */
    }

    &::before { /* Top-left blue glow */
        background: radial-gradient(circle, #3b82f6, transparent 50%);
        top: -70vw;
        left: -70vw;
    }

    &::after { /* Bottom-right orange/purple glow */
        background: radial-gradient(circle, #f97316, transparent 50%);
        bottom: -70vw;
        right: -70vw;
    }

    /* Additional subtle lines for effect */
    .line-effect {
        position: absolute;
        background: rgba(59, 130, 246, 0.2); /* Blue */
        height: 1px;
        z-index: 1;
        animation: line-fade 3s infinite alternate;
    }
    .line-effect:nth-child(1) { top: 20%; left: -10%; width: 120%; transform: rotate(15deg); }
    .line-effect:nth-child(2) { bottom: 15%; right: -10%; width: 120%; transform: rotate(-10deg); background: rgba(249, 115, 22, 0.2); } /* Orange */

    @keyframes line-fade {
        0% { opacity: 0.1; }
        100% { opacity: 0.3; }
    }
`;

// REMOVED HeaderIcon component
const HeaderLogo = styled.img` // <-- NEW Styled component for the logo
    width: 60px; /* Adjust size as needed */
    height: 60px;
    margin-bottom: 2rem;
    animation: ${fadeIn} 0.8s ease-out;
    filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.7)); /* Subtle glow for the logo */
`;


const Title = styled.h1`
    font-size: 3.2rem;
    margin-bottom: 1.5rem;
    color: #f8fafc;
    text-align: center;
    line-height: 1.2;
    animation: ${fadeIn} 1s ease-out 0.2s backwards;
    
    strong {
        color: #3b82f6; /* Blue for the brand part of the title */
    }

    @media (max-width: 768px) {
        font-size: 2.5rem;
    }
`;

const Subtitle = styled.p`
    font-size: 1.2rem;
    color: #94a3b8; /* Lighter grey for subtitle */
    margin-bottom: 3.5rem;
    max-width: 800px;
    text-align: center;
    line-height: 1.6;
    animation: ${fadeIn} 1.2s ease-out 0.4s backwards;

    @media (max-width: 768px) {
        font-size: 1rem;
        margin-bottom: 2.5rem;
    }
`;

const PricingCards = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* Exactly 3 columns as per image */
    gap: 2rem;
    max-width: 1200px;
    width: 100%;
    z-index: 2; /* Bring cards above background lines */

    @media (max-width: 1024px) {
        grid-template-columns: 1fr; /* Stack vertically on smaller screens */
        padding: 0 1rem;
    }
`;

const Card = styled.div`
    background-color: #1e293b; /* Slightly lighter dark blue for cards */
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    text-align: center;
    transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 500px; /* Ensure cards have similar height */
    animation: ${fadeIn} 1s ease-out forwards; /* Fade in animation */

    &:hover {
        transform: translateY(-8px);
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
    }

    ${props => props.planType === 'basic' && `
        border: 1px solid #3b82f6; /* Blue border */
        background-color: #1e293b;
        animation-delay: 0.4s;
        /* No glow for basic as per image */
    `}
    ${props => props.planType === 'premium' && `
        border: 1px solid #f97316; /* Orange border */
        background-color: #1e293b;
        position: relative;
        animation-delay: 0.6s;
        box-shadow: 0 0 25px rgba(249, 115, 22, 0.5), 0 10px 30px rgba(0, 0, 0, 0.5); /* Orange glow */
    `}
    ${props => props.planType === 'elite' && `
        border: 1px solid #8b5cf6; /* Purple border */
        background-color: #1e293b;
        animation-delay: 0.8s;
        box-shadow: 0 0 25px rgba(139, 92, 246, 0.5), 0 10px 30px rgba(0, 0, 0, 0.5); /* Purple glow */
    `}
`;

const PlanHeader = styled.div`
    margin-bottom: 1.5rem;
`;

const PlanTag = styled.span`
    background-color: #f97316; /* Orange tag for 'MOST POPULAR' */
    color: white;
    padding: 0.3rem 0.8rem;
    border-radius: 9999px; /* Pill shape */
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.8rem;
    display: inline-block;
`;

const PlanName = styled.h2`
    font-size: 1.8rem;
    color: ${props => props.planType === 'basic' ? '#3b82f6' : props.planType === 'premium' ? '#f97316' : '#8b5cf6'}; /* Color from image */
    margin-bottom: 0.5rem;
`;

const PlanDescription = styled.p`
    font-size: 0.95rem;
    color: #94a3b8;
    margin-bottom: 1rem;
`;

const Price = styled.div`
    font-size: 2.8rem; /* Smaller price font */
    font-weight: bold;
    color: #f8fafc;
    margin-bottom: 1.5rem;
    span {
        font-size: 1.2rem;
        font-weight: normal;
        color: #94a3b8;
    }
    ${props => props.planType === 'basic' && `
        font-size: 1.8rem; /* For '7-Day Free Trial' */
    `}
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    flex-grow: 1;
    text-align: left; /* Features aligned left as in image */
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    font-size: 0.95rem;
    color: #cbd5e1; /* Lighter grey for features */
    margin-bottom: 0.7rem;
    gap: 0.6rem;

    svg {
        color: #22c55e; /* Green check, consistent for all included features */
        min-width: 16px;
        height: 16px;
    }
`;

const ActionButton = styled.button`
    background-color: ${props => props.planType === 'basic' ? '#3b82f6' : props.planType === 'premium' ? '#f97316' : '#8b5cf6'};
    border: none;
    border-radius: 8px;
    color: white;
    padding: 0.9rem 1.8rem;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    width: 100%;
    margin-top: 2rem;

    &:hover {
        transform: translateY(-3px);
        opacity: 0.9;
    }

    &:disabled {
        background-color: #64748b; /* Grey out when disabled */
        cursor: not-allowed;
        opacity: 0.7;
        transform: none;
        box-shadow: none;
    }
`;

const FooterHashtags = styled.div`
    z-index: 2;
    margin-top: 5rem;
    font-size: 1rem;
    color: #64748b; /* Subtle grey for hashtags */
    animation: ${fadeIn} 1.5s ease-out 1s backwards;

    span {
        margin: 0 0.5rem;
        white-space: nowrap;
    }

    @media (max-width: 768px) {
        font-size: 0.8rem;
        span {
            margin: 0 0.3rem;
        }
    }
`;

const PricingPage = () => {
    return (
        <PricingContainer>
            {/* Background line effects (optional, for visual flair) */}
            <div className="line-effect"></div>
            <div className="line-effect"></div>

            {/* Replaced HeaderIcon with your logo */}
            <HeaderLogo src={nexusSignalLogo} alt="Nexus Signal AI Logo" /> 

            <Title>Unlock Your Trading Edge: <strong>Nexus Signal.AI</strong> Pricing!</Title>
            <Subtitle>
                Gain an unfair advantage with AI-powered insights, real-time analytics, and advanced predictive models. Choose the plan that elevates your trading strategy.
            </Subtitle>

            <PricingCards>
                {/* Basic Tier Card */}
                <Card planType="basic">
                    <PlanHeader>
                        <PlanName planType="basic">Basic</PlanName>
                        <PlanDescription>Explore the Fundamentals</PlanDescription>
                    </PlanHeader>
                    <Price planType="basic">7-Day Free Trial<span> (No Credit Card Required)</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={16} /> Limited Daily Signals (2/day)</FeatureItem>
                        <FeatureItem included><Check size={16} /> 1 Watchlist (upo 10 assets)</FeatureItem>
                        <FeatureItem included><Check size={16} /> Basic Market Overvews</FeatureItem>
                        <FeatureItem included><Check size={16} /> Email Support (Standard)</FeatureItem>
                    </FeatureList>
                    <ActionButton planType="basic" disabled>Coming Soon</ActionButton>
                </Card>

                {/* Premium Tier Card */}
                <Card planType="premium">
                    <PlanHeader>
                        <PlanTag>Most Popular</PlanTag>
                        <PlanName planType="premium">Premium</PlanName>
                        <PlanDescription>Master Your Trades</PlanDescription>
                    </PlanHeader>
                    <Price planType="premium">$49<span>/month</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={16} /> Comprehensive Daily Signals</FeatureItem>
                        <FeatureItem included><Check size={16} /> Live Market Data (Minute)</FeatureItem>
                        <FeatureItem included><Check size={16} /> Real-Time Price & Insights</FeatureItem>
                        <FeatureItem included><Check size={16} /> Algorithmic Analysis</FeatureItem>
                        <FeatureItem included><Check size={16} /> In-depth Sector Analysis</FeatureItem>
                        <FeatureItem included><Check size={16} /> Priority Email Support</FeatureItem>
                    </FeatureList>
                    <ActionButton planType="premium" disabled>Coming Soon</ActionButton>
                </Card>

                {/* Elite Tier Card */}
                <Card planType="elite">
                    <PlanHeader>
                        <PlanName planType="elite">Elite</PlanName>
                        <PlanDescription>For the Ultimate Market Edge</PlanDescription>
                    </PlanHeader>
                    <Price planType="elite">$125<span>/month</span></Price>
                    <FeatureList>
                        <FeatureItem included><Check size={16} /> All Premium Features +</FeatureItem>
                        <FeatureItem included><Check size={16} /> Ultra-Low Latency Data</FeatureItem>
                        <FeatureItem included><Check size={16} /> API Access</FeatureItem>
                        <FeatureItem included><Check size={16} /> Unlimited Literacy Reports</FeatureItem>
                        <FeatureItem included><Check size={16} /> Custom Research Insights</FeatureItem>
                        <FeatureItem included><Check size={16} /> Personalized Mentorships</FeatureItem>
                        <FeatureItem included><Check size={16} /> 24/7 Dedicated Account Manager</FeatureItem>
                    </FeatureList>
                    <ActionButton planType="elite" disabled>Coming Soon</ActionButton>
                </Card>
            </PricingCards>

            <FooterHashtags>
                <span>#NexusSignalAI</span>
                <span>#AITrading</span>
                <span>#MarketPredictions</span>
                <span>#ComingSoon</span>
            </FooterHashtags>
        </PricingContainer>
    );
};

export default PricingPage;