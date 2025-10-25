// client/src/App.js - Corrected: Removed HomePage if not present
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // Added Navigate
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
// import HomePage from './pages/HomePage'; // Removed or commented out if HomePage.js does not exist
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PredictPage from './pages/PredictPage';
import AccountSettingsPage from './pages/AccountSettingsPage';

import { Analytics } from '@vercel/analytics/react'; // If you're using Vercel Analytics

function App() {
    useEffect(() => {
        const setVh = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVh();
        window.addEventListener('resize', setVh);
        return () => window.removeEventListener('resize', setVh);
    }, []);

    return (
        <BrowserRouter>
            <AuthProvider>
                <Navbar />
                <Routes>
                    {/* If you don't have a HomePage.js, we can redirect '/' to '/dashboard' */}
                    {/* <Route path="/" element={<HomePage />} /> */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} /> {/* Redirect root to dashboard */}
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/predict" element={<PredictPage />} />
                    <Route path="/settings" element={<AccountSettingsPage />} />
                </Routes>
                <Analytics />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;