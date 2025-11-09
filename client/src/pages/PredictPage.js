// client/src/pages/PredictPage.js - FULL CORRECTED VERSION WITH ALL INTERVALS
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { Chart } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, LineController,
    Title, Tooltip, Legend, TimeScale, Filler, CandlestickController, CandlestickElement
);

const fadeIn = keyframes`from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }`;
const PredictPageContainer = styled.div`
    display: flex; flex-direction: column; align-items: center; padding: 3rem 1.5rem;
    min-height: calc(100vh - 60px); background-color: #0d1a2f; color: #e0e6ed;
    font-family: 'Inter', sans-serif; animation: ${fadeIn} 0.8s ease-out;
`;
const TitleStyled = styled.h1`
    font-size: 2.8rem; font-weight: 700; color: #00adef; text-align: center;
    margin-bottom: 2.5rem; text-shadow: 0 0 10px rgba(0, 173, 239, 0.3);
`;
const Card = styled.div`
    background: linear-gradient(145deg, #1a273b 0%, #2c3e50 100%); border-radius: 12px;
    padding: 2.5rem; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2); width: 100%; margin-bottom: 2rem;
`;
const PredictBox = styled(Card)`max-width: 900px; display: flex; flex-direction: column; align-items: center;`;
const TypeToggleGroup = styled.div`
    display: flex; margin-bottom: 2rem; border-radius: 8px; overflow: hidden;
    background-color: #0f172a; border: 1px solid #334155;
`;
const TypeToggleButton = styled.button`
    padding: 0.8rem 1.5rem; border: none; background-color: ${props => (props.active ? '#00adef' : 'transparent')};
    color: ${props => (props.active ? '#ffffff' : '#94a3b8')}; font-size: 1rem; font-weight: 600;
    cursor: pointer; transition: all 0.3s ease; flex: 1;
    &:hover:not(:disabled) { background-color: ${props => (props.active ? '#008bb3' : '#1e293b')}; color: white; }
    &:first-child { border-right: 1px solid #334155; }
`;
const InputGroup = styled.form`
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; width: 100%;
    @media (max-width: 768px) { grid-template-columns: 1fr; }
`;
const InputControl = styled.div`display: flex; flex-direction: column; align-items: flex-start; width: 100%;`;
const ControlLabel = styled.label`font-size: 0.95rem; color: #94a3b8; margin-bottom: 0.5rem;`;
const Input = styled.input`
    padding: 0.8rem 1rem; border: 1px solid #334155; border-radius: 8px; font-size: 1rem;
    width: 100%; background-color: #0f172a; color: #e0e6ed;
    &:focus { outline: none; border-color: #00adef; box-shadow: 0 0 0 3px rgba(0, 173, 239, 0.3); }
`;
const Select = styled.select`
    padding: 0.8rem 1rem; border: 1px solid #334155; border-radius: 8px; font-size: 1rem;
    background-color: #0f172a; color: #e0e6ed; width: 100%; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
    background-position: right 0.75rem center; background-repeat: no-repeat; background-size: 1em 1em;
    &:focus { outline: none; border-color: #00adef; box-shadow: 0 0 0 3px rgba(0, 173, 239, 0.3); }
`;
const Button = styled.button`
    padding: 0.8rem 1.5rem; background: linear-gradient(90deg, #00adef 0%, #007bff 100%);
    color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600;
    cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 1rem; grid-column: 1 / -1;
    &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0, 173, 239, 0.4); }
    &:disabled { background: #334155; cursor: not-allowed; opacity: 0.7; }
`;
const PredictionResult = styled(Card)`
    max-width: 900px; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
    @media (max-width: 768px) { grid-template-columns: 1fr; }
`;
const ResultDetail = styled.p`
    font-size: 1.1rem; color: #cbd5e1; margin: 0.5rem 0;
    strong { color: #94a3b8; font-weight: 600; margin-right: 0.5rem; }
`;
const PredictionValue = styled.p`
    font-size: 2.5rem; font-weight: 700; margin: 0; display: flex; align-items: center;
    color: ${props => props.direction === 'Up' ? '#28a745' : props.direction === 'Down' ? '#dc3545' : '#e0e6ed'};
`;
const DirectionArrow = styled.span`font-size: 1.8rem; margin-left: 0.8rem;`;
const ChartContainer = styled(Card)`max-width: 900px; height: 500px; padding: 1.5rem;`;
const ErrorMessage = styled.p`color: #ff6b6b; margin-top: 1rem; font-size: 1rem; font-weight: 600;`;
const InitialMessage = styled.p`color: #94a3b8; font-size: 1.1rem; margin-top: 1rem;`;

