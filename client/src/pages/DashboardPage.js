// client/src/pages/DashboardPage.js - Updated for Stock/Crypto search and display
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import Loader from '../components/Loader';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {TrendingUp, Clock, BarChart2, DollarSign, Activity, Zap, Bitcoin, LineChart as LineChartIcon} from 'lucide-react'; // Added Bitcoin and LineChartIcon

// --- Keyframes for subtle animations ---
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 20px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

// --- New Styled Components for the Flashy Dashboard ---

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

const HeaderSection = styled.div`
    text-align: center;
    margin-bottom: 2rem;
    h1 {
        font-size: 3.8rem;
        color: #00adef; /* Nexus blue */
        margin-bottom: 0.5rem;
        letter-spacing: -1px;
        text-shadow: 0 0 15px rgba(0, 173, 237, 0.6);
        span {
            color: #f8fafc;
        }
    }
    p {
        font-size: 1.3rem;
        color: #94a3b8;
        max-width: 800px;
        margin: 0 auto;
        line-height: 1.5;
    }
`;

const StatGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    margin-bottom: 2.5rem;
`;

const StatCard = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid rgba(0, 173, 237, 0.2);

    &:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    }

    h3 {
        font-size: 1.4rem;
        color: #e0e0e0;
        margin-bottom: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    p {
        font-size: 2.2rem;
        font-weight: bold;
        color: #00adef; /* Nexus blue */
        margin-bottom: 0.5rem;
        text-shadow: 0 0 10px rgba(0, 173, 237, 0.4);
    }
    span {
        font-size: 0.95rem;
        color: #94a3b8;
    }
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

const GraphContainer = styled(Card)`
    height: 400px; /* Fixed height for graphs */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #15202b; /* Slightly different background for charts */
    border: 1px solid rgba(0, 173, 237, 0.3);
`;

const NewsFeed = styled(Card)`
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        &:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
    }
    a {
        color: #00adef;
        text-decoration: none;
        font-weight: bold;
        &:hover {
            text-decoration: underline;
        }
    }
    p {
        font-size: 0.9rem;
        color: #94a3b8;
        margin-top: 0.5rem;
    }
`;

// Styled NavLink for internal navigation within the dashboard (e.g., Quick Links)
const StyledNavLink = styled(RouterNavLink)`
    color: #00adef;
    text-decoration: none;
    font-weight: bold;
    transition: color 0.2s ease-in-out;
    &:hover {
        color: #74ccf4;
        text-decoration: underline;
    }
`;

// --- Stock/Crypto Search Styled Components ---
const SearchSection = styled(Card)`
    width: 100%;
    max-width: none;
    margin-top: 0;
    padding-top: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;

    h3 {
        font-size: 1.8rem;
        color: #e0e0e0;
        margin-bottom: 1.5rem;
        text-align: center;
    }
`;

const InputGroup = styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 450px;
`;

const Input = styled.input`
    padding: 0.9rem 1.2rem;
    border: 1px solid #00adef;
    border-radius: 8px;
    font-size: 1.05rem;
    flex-grow: 1;
    margin-right: 0.8rem;
    background-color: #1a273b;
    color: #f8fafc;
    transition: all 0.3s ease;

    &::placeholder {
        color: #64748b;
    }

    &:focus {
        outline: none;
        border-color: #008cd4;
        box-shadow: 0 0 0 4px rgba(0, 173, 237, 0.4);
    }
`;

const Button = styled.button`
    padding: 0.9rem 1.8rem;
    background: linear-gradient(90deg, #00adef 0%, #008cd4 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.05rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 173, 237, 0.4);

    &:hover {
        background: linear-gradient(90deg, #008cd4 0%, #00adef 100%);
        box-shadow: 0 6px 20px rgba(0, 173, 237, 0.6);
        transform: translateY(-2px);
    }

    &:disabled {
        background: #4a5a6b;
        cursor: not-allowed;
        opacity: 0.7;
        transform: none;
        box-shadow: none;
    }
`;

