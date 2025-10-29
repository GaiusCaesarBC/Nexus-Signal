import React from 'react';
import { useParams } from 'react-router-dom'; // To get symbol from URL
import styled from 'styled-components';
import StockDataDisplay from '../components/StockDataDisplay'; // Your chart component wrapper

// Basic styled components for layout
const PageContainer = styled.div`
    padding: 2rem;
    background-color: #0d1a2f; // Main background for the page
    min-height: 100vh;
    color: #e0e6ed;
`;

const PageHeader = styled.h1`
    font-size: 2.5rem;
    color: #00adef;
    margin-bottom: 2rem;
    text-align: center;
    text-shadow: 0 0 10px rgba(0, 173, 237, 0.5);
`;

const StockPage = () => {
    const { symbol } = useParams();
    console.log("StockPage - Symbol from URL:", symbol); // <--- ADD THIS LINE

    if (!symbol) {
        return (
            <PageContainer>
                <PageHeader>Stock Details</PageHeader>
                <p style={{ textAlign: 'center', color: '#ef4444' }}>No stock symbol provided in URL.</p>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PageHeader>{symbol.toUpperCase()} Stock Overview</PageHeader>
            <StockDataDisplay symbol={symbol.toUpperCase()} />
            <div style={{ marginTop: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                <p>Additional details for {symbol.toUpperCase()} would go here.</p>
            </div>
        </PageContainer>
    );
};

export default StockPage;