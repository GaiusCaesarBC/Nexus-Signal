import React, { useState, useContext } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import StockChart from '../components/StockChart';
import Watchlist from '../components/Watchlist';
import Copilot from '../components/Copilot';
import NewsWidget from '../components/NewsWidget'; // <-- 1. IMPORT THE NEW COMPONENT
import { Search, TrendingUp, TrendingDown, MinusCircle, PlusCircle } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// ... (Styled Components remain the same) ...

const DashboardContainer = styled.div`
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
`;

const SearchContainer = styled.div`
    display: flex;
    width: 100%;
    max-width: 600px;
    background-color: #2c3e50;
    border-radius: 8px;
    padding: 8px;
`;

const SearchInput = styled.input`
    flex-grow: 1;
    border: none;
    background: none;
    outline: none;
    color: #ecf0f1;
    font-size: 1.2rem;
    padding: 0 1rem;
`;

const SearchButton = styled.button`
    background-color: #3498db;
    border: none;
    border-radius: 5px;
    color: white;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #2980b9;
    }
`;

const ResultCard = styled.div`
    background-color: #2c3e50;
    padding: 2rem;
    border-radius: 8px;
    width: 100%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    border-left: 5px solid ${props => props.borderColor || '#3498db'};
`;

const CardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const Symbol = styled.h2`
    color: #ecf0f1;
    font-size: 2rem;
`;

const AddButton = styled.button`
    background-color: #27ae60;
    border: none;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    &:hover {
        background-color: #229954;
    }
`;

const Signal = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: bold;
    color: ${props => props.color || '#ecf0f1'};
`;

const AnalysisGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
`;

const AnalysisItem = styled.div`
    background-color: #34495e;
    padding: 1rem;
    border-radius: 5px;
    color: #bdc3c7;
    
    strong {
        display: block;
        color: #ecf0f1;
        margin-bottom: 0.3rem;
    }
`;

const ErrorMessage = styled.p`
    color: #e74c3c;
    text-align: center;
    margin-top: 1rem;
`;


const Dashboard = () => {
    const [symbol, setSymbol] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, addToWatchlist, watchlist } = useContext(AuthContext);

    const handleSearch = async () => {
        if (!symbol) return;
        setLoading(true);
        setError('');
        setPrediction(null);
        try {
            const res = await axios.get(`/api/predict/${symbol}`);
            setPrediction(res.data);
        } catch (err) {
            setError(err.response ? err.response.data.msg : 'An error occurred');
        }
        setLoading(false);
    };

    const getSignalStyle = (signal) => {
        switch (signal) {
            case 'Buy':
                return { color: '#2ecc71', icon: <TrendingUp />, borderColor: '#2ecc71' };
            case 'Sell':
                return { color: '#e74c3c', icon: <TrendingDown />, borderColor: '#e74c3c' };
            default:
                return { color: '#f1c40f', icon: <MinusCircle />, borderColor: '#f1c40f' };
        }
    };

    return (
        <DashboardContainer>
            <SearchContainer>
                <SearchInput
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="Enter stock symbol (e.g., AAPL)"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <SearchButton onClick={handleSearch}>
                    <Search size={20} />
                    Get Prediction
                </SearchButton>
            </SearchContainer>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            {loading && (
                <ResultCard>
                    <Skeleton height={40} width={200} />
                    <Skeleton height={30} width={100} />
                    <AnalysisGrid>
                        <Skeleton height={60} />
                        <Skeleton height={60} />
                        <Skeleton height={60} />
                    </AnalysisGrid>
                    <Skeleton height={400} />
                </ResultCard>
            )}

            {prediction && (
                <>
                    <ResultCard borderColor={getSignalStyle(prediction.signal).borderColor}>
                        <CardHeader>
                            <Symbol>{prediction.symbol}</Symbol>
                            {user && Array.isArray(watchlist) && !watchlist.includes(prediction.symbol) && (
                                <AddButton onClick={() => addToWatchlist(prediction.symbol)}>
                                    <PlusCircle size={18} />
                                    Add to Watchlist
                                </AddButton>
                            )}
                        </CardHeader>
                        <Signal color={getSignalStyle(prediction.signal).color}>
                            {getSignalStyle(prediction.signal).icon}
                            {prediction.signal} (Confidence: {prediction.confidence.toFixed(2)}%)
                        </Signal>
                        <AnalysisGrid>
                            <AnalysisItem><strong>SMA</strong> {prediction.analysis.sma}</AnalysisItem>
                            <AnalysisItem><strong>RSI</strong> {prediction.analysis.rsi}</AnalysisItem>
                            <AnalysisItem><strong>MACD</strong> {prediction.analysis.macd}</AnalysisItem>
                        </AnalysisGrid>

                        {prediction.historicalData && prediction.historicalData.length > 0 && (
                            <StockChart data={prediction.historicalData} />
                        )}
                    </ResultCard>

                    {/* --- 2. ADD THE NEWS WIDGET HERE --- */}
                    {/* It will only render if a prediction is available */}
                    <NewsWidget symbol={prediction.symbol} />
                </>
            )}

            {user && <Watchlist />}
            {user && <Copilot />}

        </DashboardContainer>
    );
};

export default Dashboard;

