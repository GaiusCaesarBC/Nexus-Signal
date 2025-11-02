// client/src/pages/PredictPage.js - UPDATED with Labels and Percentage Change
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

// --- Styled Components ---
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
    align-items: center; /* Align items vertically in the center */
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 800px; /* Increased max-width to accommodate new labels and selects */
    flex-wrap: wrap; /* Allow items to wrap on smaller screens */
    gap: 1rem; /* Space between elements */

    & > * { /* Apply margin to direct children */
        margin-bottom: 0.5rem; /* Add some vertical spacing */
    }
`;

const Input = styled.input`
    padding: 0.8rem 1rem;
    border: 1px solid #3f51b5;
    border-radius: 4px;
    font-size: 1rem;
    flex: 2; /* Allow input to take more space */
    min-width: 180px; /* Minimum width for input */
    background-color: #34495e;
    color: #e0e0e0;

    &:focus {
        outline: none;
        border-color: #5d74e3;
        box-shadow: 0 0 0 3px rgba(93, 116, 227, 0.5);
    }
`;

const Select = styled.select`
    padding: 0.8rem 1rem;
    border: 1px solid #3f51b5;
    border-radius: 4px;
    font-size: 1rem;
    background-color: #34495e;
    color: #e0e0e0;
    flex: 1; /* Allow selects to take equal space */
    min-width: 120px; /* Minimum width for selects */

    &:focus {
        outline: none;
        border-color: #5d74e3;
        box-shadow: 0 0 0 3px rgba(93, 116, 227, 0.5);
    }
