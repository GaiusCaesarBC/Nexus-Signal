// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GlobalStyle from './styles/GlobalStyle';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PredictPage from './pages/PredictPage';
import PricingPage from './pages/PricingPage';
import LandingPage from './pages/LandingPage'; // <--- NEW: Import LandingPage
import { AuthProvider } from './context/AuthContext';
// import ProtectedRoute from './components/ProtectedRoute'; // Temporarily commented out

function App() {
    return (
        <Router>
            <GlobalStyle />
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/" element={<LandingPage />} /> {/* <--- NEW: Landing Page at root */}
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} /> {/* Dashboard now explicitly at /dashboard */}
                    <Route path="/predict" element={<PredictPage />} />
                    <Route path="/pricing" element={<PricingPage />} />

                    {/* Example of a protected route using the component, if you want to use it
                    // <Route
                    //     path="/settings"
                    //     element={
                    //         <ProtectedRoute>
                    //             <SettingsPage />
                    //         </ProtectedRoute>
                    //     }
                    // />
                    */}
                </Routes>
                {/* Note: I'm leaving the general Footer in App.js. If your LandingPage also has its own footer,
                    you