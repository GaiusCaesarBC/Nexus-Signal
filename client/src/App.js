// client/src/App.js - Footer links now have routes
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
import LandingPage from './pages/LandingPage';

// Import the new pages for the footer links
import Terms from './pages/Terms'; // Assuming Terms.js in src/pages/
import Privacy from './pages/Privacy'; // Assuming Privacy.js in src/pages/
import Disclaimer from './pages/Disclaimer'; // Assuming Disclaimer.js in src/pages/

import { AuthProvider } from './context/AuthContext';
// import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <Router>
            <GlobalStyle />
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/predict" element={<PredictPage />} />
                    <Route path="/pricing" element={<PricingPage />} />

                    {/* New Routes for Footer Links */}
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/disclaimer" element={<Disclaimer />} />

                    {/* Example of a protected route using the component
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
                <Footer />
            </AuthProvider>
        </Router>
    );
}

export default App;