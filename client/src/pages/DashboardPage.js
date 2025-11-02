// client/src/pages/DashboardPage.js - FINAL CORRECTED VERSION
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Loader from '../components/Loader';
// axios import removed as it's no longer used directly, 'api' from AuthContext is used instead

// Import your new dashboard sub-components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatCardsGrid from '../components/dashboard/StatCardsGrid';
import MarketDataSearch from '../components/dashboard/MarketDataSearch';
import AIDataGraph from '../components/dashboard/AIDataGraph';
import NewsFeedCard from '../components/dashboard/NewsFeedCard';
import DashboardCard from '../components/dashboard/DashboardCard';

// Icon Imports (using lucide-react as an example)
// Removed unused icons, keeping only those explicitly used or planned
import { BriefcaseBusiness, Bitcoin, LineChart } from 'lucide-react';

// --- Keyframes and other global styles ---
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
    const [dashboardSummary, setDashboardSummary] = useState([]);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    // State for market overview data
    const [marketData, setMarketData] = useState(null);
    const [loadingMarketData, setLoadingMarketData] = useState(true);
    const [errorMarketData, setErrorMarketData] = useState(null);

    const [aiGraphData, setAiGraphData] = useState([]);
    const [aiGraphLoading, setAiGraphLoading] = useState(true);
    const [aiGraphError, setAiGraphError] = useState(null);

    const [news, setNews] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);

    // Effect for authentication redirection
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    // Effect for fetching dashboard summary data
    useEffect(() => {
        const fetchDashboardSummary = async () => {
            if (!api || !isAuthenticated) {
                setDashboardLoading(false);
                return;
            }

            setDashboardLoading(true);
            setDashboardError(null);
            try {
                // CORRECTED: Path is now relative to the baseURL set in AuthContext (which already includes /api)
                const res = await api.get('/dashboard/summary');
                if (res.data && Array.isArray(res.data.mainMetrics)) {
                    setDashboardSummary(res.data.mainMetrics);
                } else {
                    setDashboardError('Invalid summary data format.');
                    setDashboardSummary([]);
                }
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

    // Effect for fetching market overview data
    useEffect(() => {
        const fetchMarketOverview = async () => {
            if (!api || !isAuthenticated) {
                setLoadingMarketData(false);
                return;
            }

            setLoadingMarketData(true);
            setErrorMarketData(null);
            try {
                // CORRECTED: Path is now relative to the baseURL set in AuthContext (which already includes /api)
                const res = await api.get('/dashboard/market-overview');
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
    }, [api, isAuthenticated, authLoading]);

    // Effect for fetching AI Graph Data
    useEffect(() => {
        const fetchAiGraphData = async () => {
            if (!api || !isAuthenticated) {
                setAiGraphLoading(false);
                return;
            }

            setAiGraphLoading(true);
            setAiGraphError(null);
            try {
                // CORRECTED: Path is now relative to the baseURL set in AuthContext (which already includes /api)
                const res = await api.get('/dashboard/ai-graph-data');
                if (res.data && Array.isArray(res.data)) {
                    setAiGraphData(res.data);
                } else {
                    setAiGraphError('Invalid AI graph data format.');
                    setAiGraphData([]);
                }
            } catch (err) {
                console.error('Error fetching AI graph data:', err.response?.data?.msg || err.message);
                setAiGraphError('Failed to fetch AI graph data.');
            } finally {
                setAiGraphLoading(false);
            }
        };

        if (isAuthenticated && !authLoading && api) {
            fetchAiGraphData();
        }
    }, [api, isAuthenticated, authLoading]);

    // Effect for fetching News Data
    useEffect(() => {
        const fetchNews = async () => {
            if (!api || !isAuthenticated) {
                setNewsLoading(false);
                return;
            }

            setNewsLoading(true);
            setNewsError(null);
            try {
                // CORRECTED: Path is now relative to the baseURL set in AuthContext (which already includes /api)
                const res = await api.get('/dashboard/news');
                if (res.data && Array.isArray(res.data)) {
                    setNews(res.data);
                } else {
                    setNewsError('Invalid news data format.');
                    setNews([]);
                }
            } catch (err) {
                console.error('Error fetching news:', err.response?.data?.msg || err.message);
                setNewsError('Failed to fetch news.');
            } finally {
                setNewsLoading(false);
            }
        };

        if (isAuthenticated && !authLoading && api) {
            fetchNews();
        }
    }, [api, isAuthenticated, authLoading]);

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
                {/* Ensure your StatCardsGrid component correctly handles an array for summary */}
                <StatCardsGrid summary={dashboardSummary} />

                <SectionTitle>Real-Time Market Data & Analytics</SectionTitle>

                <TwoColumnLayout>
                    <MainContentArea>
                        {/* 3. AI Data Graph */}
                        <AIDataGraph
                            data={aiGraphData}
                            loading={aiGraphLoading}
                            error={aiGraphError}
                        />

                        {/* NEW: Market Overview Data Card */}
                        <Card>
                            <SectionTitle style={{ marginBottom: '1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
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
                        <MarketDataSearch api={api} />

                    </MainContentArea>

                    <SideContentArea>
                        {/* 5. News Feed Card */}
                        <NewsFeedCard
                            news={news}
                            loading={newsLoading}
                            error={newsError}
                        />
                        {/* Quick Links Card */}
                        <Card>
                            <h3>Quick Links</h3>
                            <p>This section can host quick links to other parts of your app or external resources.</p>
                            <ul>
                                {/* Changed to use Link for proper navigation */}
                                <li><Link to="/predict" style={{ color: '#00adef', textDecoration: 'none', fontWeight: 'bold' }}>Go to Predictions</Link></li>
                                <li><Link to="/settings" style={{ color: '#00adef', textDecoration: 'none', fontWeight: 'bold' }}>Account Settings</Link></li>
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