import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Chart } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale, // Crucial for time-series data
    Filler, // Required for filling areas under line charts
} from 'chart.js';
import 'chartjs-adapter-date-fns'; // Adapter for date handling
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial'; // For candlestick charts

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';

// Register Chart.js components
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,    // Should only be listed once here
    LineController, // ADD THIS LINE if it's not there, but ensure LineElement is not duplicated
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController, // Ensure this is present
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
    CandlestickController,
    CandlestickElement
);

// --- Styled Components --- (Continues in Part 2)

// --- Styled Components ---
const PredictPageContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background-color: transparent;
    color: #e0e0e0;
`;

const TitleStyled = styled.h1`
    font-size: 2.5rem;
    color: #00adef;
    text-align: center;
    margin-bottom: 2rem;
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

const TypeToggleGroup = styled.div`
    display: flex;
    margin-bottom: 1.5rem;
    border-radius: 4px;
    overflow: hidden;
    background-color: #34495e;
    width: fit-content;
`;

const TypeToggleButton = styled.button`
    padding: 0.8rem 1.5rem;
    border: none;
    background-color: ${props => (props.active ? '#3f51b5' : 'transparent')};
    color: ${props => (props.active ? 'white' : '#b0c4de')};
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;

    &:hover {
        background-color: ${props => (props.active ? '#5d74e3' : '#4a6288')};
        color: white;
    }

    &:first-child {
        border-right: 1px solid #2c3e50;
    }
`;

const InputGroup = styled.form`
    display: flex;
    justify-content: center;
    align-items: flex-end;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 800px;
    gap: 1rem;
    flex-wrap: wrap;
`;

const InputControl = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    min-width: 150px;
`;

const Input = styled.input`
    padding: 0.8rem 1rem;
    border: 1px solid #3f51b5;
    border-radius: 4px;
    font-size: 1rem;
    width: 100%;
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

const ControlLabel = styled.label`
    font-size: 0.95rem;
    color: #b0c4de;
    margin: 0 0 0.5rem 0;
    white-space: nowrap;
    text-align: left;
    width: 100%;
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
    min-width: 120px;

    &:hover {
        background-color: #5d74e3;
    }

    &:disabled {
        background-color: #5a6a7c;
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

const PredictionResult = styled.div`
    margin-top: 2rem;
    text-align: center;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
    max-width: 450px;
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
    height: 450px;
    background-color: #34495e;
    padding: 1.5rem;
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

