// client/src/App.js - Complete file with basic routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import styled from 'styled-components';

// Import your pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage'; // Assuming you have a LoginPage
// Import other pages you might have
// import DashboardPage from './pages/DashboardPage';
// import WatchlistPage from './pages/WatchlistPage';
// import SettingsPage from './pages/SettingsPage';
// import AboutPage from './pages/AboutPage';
// import PricingPage from './pages/PricingPage';
// import PerformancePage from './pages/PerformancePage';
// import DisclaimerPage from './pages/DisclaimerPage';
// import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
// import TermsOfServicePage from './pages/TermsOfServicePage';


// --- Basic Styled Components for Navbar/Footer (can be replaced with your actual components) ---
const NavbarContainer = styled.nav`
    background-color: #1a273b;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #f8fafc;
    border-bottom: 1px solid rgba(0, 173, 237, 0.1);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    position: sticky;
    top: 0;
    z-index: 1000;
    height: var(--navbar-height, 60px); /* Define a CSS variable for height */

    .logo {
        font-size: 1.8rem;
        font-weight: bold;
        color: #00adef;
        text-decoration: none;
        span {
            color: #f8fafc;
        }
    }

    .nav-links a {
        color: #94a3b8;
        text-decoration: none;
        margin-left: 1.5rem;
        font-size: 1.05rem;
        transition: color 0.3s ease;

        &:hover {
            color: #f8fafc;
        }
    }
`;

const GlobalStyle = styled.div`
    /* Define CSS variables */
    --navbar-height: 60px;
    min-height: 100vh; /* Ensure full height for content */
    display: flex;
    flex-direction: column;
`;

// --- App Component ---
const App = () => {
    return (
        <Router>
            <GlobalStyle>
                {/* Navbar */}
                <NavbarContainer>
                    <Link to="/" className="logo">Nexus<span>Signal</span></Link>
                    <div className="nav-links">
                        {/* Example navigation links */}
                        <Link to="/about">About</Link>
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/login">Login</Link>
                        {/* Add more links as needed */}
                    </div>
                </NavbarContainer>

                {/* Main Content Area with Routes */}
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />

                    {/* Add routes for other pages you import */}
                    {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
                    {/* <Route path="/watchlist" element={<WatchlistPage />} /> */}
                    {/* <Route path="/settings" element={<SettingsPage />} /> */}
                    {/* <Route path="/about" element={<AboutPage />} /> */}
                    {/* <Route path="/pricing" element={<PricingPage />} /> */}
                    {/* <Route path="/performance" element={<PerformancePage />} /> */}
                    {/* <Route path="/disclaimer" element={<DisclaimerPage />} /> */}
                    {/* <Route path="/privacy" element={<PrivacyPolicyPage />} /> */}
                    {/* <Route path="/terms" element={<TermsOfServicePage />} /> */}

                    {/* Fallback for 404 Not Found pages */}
                    <Route path="*" element={
                        <div style={{ padding: '50px', textAlign: 'center', color: '#e0e0e0', fontSize: '2rem' }}>
                            404 - Page Not Found
                        </div>
                    } />
                </Routes>

                {/* The Footer from LandingPage is still present, so we'll omit a global one here
                    If you wanted a global footer, you'd remove it from LandingPage and put it here.
                */}
            </GlobalStyle>
        </Router>
    );
};

export default App;