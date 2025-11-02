import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import RealTimeChart from './RealTimeChart';
import axios from 'axios'; // Keep axios import for isCancel check, but use 'api' from context for requests
import { useAuth } from '../context/AuthContext';

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
    // FIX HERE: Destructure `api` (the configured axios instance)
    const { token, isAuthenticated, api } = useAuth(); // <--- MODIFIED LINE: Added `api`

    const [chartData, setChartData] = useState([]);
    const [selectedRange, setSelectedRange] = useState('1M'); // Default range
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchController = useRef(null);

    useEffect(() => {
        console.log("StockDataDisplay - Received Symbol prop:", symbol);
        console.log("StockDataDisplay - IsAuthenticated from useAuth:", isAuthenticated);
        console.log("StockDataDisplay - Raw token from useAuth:", token ? 'present' : 'absent');
        console.log("StockDataDisplay - API client from useAuth:", api ? 'present' : 'absent'); // <--- Added log for api

        if (!isAuthenticated || !token || !symbol || !api) { // <--- MODIFIED CONDITION: Check for `api`
            setError('Authentication required, API client not initialized, or no symbol provided.');
            setChartData([]);
            setLoading(false);
            return;
        }

        const fetchStockData = async () => {
            if (fetchController.current) {
                fetchController.current.abort();
            }
            fetchController.current = new AbortController();
            const { signal } = fetchController.current;

            setLoading(true);
            setError(null);
            setChartData([]);

            try {
                let intervalParam = '';
                if (selectedRange === '1D') {
                    intervalParam = '5min';
                } else if (selectedRange === '5D') {
                    intervalParam = '60min';
                }

                // Construct params object, only include interval if it has a value
                const requestParams = {
                    range: selectedRange,
                };
                if (intervalParam) {
                    requestParams.interval = intervalParam;
                }

                // FIX HERE: Use the `api` instance from context and adjust URL path
                const response = await api.get( // <--- MODIFIED LINE: Used `api.get`
                    `/stocks/historical/${symbol}`, // <--- MODIFIED LINE: Removed leading `/api/` and `process.env.REACT_APP_API_URL`
                    {
                        params: requestParams, // <--- MODIFIED LINE: Use the constructed params object
                        // Headers are already set by the `api` instance from AuthContext if configured to include x-auth-token
                        // However, explicitly setting it here doesn't hurt and ensures it's always there.
                        headers: {
                            'x-auth-token': token,
                        },
                        signal: signal,
                    }
                );

                // Assuming your backend response for /api/stocks/historical/:symbol
                // returns data directly, or within a 'historicalData' key.
                // The PredictPage.js expects it in 'historicalData'. Let's make this consistent.
                const fetchedData = response.data.historicalData || response.data; // <--- Handle both direct array or nested historicalData

                setChartData(fetchedData);
                if (fetchedData.length === 0) {
                    setError(`No historical data found for ${symbol} for the ${selectedRange} range.`);
                }
            } catch (err) {
                if (axios.isCancel(err)) {
                    console.log('Fetch aborted:', err.message);
                    return;
                }
                console.error('Error fetching stock data:', err);
                if (err.response && err.response.data && err.response.data.msg) {
                    setError(`Error: ${err.response.data.msg}`);
                } else if (err.message) {
                    setError(`Network error or API issue: ${err.message}. Please try again.`);
                } else {
                    setError('An unknown error occurred while fetching stock data.');
                }
            } finally {
                setLoading(false);
                fetchController.current = null;
            }
        };

        fetchStockData();

        return () => {
            if (fetchController.current) {
                fetchController.current.abort();
            }
        };
    }, [symbol, selectedRange, isAuthenticated, token, api]); // <--- MODIFIED DEPENDENCIES: Added `api`

    return (
        <StockDataContainer>
            <Header>{symbol.toUpperCase()} Stock Chart</Header>
            <RangeButtonContainer>
                {['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'].map((range) => ( // Added 3M and 5Y
                    <RangeButton
                        key={range}
                        active={selectedRange === range}
                        onClick={() => setSelectedRange(range)}
                        disabled={loading}
                    >
                        {range}
                    </RangeButton>
                ))}
            </RangeButtonContainer>

            {loading && (
                <LoadingContainer>
                    Loading {symbol.toUpperCase()} data for {selectedRange} range...
                </LoadingContainer>
            )}

            {error && !loading && (
                <ErrorContainer>
                    {error}
                </ErrorContainer>
            )}

            {!loading && !error && chartData.length > 0 && (
                <RealTimeChart data={chartData} />
            )}

            {!loading && !error && chartData.length === 0 && (
                <LoadingContainer>
                    No chart data available for {symbol.toUpperCase()} for the {selectedRange} range.
                    This might happen for very new symbols or specific ranges.
                </LoadingContainer>
            )}
        </StockDataContainer>
    );
};
export default StockDataDisplay;