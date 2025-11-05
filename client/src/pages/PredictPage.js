// client/src/pages/PredictPage.js - PART 1 (Styled-Components Version)

import React, { useState, useEffect, useMemo } from 'react';
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
    min-height: calc(100vh - var(--navbar-height)); /* Ensure navbar-height is defined if used */
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

    @media (max-width: 768px) {
        padding: 1.5rem;
    }
`;

const TypeToggleGroup = styled.div`
    display: flex;
    margin-bottom: 1.5rem;
    border-radius: 4px;
    overflow: hidden;
    background-color: #34495e;
    width: fit-content; /* Adjust width to content */
`;

const TypeToggleButton = styled.button`
    padding: 0.8rem 1.5rem;
    border: none;
    background-color: ${props => (props.active ? '#3f51b5' : 'transparent')};
    color: ${props => (props.active ? 'white' : '#b0c4de')};
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1; /* Allow buttons to expand within the group */

    &:hover {
        background-color: ${props => (props.active ? '#5d74e3' : '#4a6288')};
        color: white;
    }

    &:first-child {
        border-right: 1px solid #2c3e50;
    }
`;

const InputGroup = styled.form` /* Changed to form for better accessibility and submit handling */
    display: flex;
    justify-content: center;
    align-items: flex-end; /* Align items to the bottom */
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 800px;
    gap: 1rem;
    flex-wrap: wrap; /* Allow wrapping on smaller screens */

    @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
    }
`;

const InputControl = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1; /* Allow flexibility */
    min-width: 150px; /* Minimum width for inputs/selects */

    @media (max-width: 768px) {
        width: 100%; /* Full width on smaller screens */
    }
`;

const Input = styled.input`
    padding: 0.8rem 1rem;
    border: 1px solid #3f51b5;
    border-radius: 4px;
    font-size: 1rem;
    width: 100%; /* Take full width of its parent Control */
    background-color: #34495e;
    color: #e0e0e0;

    &::placeholder {
        color: #b0c4de80;
    }

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
    width: 100%;

    &:focus {
        outline: none;
        border-color: #5d74e3;
        box-shadow: 0 0 0 3px rgba(93, 116, 227, 0.5);
    }
`;

const ControlLabel = styled.label` /* Changed to label for accessibility */
    font-size: 0.95rem;
    color: #b0c4de;
    margin: 0 0 0.5rem 0;
    white-space: nowrap;
    text-align: left; /* Align label text to left */
    width: 100%; /* Ensure label takes full width */
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
    flex-shrink: 0;
    min-width: 120px; /* Give button a consistent min-width */

    &:hover {
        background-color: #5d74e3;
    }

    &:disabled {
        background-color: #5a6a7c;
        cursor: not-allowed;
        opacity: 0.7;
    }

    @media (max-width: 768px) {
        width: 100%;
        margin-top: 1rem; /* Add some space above button on small screens */
    }
`;

// NEW Styled Component for Interval Buttons Group
const IntervalButtonGroup = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); /* Responsive grid */
    gap: 0.8rem;
    margin-top: 1.5rem;
    width: 100%;
    max-width: 900px;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px) {
        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
        padding: 1rem;
    }
`;

// NEW Styled Component for Individual Interval Button
const IntervalButton = styled.button`
    padding: 0.6rem 0.8rem;
    border: 1px solid ${props => (props.active ? '#3f51b5' : '#4a6288')};
    border-radius: 4px;
    background-color: ${props => (props.active ? '#3f51b5' : 'transparent')};
    color: ${props => (props.active ? 'white' : '#b0c4de')};
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap; /* Prevent text wrapping */

    &:hover {
        background-color: ${props => (props.active ? '#5d74e3' : '#4a6288')};
        color: white;
        border-color: ${props => (props.active ? '#5d74e3' : '#6c8cd1')};
    }
