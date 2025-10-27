// client/src/components/dashboard/MarketDataSearch.js
import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components'; // Added keyframes import
import Loader from '../Loader';
import { DollarSign, Bitcoin, Search } from 'lucide-react'; // Added Search icon

// Ensure keyframes are defined if used here, or imported from a global style file
const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 20px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

const SearchCard = styled.div` // Changed from Card to SearchCard to be specific
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
    flex-wrap: wrap; /* Allow wrapping on smaller screens */
`;

const SearchInput = styled.input`
    flex: 1;
    padding: 0.8rem 1.2rem;
    border-radius: 8px;
    border: 1px solid #00adef;
    background-color: #0d1a2f;
    color: #e0e0e0;
    font-size: 1rem;
    min-width: 150px; /* ensure input doesn't get too small */

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
    margin-bottom: 1rem; /* Space below the toggle buttons */
`;

// Changed to use $active as a transient prop
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
            const res = await api.get(`/api/market-data/quote/${searchSymbol}?type=${searchType}`);
            if (res.data) {
                setQuoteData(res.data);
            } else {
                setSearchError(`No quote found for ${searchType} symbol: ${searchSymbol}. Please try another symbol.`);
            }
        } catch (err) {
            console.error(`Error fetching ${searchType} quote:`, err.response?.data?.msg || err.message);
            setSearchError(err.response?.data?.msg || `Failed to fetch ${searchType} quote for ${searchSymbol}. Please ensure the symbol is correct and try again.`);
        } finally {
            setSearchLoading(false);
        }
    };

    return (
        <SearchCard>
            <h3><Search size={24} color="#f8fafc" /> Market Data Search</h3>
            <ToggleButtonGroup>
                <ToggleButton
                    $active={searchType === 'stock'} // <--- USE $active HERE
                    onClick={() => setSearchType('stock')}
                >
                    Stock
                </ToggleButton>
                <ToggleButton
                    $active={searchType === 'crypto'} // <--- USE $active HERE
                    onClick={() => setSearchType('crypto')}
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

            {searchLoading && <Loader />}

            {quoteData && !searchLoading && (
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
                        <p>${parseFloat(quoteData.price).toFixed(2)}</p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Change</h4>
                        <p><ChangeText>{parseFloat(quoteData.change).toFixed(2)}</ChangeText></p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Change %</h4>
                        <p><ChangeText>{parseFloat(quoteData.changePercent).toFixed(2)}%</ChangeText></p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>High</h4>
                        <p>${parseFloat(quoteData.high).toFixed(2)}</p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Low</h4>
                        <p>${parseFloat(quoteData.low).toFixed(2)}</p>
                    </QuoteItem>
                    <QuoteItem>
                        <h4>Volume</h4>
                        <p>{quoteData.volume.toLocaleString()}</p>
                    </QuoteItem>
                </QuoteDisplay>
            )}
        </SearchCard>
    );
};

export default MarketDataSearch;