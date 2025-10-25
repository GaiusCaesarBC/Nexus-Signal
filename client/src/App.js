// client/src/App.js - CORRECTED VERSION for useLocation hook
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

// Import all your pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import PerformancePage from './pages/PerformancePage';
import DisclaimerPage from './pages/DisclaimerPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';


// --- Styled Components for a global Navbar ---
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
    height: var(--navbar-height, 60px);

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

// Global styling container for consistent layout and CSS variables
const GlobalStyle = styled.div`
    --navbar-height: 60px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #0d1a2f;
    font-family: 'Inter', sans-serif;
`;

// --- Main App Component ---
const App = () => {
    // Moved useLocation and related logic INSIDE the App component, but outside the Router's JSX return
    // This allows useLocation to be called within the Router's context.
    const location = useLocation(); 
    
    // Define an array of paths where the "Login" link should NOT be shown
    const pathsToHideLogin = ['/', '/pricing', '/about', '/performance'];

    // Check if the current path is in the array of paths to hide login
    const shouldShowLoginLink = !pathsToHideLogin.includes(location.pathname);

    return (
        <Router> {/* This Router component needs to wrap useLocation's context */}
            <GlobalStyle>
                {/* Navbar: Appears on ALL pages */}
                <NavbarContainer>
                    <Link to="/" className="logo">Nexus<span>Signal</span></Link>
                    <div className="nav-links">
                        <Link to="/about">About</Link>
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/performance">Performance</Link>
                        {/* Conditionally render the Login link */}
                        {shouldShowLoginLink && <Link to="/login">Login</Link>}
                    </div>
                </NavbarContainer>

                {/* Main Content Area where pages are rendered based on the URL */}
                <Routes>
                    {/* Core Pages */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/pricing" element={<PricingPage />} />

                    {/* Footer Links */}
                    <Route path="/performance" element={<PerformancePage />} />
                    <Route path="/disclaimer" element={<DisclaimerPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsOfServicePage />} />

                    {/* Fallback for 404 Not Found pages */}
                    <Route path="*" element={
                        <div style={{
                            padding: '50px',
                            textAlign: 'center',
                            color: '#e0e0e0',
                            fontSize: '2rem',
                            minHeight: 'calc(100vh - var(--navbar-height))',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: '#0d1a2f'
                        }}>
                            <h2>404 - Page Not Found</h2>
                            <p style={{fontSize: '1.2rem', color: '#94a3b8'}}>The page you are looking for does not exist.</p>
                            <Link to="/" style={{ color: '#00adef', textDecoration: 'none', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Go to Home
                            </Link>
                        </div>
                    } />
                </Routes>
            </GlobalStyle>
        </Router>
    );
};

export default App;