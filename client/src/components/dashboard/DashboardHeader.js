// client/src/components/dashboard/DashboardHeader.js
import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const HeaderSection = styled.div`
    text-align: center;
    margin-bottom: 2rem;
    h1 {
        font-size: 3.8rem;
        color: #00adef; /* Nexus blue */
        margin-bottom: 0.5rem;
        letter-spacing: -1px;
        text-shadow: 0 0 15px rgba(0, 173, 237, 0.6);
        span {
            color: #f8fafc;
        }
    }
    p {
        font-size: 1.3rem;
        color: #94a3b8;
        max-width: 800px;
        margin: 0 auto;
        line-height: 1.5;
    }
    animation: ${fadeIn} 1s ease-out forwards; // Keep animation here
`;

const DashboardHeader = ({ username }) => {
    return (
        <HeaderSection>
            <h1>Welcome, <span>{username ? username : 'Trader'}!</span></h1>
            <p>Your comprehensive control center for AI-powered market intelligence. Stay ahead with real-time data, predictive analytics, and personalized insights.</p>
        </HeaderSection>
    );
};

export default DashboardHeader;