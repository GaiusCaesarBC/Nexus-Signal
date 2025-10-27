import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Newspaper } from 'lucide-react';
import Loader from '../Loader';

const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 20px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

const Card = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: 100%;
`;

const NewsFeedHeader = styled.h3`
    font-size: 1.6rem;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-bottom: 1rem;
`;

const NewsList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    flex-grow: 1;
    overflow-y: auto;
    max-height: 500px;
    scrollbar-width: thin;
    scrollbar-color: #00adef #1e293b;

    &::-webkit-scrollbar {
        width: 8px;
    }
    &::-webkit-scrollbar-track {
        background: #1e293b;
        border-radius: 10px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #00adef;
        border-radius: 10px;
        border: 2px solid #1e293b;
    }
`;

const NewsItem = styled.li`
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
    &:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    a {
        color: #00adef;
        text-decoration: none;
        font-weight: bold;
        display: block;
        &:hover {
            text-decoration: underline;
            color: #4ddbff;
        }
    }
    p {
        font-size: 0.9rem;
        color: #94a3b8;
        margin-top: 0.5rem;
    }
    span {
        font-size: 0.8rem;
        color: #64748b;
        display: block;
        margin-top: 0.3rem;
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

const NewsFeedCard = ({ api }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Mock news data defined INSIDE useEffect or the function it calls
        // This is the key change to resolve the ESLint warning
        const mockNews = [
            { id: 1, title: "Tech Giants Announce Q3 Earnings Ahead of Forecast", source: "Financial Times", time: "2 hours ago", url: "https://www.ft.com" },
            { id: 2, title: "Inflation Concerns Ease Ahead of Fed Meeting", source: "Bloomberg", time: "4 hours ago", url: "https://www.bloomberg.com" },
            { id: 3, title: "Oil Prices Dip Amidst Global Demand Worries", source: "Reuters", time: "1 day ago", url: "https://www.reuters.com" },
            { id: 4, title: "Cryptocurrency Market Sees Renewed Volatility", source: "CoinDesk", time: "1 day ago", url: "https://www.coindesk.com" },
            { id: 5, title: "New AI Breakthrough in Medical Diagnostics Announced", source: "Science Daily", time: "2 days ago", url: "https://www.sciencedaily.com" },
            { id: 6, title: "Global Stock Markets Show Mixed Performance This Week", source: "Wall Street Journal", time: "3 days ago", url: "https://www.wsj.com" },
        ];

        const fetchNews = async () => {
            setLoading(true);
            setError(null);
            try {
                console.log('Fetching news...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                setNews(mockNews); // Now mockNews is in scope
            } catch (err) {
                console.error('Error fetching news:', err);
                setError('Failed to load news feed.');
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []); // Empty dependency array is correct now as 'mockNews' is defined within the effect's closure

    return (
        <Card>
            <NewsFeedHeader>
                <Newspaper size={24} color="#f8fafc" /> Latest Market News
            </NewsFeedHeader>
            {loading && <Loader />}
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {!loading && !error && (
                <NewsList>
                    {news.length > 0 ? (
                        news.map((item) => (
                            <NewsItem key={item.id}>
                                <a href={item.url || "#"} target="_blank" rel="noopener noreferrer">
                                    {item.title}
                                </a>
                                <p>{item.source} <span>• {item.time}</span></p>
                            </NewsItem>
                        ))
                    ) : (
                        <p>No news available.</p>
                    )}
                </NewsList>
            )}
        </Card>
    );
};

export default NewsFeedCard;