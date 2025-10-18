import React, { useContext } from 'react';
import styled from 'styled-components';
// The fix is on this line:
import { AuthContext } from '../context/AuthContext';
import { XCircle } from 'lucide-react';

const WatchlistContainer = styled.div`
    width: 100%;
    max-width: 800px;
    background-color: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1.5rem;
    color: #ecf0f1;
`;

const Title = styled.h3`
    margin-top: 0;
    margin-bottom: 1rem;
    border-bottom: 1px solid #374151;
    padding-bottom: 0.5rem;
`;

const WatchlistGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 1rem;
`;

const WatchlistItem = styled.div`
    background-color: #374151;
    padding: 1rem;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const RemoveButton = styled.button`
    background: none;
    border: none;
    color: #95a5a6;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.2s;

    &:hover {
        color: #e74c3c;
    }
`;


const Watchlist = () => {
    const { watchlist, removeFromWatchlist } = useContext(AuthContext);

    if (!watchlist || watchlist.length === 0) {
        return (
            <WatchlistContainer>
                <Title>Your Watchlist</Title>
                <p>Your watchlist is empty. Add stocks from the prediction results.</p>
            </WatchlistContainer>
        )
    }

    return (
        <WatchlistContainer>
            <Title>Your Watchlist</Title>
            <WatchlistGrid>
                {watchlist.map(symbol => (
                    <WatchlistItem key={symbol}>
                        <span>{symbol}</span>
                        <RemoveButton onClick={() => removeFromWatchlist(symbol)}>
                            <XCircle size={18} />
                        </RemoveButton>
                    </WatchlistItem>
                ))}
            </WatchlistGrid>
        </WatchlistContainer>
    );
};

export default Watchlist;

