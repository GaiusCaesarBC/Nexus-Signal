// client/src/components/Watchlist.js

import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext'; // Correct import for useAuth
import { X, Loader2 } from 'lucide-react'; // Example icons for remove and loading

// --- Styled Components (Adjust these to match your existing design system) ---

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;

const WatchlistContainer = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    color: #e0e6ed;
    animation: ${fadeIn} 0.5s ease-out forwards;
    display: flex;
    flex-direction: column;
`;

const WatchlistHeader = styled.h3`
    font-size: 1.8rem;
    color: #00adef;
    margin-bottom: 1.2rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(0, 173, 237, 0.3);
    text-align: center;
`;

const WatchlistList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px; /* Limit height for scrollability */
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #00adef #1a273b;

    &::-webkit-scrollbar {
        width: 8px;
    }
    &::-webkit-scrollbar-track {
        background: #1a273b;
        border-radius: 10px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #00adef;
        border-radius: 10px;
        border: 2px solid #1a273b;
    }
`;

const WatchlistItem = styled.li`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 0;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
    font-size: 1.1rem;

    &:last-child {
        border-bottom: none;
    }
`;

const SymbolName = styled.span`
    font-weight: bold;
    color: #f8fafc;
`;

const RemoveButton = styled.button`
    background: none;
    border: none;
    color: #ff6b6b; /* Red color for delete action */
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    transition: color 0.2s ease, transform 0.2s ease;

    &:hover {
        color: #e04a4a;
        transform: scale(1.1);
    }
    &:disabled {
        color: #777;
        cursor: not-allowed;
    }
`;

const Message = styled.p`
    text-align: center;
    font-size: 1.1rem;
    color: #b0c4de;
    padding: 1rem;
`;

const ErrorMessage = styled(Message)`
    color: #ff6b6b;
    font-weight: bold;
`;

const LoaderWrapper = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    color: #00adef;
`;

const RotatingLoader = styled(Loader2)`
    animation: spin 1s linear infinite;
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;

// --- Watchlist Component ---
const Watchlist = () => {
    // Destructure what's needed from useAuth
    const { api, isAuthenticated, loading: authLoading } = useAuth();

    // State for the watchlist data, loading status, and errors
    const [watchlist, setWatchlist] = useState([]);
    const [watchlistLoading, setWatchlistLoading] = useState(true);
    const [watchlistError, setWatchlistError] = useState(null);

    // Callback to fetch the user's watchlist from the backend
    const fetchWatchlist = useCallback(async () => {
        // Only fetch if authenticated and API client is ready
        if (!isAuthenticated || !api) {
            setWatchlist([]);
            setWatchlistLoading(false);
            // Optionally set an error if not authenticated/api not ready but component loaded
            if (!isAuthenticated && !authLoading) {
                setWatchlistError("Please log in to view your watchlist.");
            }
            return;
        }

        setWatchlistLoading(true);
        setWatchlistError(null); // Clear previous errors
        try {
            // Assuming your backend has a GET /api/watchlist route
            const res = await api.get('/api/watchlist');
            if (Array.isArray(res.data)) {
                setWatchlist(res.data);
            } else {
                // Handle cases where backend might return non-array or empty object
                setWatchlist([]);
                console.warn("Watchlist API returned non-array data:", res.data);
            }
        } catch (error) {
            console.error('Error fetching watchlist:', error.response?.data?.msg || error.message);
            setWatchlistError('Failed to load watchlist. Please try again.');
            setWatchlist([]); // Clear watchlist on error
        } finally {
            setWatchlistLoading(false);
        }
    }, [isAuthenticated, api, authLoading]); // Dependencies for useCallback

    // Effect to trigger fetching the watchlist when authentication status or API client changes
    useEffect(() => {
        if (!authLoading) { // Ensure authentication status has been determined
            fetchWatchlist();
        }
    }, [authLoading, fetchWatchlist]); // Re-run when authLoading or fetchWatchlist changes

    // Callback to remove a stock from the watchlist
    const removeFromWatchlist = useCallback(async (symbol) => {
        if (!isAuthenticated || !api) {
            console.error("Not authenticated or API client not ready to remove from watchlist.");
            return;
        }
        try {
            // Assuming your backend has a DELETE /api/watchlist/:symbol route
            await api.delete(`/api/watchlist/${symbol}`);
            // Update local state by filtering out the removed symbol
            setWatchlist(prevWatchlist => prevWatchlist.filter(item => item.symbol !== symbol));
            console.log(`${symbol} removed from watchlist.`);
        } catch (error) {
            console.error('Error removing from watchlist:', error.response?.data?.msg || error.message);
            // Optionally set an error state or show a toast notification here
        }
    }, [isAuthenticated, api]); // Dependencies for useCallback

    // --- Render Logic ---
    return (
        <WatchlistContainer>
            <WatchlistHeader>My Watchlist</WatchlistHeader>

            {watchlistLoading ? (
                <LoaderWrapper>
                    <RotatingLoader size={24} /> <Message>Loading Watchlist...</Message>
                </LoaderWrapper>
            ) : watchlistError ? (
                <ErrorMessage>{watchlistError}</ErrorMessage>
            ) : watchlist.length === 0 ? (
                <Message>Your watchlist is empty. Add some stocks!</Message>
            ) : (
                <WatchlistList>
                    {watchlist.map((item, index) => (
                        <WatchlistItem key={item._id || index}> {/* Use _id if available from MongoDB, otherwise index */}
                            <SymbolName>{item.symbol.toUpperCase()}</SymbolName>
                            <RemoveButton
                                onClick={() => removeFromWatchlist(item.symbol)}
                                disabled={!isAuthenticated} // Disable if not authenticated
                            >
                                <X size={16} /> Remove
                            </RemoveButton>
                        </WatchlistItem>
                    ))}
                </WatchlistList>
            )}
        </WatchlistContainer>
    );
};

export default Watchlist;