// client/src/pages/PredictPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
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

const stockIntradayIntervals = ['1m', '5m', '1h', '5h', '12h'];
const stockLongTermIntervals = ['1d', '1w', '1mo', '6mo', '1y'];
const cryptoIntradayIntervals = ['1m', '5m', '1h', '5h', '12h'];
const cryptoLongTermIntervals = ['1d', '1w', '1mo', '6mo', '1y'];

const PredictPage = () => {
    const { api } = useAuth(); // Use the authenticated axios instance
    const [predictionType, setPredictionType] = useState('stock'); // 'stock' or 'crypto'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInterval, setSelectedInterval] = useState('1d'); // Default to 1 Day
    const [predictionData, setPredictionData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getAvailableIntervals = () => {
        if (predictionType === 'stock') {
            return [...stockIntradayIntervals, ...stockLongTermIntervals];
        } else {
            return [...cryptoIntradayIntervals, ...cryptoLongTermIntervals];
        }
    };

    // Reset interval when prediction type changes
    useEffect(() => {
        if (predictionType === 'stock') {
            setSelectedInterval('1d');
        } else {
            setSelectedInterval('1d');
        }
    }, [predictionType]);

    const fetchPrediction = useCallback(async () => {
        if (!searchTerm) {
            setError('Please enter a symbol.');
            return;
        }

        setLoading(true);
        setError(null);
        setPredictionData(null);

        try {
            let endpoint;
            let queryParams = '';

            // Construct endpoint based on type and interval
            if (predictionType === 'stock') {
                endpoint = `/predict/stock/${searchTerm}/${selectedInterval}`;
                // For Alpha Vantage, 'range' is determined by the interval on the backend
                // The `interval` param will be mapped on the backend for Alpha Vantage calls (e.g., '1m' -> '1min')
            } else { // crypto
                endpoint = `/predict/crypto/${searchTerm}/${selectedInterval}`;
            }

            console.log(`Fetching ${predictionType} prediction for ${searchTerm} with interval ${selectedInterval}. Endpoint: ${endpoint}`);
            const res = await api.get(endpoint);

            console.log('Prediction API response:', res.data);
            setPredictionData(res.data);

        } catch (err) {
            console.error('Error fetching prediction:', err.response?.data || err.message);
            setError(err.response?.data?.msg || 'Failed to fetch prediction. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [api, predictionType, searchTerm, selectedInterval]);

    // Prepare data for Chart.js
    const chartData = {
        labels: predictionData?.data?.map(item => new Date(item.time * 1000).toLocaleString()) || [],
        datasets: [
            {
                label: 'Actual Price',
                data: predictionData?.data?.filter(item => item.actualPrice !== null).map(item => item.actualPrice),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 2,
                pointRadius: 1,
                tension: 0.4,
                spanGaps: true, // Connects gaps in data (e.g. if actualPrice is null)
            },
            {
                label: 'Predicted Price',
                data: predictionData?.data?.filter(item => item.predictedPrice !== null).map(item => item.predictedPrice),
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.4,
                spanGaps: true,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#e0e0e0', // Light color for legend text
                }
            },
            title: {
                display: true,
                text: `${predictionType === 'stock' ? 'Stock' : 'Crypto'} Price Prediction for ${searchTerm}`,
                color: '#e0e0e0', // Light color for title
            },
            tooltip: {
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
                    color: '#a0a0a0', // Light color for x-axis ticks
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)', // Light grid lines
                },
            },
            y: {
                ticks: {
                    color: '#a0a0a0', // Light color for y-axis ticks
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

    const allIntervals = getAvailableIntervals();

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
            <h1 className="text-4xl font-bold mb-8 text-center text-teal-400">Price Prediction</h1>

            {/* Prediction Type Toggle */}
            <div className="flex justify-center mb-8 space-x-4">
                <button
                    onClick={() => setPredictionType('stock')}
                    className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                        predictionType === 'stock' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    Stock Prediction
                </button>
                <button
                    onClick={() => setPredictionType('crypto')}
                    className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                        predictionType === 'crypto' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    Crypto Prediction
                </button>
            </div>

            {/* Search and Fetch */}
            <div className="flex justify-center mb-8">
                <input
                    type="text"
                    placeholder={`Enter ${predictionType === 'stock' ? 'Stock Ticker (e.g., AAPL)' : 'Crypto Symbol (e.g., BTC, ETH)'}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                    className="w-full max-w-md p-3 rounded-l-lg bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                    onClick={fetchPrediction}
                    disabled={loading}
                    className="px-6 py-3 rounded-r-lg bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Predicting...' : 'Get Prediction'}
                </button>
            </div>

            {/* Interval Selection */}
            <div className="mb-8 p-4 bg-gray-800 rounded-lg shadow-md max-w-4xl mx-auto">
                <h3 className="text-xl font-semibold mb-4 text-center">Select Interval</h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {allIntervals.map(interval => (
                        <button
                            key={interval}
                            onClick={() => setSelectedInterval(interval)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                selectedInterval === interval ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                            }`}
                        >
                            {interval.replace('m', ' Min').replace('h', ' Hr').replace('d', ' Day').replace('w', ' Week').replace('mo', ' Month').replace('y', ' Year')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Prediction Results Display */}
            <div className="max-w-6xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
                {error && <p className="text-red-500 text-center text-lg mb-4">{error}</p>}
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-teal-500"></div>
                        <p className="ml-4 text-lg">Fetching data and running prediction...</p>
                    </div>
                )}

                {predictionData && !loading && !error && (
                    <div>
                        <h2 className="text-3xl font-bold mb-4 text-center">
                            {predictionData.symbol} ({predictionData.interval.toUpperCase()})
                        </h2>
                        <div className="h-96 mb-8">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-lg">
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <p className="text-gray-400">Last Actual Price:</p>
                                <p className="text-white font-bold">
                                    {predictionData.historicalData?.length > 0
                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(predictionData.historicalData[predictionData.historicalData.length - 1].close)
                                        : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <p className="text-gray-400">Predicted Price:</p>
                                <p className="text-teal-400 font-bold">
                                    {predictionData.predictedPrice
                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(predictionData.predictedPrice)
                                        : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <p className="text-gray-400">Prediction Message:</p>
                                <p className="text-gray-200">{predictionData.predictionMessage || 'No specific message.'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PredictPage;