// client/src/pages/WatchlistPage.js
import React, { useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import Watchlist from '../components/Watchlist'; // Your existing Watchlist component

// Styled components
const PageContainer = styled.div`
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
    color: #e2e8f0;
    background-color: #1a202c;
    min-height: calc(100vh - 60px); // Adjust based on your Navbar height
`;

const Header = styled.h1`
    font-size: 2.5rem;
    color: #667eea;
    margin-bottom: 2rem;
    text-align: center;
`;

const AddSymbolForm = styled.form`
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
`;

const Input = styled.input`
    flex-grow: 1;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #4a5568;
    background-color: #2d3748;
    color: #e2e8f0;
    font-size: 1rem;

    &::placeholder {
        color: #a0aec0;
    }
`;

const Button = styled.button`
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    background-color: #4299e1;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background-color: #3182ce;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const Message = styled.div`
    background-color: ${props => props.type === 'success' ? '#2d3748' : '#c53030'};
    color: ${props => props.type === 'success' ? '#a0aec0' : '#e0e0e0'};
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
    text-align: center;
    max-width: 500px;
    margin: 0 auto 2rem auto;
`;

const WatchlistPage = () => {
    const { addToWatchlist } = useAuth();
    const [newSymbol, setNewSymbol] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(''); // Clear previous messages
        if (!newSymbol.trim()) {
            setMessage('Please enter a symbol.');
            setMessageType('error');
            return;
        }

        const res = await addToWatchlist(newSymbol.trim().toUpperCase());
        if (res.success) {
            setMessage(`'${newSymbol.trim().toUpperCase()}' added to watchlist!`);
            setMessageType('success');
            setNewSymbol(''); // Clear input
        } else {
            setMessage(res.msg || 'Failed to add symbol.');
            setMessageType('error');
        }
    };

    return (
        <PageContainer>
            <Header>Your Watchlist</Header>

            {message && <Message type={messageType}>{message}</Message>}

            <AddSymbolForm onSubmit={handleSubmit}>
                <Input
                    type="text"
                    placeholder="Add stock or crypto symbol (e.g., AAPL, BTC)"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    aria-label="Add new symbol to watchlist"
                />
                <Button type="submit" disabled={!newSymbol.trim()}>Add to Watchlist</Button>
            </AddSymbolForm>

            <Watchlist /> {/* Your existing Watchlist component goes here */}
        </PageContainer>
    );
};

export default WatchlistPage;