`;


const PredictionResult = styled.div`
    margin-top: 2rem; /* Adjusted margin */
    text-align: center;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
    max-width: 450px; /* Slightly wider */
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
    height: 450px; /* Slightly taller chart */
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    max-width: 900px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px) {
        height: 300px; /* Shorter on mobile */
        padding: 1rem;
    }
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
    const [predictionType, setPredictionType] = useState('stock'); // 'stock' or 'crypto'
    const [symbol, setSymbol] = useState('');
    const [selectedRange, setSelectedRange] = useState('6M'); // Default range for historical depth
    const [selectedInterval, setSelectedInterval] = useState('1d'); // Default interval for data points
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

    // Define interval options dynamically based on predictionType
    const intervalOptions = useMemo(() => {
        const shortTerm = [
            { value: '1min', label: '1 Min' },
            { value: '5min', label: '5 Min' },
            { value: '15min', label: '15 Min' },
            { value: '30min', label: '30 Min' },
            { value: '1h', label: '1 Hr' },
            { value: '5h', label: '5 Hr' },
            { value: '12h', label: '12 Hr' },
        ];
        const longTerm = [
            { value: '1d', label: '1 Day' },
            { value: '1w', label: '1 Week' },
            { value: '1mo', label: '1 Month' },
            { value: '6mo', label: '6 Months' },
            { value: '1y', label: '1 Year' },
        ];

        // Combine for now, but you can filter these based on predictionType
        // if some intervals are only relevant for stocks vs. crypto.
        return [...shortTerm, ...longTerm];
    }, [predictionType]); // Recompute if predictionType changes.

    // Define range options.
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

    const onSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        setError(null);
        setPrediction(null);
        setChartData(null);
        setCurrentPrice(null);

        if (!symbol) {
            setError(`Please enter a ${predictionType === 'stock' ? 'stock symbol (e.g., AAPL)' : 'crypto symbol (e.g., BTC)'}.`);
            return;
        }

        if (!api) {
            setError('API client not initialized. Please ensure you are logged in and try again.');
            setLoading(false); // Make sure loading is false if API is not ready
            console.error("API client (axios instance) is undefined.");
            return;
        }

        if (!isAuthenticated) {
            setError('You must be logged in to get predictions.');
            setLoading(false); // Make sure loading is false if not authenticated
            return;
        }

        setLoading(true);
        try {
            console.log(`Fetching ${predictionType} historical data for ${symbol} with range=${selectedRange}, interval=${selectedInterval}`);

            let res;
            if (predictionType === 'stock') {
                res = await api.get(`/stocks/historical/${symbol}?range=${selectedRange}&interval=${selectedInterval}`);
            } else { // 'crypto'
                // This will call a NEW backend endpoint you'll need to create: /api/crypto/historical/:symbol?range=...&interval=...
                // For now, this will likely fail until you set up the backend /crypto/historical route.
                // You might need a different `range` and `interval` mapping for crypto APIs.
                res = await api.get(`/crypto/historical/${symbol}?range=${selectedRange}&interval=${selectedInterval}`);
            }

            console.log(`${predictionType} Historical Data API response:`, res.data);

            const { historicalData } = res.data;

            if (!historicalData || historicalData.length === 0) {
                setError(`No historical data found for ${symbol} with the selected range and interval.`);
                setLoading(false);
                return;
            }

            const lastHistoricalClose = historicalData[historicalData.length - 1].close;
            setCurrentPrice(lastHistoricalClose);

            // --- TEMPORARY MOCK PREDICTION FOR FRONTEND LOGIC ---
            // This mock logic is based on the LAST item in historicalData
            const mockPredictionPrice = lastHistoricalClose * (1 + (Math.random() - 0.5) * 0.05); // +/- 2.5%
            const mockPredictedDirection = mockPredictionPrice > lastHistoricalClose ? 'Up' : 'Down';
            const mockConfidence = Math.floor(Math.random() * (95 - 60 + 1)) + 60;
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
                const date = new Date(typeof d.time === 'number' ? d.time * 1000 : d.time);
                if (['1min', '5min', '15min', '30min', '1h', '5h', '12h'].includes(selectedInterval)) {
                    return date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
                }
                return date.toISOString().split('T')[0]; // YYYY-MM-DD for daily or longer
            });
            const closePrices = historicalData.map(d => d.close);

            // Add the predicted point to the chart data
            const lastHistoricalPointTime = historicalData.length > 0
                ? (typeof historicalData[historicalData.length - 1].time === 'number'
                    ? historicalData[historicalData.length - 1].time * 1000
                    : new Date(historicalData[historicalData.length - 1].time).getTime())
                : (new Date().getTime()); // Fallback to now if no data

            let predictedTimeLabel;
            const predictedDateTime = new Date(lastHistoricalPointTime);

            switch(selectedInterval) {
                case '1min': predictedDateTime.setMinutes(predictedDateTime.getMinutes() + 1); break;
                case '5min': predictedDateTime.setMinutes(predictedDateTime.getMinutes() + 5); break;
                case '15min': predictedDateTime.setMinutes(predictedDateTime.getMinutes() + 15); break;
                case '30min': predictedDateTime.setMinutes(predictedDateTime.getMinutes() + 30); break;
                case '1h': predictedDateTime.setHours(predictedDateTime.getHours() + 1); break;
                case '5h': predictedDateTime.setHours(predictedDateTime.getHours() + 5); break;
                case '12h': predictedDateTime.setHours(predictedDateTime.getHours() + 12); break;
                case '1d': predictedDateTime.setDate(predictedDateTime.getDate() + 1); break;
                case '1w': predictedDateTime.setDate(predictedDateTime.getDate() + 7); break;
                case '1mo': predictedDateTime.setMonth(predictedDateTime.getMonth() + 1); break;
                case '6mo': predictedDateTime.setMonth(predictedDateTime.getMonth() + 6); break;
                case '1y': predictedDateTime.setFullYear(predictedDateTime.getFullYear() + 1); break;
                default: predictedDateTime.setDate(predictedDateTime.getDate() + 1); // Default to next day
            }

            if (['1min', '5min', '15min', '30min', '1h', '5h', '12h'].includes(selectedInterval)) {
                predictedTimeLabel = predictedDateTime.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
            } else {
                predictedTimeLabel = predictedDateTime.toISOString().split('T')[0];
            }

            labels.push(predictedTimeLabel);
            closePrices.push(mockPredictionPrice); // Add predicted price to the end of the data

            setChartData({
                labels: labels,
                datasets: [
                    {
                        label: `${symbol} Close Price (Historical)`,
                        data: closePrices.slice(0, closePrices.length - 1), // Historical data only
                        fill: false,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 0.8)',
                        tension: 0.1,
                        pointRadius: 0,
                    },
                    {
                        label: `Predicted Price`,
                        data: Array(closePrices.length - 1).fill(null).concat([mockPredictionPrice]), // Only show the last point for prediction
                        fill: false,
                        backgroundColor: '#00adef', // Distinct color for prediction
                        borderColor: '#00adef',
                        pointRadius: 6,
                        pointBackgroundColor: '#00adef',
                        pointBorderColor: '#fff',
                        tension: 0.1,
                        borderDash: [5, 5], // Dashed line for prediction
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

    // Chart Options will be defined here (and then Part 2 will start with the return statement)
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#e0e0e0', // Light color for legend text
                },
            },
            title: {
                display: true,
                text: `${symbol} ${predictionType === 'stock' ? 'Stock' : 'Crypto'} Price Trend & Prediction`,
                color: '#e0e0e0', // Light color for title
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
            },
        },
        scales: {
            x: {
                ticks: {
                    color: '#e0e0e0', // Light color for x-axis ticks
                    maxTicksLimit: 10,
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)', // Light grid lines
                },
            },
            y: {
                ticks: {
                    color: '#e0e0e0', // Light color for y-axis ticks
                    callback: function(value) {
                        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 5 }).format(value);
                    }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)', // Light grid lines
                },
            },
        },
    };

    // Calculate percentage change if we have both current and predicted prices
    const percentageChange = currentPrice && prediction?.predictedPrice
        ? ((prediction.predictedPrice - currentPrice) / currentPrice) * 100
        : 0;
    const percentageChangeDirection = percentageChange >= 0 ? 'Up' : 'Down';
    const percentageChangeColor = percentageChangeDirection === 'Up' ? '#28a745' : '#dc3545';

    // END PART 1 - The 'return' statement begins Part 2
    // client/src/pages/PredictPage.js - PART 2 (Styled-Components Version - Continues from Part 1)

    return (
        <PredictContainer>
            <PredictBox>
                <h2>{predictionType === 'stock' ? 'Stock Price Prediction' : 'Crypto Price Prediction'}</h2>
                <p>
                    Enter a {predictionType === 'stock' ? 'stock symbol' : 'crypto symbol'} to get AI-driven insights
                    and a prediction for the next period.
                </p>

                <TypeToggleGroup>
                    <TypeToggleButton
                        active={predictionType === 'stock'}
                        onClick={() => {
                            setPredictionType('stock');
                            setSymbol(''); // Clear symbol when switching type
                            setPrediction(null);
                            setChartData(null);
                            setError(null);
                            setSelectedRange('6M'); // Reset range and interval on type change
                            setSelectedInterval('1d');
                        }}
                    >
                        Stocks
                    </TypeToggleButton>
                    <TypeToggleButton
                        active={predictionType === 'crypto'}
                        onClick={() => {
                            setPredictionType('crypto');
                            setSymbol(''); // Clear symbol when switching type
                            setPrediction(null);
                            setChartData(null);
                            setError(null);
                            setSelectedRange('6M'); // Reset range and interval on type change
                            setSelectedInterval('1d');
                        }}
                    >
                        Crypto
                    </TypeToggleButton>
                </TypeToggleGroup>

                <InputGroup onSubmit={onSubmit}> {/* Form element to handle Enter key submission */}
                    <InputControl style={{ flex: '2 1 250px' }}> {/* Adjust flex for input */}
                        <ControlLabel htmlFor="symbol-input">
                            {predictionType === 'stock' ? 'Stock Ticker (e.g., AAPL)' : 'Crypto Symbol (e.g., BTC)'}
                        </ControlLabel>
                        <Input
                            id="symbol-input"
                            type="text"
                            placeholder={predictionType === 'stock' ? 'e.g., AAPL' : 'e.g., BTC'}
                            aria-label={`${predictionType === 'stock' ? 'Stock' : 'Crypto'} Symbol`}
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        />
                    </InputControl>

                    <InputControl>
                        <ControlLabel htmlFor="range-select">Historical Data Range:</ControlLabel>
                        <Select
                            id="range-select"
                            value={selectedRange}
                            onChange={(e) => setSelectedRange(e.target.value)}
                        >
                            {rangeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </InputControl>

                    {/* Interval is now handled by the buttons below, no longer a select here */}
                    {/* The selectedInterval state will be updated by the buttons */}

                    <Button type="submit" disabled={loading}>
                        {loading ? 'Predicting...' : 'Get Prediction'}
                    </Button>
                </InputGroup>

                {error && <ErrorMessage>{error}</ErrorMessage>}
                {loading && <Loader />}

                {!prediction && !loading && !error && (
                    <InitialMessage>Type a {predictionType === 'stock' ? 'stock' : 'crypto'} symbol above and click "Get Prediction" to start.</InitialMessage>
                )}

                {/* NEW Interval Button Group */}
                <IntervalButtonGroup>
                    {intervalOptions.map(option => (
                        <IntervalButton
                            key={option.value}
                            active={selectedInterval === option.value}
                            onClick={() => setSelectedInterval(option.value)}
                            disabled={loading}
                        >
                            {option.label}
                        </IntervalButton>
                    ))}
                </IntervalButtonGroup>


                {prediction && (
                    <PredictionResult>
                        <h3>Prediction for {prediction.symbol}:</h3>
                        <PredictionValue direction={prediction.predictedDirection}>
                            {prediction.predictedPrice ? `$${prediction.predictedPrice.toFixed(2)}` : 'N/A'}
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