const SearchToggleButtonGroup = styled.div`
    display: flex;
    margin-bottom: 1.5rem;
    border-radius: 8px;
    overflow: hidden; /* Ensures border-radius applies to children */
    border: 1px solid #00adef; /* Border around the group */
    background-color: #1a273b;
`;

const SearchToggleButton = styled.button`
    flex: 1;
    padding: 0.8rem 1.2rem;
    background-color: ${props => (props.active ? '#00adef' : 'transparent')};
    color: ${props => (props.active ? '#000' : '#f8fafc')}; /* Darker text for active, lighter for inactive */
    border: none;
    cursor: pointer;
    font-size: 1rem;
    font-weight: ${props => (props.active ? 'bold' : 'normal')};
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: ${props => (props.active ? '#008cd4' : '#2c3e50')};
        color: ${props => (props.active ? '#000' : '#e0e0e0')};
    }

    &:first-child {
        border-right: ${props => (props.active ? 'none' : '1px solid #00adef')};
    }
    &:last-child {
        border-left: ${props => (props.active ? 'none' : '1px solid #00adef')};
    }
`;


const StockQuoteDisplay = styled.div`
    margin-top: 2rem;
    text-align: left;
    background-color: #1a273b;
    padding: 2rem;
    border-radius: 12px;
    width: 100%;
    max-width: 450px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 173, 237, 0.2);

    h3 {
        color: #00adef; /* Nexus blue */
        margin-bottom: 1.2rem;
        font-size: 1.6rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    p {
        margin-bottom: 0.8rem;
        font-size: 1.05rem;
        span {
            font-weight: bold;
            color: #74ccf4;
            display: inline-block;
            min-width: 120px; /* Align labels */
        }
        &.price {
            font-size: 1.8rem;
            color: #f8fafc;
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
            margin-bottom: 1rem;
        }
        &.positive {
            color: #4CAF50;
        }
        &.negative {
            color: #f44336;
        }
    }
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    animation: ${pulseGlow} 1.5s infinite alternate;
`;
// --- End New Styled Components ---

