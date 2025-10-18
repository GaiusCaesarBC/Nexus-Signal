import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import Skeleton from 'react-loading-skeleton';

// The live URL of your backend server on Render
const API_URL = 'https://quantum-trade-server.onrender.com';

const NewsContainer = styled.div`
    background-color: #2c3e50;
    padding: 1.5rem;
    border-radius: 8px;
    width: 100%;
`;

const Title = styled.h3`
    color: #ecf0f1;
    margin-top: 0;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #34495e;
    padding-bottom: 0.5rem;
`;

const NewsList = styled.ul`
    list-style-type: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const NewsItem = styled.li`
    background-color: #34495e;
    border-radius: 5px;
    padding: 1rem;
    transition: background-color 0.2s ease;

    &:hover {
        background-color: #4a627a;
    }
`;

const NewsLink = styled.a`
    text-decoration: none;
    color: #ecf0f1;
    font-weight: bold;
    display: block;
    margin-bottom: 0.5rem;
`;

const NewsMeta = styled.div`
    font-size: 0.8rem;
    color: #bdc3c7;
    display: flex;
    justify-content: space-between;
`;

const NewsWidget = ({ symbol }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            if (!symbol) return;
            setLoading(true);
            try {
                const res = await axios.get(`${API_URL}/api/news/${symbol}`);
                setNews(res.data.slice(0, 5)); // Limit to 5 articles
            } catch (err) {
                console.error("Failed to fetch news:", err);
            }
            setLoading(false);
        };

        fetchNews();
    }, [symbol]);

    return (
        <NewsContainer>
            <Title>Latest News for {symbol}</Title>
            {loading ? (
                <NewsList>
                    {[...Array(3)].map((_, i) => (
                        <NewsItem key={i}>
                            <Skeleton height={20} width="80%" />
                            <Skeleton height={15} width="50%" style={{ marginTop: '0.5rem' }}/>
                        </NewsItem>
                    ))}
                </NewsList>
            ) : (
                <NewsList>
                    {news.map((article) => (
                        <NewsItem key={article.id}>
                            <NewsLink href={article.url} target="_blank" rel="noopener noreferrer">
                                {article.headline}
                            </NewsLink>
                            <NewsMeta>
                                <span>{article.source}</span>
                                <span>{new Date(article.datetime * 1000).toLocaleDateString()}</span>
                            </NewsMeta>
                        </NewsItem>
                    ))}
                </NewsList>
            )}
        </NewsContainer>
    );
};

export default NewsWidget;

