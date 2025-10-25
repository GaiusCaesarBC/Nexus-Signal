// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GlobalStyle from './styles/GlobalStyle';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage'; // Renamed and correctly imported
import PredictPage from './pages/PredictPage';     // Correctly imported
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute'; // For future use if you make more protected routes

function App() {
    return (
        <Router>
            <GlobalStyle />
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<DashboardPage />} /> {/* Default route */}
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/predict" element={<PredictPage />} />

                    {/* Example of a protected route using the component, if you want to use it
                    <Route
                        path="/settings"
                        element={
                            <ProtectedRoute>
                                <SettingsPage />
                            </ProtectedRoute>
                        }
                    />
                    */}
                </Routes>
                <Footer />
            </AuthProvider>
        </Router>
    );
}

export default App;