`;

const ControlLabel = styled.p`
    font-size: 0.95rem;
    color: #b0c4de;
    margin: 0;
    white-space: nowrap; /* Prevent label from wrapping */
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
    flex-shrink: 0; /* Don't allow button to shrink */

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
    const [selectedRange, setSelectedRange] = useState('6M'); // Default range
    const [selectedInterval, setSelectedInterval] = useState('1d'); // Default interval
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(null); // To store the last known historical price

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
        setCurrentPrice(null); // Reset current price

        if (!symbol) {
            setError('Please enter a stock symbol (e.g., AAPL).');
            return;
        }

        if (!api) {
            setError('API client not initialized. Please ensure you are logged in and try again.');
            setLoading(false);
            console.error("API client (axios instance) is undefined.");
            return;
        }

        if (!isAuthenticated) {
            setError('You must be logged in to get predictions.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            console.log(`Fetching historical data for ${symbol} with range=${selectedRange}, interval=${selectedInterval}`);
            const res = await api.get(`/stocks/historical/${symbol}?range=${selectedRange}&interval=${selectedInterval}`);
            console.log('Historical Data API response:', res.data);

            const { historicalData } = res.data;

            if (!historicalData || historicalData.length === 0) {
                setError(`No historical data found for ${symbol} with the selected range and interval.`);
                setLoading(false);
                return;
            }

            const lastHistoricalClose = historicalData[historicalData.length - 1].close;
            setCurrentPrice(lastHistoricalClose); // Store the last historical close price

            // --- TEMPORARY MOCK PREDICTION FOR FRONTEND LOGIC ---
            // You will replace this with an actual prediction API call or logic
            const mockPredictionPrice = lastHistoricalClose * (1 + (Math.random() - 0.5) * 0.05); // +/- 2.5%
            const mockPredictedDirection = mockPredictionPrice > lastHistoricalClose ? 'Up' : 'Down';
            const mockConfidence = Math.floor(Math.random() * (95 - 60 + 1)) + 60; // 60-95%
            const mockPredictionMessage = `Based on historical data for the last ${selectedRange}, the model predicts a ${mockPredictedDirection} movement.`;
            // --- END TEMPORARY MOCK ---

            setPrediction({
                symbol: symbol,
                predictedPrice: mockPredictionPrice,
                predictedDirection: mockPredictedDirection,
                confidence: mockConfidence,
                predictionMessage: mockPredictionMessage
            });

            // Prepare chart data
            const labels = historicalData.map(d => {
                // If time is a Unix timestamp (from intraday), convert to readable date for labels
                if (typeof d.time === 'number') {
                    return new Date(d.time * 1000).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
                }
                return d.time; // YYYY-MM-DD for daily data
            });
            const closePrices = historicalData.map(d => d.close);

            // Add the predicted point to the chart data
            const lastHistoricalPointTime = historicalData.length > 0 ? historicalData[historicalData.length - 1].time : (new Date().getTime() / 1000);
            let predictedTimeLabel;

            if (typeof lastHistoricalPointTime === 'number') { // Intraday
                const predictedDateTime = new Date(lastHistoricalPointTime * 1000);
                predictedDateTime.setHours(predictedDateTime.getHours() + 24); // Assuming next day's opening
                predictedTimeLabel = predictedDateTime.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
            } else { // Daily (YYYY-MM-DD)
                const predictedDate = new Date(lastHistoricalPointTime);
                predictedDate.setDate(predictedDate.getDate() + 1); // Predict for the next day
                predictedTimeLabel = predictedDate.toISOString().split('T')[0];
            }


            labels.push(predictedTimeLabel);
            closePrices.push(mockPredictionPrice);

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
                        data: Array(closePrices.length - 1).fill(null).concat([mockPredictionPrice]),
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
            console.error('Error fetching prediction or historical data:', err.response?.data?.msg || err.message);
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

    const rangeOptions = [
        { value: '1D', label: '1 Day' },
        { value: '5D', label: '5 Days' },
        { value: '1M', label: '1 Month' },
        { value: '3M', label: '3 Months' },
        { value: '6M', label: '6 Months' },
        { value: '1Y', label: '1 Year' },
        { value: '5Y', label: '5 Years' },
        { value: 'MAX', label: 'Max' },
    ];

    const intervalOptions = [
        { value: '1min', label: '1 Minute (Intraday)' }, // Adjusted labels for clarity
        { value: '5min', label: '5 Minutes (Intraday)' },
        { value: '15min', label: '15 Minutes (Intraday)' },
        { value: '30min', label: '30 Minutes (Intraday)' },
        { value: '60min', label: '60 Minutes (Intraday)' },
        { value: '1d', label: '1 Day (Daily)' },
        // { value: '1wk', label: '1 Week (Daily)' }, // Alpha Vantage doesn't directly support 1wk interval in intraday or daily for `interval` param
        // { value: '1mo', label: '1 Month (Daily)' }, // Alpha Vantage doesn't directly support 1mo interval in intraday or daily for `interval` param
    ];


    // Calculate percentage change if we have both current and predicted prices
    const percentageChange = currentPrice && prediction?.predictedPrice
        ? ((prediction.predictedPrice - currentPrice) / currentPrice) * 100
        : 0;
    const percentageChangeDirection = percentageChange >= 0 ? 'Up' : 'Down';
    const percentageChangeColor = percentageChangeDirection === 'Up' ? '#28a745' : '#dc3545';

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

                    <div> {/* Wrapper for label and select */}
                        <ControlLabel>Historical Data Range:</ControlLabel>
                        <Select value={selectedRange} onChange={(e) => setSelectedRange(e.target.value)}>
                            {rangeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div> {/* Wrapper for label and select */}
                        <ControlLabel>Chart Interval:</ControlLabel>
                        <Select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)}>
                            {intervalOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </div>

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
                        {currentPrice && prediction?.predictedPrice && (
                            <ResultDetail style={{ color: percentageChangeColor }}>
                                Current: ${currentPrice.toFixed(2)} &nbsp;|&nbsp;
                                Predicted Change: {percentageChange.toFixed(2)}% {percentageChangeDirection === 'Up' ? '▲' : '▼'}
                            </ResultDetail>
                        )}
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