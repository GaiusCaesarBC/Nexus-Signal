// client/src/pages/NotFoundPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components'; // If you're using styled-components

const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - var(--navbar-height)); /* Adjust for your navbar height */
  background-color: #0d1a2f; /* Dark background from your theme */
  color: #e0e0e0; /* Light text color */
  text-align: center;
  padding: 2rem;
`;

const Title = styled.h1`
  font-size: 5rem;
  color: #ef4444; /* A striking red for error */
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const Subtitle = styled.h2`
  font-size: 2rem;
  margin-bottom: 1.5rem;
  color: #b0c4de;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const Message = styled.p`
  font-size: 1.1rem;
  margin-bottom: 2rem;
  max-width: 600px;
  line-height: 1.6;
`;

const HomeLink = styled(Link)`
  color: #00adef; /* Your primary brand color */
  text-decoration: none;
  font-size: 1.2rem;
  padding: 0.8rem 1.5rem;
  border: 1px solid #00adef;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    background-color: #00adef;
    color: #f8fafc;
    box-shadow: 0 0 15px rgba(0, 173, 237, 0.4);
  }
`;


const NotFoundPage = () => {
  return (
    <NotFoundContainer>
      <Title>404</Title>
      <Subtitle>Page Not Found</Subtitle>
      <Message>
        Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        Don't worry, you can always go back to the home page.
      </Message>
      <HomeLink to="/">Go to Home Page</HomeLink>
    </NotFoundContainer>
  );
};

export default NotFoundPage;