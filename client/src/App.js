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
import PricingPage from './pages/PricingPage'; // <--- NEW: Import PricingPage
import { AuthProvider } from './context/AuthContext';
// import ProtectedRoute from './components/ProtectedRoute'; // Temporarily commented out

function App() {
    return (
        <Router>
            <GlobalStyle />
            <AuthProvider>
                <Navbar />
                <Routes>
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/predict" element={<PredictPage />} />
                    <Route path="/pricing" element={<PricingPage />} /> {/* <--- NEW: Pricing Route */}

                    {/* Performance Page route (currently commented out as you said it's okay to be gone)
                    // If you want it back:
                    // import PerformancePage from './pages/PerformancePage';
                    // <Route path="/performance" element={<PerformancePage />} />
                    */}

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
                <Footer />
            </AuthProvider>
        </Router>
    );
}

export default App;