import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import RealTimeChart from './RealTimeChart';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Make sure this path is correct

const StockDataContainer = styled.div`
    background-color: #1a273b;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    padding: 1.5rem;
    margin: 2rem auto;
    max-width: 1200px;
    color: #e0e6ed;
`;

const Header = styled.h2`
    color: #00adef;
    text-align: center;
    margin-bottom: 1.5rem;
    font-size: 2rem;
    text-shadow: 0 0 8px rgba(0, 173, 237, 0.4);
`;

const RangeButtonContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap; // Allow buttons to wrap on smaller screens
`;

const RangeButton = styled.button`
    background-color: ${({ active }) => (active ? '#00adef' : '#344a66')};
    color: white;
    border: none;
    border-radius: 5px;
    padding: 0.6rem 1.2rem;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.1s ease;

    &:hover {
        background-color: ${({ active }) => (active ? '#008bb3' : '#4a627a')};
        transform: translateY(-1px);
    }
    &:active {
        transform: translateY(0);
    }
`;

// --- NEW STYLED COMPONENTS for Loading/Error ---
const LoadingContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px; /* Or a suitable height */
    font-size: 1.2rem;
    color: #b0c4de;
`;

const ErrorContainer = styled.div`
    background-color: #331f24; // Dark red background
    border: 1px solid #ef4444; // Red border
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1.5rem;
    text-align: center;
    color: #ef4444; // Red text
    font-weight: bold;
`;

const StockDataDisplay = ({ symbol }) => {
    // FIX HERE: Destructure `token` and `user` (for profile info if needed elsewhere)
    // You have `isAuthenticated` also available, which might be more robust for the check.
    const { token, isAuthenticated, user } = useAuth(); // <--- MODIFIED LINE

    const [chartData, setChartData] = useState([]);
    const [selectedRange, setSelectedRange] = useState('1M'); // Default range
    const [loading, setLoading] = useState(false); // <--- NEW: Loading state
    const [error, setError] = useState(null);       // <--- NEW: Error state

    // Ref to prevent multiple fetches on quick range changes
    const fetchController = useRef(null);

    // This is the ONE and ONLY useEffect for fetching data and logging
    useEffect(() => {
        console.log("StockDataDisplay - Received Symbol prop:", symbol);
        console.log("StockDataDisplay - IsAuthenticated from useAuth:", isAuthenticated); // <--- Added log
        console.log("StockDataDisplay - Raw token from useAuth:", token ? 'present' : 'absent'); // <--- Added log for raw token
        console.log("StockDataDisplay - User object (profile data) from useAuth:", user); // <--- Log for profile user object

        // FIX HERE: Use `isAuthenticated` and `token` directly, not `user.token`
        if (!isAuthenticated || !token || !symbol) { // <--- MODIFIED CONDITION
            setError('Authentication required or no symbol provided.');
            setChartData([]);
            setLoading(false); // Ensure loading is false if there's an immediate error
            return;
        }

        const fetchStockData = async () => {
            // Cancel previous request if still pending
            if (fetchController.current) {
                fetchController.current.abort();
            }
            fetchController.current = new AbortController();
            const { signal } = fetchController.current;

            setLoading(true); // <--- Set loading true
            setError(null);   // <--- Clear any previous error
            setChartData([]); // <--- Clear previous data while loading

            try {
                // Determine interval based on range (you might refine this more)
                let intervalParam = '';
                if (selectedRange === '1D') {
                    intervalParam = '5min';
                } else if (selectedRange === '5D') {
                    intervalParam = '60min'; // Use 60 min interval for 5 days
                }
                // For other ranges (1M, 6M, 1Y, YTD, MAX), no interval param is needed for daily data

                const response = await axios.get(
                    `${process.env.REACT_APP_API_URL}/api/stocks/historical/${symbol}`,
                    {
                        params: {
                            range: selectedRange,
                            interval: intervalParam, // Only send if relevant
                        },
                        headers: {
                           'x-auth-token': token, // <--- MODIFIED LINE: Use the raw `token`
                        },
                        signal: signal, // Attach abort signal
                    }
                );
                setChartData(response.data);
                if (response.data.length === 0) {
                      setError(`No historical data found for ${symbol} for the ${selectedRange} range.`);
                }
            } catch (err) {
                if (axios.isCancel(err)) {
                    console.log('Fetch aborted:', err.message);
                    return; // Don't set error if request was cancelled
                }
                console.error('Error fetching stock data:', err);
                // More specific error messages based on backend response
                if (err.response && err.response.data && err.response.data.msg) {
                    setError(`Error: ${err.response.data.msg}`);
                } else if (err.message) {
                    setError(`Network error or API issue: ${err.message}. Please try again.`);
                } else {
                    setError('An unknown error occurred while fetching stock data.');
                }
            } finally {
                setLoading(false); // <--- Set loading false
                fetchController.current = null; // Clear the controller
            }
        };

        fetchStockData();

        // Cleanup function for unmounting
        return () => {
            if (fetchController.current) {
                fetchController.current.abort();
            }
        };
    }, [symbol, selectedRange, isAuthenticated, token, user]); // <--- MODIFIED DEPENDENCIES: Added isAuthenticated, token, user

    return (
        <StockDataContainer>
            <Header>{symbol.toUpperCase()} Stock Chart</Header>
            <RangeButtonContainer>
                {['1D', '5D', '1M', '6M', '1Y', 'YTD', 'MAX'].map((range) => (
                    <RangeButton
                        key={range}
                        active={selectedRange === range}
                        onClick={() => setSelectedRange(range)}
                        disabled={loading} // <--- Disable buttons while loading
                    >
                        {range}
                    </RangeButton>
                ))}
            </RangeButtonContainer>

            {/* --- NEW: Conditional Rendering for Loading/Error/Chart --- */}
            {loading && (
                <LoadingContainer>
                    Loading {symbol.toUpperCase()} data for {selectedRange} range...
                </LoadingContainer>
            )}

            {error && !loading && ( // Show error if present and not currently loading
                <ErrorContainer>
                    {error}
                </ErrorContainer>
            )}

            {!loading && !error && chartData.length > 0 && ( // Only show chart if not loading, no error, and data exists
                <RealTimeChart data={chartData} />
            )}

            {!loading && !error && chartData.length === 0 && ( // Case for no data found, no error, not loading
                   <LoadingContainer>
                       No chart data available for {symbol.toUpperCase()} for the {selectedRange} range.
                       This might happen for very new symbols or specific ranges.
                   </LoadingContainer>
            )}
            {/* --- END NEW CONDITIONAL RENDERING --- */}

        </StockDataContainer>
    );
};
export default StockDataDisplay;