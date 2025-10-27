// client/src/pages/PredictPage.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// --- Styled Components (unchanged) ---
const PredictContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background-color: transparent;
    color: #e0e0e0;
`;

const PredictBox = styled.div`
    background-color: #2c3e50;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    padding: 2.5rem;
    max-width: 900px;
    width: 100%;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
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

const PredictionResult = styled.div`
    margin-top: 1.5rem;
    text-align: center;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const PredictionValue = styled.p`
    font-size: 2.5rem;
    font-weight: bold;
    color: ${props => props.direction === 'Up' ? '#28a745' : props.direction === 'Down' ? '#dc3545' : '#ffc107'};
    margin: 0.5rem 0;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const DirectionArrow = styled.span`
    font-size: 1.8rem;
    margin-left: 0.8rem;
    margin-right: -0.5rem;
    vertical-align: middle;
`;

const ResultDetail = styled.p`
    font-size: 1.1rem;
    color: #b0c4de;
    margin-top: 0.5rem;
`;

const ChartContainer = styled.div`
    margin-top: 2rem;
    width: 100%;
    height: 400px;
    background-color: #34495e;
    padding: 1rem;
    border-radius: 8px;
    max-width: 900px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1rem;
    font-size: 0.95rem;
`;

const InitialMessage = styled.p`
    color: #b0c4de;
    font-size: 1.1rem;
    margin-top: 1rem;
`;

const PredictPage = () => {
    const { api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [symbol, setSymbol] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setPrediction(null);
        setChartData(null);
        
        if (!symbol) {
            setError('Please enter a stock symbol (e.g., AAPL).');
            return;
        }

        // --- NEW CHECK HERE ---
        if (!api) {
            setError('API client not initialized. Please ensure you are logged in and try again.');
            setLoading(false); // Ensure loading is false
            console.error("API client (axios instance) is undefined.");
            return;
        }
        // --- END NEW CHECK ---

        if (!isAuthenticated) {
            setError('You must be logged in to get predictions.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Only attempt to log baseURL if api is defined
            console.log(`Fetching prediction for ${symbol} from ${api.defaults.baseURL}/api/predict/${symbol}`);
            const res = await api.get(`/api/predict/${symbol}`);
            console.log('Prediction API response:', res.data);

            const {
                predictedPrice,
                predictedDirection,
                confidence,
                predictionMessage,
                historicalData
            } = res.data;

            setPrediction({
                symbol: symbol,
                predictedPrice: predictedPrice,
                predictedDirection: predictedDirection,
                confidence: confidence,
                predictionMessage: predictionMessage
            });

            // Prepare chart data
            const labels = historicalData.map(d => d.time);
            const closePrices = historicalData.map(d => d.close);

            // Add the predicted point to the chart data
            const lastHistoricalTime = historicalData.length > 0 ? new Date(historicalData[historicalData.length - 1].time) : new Date();
            const predictedTime = new Date(lastHistoricalTime);
            predictedTime.setDate(predictedTime.getDate() + 1);

            labels.push(predictedTime.toISOString().split('T')[0]);
            closePrices.push(predictedPrice);

            setChartData({
                labels: labels,
                datasets: [
                    {
                        label: `${symbol} Close Price (Historical)`,
                        data: closePrices.slice(0, closePrices.length - 1),
                        fill: false,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 0.8)',
                        tension: 0.1,
                        pointRadius: 0,
                    },
                    {
                        label: `Predicted Price`,
                        data: Array(closePrices.length - 1).fill(null).concat([predictedPrice]),
                        fill: false,
                        backgroundColor: '#00adef',
                        borderColor: '#00adef',
                        pointRadius: 6,
                        pointBackgroundColor: '#00adef',
                        pointBorderColor: '#fff',
                        tension: 0.1,
                        borderDash: [5, 5],
                    }
                ],
            });

        } catch (err) {
            console.error('Error fetching prediction:', err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Failed to fetch prediction. Please check the symbol and try again.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return <Loader />;
    }

    if (!isAuthenticated) {
        return (
            <PredictContainer>
                <PredictBox>
                    <ErrorMessage>You need to be logged in to access the prediction features.</ErrorMessage>
                    <Button onClick={() => navigate('/login')}>Login Now</Button>
                </PredictBox>
            </PredictContainer>
        );
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#e0e0e0',
                },
            },
            title: {
                display: true,
                text: `${symbol} Price Trend & Prediction`,
                color: '#e0e0e0',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#e0e0e0',
                    maxTicksLimit: 10
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
            },
            y: {
                ticks: {
                    color: '#e0e0e0',
                    callback: function(value) {
                        return `$${value.toFixed(2)}`;
                    }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
            },
        },
    };

    return (
        <PredictContainer>
            <PredictBox>
                <h2>Stock Price Prediction</h2>
                <p>Enter a stock symbol to get AI-driven insights and a prediction for the next trading day.</p>
                <InputGroup>
                    <Input
                        type="text"
                        placeholder="Enter stock symbol (e.g., AAPL)"
                        aria-label="Stock Symbol"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                onSubmit(e);
                            }
                        }}
                    />
                    <Button onClick={onSubmit} disabled={loading}>
                        {loading ? 'Predicting...' : 'Get Prediction'}
                    </Button>
                </InputGroup>

                {error && <ErrorMessage>{error}</ErrorMessage>}
                {loading && <Loader />}

                {!prediction && !loading && !error && (
                    <InitialMessage>Type a stock symbol above and click "Get Prediction" to start.</InitialMessage>
                )}

                {prediction && (
                    <PredictionResult>
                        <h3>Prediction for {prediction.symbol}:</h3>
                        <PredictionValue direction={prediction.predictedDirection}>
                            {prediction.predictedPrice ? `$${prediction.predictedPrice.toFixed(2)}` : prediction.predictedDirection}
                            {prediction.predictedDirection === 'Up' && <DirectionArrow>▲</DirectionArrow>}
                            {prediction.predictedDirection === 'Down' && <DirectionArrow>▼</DirectionArrow>}
                            {prediction.predictedDirection === 'Neutral' && <DirectionArrow>━</DirectionArrow>}
                        </PredictionValue>
                        <ResultDetail>
                            <strong>Direction:</strong> {prediction.predictedDirection} ({prediction.confidence.toFixed(2)}%)
                        </ResultDetail>
                        {prediction.predictionMessage && <ResultDetail>{prediction.predictionMessage}</ResultDetail>}
                    </PredictionResult>
                )}
            </PredictBox>

            {chartData && (
                <ChartContainer>
                    <Line data={chartData} options={chartOptions} />
                </ChartContainer>
            )}
        </PredictContainer>
    );
};

export default PredictPage;