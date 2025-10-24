// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Login from './pages/Login';
import About from './pages/About';
import Pricing from './pages/Pricing';
import Performance from './pages/Performance';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Disclaimer from './pages/Disclaimer';
import LandingPage from './pages/LandingPage';
import PredictPage from './pages/PredictPage'; // <--- NEW: Import the PredictPage

// --- Vercel Analytics Import ---
import { Analytics } from '@vercel/analytics/react';
// --- End Vercel Analytics Import ---

const AppContainer = styled.div`
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
`;

const MainContent = styled.main`
    flex-grow: 1;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    padding: ${props => props.$hasNavbar ? '2rem 1rem' : '0 1rem'};

    ${props => !props.$hasNavbar && `
        padding: 0;
        max-width: 100%;
    `}
`;

const AppContent = () => {
    const location = useLocation();
    const isLandingPage = location.pathname === '/landing';

    return (
        <AppContainer>
            {!isLandingPage && <Navbar />}

            <MainContent $hasNavbar={!isLandingPage}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/performance" element={<Performance />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/disclaimer" element={<Disclaimer />} />
                    <Route path="/landing" element={<LandingPage />} />
                    <Route path="/predict" element={<PredictPage />} /> {/* <--- NEW: Add the PredictPage route */}
                </Routes>
            </MainContent>

            {!isLandingPage && <Footer />}

            <Analytics />
        </AppContainer>
    );
};

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;