// client/src/index.js -

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Your global CSS
import App from './App';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import { AuthProvider } from './context/AuthContext'; // Assuming AuthProvider is here

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* <--- THIS IS THE OPENING TAG */}
      <AuthProvider> {/* <--- WRAPPER 2: AuthProvider for authentication context */}
        <App />
      </AuthProvider>
    </BrowserRouter> {/* <--- THIS IS THE CORRECT CLOSING TAG */}
  </React.StrictMode>
);