import React, { useState, useContext } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import RealTimeChart from '../components/RealTimeChart';
import Watchlist from '../components/Watchlist';
import Copilot from '../components/Copilot';
import NewsWidget from '../components/NewsWidget';
import { Search, TrendingUp, TrendingDown, MinusCircle, PlusCircle, PieChart } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// The live URL of your backend server on Render
const API_URL = 'https://nexus-signal-server.onrender.com';

const addCacheBust = (url) => `${url}?_t=${new Date().getTime()}`;

const DashboardContainer = styled.div`
    padding: 2rem;
    display: grid;
    grid-template-columns: 2fr 1fr;
    grid-template-areas:
        "main sidebar";
    gap: 2rem;
    align-items: flex-start;

    @media (max-width: 1024px) {
        grid-template-columns: 1fr;
        grid-template-areas:
            "main"
            "sidebar";
    }
`;

const MainContent = styled.div`
    grid-area: main;
    display: flex;
    flex-direction: column;
    gap: 2rem;
`;

const Sidebar = styled.div`
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    position: sticky;
    top: 2rem;
`;

const GlassCard = styled.div`
    background: rgba(44, 62, 80, 0.75);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    padding: 1.5rem;
`;

const SearchContainer = styled(GlassCard)`
    padding: 1rem;
`;

const SearchForm = styled.form`
    display: flex;
    width: 100%;
`;

const SearchInput = styled.input`
    flex-grow: 1;
    border: none;
    background: none;
    outline: none;
    color: #ecf0f1;
    font-size: 1.1rem;
    padding: 0 1rem;

    &::placeholder {
        color: #95a5a6;
    }
`;

const SearchButton = styled.button`
    background: linear-gradient(45deg, #3498db, #2980b9);
    border: none;
    border-radius: 5px;
    color: white;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    }
`;

const ResultCard = styled(GlassCard)`
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
    text-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
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
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-2px);
        background-color: #229954;
        box-shadow: 0 5px 15px rgba(46, 204, 113, 0.4);
    }
`;

const Signal = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: bold;
    color: ${props => props.color || '#ecf0f1'};
    text-shadow: 0 0 8px ${props => props.color || '#ecf0f1'};
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

const SidebarWidget = styled(GlassCard)``;

const WidgetTitle = styled.h3`
    color: #ecf0f1;
    margin-top: 0;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #34495e;
    padding-bottom: 0.5rem;
    text-shadow: 0 0 5px rgba(236, 240, 241, 0.3);
`;

const MoversList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    li {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        color: #bdc3c7;
        span:last-child {
            font-weight: bold;
        }
    }
`;
const Gainer = styled.span` color: #2ecc71; `;
const Loser = styled.span` color: #e74c3c; `;

const Dashboard = () => {
    const [symbol, setSymbol] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, addToWatchlist, watchlist } = useContext(AuthContext);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!symbol) return;
        setLoading(true);
        setError('');
        setPrediction(null);
        try {
            const res = await axios.get(addCacheBust(`${API_URL}/api/predict/${symbol}`));
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
            <MainContent>
                <SearchContainer>
                    <SearchForm onSubmit={handleSearch}>
                        <SearchInput
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            placeholder="Enter stock symbol (e.g., AAPL)"
                        />
                        <SearchButton type="submit">
                            <Search size={20} />
                            Search
                        </SearchButton>
                    </SearchForm>
                </SearchContainer>

                {error && <ErrorMessage>{error}</ErrorMessage>}

                {loading && (
                     <ResultCard>
                        <Skeleton height={40} width={200} baseColor="#34495e" highlightColor="#4a627a"/>
                        <Skeleton height={30} width={100} baseColor="#34495e" highlightColor="#4a627a"/>
                        <AnalysisGrid>
                            <Skeleton height={60} baseColor="#34495e" highlightColor="#4a627a"/>
                            <Skeleton height={60} baseColor="#34495e" highlightColor="#4a627a"/>
                            <Skeleton height={60} baseColor="#34495e" highlightColor="#4a627a"/>
                        </AnalysisGrid>
                        <Skeleton height={400} baseColor="#34495e" highlightColor="#4a627a"/>
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
                                <RealTimeChart data={prediction.historicalData} />
                            )}
                        </ResultCard>
                        <NewsWidget symbol={prediction.symbol} />
                    </>
                )}
            </MainContent>
            <Sidebar>
                {user && <Watchlist />}
                
                <SidebarWidget>
                    <WidgetTitle>Market Movers</WidgetTitle>
                    <MoversList>
                        <li><span>NVDA</span> <Gainer>+5.2%</Gainer></li>
                        <li><span>TSLA</span> <Gainer>+3.1%</Gainer></li>
                        <li><span>BA</span> <Loser>-3.8%</Loser></li>
                        <li><span>NFLX</span> <Gainer>+1.2%</Gainer></li>
                    </MoversList>
                </SidebarWidget>

                <SidebarWidget>
                     <WidgetTitle>Portfolio Snapshot</WidgetTitle>
                     <div style={{textAlign: 'center', color: '#ecf0f1'}}>
                        <PieChart size={80} style={{ margin: '0 auto 1rem' }}/>
                        <h4>+18.7% All Time</h4>
                     </div>
                </SidebarWidget>

            </Sidebar>

            {user && <Copilot />}
        </DashboardContainer>
    );
};

export default Dashboard;

