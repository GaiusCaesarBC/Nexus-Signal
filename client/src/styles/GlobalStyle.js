// client/src/styles/GlobalStyle.js
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  :root {
    --navbar-height: 60px; /* Define a CSS variable for navbar height */
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Arial', sans-serif;
    background-color: #1a202c; /* Dark background color */
    color: #e0e0e0; /* Light text color */
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  a {
    color: #61dafb; /* Light blue for links */
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  ul {
    list-style: none;
  }

  h1, h2, h3, h4, h5, h6 {
    color: #e0e0e0;
    margin-bottom: 0.5rem;
  }

  button {
    font-family: 'Arial', sans-serif;
  }

  /* Basic form element styling */
  input[type="text"],
  input[type="email"],
  input[type="password"],
  textarea {
      background-color: #34495e; /* Darker input background */
      border: 1px solid #3f51b5; /* Blue border */
      color: #e0e0e0; /* Light text */
      padding: 0.75rem 1rem;
      border-radius: 4px;
      width: 100%;
      font-size: 1rem;

      &:focus {
          outline: none;
          border-color: #5d74e3;
          box-shadow: 0 0 0 3px rgba(93, 116, 227, 0.5);
      }
  }
`;

export default GlobalStyle;