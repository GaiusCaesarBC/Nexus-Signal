import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Newspaper } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';

const NewsContainer = styled.div`
  background-color: #2c3e50;
  padding: 1.5rem 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 800px;
  margin-top: 2rem;
`;

const WidgetHeader = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #ecf0f1;
  margin-top: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #34495e;
  padding-bottom: 1rem;
`;

const ArticleList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ArticleItem = styled.li`
  border-bottom: 1px solid #34495e;
  padding-bottom: 1.5rem;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const ArticleLink = styled.a`
  text-decoration: none;
`;

const ArticleHeadline = styled.h4`
  color: #ecf0f1;
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  transition: color 0.2s ease-in-out;

  &:hover {
    color: #3498db;
  }
`;

const ArticleMeta = styled.p`
  color: #bdc3c7;
  font-size: 0.8rem;
  margin: 0;
`;

const ErrorMessage = styled.p`
    color: #f1c40f;
`;

const NewsWidget = ({ symbol }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (!symbol || !token) return;

    const fetchNews = async () => {
      setLoading(true);
      setError('');
      try {
        const config = {
          headers: {
            'x-auth-token': token,
          },
        };
        const res = await axios.get(`/api/news/${symbol}`, config);
        setArticles(res.data);
      } catch (err) {
        setError('Could not fetch news articles.');
        console.error('News fetch error:', err);
      }
      setLoading(false);
    };

    fetchNews();
  }, [symbol, token]);

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
        <NewsContainer>
            <WidgetHeader><Newspaper size={24} /> Latest News for {symbol}</WidgetHeader>
            <Skeleton count={3} height={60} style={{ marginBottom: '1rem' }} />
        </NewsContainer>
    );
  }

  if (error) {
    return <NewsContainer><ErrorMessage>{error}</ErrorMessage></NewsContainer>;
  }

  if (articles.length === 0) {
    return (
        <NewsContainer>
            <WidgetHeader><Newspaper size={24} /> Latest News for {symbol}</WidgetHeader>
            <p style={{color: '#bdc3c7'}}>No recent news found for this symbol.</p>
        </NewsContainer>
    );
  }

  return (
    <NewsContainer>
      <WidgetHeader><Newspaper size={24} /> Latest News for {symbol}</WidgetHeader>
      <ArticleList>
        {articles.map((article) => (
          <ArticleItem key={article.id}>
            <ArticleLink href={article.url} target="_blank" rel="noopener noreferrer">
              <ArticleHeadline>{article.headline}</ArticleHeadline>
            </ArticleLink>
            <ArticleMeta>
              {article.source} &bull; {formatDate(article.datetime)}
            </ArticleMeta>
          </ArticleItem>
        ))}
      </ArticleList>
    </NewsContainer>
  );
};

export default NewsWidget;