const PredictPage = () => {
    const { api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [predictionType, setPredictionType] = useState('stock');
    const [symbol, setSymbol] = useState('');
    const [selectedRange, setSelectedRange] = useState('1Y');
    const [selectedInterval, setSelectedInterval] = useState('1d');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(null);
    const [fullHistoricalData, setFullHistoricalData] = useState(null);

    // --- RESTORED & EXPANDED INTERVAL OPTIONS ---
    const intervalOptions = useMemo(() => ({
        '1D': ['1min', '5min', '15min', '30min', '1h'],
        '5D': ['5min', '15min', '30min', '60min', '1h', '1d'],
        '1M': ['30min', '60min', '1h', '1d', '1wk'],
        '3M': ['1h', '1d', '1wk', '1mo'],
        '6M': ['1h', '1d', '1wk', '1mo'],
        '1Y': ['1h', '1d', '1wk', '1mo'],
        '5Y': ['1d', '1wk', '1mo'],
        'MAX': ['1d', '1wk', '1mo'],
    }), []);

    const rangeOptions = { '1D': '1 Day', '5D': '5 Days', '1M': '1 Month', '3M': '3 Months', '6M': '6 Months', '1Y': '1 Year', '5Y': '5 Years', 'MAX': 'Max' };

    const getIntervalDisplayName = (interval) => {
        switch (interval) {
            case '1min': return '1 Minute'; case '5min': return '5 Minutes';
            case '15min': return '15 Minutes'; case '30min': return '30 Minutes';
            case '60min': return '60 Minutes'; case '1h': return '1 Hour';
            case '1d': return '1 Day'; case '1wk': return '1 Week'; case '1mo': return '1 Month';
            default: return interval;
        }
    };

    useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [isAuthenticated, authLoading, navigate]);

    // Reset state when prediction type changes
    useEffect(() => {
        setSymbol(''); setPrediction(null); setChartData(null); setError(null);
        setCurrentPrice(null); setFullHistoricalData(null);
        setSelectedRange('6M'); setSelectedInterval('1d');
    }, [predictionType]);

    const handleRangeChange = (newRange) => {
        setSelectedRange(newRange);
        const validIntervals = intervalOptions[newRange];
        if (validIntervals && !validIntervals.includes(selectedInterval)) {
            setSelectedInterval(validIntervals[0]); // Default to first valid option
        }
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(null); setPrediction(null); setChartData(null); setCurrentPrice(null); setFullHistoricalData(null);

        if (!symbol) { setError(`Please enter a ${predictionType} symbol.`); return; }
        if (!api) { setError('API client not initialized. Please re-login.'); return; }

        setLoading(true);
        try {
            const endpoint = predictionType === 'stock' ? `/stocks/historical/${symbol}` : `/crypto/historical/${symbol}`;
            const res = await api.get(endpoint, { params: { range: selectedRange, interval: selectedInterval } });

            const { historicalData, predictedPrice, predictedDirection, confidence, predictionMessage, percentageChange } = res.data;
            if (!historicalData || historicalData.length === 0) throw new Error('No data found for this symbol and range.');

            setFullHistoricalData(historicalData);
            const lastClose = historicalData[historicalData.length - 1].close;
            setCurrentPrice(lastClose);
            setPrediction({ symbol, predictedPrice, predictedDirection, confidence, message: predictionMessage, percentageChange });

            // Chart Data Prep - Zoom to last 30 points by default
            let chartDataView = historicalData;
            if (historicalData.length > 30) {
                 chartDataView = historicalData.slice(-30);
            }

            const chartPoints = chartDataView.map(d => ({
                x: new Date(d.time).getTime(), // Ensure milliseconds
                o: d.open, h: d.high, l: d.low, c: d.close, y: d.close
            }));
            const lastPoint = chartPoints[chartPoints.length - 1];
            const nextTime = lastPoint.x + (24 * 60 * 60 * 1000); 

            setChartData({
                datasets: [
                    ...(predictionType === 'stock' && chartPoints[0].o ? [{
                        label: `${symbol} OHLC`, data: chartPoints, type: 'candlestick',
                        borderColor: '#e0e6ed', color: { up: '#00adef', down: '#e94560', unchanged: '#999' }, yAxisID: 'y'
                    }] : []),
                    {
                        label: `${symbol} Price`, data: chartPoints, type: 'line',
                        borderColor: '#00adef', backgroundColor: 'rgba(0, 173, 239, 0.1)',
                        borderWidth: 2, pointRadius: 0, tension: 0.1, yAxisID: 'y', fill: predictionType === 'crypto'
                    },
                    {
                        label: 'Predicted', data: [{ x: lastPoint.x, y: lastPoint.y }, { x: nextTime, y: predictedPrice }],
                        type: 'line', borderColor: '#e94560', borderWidth: 2, borderDash: [5, 5],
                        pointRadius: [0, 6], pointBackgroundColor: '#e94560', yAxisID: 'y'
                    }
                ]
            });
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.msg || err.message || 'Failed to fetch prediction.');
        } finally { setLoading(false); }
    }, [api, predictionType, symbol, selectedRange, selectedInterval]);

    const getChartOptions = useCallback((type, sym) => ({
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { color: '#e0e6ed' } },
            title: { display: true, text: `${sym} ${type === 'stock' ? 'Stock' : 'Crypto'} Analysis`, color: '#e0e0e0', font: { size: 18 } }
        },
        scales: {
            x: { type: 'time', time: { tooltipFormat: 'MMM dd HH:mm' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0a0' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0a0' } }
        }
    }), []);


    return (
        <PredictPageContainer>
            <TitleStyled>AI-Powered Market Predictions</TitleStyled>
            <PredictBox>
                <TypeToggleGroup>
                    <TypeToggleButton active={predictionType === 'stock'} onClick={() => setPredictionType('stock')} disabled={loading}>Stock</TypeToggleButton>
                    <TypeToggleButton active={predictionType === 'crypto'} onClick={() => setPredictionType('crypto')} disabled={loading}>Crypto</TypeToggleButton>
                </TypeToggleGroup>
                <InputGroup onSubmit={handleSubmit}>
                    <InputControl>
                        <ControlLabel>Symbol</ControlLabel>
                        <Input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder={predictionType === 'stock' ? 'AAPL' : 'BTC'} required disabled={loading} />
                    </InputControl>
                    <InputControl>
                        <ControlLabel>Range</ControlLabel>
                        <Select value={selectedRange} onChange={(e) => handleRangeChange(e.target.value)} disabled={loading}>
                            {Object.entries(rangeOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                    </InputControl>
                    <InputControl>
                        <ControlLabel>Interval</ControlLabel>
                        <Select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)} disabled={loading}>
                            {intervalOptions[selectedRange]?.map(i => <option key={i} value={i}>{getIntervalDisplayName(i)}</option>)}
                        </Select>
                    </InputControl>
                    <Button type="submit" disabled={loading || !symbol}>{loading ? 'Analyzing...' : 'Get Prediction'}</Button>
                </InputGroup>
                {error && <ErrorMessage>{error}</ErrorMessage>}
            </PredictBox>
            {loading && <Loader />}
            {!loading && prediction && (
                <PredictionResult>
                    <div>
                        <ResultDetail><strong>Symbol:</strong> {prediction.symbol}</ResultDetail>
                        <ResultDetail><strong>Current:</strong> ${currentPrice?.toFixed(2)}</ResultDetail>
                        <ResultDetail><strong>Predicted:</strong> ${prediction.predictedPrice?.toFixed(2)}</ResultDetail>
                        <PredictionValue direction={prediction.predictedDirection}>
                            {prediction.predictedDirection === 'Up' ? '+' : ''}{prediction.percentageChange?.toFixed(2)}%
                            <DirectionArrow>{prediction.predictedDirection === 'Up' ? '▲' : '▼'}</DirectionArrow>
                        </PredictionValue>
                    </div>
                    <div>
                        <ResultDetail><strong>Confidence:</strong> {prediction.confidence}%</ResultDetail>
                        <ResultDetail><strong>Analysis:</strong> {prediction.message}</ResultDetail>
                    </div>
                </PredictionResult>
            )}
            {!loading && chartData && (
                <ChartContainer>
                    <Chart type='line' data={chartData} options={getChartOptions(predictionType, symbol)} />
                </ChartContainer>
            )}
        </PredictPageContainer>
    );
};

export default PredictPage;