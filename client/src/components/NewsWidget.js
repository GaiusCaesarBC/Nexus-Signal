import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const NewsContainer = styled.div`
    background-color: #2c3e50;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
`;

const NewsHeader = styled.h3`
    color: #ecf0f1;
    margin-top: 0;
    margin-bottom: 1rem;
    border-bottom: 1px solid #34495e;
    padding-bottom: 0.5rem;
`;

const NewsList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const NewsItem = styled.li`
    background-color: #34495e;
    padding: 1rem;
    border-radius: 5px;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #465a71;
    }
`;

const NewsLink = styled.a`
    text-decoration: none;
    color: #ecf0f1;
    font-weight: bold;
`;

const NewsSource = styled.p`
    color: #bdc3c7;
    font-size: 0.8rem;
    margin: 0.3rem 0 0;
`;

const LoadingText = styled.p`
    color: #bdc3c7;
    text-align: center;
`;

const NewsWidget = ({ symbol }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useContext(AuthContext);
    
    // Use your unique Render URL here
    const API_URL = 'https://quantum-trade-server.onrender.com';

    useEffect(() => {
        const fetchNews = async () => {
            if (!symbol || !token) return;
            setLoading(true);
            try {
                const config = {
                    headers: { 'x-auth-token': token }
                };
                const res = await axios.get(`${API_URL}/api/news/${symbol}`, config);
                setNews(res.data.slice(0, 5)); // Get top 5 articles
            } catch (err) {
                console.error("Failed to fetch news:", err);
            }
            setLoading(false);
        };

        fetchNews();
    }, [symbol, token]);

    return (
        <NewsContainer>
            <NewsHeader>Latest News for {symbol}</NewsHeader>
            {loading ? (
                <LoadingText>Loading news...</LoadingText>
            ) : (
                <NewsList>
                    {news.map((article) => (
                        <NewsItem key={article.id}>
                            <NewsLink href={article.url} target="_blank" rel="noopener noreferrer">
                                {article.headline}
                            </NewsLink>
                            <NewsSource>{article.source} - {new Date(article.datetime * 1000).toLocaleDateString()}</NewsSource>
                        </NewsItem>
                    ))}
                </NewsList>
            )}
        </NewsContainer>
    );
};

export default NewsWidget;

