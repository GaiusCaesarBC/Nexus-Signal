import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Import the AuthProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Wrap the entire App with AuthProvider so all components can access the context */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