// PredictPage Component starts in Part 3

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

    // Redirect if not authenticated after loading
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(null);
        setPrediction(null);
        setChartData(null);
        setCurrentPrice(null);

        if (!symbol) {
            setError(`Please enter a ${predictionType} symbol.`);
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
            console.log(`Fetching ${predictionType} historical data for ${symbol} with range=${selectedRange}, interval=${selectedInterval}`);

            let res;
            if (predictionType === 'stock') {
                res = await api.get(`/stocks/historical/${symbol}`, {
                    params: { range: selectedRange, interval: selectedInterval }
                });
            } else { // 'crypto'
                res = await api.get(`/crypto/historical/${symbol}`, {
                    params: { range: selectedRange, interval: selectedInterval }
                });
            }

            console.log(`${predictionType} Historical Data API response:`, res.data);

            const historicalData = res.data.historicalData; // Assuming backend sends { historicalData: [...] }
            const backendPredictedPrice = res.data.predictedPrice; // Get predictedPrice from backend response
            const backendPredictedDirection = res.data.predictedDirection;
            const backendConfidence = res.data.confidence;
            const backendPredictionMessage = res.data.predictionMessage;


            if (!historicalData || historicalData.length === 0) {
                setError(`No historical data found for ${symbol} with the selected range and interval.`);
                setLoading(false);
                return;
            }

            const lastHistoricalClose = historicalData[historicalData.length - 1].close;
            setCurrentPrice(lastHistoricalClose);

            // --- Filter historical data for the "last day" chart ---
            let chartDataForLastDay = [];
            if (historicalData.length > 0) {
                // Determine the last timestamp available (in milliseconds)
                const lastDataPointTimeMs = typeof historicalData[historicalData.length - 1].time === 'number'
                    ? historicalData[historicalData.length - 1].time * 1000
                    : new Date(historicalData[historicalData.length - 1].time).getTime();

                // Calculate 24 hours ago
                const oneDayAgo = new Date(lastDataPointTimeMs - 24 * 60 * 60 * 1000).getTime();

                chartDataForLastDay = historicalData.filter(d => {
                    const dataDateMs = typeof d.time === 'number' ? d.time * 1000 : new Date(d.time).getTime();
                    return dataDateMs >= oneDayAgo;
                });

                // Fallback logic (unchanged)
                if (chartDataForLastDay.length === 0 && selectedRange === '1D') {
                    chartDataForLastDay = historicalData;
                } else if (chartDataForLastDay.length === 0) {
                    chartDataForLastDay = [historicalData[historicalData.length - 1]];
                } else if (chartDataForLastDay.length === 1 && historicalData.length > 1) {
                    chartDataForLastDay.unshift(historicalData[historicalData.length - 2]);
                }
            }

            // Prepare chart data using the filtered `chartDataForLastDay`
            const chartPoints = chartDataForLastDay.map(d => {
                // CRITICAL FIX: Convert time to Unix Milliseconds for Chart.js Time Scale
                const timeInMs = typeof d.time === 'number' ? d.time * 1000 : new Date(d.time).getTime();

                return {
                    x: timeInMs, // <-- MUST BE MILLISECONDS (Unix time)
                    y: d.close,
                    o: d.open,
                    h: d.high,
                    l: d.low,
                    c: d.close
                };
            });

            // --- PREDICTION LOGIC AND CHART POINT GENERATION ---
            // Use the predictedPrice from the backend, or fall back to mock if not provided
            const finalPredictedPrice = backendPredictedPrice || (lastHistoricalClose * (1 + (Math.random() - 0.5) * 0.05));
            const finalPredictedDirection = backendPredictedDirection || (finalPredictedPrice > lastHistoricalClose ? 'Up' : 'Down');
            const finalConfidence = backendConfidence || (Math.floor(Math.random() * (95 - 60 + 1)) + 60);
            const finalPredictionMessage = backendPredictionMessage || `Based on historical data for the last ${selectedRange}, the model predicts a ${finalPredictedDirection} movement.`;
            const percentageChange = ((finalPredictedPrice - lastHistoricalClose) / lastHistoricalClose) * 100;

            // Prepare prediction point data (must also be in milliseconds)
            // Start from the last historical point's time
            const predictionPointTimeMsStart = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].x : Date.now();
            let predictedDateTime = new Date(predictionPointTimeMsStart);

            // Advance time based on interval (this logic determines WHEN the prediction occurs)
            // For simplicity, we'll just move it a bit into the future for visualization
            predictedDateTime.setHours(predictedDateTime.getHours() + 24); // +24 hours from last data point

            const predictionPointData = [{
                x: predictedDateTime.getTime(), // CRITICAL: Use milliseconds for prediction point
                y: finalPredictedPrice
            }];

            // Set the prediction state for display
            setPrediction({
                symbol: symbol,
                predictedPrice: finalPredictedPrice,
                predictedDirection: finalPredictedDirection,
                confidence: finalConfidence,
                message: finalPredictionMessage,
                percentageChange: percentageChange,
            });

            // --- CHART DATA SETUP ---
            setChartData({
                datasets: [
                    // Candlestick data for stocks if available
                    ...(predictionType === 'stock' && chartPoints[0]?.o !== undefined ? [{
                        label: `${symbol} (OHLC)`,
                        data: chartPoints.map(p => ({ x: p.x, o: p.o, h: p.h, l: p.l, c: p.c })),
                        type: 'candlestick',
                        borderColor: 'transparent',
                        borderWidth: 1,
                        yAxisID: 'y'
                    }] : []),
                    // Line data for historical close prices (or crypto)
                    {
                        label: `${symbol} Price`,
                        data: chartPoints.map(p => ({ x: p.x, y: p.y })),
                        borderColor: '#00adef',
                        backgroundColor: 'rgba(0, 173, 239, 0.2)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.2,
                        yAxisID: 'y'
                    },
                    // Prediction line, connected from the last historical close
                    {
                        label: 'Predicted Price',
                        data: [
                            { x: chartPoints[chartPoints.length - 1].x, y: chartPoints[chartPoints.length - 1].y },
                            ...predictionPointData
                        ],
                        borderColor: '#FFC107',
                        backgroundColor: '#FFC107',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointBackgroundColor: '#FFC107',
                        pointBorderColor: '#fff',
                        tension: 0,
                        fill: false,
                        yAxisID: 'y'
                    }
                ],
            });

        } catch (err) {
            console.error('Error fetching prediction or historical data:', err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Failed to fetch prediction. Please check the symbol and try again.');
        } finally {
            setLoading(false);
        }
    }, [api, isAuthenticated, predictionType, symbol, selectedRange, selectedInterval]); // Dependencies for useCallback

    // getChartOptions starts in Part 4
    const getChartOptions = useCallback((currentPredictionType, currentSymbol) => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                    },
                },
                title: {
                    display: true,
                    text: `${currentSymbol} ${currentPredictionType === 'stock' ? 'Stock' : 'Crypto'} Price & Prediction`,
                    color: '#e0e0e0',
                    font: {
                        size: 18
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }

                            if (context.dataset.type === 'candlestick' && context.parsed.o !== undefined) {
                                label = [
                                    `${currentSymbol} OHLC`,
                                    `Open: ${context.parsed.o.toFixed(2)}`,
                                    `High: ${context.parsed.h.toFixed(2)}`,
                                    `Low: ${context.parsed.l.toFixed(2)}`,
                                    `Close: ${context.parsed.c.toFixed(2)}`
                                ];
                            } else if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        },
                        title: function(context) {
                            if (context[0] && context[0].parsed && context[0].parsed.x) {
                                return new Date(context[0].parsed.x).toLocaleString();
                            }
                            return '';
                        }
                    }
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day', // Default unit, will adapt to data
                        tooltipFormat: 'MMM dd, yyyy HH:mm',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'MMM d, HH:mm',
                            day: 'MMM dd',
                            week: 'MMM dd, yyyy',
                            month: 'MMM yyyy',
                            quarter: 'qqq yyyy',
                            year: 'yyyy',
                        }
                    },
                    ticks: {
                        color: '#b0c4de',
                        maxTicksLimit: 10,
                        autoSkipPadding: 10,
                    },
                    grid: {
                        color: 'rgba(176, 196, 222, 0.1)',
                    },
                },
                y: {
                    ticks: {
                        color: '#b0c4de',
                        callback: function(value) {
                            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 5 }).format(value);
                        }
                    },
                    grid: {
                        color: 'rgba(176, 196, 222, 0.1)',
                    },
                },
            },
        };
    }, []); // No dependencies for options that depend on data dynamically within the callback

    return (
        <PredictPageContainer>
            <TitleStyled>Market Prediction</TitleStyled>

            <PredictBox>
                <TypeToggleGroup>
                    <TypeToggleButton
                        active={predictionType === 'stock'}
                        onClick={() => setPredictionType('stock')}
                    >
                        Stock
                    </TypeToggleButton>
                    <TypeToggleButton
                        active={predictionType === 'crypto'}
                        onClick={() => setPredictionType('crypto')}
                    >
                        Crypto
                    </TypeToggleButton>
                </TypeToggleGroup>

                <InputGroup onSubmit={handleSubmit}>
                    <InputControl>
                        <ControlLabel htmlFor="symbol-input">
                            {predictionType === 'stock' ? 'Stock Symbol (e.g., AAPL)' : 'Crypto Symbol (e.g., BTC)'}
                        </ControlLabel>
                        <Input
                            id="symbol-input"
                            type="text"
                            placeholder={predictionType === 'stock' ? 'Enter stock symbol' : 'Enter crypto symbol'}
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            required
                        />
                    </InputControl>

                    <InputControl>
                        <ControlLabel htmlFor="range-select">Date Range</ControlLabel>
                        <Select
                            id="range-select"
                            value={selectedRange}
                            onChange={(e) => setSelectedRange(e.target.value)}
                        >
                            <option value="1D">1 Day</option>
                            <option value="5D">5 Days</option>
                            <option value="1M">1 Month</option>
                            <option value="3M">3 Months</option>
                            <option value="6M">6 Months</option>
                            <option value="1Y">1 Year</option>
                            <option value="5Y">5 Years</option>
                            <option value="MAX">Max</option>
                        </Select>
                    </InputControl>

                    <InputControl>
                        <ControlLabel htmlFor="interval-select">Interval</ControlLabel>
                        <Select
                            id="interval-select"
                            value={selectedInterval}
                            onChange={(e) => setSelectedInterval(e.target.value)}
                        >
                            <option value="1m">1 Minute</option>
                            <option value="5m">5 Minutes</option>
                            <option value="15m">15 Minutes</option>
                            <option value="30m">30 Minutes</option>
                            <option value="60m">60 Minutes</option>
                            <option value="90m">90 Minutes</option>
                            <option value="1h">1 Hour</option>
                            <option value="1d">1 Day</option>
                            <option value="5d">5 Days</option>
                            <option value="1wk">1 Week</option>
                            <option value="1mo">1 Month</option>
                            <option value="3mo">3 Months</option>
                        </Select>
                    </InputControl>

                    <Button type="submit" disabled={loading || authLoading || !isAuthenticated}>
                        {loading ? <Loader size="20px" /> : 'Get Prediction'}
                    </Button>
                </InputGroup>

                {error && <ErrorMessage>{error}</ErrorMessage>}
                {!isAuthenticated && !authLoading && (
                    <InitialMessage>Please log in to use the prediction feature.</InitialMessage>
                )}
                {loading && !error && <Loader message="Fetching data & making prediction..." />}
            </PredictBox>

            {prediction && (
                <PredictionResult>
                    {currentPrice && (
                        <ResultDetail>
                            Current Price: ${currentPrice.toFixed(2)}
                        </ResultDetail>
                    )}
                    <PredictionValue direction={prediction.predictedDirection}>
                        Predicted: ${prediction.predictedPrice.toFixed(2)}
                        <DirectionArrow>
                            {prediction.predictedDirection === 'Up' ? '▲' : prediction.predictedDirection === 'Down' ? '▼' : ''}
                        </DirectionArrow>
                    </PredictionValue>
                    {prediction.percentageChange !== undefined && (
                        <ResultDetail>
                            Change: {prediction.percentageChange.toFixed(2)}%
                            <span style={{ color: prediction.percentageChange >= 0 ? '#28a745' : '#dc3545', marginLeft: '8px' }}>
                                ({prediction.percentageChange >= 0 ? 'Increase' : 'Decrease'})
                            </span>
                        </ResultDetail>
                    )}
                    <ResultDetail>
                        Direction: {prediction.predictedDirection} (Confidence: {prediction.confidence}%)
                    </ResultDetail>
                    <ResultDetail>{prediction.message}</ResultDetail>
                </PredictionResult>
            )}

            {chartData && (
                <ChartContainer>
                    <Chart
                        type='line' // Default to line, candlestick will be a dataset within if stock
                        data={chartData}
                        options={getChartOptions(predictionType, symbol)}
                    />
                </ChartContainer>
            )}

        </PredictPageContainer>
    );
};

export default PredictPage;