// client/src/index.js - **CRITICAL UPDATE: Adding BrowserRouter and AuthProvider**

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router } from 'react-router-dom'; // <--- ADD THIS IMPORT
import { AuthProvider } from './context/AuthContext'; // <--- ADD THIS IMPORT

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router> {/* <--- WRAPPER 1: BrowserRouter for routing */}
      <AuthProvider> {/* <--- WRAPPER 2: AuthProvider for authentication context */}
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);

reportWebVitals();