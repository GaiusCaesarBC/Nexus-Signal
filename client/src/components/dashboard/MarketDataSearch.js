// client/src/components/dashboard/MarketDataSearch.js - REFINED
import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import Loader from '../Loader';
import { Search } from 'lucide-react'; // Only Search icon is directly used in JSX or logic here

const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 20px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

const SearchCard = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    h3 {
        font-size: 1.6rem;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.5rem;
    }
`;

const SearchForm = styled.form`
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
`;

const SearchInput = styled.input`
    flex: 1;
    padding: 0.8rem 1.2rem;
    border-radius: 8px;
    border: 1px solid #00adef;
    background-color: #0d1a2f;
    color: #e0e0e0;
    font-size: 1rem;
    min-width: 150px;

    &:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 173, 237, 0.5);
    }
`;

const SearchButton = styled.button`
    padding: 0.8rem 1.5rem;
    background-color: #00adef;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    transition: background-color 0.3s ease, transform 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover {
        background-color: #008cc7;
        transform: translateY(-2px);
    }
    &:active {
        transform: translateY(0);
    }
    &:disabled {
        background-color: #64748b;
        cursor: not-allowed;
    }
`;

const ToggleButtonGroup = styled.div`
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #00adef;
    margin-bottom: 1rem;
`;

const ToggleButton = styled.button`
    padding: 0.8rem 1.5rem;
    background-color: ${props => (props.$active ? '#00adef' : '#1e293b')};
    color: ${props => (props.$active ? '#fff' : '#94a3b8')};
    border: none;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    transition: all 0.2s ease;
    flex: 1;

    &:hover {
        background-color: ${props => (props.$active ? '#008cc7' : '#2c3e50')};
        color: #fff;
    }
`;

const QuoteDisplay = styled.div`
    background-color: #1a273b;
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid rgba(0, 173, 237, 0.3);
    margin-top: 1.5rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
`;

const QuoteItem = styled.div`
    h4 {
        color: #94a3b8;
        font-size: 0.9rem;
        margin-bottom: 0.4rem;
    }
    p {
        font-size: 1.3rem;
        font-weight: bold;
        color: #e0e0e0;
        span {
            font-size: 0.9rem;
            font-weight: normal;
            margin-left: 0.5rem;
        }
    }
`;

const ChangeText = styled.span`
    color: ${props => {
        const value = parseFloat(props.children);
        if (isNaN(value)) return '#e0e0e0';
        return value > 0 ? '#4CAF50' : value < 0 ? '#FF6B6B' : '#e0e0e0';
    }};
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    animation: ${pulseGlow} 1.5s infinite alternate;
`;

const MarketDataSearch = ({ api }) => {
    const [searchSymbol, setSearchSymbol] = useState('');
    const [searchType, setSearchType] = useState('stock'); // 'stock' or 'crypto'
    const [quoteData, setQuoteData] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        setSearchError(null);
        setQuoteData(null); // Reset all quote data

        if (!searchSymbol) {
            setSearchError(`Please enter a ${searchType} symbol.`);
            return;
        }

        setSearchLoading(true);
        try {
            // CORRECTED: Removed the leading /api as AuthContext's api instance already includes it in baseURL
            const res = await api.get(`/market-data/quote/${searchSymbol}?type=${searchType}`);
            if (res.data) {
                // Ensure number formatting is applied to relevant fields
                const formattedData = {
                    ...res.data,
                    price: parseFloat(res.data.price).toFixed(2),
                    change: parseFloat(res.data.change).toFixed(2),
                    changePercent: parseFloat(res.data.changePercent).toFixed(2),
                    high: parseFloat(res.data.high).toFixed(2),
                    low: parseFloat(res.data.low).toFixed(2),
                    volume: parseInt(res.data.volume).toLocaleString(), // Format volume for readability
                };
                setQuoteData(formattedData);
            } else {
                setSearchError(`No quote found for ${searchType} symbol: ${searchSymbol.toUpperCase()}. Please try another symbol.`);
            }
        } catch (err) {
            console.error(`Error fetching ${searchType} quote:`, err.response?.data?.msg || err.message);
            setSearchError(err.response?.data?.msg || `Failed to fetch ${searchType} quote for ${searchSymbol.toUpperCase()}. Please ensure the symbol is correct and try again.`);
        } finally {
            setSearchLoading(false);
        }
    };

    return (
        <SearchCard>
            <h3><Search size={24} color="#f8fafc" /> Market Data Search</h3>
            <ToggleButtonGroup>
                <ToggleButton
                    $active={searchType === 'stock'}
                    onClick={() => {
                        setSearchType('stock');
                        setSearchError(null); // Clear error on type change
                        setQuoteData(null); // Clear previous data
                    }}
                >
                    Stock
                </ToggleButton>
                <ToggleButton
                    $active={searchType === 'crypto'}
                    onClick={() => {
                        setSearchType('crypto');
                        setSearchError(null); // Clear error on type change
                        setQuoteData(null); // Clear previous data
                    }}
                >
                    Crypto
                </ToggleButton>
            </ToggleButtonGroup>

            <SearchForm onSubmit={handleSearchSubmit}>
                <SearchInput
                    type="text"
                    placeholder={`Enter ${searchType} symbol (e.g., AAPL or BTC)`}
                    value={searchSymbol}
                    onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                    required
                />
                <SearchButton type="submit" disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                </SearchButton>
            </SearchForm>

            {searchError && <ErrorMessage>{searchError}</ErrorMessage>}

            {/* Conditional rendering for Loader and QuoteDisplay to ensure only one shows at a time */}
            {searchLoading && <Loader />}

            {/* Only show quoteData if not loading and no error */}
            {quoteData && !searchLoading && !searchError && (
                <QuoteDisplay>
                    <QuoteItem>
                        <h4>Symbol</h4>
                        <p>{quoteData.symbol}</p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Name</h4>
                        <p>{quoteData.name}</p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Price</h4>
                        <p>${quoteData.price}</p> {/* Already formatted in state */}
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Change</h4>
                        <p><ChangeText>{quoteData.change}</ChangeText></p> {/* Already formatted in state */}
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Change %</h4>
                        <p><ChangeText>{quoteData.changePercent}%</ChangeText></p> {/* Already formatted in state */}
                    </QuoteItem>
                    <QuoteItem>
                        <h4>High</h4>
                        <p>${quoteData.high}</p> {/* Already formatted in state */}
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Low</h4>
                        <p>${quoteData.low}</p> {/* Already formatted in state */}
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Volume</h4>
                        <p>{quoteData.volume}</p> {/* Already formatted in state */}
                    </QuoteItem>
                </QuoteDisplay>
            )}
        </SearchCard>
    );
};

export default MarketDataSearch;