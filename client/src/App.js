// client/src/App.js - **FULL CORRECTED VERSION (assuming TermsOfServicePage and PrivacyPolicyPage)**

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Import Layout/Structure Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Copilot from './components/Copilot';

// Import Page Components
import LandingPage from './pages/LandingPage'; // This typically acts as the home page for unauthenticated users
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PredictPage from './pages/PredictPage';
import PricingPage from './pages/PricingPage';
import SettingsPage from './components/SettingsPage';
import WatchlistPage from './pages/WatchlistPage';
import PortfolioPage from './pages/PortfolioPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DisclaimerPage from './pages/DisclaimerPage';
import NotFoundPage from './pages/NotFoundPage';
import StockPage from './pages/StockPage'; // <--- ADD THIS LINE to import your new StockPage

import ProtectedRoute from './components/ProtectedRoute';

function App() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#0d1a2f',
                color: '#e0e0e0',
                fontSize: '1.5rem'
            }}>
                Loading application...
            </div>
        );
    }

    return (
        <>
            <Navbar />
            <main style={{ flexGrow: 1, minHeight: 'calc(100vh - 120px)' }}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/terms" element={<TermsOfServicePage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/disclaimer" element={<DisclaimerPage />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
                    <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
                    <Route path="/predict" element={<ProtectedRoute><PredictPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                    {/* NEW: Stock Details Page Route */}
                    {/* This route will capture the stock symbol from the URL (e.g., /stocks/AAPL) */}
                    <Route path="/stocks/:symbol" element={<ProtectedRoute><StockPage /></ProtectedRoute>} /> {/* <-- ADD THIS LINE */}

                    {/* Catch-all for 404 Not Found pages */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
            <Footer />
            <Copilot />
        </>
    );
}

export default App;