// client/src/pages/HomePage.js
import React from 'react';
import styled from 'styled-components'; // If you're using styled-components

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - var(--navbar-height)); /* Adjust for your navbar height */
  background-color: #0d1a2f; /* Dark background from your theme */
  color: #f8fafc; /* Light text color */
  text-align: center;
  padding: 2rem;
`;

const HomeTitle = styled.h1`
  font-size: 3.5rem;
  color: #00adef; /* Your primary brand color */
  margin-bottom: 1.5rem;
  text-shadow: 0 0 15px rgba(0, 173, 237, 0.5);

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const HomeSubtitle = styled.p`
  font-size: 1.5rem;
  max-width: 800px;
  line-height: 1.6;
  margin-bottom: 2.5rem;
  color: #b0c4de;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const CallToAction = styled.div`
  /* You can add buttons or other CTAs here */
  margin-top: 2rem;
`;

const HomePage = () => {
  return (
    <HomeContainer>
      <HomeTitle>Welcome to Nexus Signal.AI</HomeTitle>
      <HomeSubtitle>
        Your intelligent platform for advanced analytics and insights.
        Explore powerful tools and make informed decisions.
      </HomeSubtitle>
      <CallToAction>
        {/* Example Call to Action - You can replace this */}
        {/* <Link to="/register" style={{ ... }}>Get Started</Link> */}
        {/* <Link to="/pricing" style={{ ... }}>View Pricing</Link> */}
      </CallToAction>
    </HomeContainer>
  );
};

export default HomePage;