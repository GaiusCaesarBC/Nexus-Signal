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

const PredictContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background-color: transparent; // <-- Changed this from #1a1a2e to transparent
    color: #e0e0e0;
`;

const PredictBox = styled.div`
    background-color: #2c3e50; // Dark blue-gray for the inner box
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    padding: 2.5rem;
    max-width: 900px;
    width: 100%;
    margin-bottom: 2rem;
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
    text-align: left;
    background-color: #34495e;
    padding: 1.5rem;
    border-radius: 8px;
`;

const ChartContainer = styled.div`
    margin-top: 2rem;
    width: 100%;
    height: 400px; // Fixed height for consistency
    background-color: #34495e;
    padding: 1rem;
    border-radius: 8px;
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1rem;
    font-size: 0.95rem;
`;

const InfoMessage = styled.p`
    color: #6a9955;
    margin-top: 1rem;
    font-size: 0.95rem;
`;


const PredictPage = () => {
    const { api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [symbol, setSymbol] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [predictionMessage, setPredictionMessage] = useState('');

    useEffect(() => {
        // Redirect if not authenticated and authLoading is false
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);


    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setPrediction(null);
        setChartData(null);
        setPredictionMessage('');

        if (!symbol) {
            setError('Please enter a stock symbol.');
            return;
        }
        if (!isAuthenticated) { // This check should ideally not be reached if useEffect redirects
            setError('Please log in to get predictions.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            console.log(`Fetching prediction for ${symbol} from ${api.defaults.baseURL}/api/predict/${symbol}`); // Debug log
            const res = await api.get(`/api/predict/${symbol}`);
            console.log('Prediction API response:', res.data); // Debug log

            setPrediction(res.data);
            setPredictionMessage(res.data.predictionMessage);

            const labels = res.data.historicalData.map(d => d.time);
            const closePrices = res.data.historicalData.map(d => d.close);

            setChartData({
                labels: labels,
                datasets: [
                    {
                        label: `${symbol} Close Price`,
                        data: closePrices,
                        fill: false,
                        backgroundColor: 'rgb(75, 192, 192)',
                        borderColor: 'rgba(75, 192, 192, 0.8)',
                        tension: 0.1,
                        pointRadius: 0 // Hide individual points
                    },
                ],
            });

        } catch (err) {
            console.error('Error fetching prediction:', err.response?.data?.msg || err.message); // Detailed error log
            setError(err.response?.data?.msg || 'Failed to fetch prediction. Please try again.');
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
                    <ErrorMessage>You need to be logged in to view this page.</ErrorMessage>
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
                text: `${symbol} Historical Close Prices`,
                color: '#e0e0e0',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#e0e0e0',
                    maxTicksLimit: 10 // Limit x-axis labels
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
            },
            y: {
                ticks: {
                    color: '#e0e0e0',
                    callback: function(value) {
                        return `$${value.toFixed(2)}`; // Format as currency
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
                <h2>Stock Prediction AI</h2>
                <p>Get AI-driven predictions for your favorite stocks.</p>
                <InputGroup>
                    <Input
                        type="text"
                        placeholder="Enter stock symbol (e.g., AAPL)"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                onSubmit(e);
                            }
                        }}
                    />
                    <Button onClick={onSubmit} disabled={loading}>
                        {loading ? 'Getting Prediction...' : 'Get Prediction'}
                    </Button>
                </InputGroup>

                {error && <ErrorMessage>{error}</ErrorMessage>}
                {loading && <Loader />} {/* Use your Loader component here */}


                {prediction && (
                    <PredictionResult>
                        <h3>Prediction for {prediction.symbol}:</h3>
                        <p><strong>Predicted Direction:</strong> {prediction.predictedDirection}</p>
                        <p><strong>Confidence:</strong> {prediction.confidence.toFixed(2)}%</p>
                        <p><strong>Message:</strong> {predictionMessage}</p>
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