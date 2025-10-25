// client/src/components/Loader.js
import React from 'react'; // <--- Ensure React is explicitly imported
import styled, { keyframes } from 'styled-components'; // <--- styled and keyframes are used, so this is correct

// Keyframes for the spinner animation
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Styled component for the spinner
const Spinner = styled.div`
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #3f51b5; /* Blue spinner */
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: ${spin} 1s linear infinite;
  margin: 20px auto; /* Center the spinner */
`;

// Styled component for the container (optional, for centering/spacing)
const LoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #e0e0e0; /* Light text color */
  font-size: 1rem;
`;

const Loader = ({ message = "Loading..." }) => {
  return (
    <LoaderContainer>
      <Spinner />
      <p>{message}</p>
    </LoaderContainer>
  );
};

export default Loader;