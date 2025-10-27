// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import axios from 'axios'; // <--- ADDED AXIOS

// Import your new dashboard sub-components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatCardsGrid from '../components/dashboard/StatCardsGrid';
import MarketDataSearch from '../components/dashboard/MarketDataSearch';
import AIDataGraph from '../components/dashboard/AIDataGraph';
import NewsFeedCard from '../components/dashboard/NewsFeedCard';
import DashboardCard from '../components/dashboard/DashboardCard'; // <--- ADDED DashboardCard

// Icon Imports (using lucide-react as an example)
import { DollarSign, TrendingUp, BarChart2, BriefcaseBusiness, Bitcoin, LineChart, Newspaper } from 'lucide-react'; // <--- ADDED LineChart, BriefcaseBusiness, Bitcoin

// Define API_URL (ensure REACT_APP_API_URL is set in client/.env)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; // <--- ADDED API_URL

// --- Keyframes and other global styles (keep these, as they define the overall page look) ---
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 20px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

const DashboardContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background: linear-gradient(145deg, #0d1a2f 0%, #1a273b 100%); /* Darker, gradient background */
    color: #e0e0e0;
    font-family: 'Inter', sans-serif;
    position: relative;
    overflow: hidden; /* For background effects */

    &::before, &::after {
        content: '';
        position: absolute;
        width: 100vw;
        height: 100vw;
        border-radius: 50%;
        opacity: 0.05;
        z-index: 0;
        filter: blur(100px);
    }

    &::before {
        background: radial-gradient(circle, #00adef, transparent 50%); /* Blue glow */
        top: -50vw;
        left: -50vw;
    }

    &::after {
        background: radial-gradient(circle, #f97316, transparent 50%); /* Orange glow */
        bottom: -50vw;
        right: -50vw;
    }
`;

const ContentWrapper = styled.div`
    width: 100%;
    max-width: 1400px; /* Wider content area */
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    animation: ${fadeIn} 1s ease-out forwards;
`;

const SectionTitle = styled.h2`
    font-size: 2.5rem;
    color: #f8fafc;
    margin-bottom: 1.5rem;
    text-align: center;
    position: relative;
    padding-bottom: 0.5rem;

    &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 0;
        transform: translateX(-50%);
        width: 80px;
        height: 3px;
        background-color: #00adef;
        border-radius: 2px;
    }
`;

const TwoColumnLayout = styled.div`
    display: grid;
    grid-template-columns: 2fr 1fr; /* Main content wider than sidebar */
    gap: 2.5rem;

    @media (max-width: 1024px) {
        grid-template-columns: 1fr; /* Stack on smaller screens */
    }
`;

const MainContentArea = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
`;

const SideContentArea = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
`;

const Card = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    animation: ${pulseGlow} 1.5s infinite alternate;
`;

// NEW: Styled component for the grid of market data cards
const MarketOverviewGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
`;


// DashboardPage component
const DashboardPage = () => {
    const { user, api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // State for dashboard summary data (fetched here and passed down)
    const [dashboardSummary, setDashboardSummary] = useState({
        activeSignals: 'N/A',
        portfolioGrowth: 'N/A',
        marketVolatility: 'N/A',
        lastUpdate: 'N/A'
    });
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    // NEW: State for market overview data
    const [marketData, setMarketData] = useState(null);
    const [loadingMarketData, setLoadingMarketData] = useState(true);
    const [errorMarketData, setErrorMarketData] = useState(null);


    // Mock data for the graph for now (will be dynamic later)
    const mockChartData = [
        { name: 'Mon', value: 4000 },
        { name: 'Tue', value: 3000 },
        { name: 'Wed', value: 2000 },
        { name: 'Thu', value: 2780 },
        { name: 'Fri', value: 1890 },
        { name: 'Sat', value: 2390 },
        { name: 'Sun', value: 3490 },
    ];

    // Effect for authentication redirection
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    // Effect for fetching dashboard summary data
    useEffect(() => {
        const fetchDashboardSummary = async () => {
            if (!api) {
                setDashboardError("API client not initialized for dashboard summary.");
                setDashboardLoading(false);
                return;
            }

            setDashboardLoading(true);
            setDashboardError(null);
            try {
                const res = await api.get('/api/dashboard/summary');
                setDashboardSummary({
                    activeSignals: res.data.activeSignals,
                    portfolioGrowth: res.data.portfolioGrowth,
                    marketVolatility: res.data.marketVolatility,
                    lastUpdate: new Date(res.data.lastUpdate).toLocaleTimeString()
                });
            } catch (err) {
                console.error('Error fetching dashboard summary:', err.response?.data?.msg || err.message);
                setDashboardError('Failed to fetch dashboard summary.');
            } finally {
                setDashboardLoading(false);
            }
        };

        if (isAuthenticated && !authLoading && api) {
            fetchDashboardSummary();
        }
    }, [api, isAuthenticated, authLoading]);

    // NEW: Effect for fetching market overview data
    useEffect(() => {
        const fetchMarketOverview = async () => {
            if (!api) { // Use the `api` instance from AuthContext
                setErrorMarketData("API client not initialized for market data.");
                setLoadingMarketData(false);
                return;
            }

            setLoadingMarketData(true);
            setErrorMarketData(null);
            try {
                const res = await api.get(`${API_URL}/api/dashboard/market-overview`);
                setMarketData(res.data);
            } catch (err) {
                console.error("Error fetching market overview data:", err.response?.data?.msg || err.message);
                setErrorMarketData("Failed to load market data.");
            } finally {
                setLoadingMarketData(false);
            }
        };

        if (isAuthenticated && !authLoading && api) {
            fetchMarketOverview();
        }
    }, [api, isAuthenticated, authLoading]); // Dependencies: api, isAuthenticated, authLoading


    if (authLoading || dashboardLoading) {
        return <Loader />;
    }

    if (!isAuthenticated) {
        return (
            <DashboardContainer>
                <ContentWrapper>
                    <Card>
                        <ErrorMessage>You need to be logged in to view this page.</ErrorMessage>
                        <button onClick={() => navigate('/login')} style={{ /* add some basic button styles or import your Button */ }}>Login Now</button>
                    </Card>
                </ContentWrapper>
            </DashboardContainer>
        );
    }

    return (
        <DashboardContainer>
            <ContentWrapper>
                {/* 1. Dashboard Header */}
                <DashboardHeader username={user ? user.username : 'Trader'} />

                {dashboardError && <ErrorMessage>{dashboardError}</ErrorMessage>}

                {/* 2. Stat Cards Grid */}
                <StatCardsGrid summary={dashboardSummary} />

                <SectionTitle>Real-Time Market Data & Analytics</SectionTitle>

                <TwoColumnLayout>
                    <MainContentArea>
                        {/* 3. AI Data Graph */}
                        {/* We pass mockChartData for now, but this component is ready for real data */}
                        <AIDataGraph data={mockChartData} />

                        {/* NEW: Market Overview Data Card */}
                        <Card>
                            <SectionTitle style={{ marginBottom: '1rem', textAlign: 'left', '&::after': { left: '0', transform: 'translateX(0)', width: '60px' } }}>
                                <LineChart size={24} color="#00adef" /> Global Market Snapshot
                            </SectionTitle>
                            {loadingMarketData ? (
                                <p>Loading market data...</p>
                            ) : errorMarketData ? (
                                <ErrorMessage>{errorMarketData}</ErrorMessage>
                            ) : (
                                <MarketOverviewGrid>
                                    {/* Stock Indices */}
                                    {marketData?.stockOverview?.map((item, index) => (
                                        <DashboardCard
                                            key={`stock-${index}`}
                                            title={item.name}
                                            value={item.value}
                                            change={item.change}
                                            changePercent={item.changePercent}
                                            icon={<BriefcaseBusiness size={24} color="#00adef" />}
                                        />
                                    ))}
                                    {/* Crypto Overview */}
                                    {marketData?.cryptoOverview?.map((item, index) => (
                                        <DashboardCard
                                            key={`crypto-${index}`}
                                            title={item.name}
                                            value={item.price}
                                            change={item.change24h}
                                            changePercent={item.changePercent24h}
                                            icon={<Bitcoin size={24} color="#f79316" />} // Using orange for crypto
                                        />
                                    ))}
                                </MarketOverviewGrid>
                            )}
                        </Card>
                        {/* END NEW MARKET OVERVIEW CARD */}

                        {/* 4. Market Data Search */}
                        {/* MarketDataSearch will handle its own internal state for searchSymbol, quoteData etc. */}
                        <MarketDataSearch api={api} />

                    </MainContentArea>

                    <SideContentArea>
                        {/* 5. News Feed Card */}
                        <NewsFeedCard api={api} /> {/* NewsFeedCard will fetch its own news */}

                        {/* Quick Links Card (moved here from previous iteration, can be a generic Card) */}
                        <Card>
                            <h3>Quick Links</h3>
                            <p>This section can host quick links to other parts of your app or external resources.</p>
                            <ul>
                                {/* Changed to use RouterNavLink for proper navigation, assuming it's imported or will be */}
                                <li><a href="/predict" style={{ color: '#00adef', textDecoration: 'none', fontWeight: 'bold' }}>Go to Predictions</a></li>
                                <li><a href="/settings" style={{ color: '#00adef', textDecoration: 'none', fontWeight: 'bold' }}>Account Settings</a></li>
                                {/* Add more links */}
                            </ul>
                        </Card>
                    </SideContentArea>
                </TwoColumnLayout>

            </ContentWrapper>
        </DashboardContainer>
    );
};

export default DashboardPage;