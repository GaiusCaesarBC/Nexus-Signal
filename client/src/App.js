import React from 'react';
// --- Add useLocation hook ---
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
    padding: 0 1rem;
    // Add padding top only if navbar is shown to prevent content jump
    padding-top: ${props => props.hasNavbar ? 'calc(1rem + 60px)' : '1rem'}; // Adjust '60px' if navbar height changes
`;

// --- Create a new component to handle conditional rendering ---
function AppContent() {
    const location = useLocation();
    const isLandingPage = location.pathname === '/landing'; // Check if current path is /landing

    return (
        <AppContainer>
            {!isLandingPage && <Navbar />} {/* Conditionally render Navbar */}
            {/* Pass prop to MainContent to adjust padding */}
            <MainContent hasNavbar={!isLandingPage}>
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
                </Routes>
            </MainContent>
            {!isLandingPage && <Footer />} {/* Conditionally render Footer */}
        </AppContainer>
    );
}


function App() {
    return (
        <Router>
            {/* Render the new component that uses the location hook */}
            <AppContent />
        </Router>
    );
}

export default App;

