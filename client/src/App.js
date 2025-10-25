// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GlobalStyle from './styles/GlobalStyle';    // Corrected path: relative to src
import Navbar from './components/Navbar';          // Corrected path: relative to src
import Footer from './components/Footer';          // Corrected path: relative to src
import RegisterPage from './pages/RegisterPage';   // Corrected path: relative to src
import LoginPage from './pages/LoginPage';         // Corrected path: relative to src
import DashboardPage from './pages/DashboardPage'; // Corrected path: relative to src
import PredictPage from './pages/PredictPage';     // Corrected path: relative to src
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
                    <Route path="/" element={<DashboardPage />} /> {/* Default route */}
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/predict" element={<PredictPage />} />

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