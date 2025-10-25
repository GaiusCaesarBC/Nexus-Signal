// client/src/App.js - Complete and Definitive Version
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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


// --- Styled Components for a global Navbar (Adjust or replace with your dedicated Navbar component if you have one) ---
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
    --navbar-height: 60px; /* Define a CSS variable for navbar height */
    min-height: 100vh; /* Ensure full height for content */
    display: flex;
    flex-direction: column;
    /* You might want to set a global background color here */
    background-color: #0d1a2f; /* Example: Dark background for the whole app */
    font-family: 'Inter', sans-serif; /* Example: Global font */
`;

// --- Main App Component ---
const App = () => {
    return (
        <Router>
            <GlobalStyle>
                {/* Navbar: Appears on ALL pages */}
                <NavbarContainer>
                    <Link to="/" className="logo">Nexus<span>Signal</span></Link>
                    <div className="nav-links">
                        <Link to="/about">About</Link>
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/performance">Performance</Link> {/* Added for testing/navigation */}
                        <Link to="/login">Login</Link>
                    </div>
                </NavbarContainer>

                {/* Main Content Area where pages are rendered based on the URL */}
                <Routes>
                    {/* Core Pages */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/pricing" element={<PricingPage />} />

                    {/* Footer Links - Now with dedicated routes */}
                    <Route path="/performance" element={<PerformancePage />} />
                    <Route path="/disclaimer" element={<DisclaimerPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsOfServicePage />} />

                    {/* Fallback for 404 Not Found pages:
                        This catches any URL that doesn't match a defined route above.
                        It renders a simple 404 message and a link back home.
                    */}
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
                            backgroundColor: '#0d1a2f' // Ensure 404 page has dark background
                        }}>
                            <h2>404 - Page Not Found</h2>
                            <p style={{fontSize: '1.2rem', color: '#94a3b8'}}>The page you are looking for does not exist.</p>
                            <Link to="/" style={{ color: '#00adef', textDecoration: 'none', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Go to Home
                            </Link>
                        </div>
                    } />
                </Routes>

                {/* Important Note: Your LandingPage currently contains its own footer.
                    If you wanted a single, app-wide footer that appears on ALL pages (not just the landing page),
                    you would:
                    1. Remove the FooterContainer component and its JSX from LandingPage.js.
                    2. Create a separate Footer.js component.
                    3. Import and render that Footer component here, AFTER the <Routes> block.
                    For now, it's fine as is, but be aware of this if you want a consistent footer across the app.
                */}
            </GlobalStyle>
        </Router>
    );
};

export default App;