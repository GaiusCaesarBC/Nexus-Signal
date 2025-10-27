// client/src/components/dashboard/DashboardCard.js
import React from 'react';
import styled, { keyframes } from 'styled-components';

// Keyframes for subtle animations
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;

const CardWrapper = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 173, 237, 0.2);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.8rem;
    animation: ${fadeIn} 0.5s ease-out forwards;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

    &:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    }
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
`;

const CardIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background-color: rgba(0, 173, 237, 0.15); /* Light blue background for icon */
    color: #00adef; /* Default icon color */
`;

const CardTitle = styled.h4`
    font-size: 1.25rem;
    color: #f8fafc;
    margin: 0;
`;

const CardValue = styled.p`
    font-size: 1.8rem;
    font-weight: bold;
    color: #e0e0e0;
    margin: 0;
`;

const CardChange = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: ${props => props.isPositive ? '#2ecc71' : '#e74c3c'}; /* Green for positive, red for negative */
`;

const ChangeArrow = styled.span`
    font-size: 1.2rem;
    line-height: 1;
`;

const DashboardCard = ({ title, value, change, changePercent, icon }) => {
    // --- START OF CHANGES YOU NEED TO MAKE ---

    // 1. Convert change and changePercent to numbers safely
    // If they are strings (like "N/A" or a numeric string), parseFloat will convert.
    // If they are undefined/null, parseFloat will yield NaN.
    const numericChange = parseFloat(change);
    const numericChangePercent = parseFloat(changePercent);

    // 2. Check if the parsed values are actual valid numbers
    const isValidChange = !isNaN(numericChange);
    const isValidChangePercent = !isNaN(numericChangePercent);

    // 3. Determine if the change is positive based on the numeric value
    const isPositive = isValidChange && numericChange > 0;

    // 4. Format the change values only if they are valid numbers
    const formattedChange = isValidChange ? numericChange.toFixed(2) : (change || 'N/A');
    const formattedPercent = isValidChangePercent ? numericChangePercent.toFixed(2) : (changePercent || 'N/A');

    // --- END OF CHANGES YOU NEED TO MAKE ---

    return (
        <CardWrapper>
            <CardHeader>
                <CardIcon>{icon}</CardIcon>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardValue>{value}</CardValue>
            {/* 5. Conditionally render the change section more robustly */}
            {/* Show this section if either change or changePercent is a valid number,
                or if the original 'change' prop was a non-"N/A" string (e.g., "$1.23") */}
            {(isValidChange || isValidChangePercent || (typeof change === 'string' && change !== 'N/A')) && (
                <CardChange isPositive={isPositive}>
                    {/* Only show the arrow if we have a valid numeric change */}
                    {isValidChange && <ChangeArrow>{isPositive ? '▲' : '▼'}</ChangeArrow>}
                    <span>{formattedChange} ({formattedPercent}%)</span>
                </CardChange>
            )}
        </CardWrapper>
    );
};

export default DashboardCard;