// client/src/pages/PredictPage.js
import React, { useState, useContext, useEffect } from 'react';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react'; // Assuming lucide-react is installed

const PredictContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height)); // Adjust based on your navbar height
    background-color: #1a1a2e; // Dark background
    color: #e0e0e0; // Light text
`;

const PredictBox = styled.div`
    background-color: #2c3e50;
    padding: 2.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const Title = styled.h2`
    color: #ecf0f1;
    text-align: center;
    margin-bottom: 1rem;
    font-size: 2.5rem;
    font-weight: 700;
`;

const InputGroup = styled.div`
    display: flex;
    gap: 0.5rem;
`;

const Input = styled.input`
    flex-grow: 1;
    background: #34495e;
    border: 1px solid #4a627a;
    border-radius: 8px;
    padding: 0.9rem 1.2rem;
    color: #ecf0f1;
    font-size: 1.1rem;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.3);
    }
    &::placeholder {
        color: #95a5a6;
    }
`;

const Button = styled.button`
    background-color: #3498db;
    border: none;
    border-radius: 8px;
    color: white;
    padding: 0.9rem 1.5rem;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out;

    &:hover {
        background-color: #2980b9;
        transform: translateY(-1px);
    }
    &:active {
        transform: translateY(0);
    }
    &:disabled {
        background-color: #7f8c8d;
        cursor: not-allowed;
    }
`;

const ResultCard = styled.div`
    background-color: ${props => {
        if (props.signal === 'Buy') return '#27ae60'; // Green for Buy
        if (props.signal === 'Sell') return '#e74c3c'; // Red for Sell
        return '#34495e'; // Blue-gray for Hold
    }};
    padding: 1.8rem;
    border-radius: 10px;
    margin-top: 2rem;
    color: white;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    text-align: center;
`;

const ResultTitle = styled.h3`
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
`;

const ConfidenceText = styled.p`
    font-size: 1.4rem;
    font-weight: bold;
`;

const AnalysisGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
    text-align: left;
`;

const AnalysisItem = styled.div`
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0.8rem 1.2rem;
    border-radius: 6px;

    strong {
        display: block;
        font-size: 0.9rem;
        margin-bottom: 0.3rem;
        color: #bdc3c7;
    }
    span {
        font-size: 1rem;
    }
`;

const ErrorMessage = styled.p`
    color: #e74c3c;
    text-align: center;
    margin-top: 1.5rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
`;

const LoadingMessage = styled.p`
    color: #3498db;
    text-align: center;
    margin-top: 1.5rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
`;


const PredictPage = () => {
    const [symbol, setSymbol] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { isAuthenticated } = useContext(AuthContext);

    // API_URL will be provided by environment variables in production (Vercel)
    // For local development, it might default to localhost
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

    const handlePredict = async (e) => {
        e.preventDefault();
        setError('');
        setPrediction(null);
        setLoading(true);

        if (!isAuthenticated) {
            setError('Please log in to get predictions.');
            setLoading(false);
            return;
        }
        if (!symbol) {
            setError('Please enter a stock symbol.');
            setLoading(false);
            return;
        }

        try {
            console.log(`Fetching prediction for ${symbol} from ${API_URL}/api/predict/${symbol}`);
            const res = await axios.get(`${API_URL}/api/predict/${symbol}`, {
                headers: {
                    'x-auth-token': localStorage.getItem('token') // Send token for authentication
                }
            });
            console.log('Prediction API response:', res.data);
            setPrediction(res.data);
        } catch (err) {
            console.error('Error fetching prediction:', err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Failed to fetch prediction. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PredictContainer>
            <PredictBox>
                <Title>Stock Prediction AI</Title>
                <form onSubmit={handlePredict}>
                    <InputGroup>
                        <Input
                            type="text"
                            placeholder="Enter Stock Symbol (e.g., AAPL)"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            disabled={loading}
                            required
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Predicting...' : 'Get Prediction'}
                            <Search size={20} />
                        </Button>
                    </InputGroup>
                </form>

                {loading && (
                    <LoadingMessage>
                        <TrendingUp size={24} /> Fetching historical data and analyzing...
                    </LoadingMessage>
                )}
                {error && (
                    <ErrorMessage>
                        <AlertTriangle size={24} /> {error}
                    </ErrorMessage>
                )}

                {prediction && (
                    <ResultCard signal={prediction.signal}>
                        <ResultTitle>
                            {prediction.signal === 'Buy' && <TrendingUp size={32} />}
                            {prediction.signal === 'Sell' && <AlertTriangle size={32} />}
                            {prediction.signal === 'Hold' && <Search size={32} />}
                            {prediction.signal} {prediction.symbol}
                        </ResultTitle>
                        <ConfidenceText>Confidence: {prediction.confidence.toFixed(2)}%</ConfidenceText>
                        <AnalysisGrid>
                            <AnalysisItem>
                                <strong>SMA Analysis:</strong> <span>{prediction.analysis.sma}</span>
                            </AnalysisItem>
                            <AnalysisItem>
                                <strong>RSI Analysis:</strong> <span>{prediction.analysis.rsi}</span>
                            </AnalysisItem>
                            <AnalysisItem>
                                <strong>MACD Analysis:</strong> <span>{prediction.analysis.macd}</span>
                            </AnalysisItem>
                            <AnalysisItem>
                                <strong>Volume Analysis:</strong> <span>{prediction.analysis.volume}</span>
                            </AnalysisItem>
                        </AnalysisGrid>
                    </ResultCard>
                )}
            </PredictBox>
            {/* TODO: Add Chart component here in future if desired */}
        </PredictContainer>
    );
};

export default PredictPage;