const DashboardPage = () => {
    const { user, api, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [searchSymbol, setSearchSymbol] = useState('');
    const [searchType, setSearchType] = useState('stock'); // 'stock' or 'crypto'
    const [quoteData, setQuoteData] = useState(null); // Renamed from stockQuote to quoteData for generality
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // Mock data for graphs and news feed
    const mockChartData = [
        { name: 'Mon', value: 4000 },
        { name: 'Tue', value: 3000 },
        { name: 'Wed', value: 2000 },
        { name: 'Thu', value: 2780 },
        { name: 'Fri', value: 1890 },
        { name: 'Sat', value: 2390 },
        { name: 'Sun', value: 3490 },
    ];

    const mockMarketOverview = [
        { id: 1, title: "Tech Stocks Surge on AI Enthusiasm", source: "Financial Times", time: "2 hours ago" },
        { id: 2, title: "Inflation Concerns Ease Ahead of Fed Meeting", source: "Bloomberg", time: "4 hours ago" },
        { id: 3, title: "Oil Prices Dip Amidst Global Demand Worries", source: "Reuters", time: "1 day ago" },
        { id: 4, title: "Cryptocurrency Market Sees Renewed Volatility", source: "CoinDesk", time: "1 day ago" },
    ];


    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        setSearchError(null);
        setQuoteData(null); // Reset all quote data

        if (!searchSymbol) {
            setSearchError(`Please enter a ${searchType} symbol.`);
            return;
        }

        setSearchLoading(true);
        try {
            console.log(`Fetching ${searchType} quote for ${searchSymbol} from ${api.defaults.baseURL}/api/market-data/quote/${searchSymbol}?type=${searchType}`);
            // Append the 'type' as a query parameter
            const res = await api.get(`/api/market-data/quote/${searchSymbol}?type=${searchType}`);
            console.log(`${searchType} Quote API response:`, res.data);

            if (res.data) {
                setQuoteData(res.data);
            } else {
                setSearchError(`No quote found for ${searchType} symbol: ${searchSymbol}. Please try another symbol.`);
            }

        } catch (err) {
            console.error(`Error fetching ${searchType} quote:`, err.response?.data?.msg || err.message);
            setSearchError(err.response?.data?.msg || `Failed to fetch ${searchType} quote for ${searchSymbol}. Please ensure the symbol is correct and try again.`);
        } finally {
            setSearchLoading(false);
        }
    };


    if (authLoading) {
        return <Loader />;
    }

    if (!isAuthenticated) {
        return (
            <DashboardContainer>
                <ContentWrapper>
                    <Card>
                        <ErrorMessage>You need to be logged in to view this page.</ErrorMessage>
                        <Button onClick={() => navigate('/login')}>Login Now</Button>
                    </Card>
                </ContentWrapper>
            </DashboardContainer>
        );
    }

    // Determine change class for styling
    const getChangeClass = (change) => {
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return '';
    };

    return (
        <DashboardContainer>
            <ContentWrapper>
                <HeaderSection>
                    <h1>Welcome, <span>{user ? user.username : 'Trader'}!</span></h1>
                    <p>Your comprehensive control center for AI-powered market intelligence. Stay ahead with real-time data, predictive analytics, and personalized insights.</p>
                </HeaderSection>

                <StatGrid>
                    <StatCard>
                        <h3><Activity size={24} color="#00adef" /> Active Signals</h3>
                        <p>12</p>
                        <span>Today's AI-driven trade recommendations</span>
                    </StatCard>
                    <StatCard>
                        <h3><TrendingUp size={24} color="#4CAF50" /> Portfolio Growth</h3>
                        <p>+3.7%</p>
                        <span>Last 30 days (mock data)</span>
                    </StatCard>
                    <StatCard>
                        <h3><Zap size={24} color="#f97316" /> Market Volatility</h3>
                        <p>High</p>
                        <span>Current AI sentiment (mock data)</span>
                    </StatCard>
                    <StatCard>
                        <h3><Clock size={24} color="#94a3b8" /> Last Update</h3>
                        <p>Just now</p>
                        <span>Real-time data stream (mock)</span>
                    </StatCard>
                </StatGrid>

                <SectionTitle>Real-Time Market Data & Analytics</SectionTitle>

                <TwoColumnLayout>
                    <MainContentArea>
                        <GraphContainer>
                            <h3><BarChart2 size={24} color="#e0e0e0" /> AI Trend Prediction (Mock Data)</h3>
                            <ResponsiveContainer width="100%" height="80%">
                                <AreaChart data={mockChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00adef" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#00adef" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#64748b" />
                                    <YAxis stroke="#64748b" />
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#2c3e50', border: 'none', borderRadius: '4px' }}
                                        itemStyle={{ color: '#e0e0e0' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#00adef" fillOpacity={1} fill="url(#colorUv)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </GraphContainer>

                        {/* --- Stock/Crypto Search Section --- */}
                        <SearchSection>
                            <h3>
                                {searchType === 'stock' ? (
                                    <DollarSign size={24} color="#e0e0e0" />
                                ) : (
                                    <Bitcoin size={24} color="#e0e0e0" />
                                )}
                                Search Real-time {searchType === 'stock' ? 'Stock' : 'Crypto'} Quote
                            </h3>

                            <SearchToggleButtonGroup>
                                <SearchToggleButton
                                    active={searchType === 'stock'}
                                    onClick={() => {
                                        setSearchType('stock');
                                        setQuoteData(null); // Clear previous search results
                                        setSearchError(null);
                                        setSearchSymbol('');
                                    }}
                                >
                                    Stocks
                                </SearchToggleButton>
                                <SearchToggleButton
                                    active={searchType === 'crypto'}
                                    onClick={() => {
                                        setSearchType('crypto');
                                        setQuoteData(null); // Clear previous search results
                                        setSearchError(null);
                                        setSearchSymbol('');
                                    }}
                                >
                                    Cryptocurrencies
                                </SearchToggleButton>
                            </SearchToggleButtonGroup>

                            <InputGroup>
                                <Input
                                    type="text"
                                    placeholder={`Enter ${searchType} symbol (e.g., ${searchType === 'stock' ? 'MSFT' : 'BTC'})`}
                                    value={searchSymbol}
                                    onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearchSubmit(e);
                                        }
                                    }}
                                />
                                <Button onClick={handleSearchSubmit} disabled={searchLoading}>
                                    {searchLoading ? 'Searching...' : 'Search'}
                                </Button>
                            </InputGroup>

                            {searchError && <ErrorMessage>{searchError}</ErrorMessage>}
                            {searchLoading && <Loader message={`Fetching ${searchType} quote...`} />}

                            {quoteData && (
                                <StockQuoteDisplay>
                                    <h3>
                                        {quoteData.type === 'stock' ? (
                                            <DollarSign size={24} color="#00adef" />
                                        ) : (
                                            <Bitcoin size={24} color="#00adef" />
                                        )}
                                        {quoteData.symbol} {quoteData.type === 'crypto' && `(${quoteData.name})`}
                                    </h3>
                                    <p className="price"><span>Price:</span> ${quoteData.price ? quoteData.price.toFixed(2) : 'N/A'}</p>

                                    {quoteData.type === 'stock' ? (
                                        <>
                                            <p><span>Open:</span> ${quoteData.open ? quoteData.open.toFixed(2) : 'N/A'}</p>
                                            <p><span>High:</span> ${quoteData.high ? quoteData.high.toFixed(2) : 'N/A'}</p>
                                            <p><span>Low:</span> ${quoteData.low ? quoteData.low.toFixed(2) : 'N/A'}</p>
                                            <p><span>Previous Close:</span> ${quoteData.previousClose ? quoteData.previousClose.toFixed(2) : 'N/A'}</p>
                                            <p className={getChangeClass(quoteData.change)}>
                                                <span>Change:</span> ${quoteData.change ? quoteData.change.toFixed(2) : 'N/A'} ({quoteData.changePercent ? quoteData.changePercent.toFixed(2) : 'N/A'}%)
                                            </p>
                                            <p><span>Volume:</span> {quoteData.volume ? quoteData.volume.toLocaleString() : 'N/A'}</p>
                                            <p><span>Last Trading Day:</span> {quoteData.latestTradingDay || 'N/A'}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p><span>Market Cap:</span> ${quoteData.marketCap ? quoteData.marketCap.toLocaleString() : 'N/A'}</p>
                                            <p><span>24h Volume:</span> ${quoteData.volume24h ? quoteData.volume24h.toLocaleString() : 'N/A'}</p>
                                            <p className={getChangeClass(quoteData.change24h)}>
                                                <span>24h Change:</span> {quoteData.change24h ? quoteData.change24h.toFixed(2) : 'N/A'}%
                                            </p>
                                            <p><span>Last Updated:</span> {quoteData.lastUpdatedAt ? new Date(quoteData.lastUpdatedAt).toLocaleString() : 'N/A'}</p>
                                        </>
                                    )}
                                </StockQuoteDisplay>
                            )}
                        </SearchSection>
                        {/* --- End Stock/Crypto Search Section --- */}

                    </MainContentArea>

                    <SideContentArea>
                        <NewsFeed>
                            <h3>Latest Market News (Mock)</h3>
                            <ul>
                                {mockMarketOverview.map(news => (
                                    <li key={news.id}>
                                        <a href="#" onClick={(e) => e.preventDefault()}>{news.title}</a>
                                        <p>{news.source} - {news.time}</p>
                                    </li>
                                ))}
                            </ul>
                        </NewsFeed>
                        <Card>
                            <h3>Quick Links</h3>
                            <p>This section can host quick links to other parts of your app or external resources.</p>
                            <ul>
                                <li><StyledNavLink to="/predict">Go to Predictions</StyledNavLink></li>
                                <li><StyledNavLink to="/settings">Account Settings</StyledNavLink></li>
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