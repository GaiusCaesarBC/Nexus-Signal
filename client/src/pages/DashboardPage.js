// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader'; // Assuming Loader is needed here too

const DashboardContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background-color: transparent;
    color: #e0e0e0;
`;

const DashboardBox = styled.div`
    background-color: #2c3e50;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    padding: 2.5rem;
    max-width: 900px;
    width: 100%;
    margin-bottom: 2rem;
    text-align: center;
    display: flex; /* Make it a flex container */
    flex-direction: column; /* Stack items vertically */
    align-items: center; /* Center items horizontally within PredictBox */
`;

const WelcomeMessage = styled.h2`
    color: #4CAF50; /* Green for welcome message */
    margin-bottom: 1.5rem;
`;

const InfoText = styled.p`
    font-size: 1.1rem;
    margin-bottom: 2rem;
`;

// --- New Styled Components for Stock Search ---
const SearchSection = styled.div`
    width: 100%;
    max-width: 500px;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1); /* Separator */
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const InputGroup = styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 400px;
`;

const Input = styled.input`
    padding: 0.8rem 1rem;
    border: 1px solid #3f51b5;
    border-radius: 4px;
    font-size: 1rem;
    flex-grow: 1;
    margin-right: 0.5rem;
    background-color: #34495e;
    color: #e0e0e0;

    &:focus {
        outline: none;
        border-color: #5d74e3;
        box-shadow: 0 0 0 3px rgba(93, 116, 227, 0.5);
    }
`;

const Button = styled.button`
    padding: 0.8rem 1.5rem;
    background-color: #3f51b5;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #5d74e3;
    }

    &:disabled {
        background-color: #5a6a7c;
        cursor: not-allowed;
    }
`;

const StockQuoteDisplay = styled.div`
    margin-top: 1.5rem;
    text-align: left;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
    max-width: 400px;

    h3 {
        color: #e0e0e0;
        margin-bottom: 1rem;
    }
    p {
        margin-bottom: 0.5rem;
        span {
            font-weight: bold;
            color: #74ccf4; /* Light blue for labels */
        }
        &.positive {
            color: #4CAF50; /* Green for positive change */
        }
        &.negative {
            color: #f44336; /* Red for negative change */
        }
    }
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1rem;
    font-size: 0.95rem;
`;
// --- End New Styled Components ---


const DashboardPage = () => {
    const { user, api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [searchSymbol, setSearchSymbol] = useState('');
    const [stockQuote, setStockQuote] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        setSearchError(null);
        setStockQuote(null);

        if (!searchSymbol) {
            setSearchError('Please enter a stock symbol.');
            return;
        }

        setSearchLoading(true);
        try {
            console.log(`Fetching quote for ${searchSymbol} from ${api.defaults.baseURL}/api/market-data/quote/${searchSymbol}`);
            const res = await api.get(`/api/market-data/quote/${searchSymbol}`);
            console.log('Stock Quote API response:', res.data);

            if (res.data && res.data['Global Quote']) {
                const rawQuote = res.data['Global Quote'];
                // Clean up Alpha Vantage keys for easier display
                const cleanedQuote = {
                    symbol: rawQuote['01. symbol'],
                    open: parseFloat(rawQuote['02. open']).toFixed(2),
                    high: parseFloat(rawQuote['03. high']).toFixed(2),
                    low: parseFloat(rawQuote['04. low']).toFixed(2),
                    price: parseFloat(rawQuote['05. price']).toFixed(2),
                    volume: parseInt(rawQuote['06. volume']).toLocaleString(),
                    latestTradingDay: rawQuote['07. latest trading day'],
                    previousClose: parseFloat(rawQuote['08. previous close']).toFixed(2),
                    change: parseFloat(rawQuote['09. change']).toFixed(2),
                    changePercent: parseFloat(rawQuote['10. change percent']).toFixed(2),
                };
                setStockQuote(cleanedQuote);
            } else {
                setSearchError(`No quote found for symbol: ${searchSymbol}. Please try another symbol.`);
            }

        } catch (err) {
            console.error('Error fetching stock quote:', err.response?.data?.msg || err.message);
            setSearchError(err.response?.data?.msg || `Failed to fetch quote for ${searchSymbol}. Please try again.`);
        } finally {
            setSearchLoading(false);
        }
    };


    if (authLoading) {
        return <Loader />;
    }

    if (!isAuthenticated) {
        return (
            <DashboardContainer>
                <DashboardBox>
                    <ErrorMessage>You need to be logged in to view this page.</ErrorMessage>
                    <Button onClick={() => navigate('/login')}>Login Now</Button>
                </DashboardBox>
            </DashboardContainer>
        );
    }

    // Determine change class for styling
    const getChangeClass = (change) => {
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return ''; // No specific class for zero change
    };


    return (
        <DashboardContainer>
            <DashboardBox>
                <WelcomeMessage>Welcome, {user ? user.username : 'User'}!</WelcomeMessage>
                <InfoText>Your personalized stock analysis platform.</InfoText>
                <InfoText>Use the navigation to explore predictions or search for real-time stock data below.</InfoText>

                {/* --- Stock Search Section --- */}
                <SearchSection>
                    <h3>Search Real-time Stock Quote</h3>
                    <InputGroup>
                        <Input
                            type="text"
                            placeholder="Enter stock symbol (e.g., MSFT)"
                            value={searchSymbol}
                            onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearchSubmit(e);
                                }
                            }}
                        />
                        <Button onClick={handleSearchSubmit} disabled={searchLoading}>
                            {searchLoading ? 'Searching...' : 'Search'}
                        </Button>
                    </InputGroup>

                    {searchError && <ErrorMessage>{searchError}</ErrorMessage>}
                    {searchLoading && <Loader message="Fetching stock quote..." />}

                    {stockQuote && (
                        <StockQuoteDisplay>
                            <h3>{stockQuote.symbol}</h3>
                            <p><span>Price:</span> ${stockQuote.price}</p>
                            <p><span>Open:</span> ${stockQuote.open}</p>
                            <p><span>High:</span> ${stockQuote.high}</p>
                            <p><span>Low:</span> ${stockQuote.low}</p>
                            <p><span>Previous Close:</span> ${stockQuote.previousClose}</p>
                            <p className={getChangeClass(stockQuote.change)}>
                                <span>Change:</span> ${stockQuote.change} ({stockQuote.changePercent}%)
                            </p>
                            <p><span>Volume:</span> {stockQuote.volume}</p>
                            <p><span>Last Trading Day:</span> {stockQuote.latestTradingDay}</p>
                        </StockQuoteDisplay>
                    )}
                </SearchSection>
                {/* --- End Stock Search Section --- */}

                {/* You can add more dashboard content here later */}

            </DashboardBox>
        </DashboardContainer>
    );
};

export default DashboardPage;