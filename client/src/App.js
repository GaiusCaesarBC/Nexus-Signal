// client/src/App.js - Latest Version with Logo, Mobile Menu, and Routes

import React, { useState, useEffect } from 'react'; // <--- Import useState, useEffect
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { Menu, X } from 'lucide-react'; // <--- Import Menu and X icons for hamburger

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
    height: var(--navbar-height, 60px); /* Define navbar height as a CSS variable */

    .logo-link { /* Wrapper for the logo image and text */
        display: flex;
        align-items: center;
        text-decoration: none;
        gap: 0.5rem; /* Space between logo image and text */

        img {
            height: 35px; /* Adjust size of logo image in Navbar */
            width: auto;
        }

        .logo-text-wrapper {
            display: flex;
            align-items: baseline;
            font-size: 1.8rem;
            font-weight: bold;
            letter-spacing: -1px;
        }

        .logo-nexus {
            color: #00adef; /* Blue for 'Nexus' */
        }
        .logo-signal {
            color: #f8fafc; /* White for 'Signal' */
            margin-left: 0.2rem;
        }
        .logo-ai {
            color: #94a3b8; /* Subdued for '.AI' */
            font-size: 1.2rem; /* Smaller for '.AI' */
            font-weight: normal;
            margin-left: 0.1rem;
        }
    }

    .nav-links {
        display: flex; /* Default to horizontal */

        @media (max-width: 768px) {
            flex-direction: column; /* Stack vertically on small screens */
            position: absolute;
            top: var(--navbar-height, 60px); /* Position below the navbar */
            left: 0;
            width: 100%;
            background-color: #1a273b; /* Same as navbar */
            border-top: 1px solid rgba(0, 173, 237, 0.1);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            transform: translateX(${props => (props.$isOpen ? '0' : '-100%')}); /* Slide in/out */
            transition: transform 0.3s ease-out;
            padding: 1rem 0; /* Vertical padding */
            z-index: 999; /* Below main navbar but above content */
        }
    }

    .nav-links a {
        color: #94a3b8;
        text-decoration: none;
        margin-left: 1.5rem;
        font-size: 1.05rem;
        transition: color 0.3s ease;
        padding: 0.5rem 1rem; /* Add padding for clickable area */

        &:hover {
            color: #f8fafc;
        }

        @media (max-width: 768px) {
            margin: 0; /* Remove horizontal margin */
            text-align: center;
            width: 100%; /* Full width for clickable area */
            border-bottom: 1px solid rgba(0, 0, 0, 0.2); /* Separator for menu items */
            &:last-child {
                border-bottom: none;
            }
        }
    }

    .hamburger-icon {
        display: none; /* Hidden by default */
        color: #f8fafc;
        cursor: pointer;
        z-index: 1001; /* Above everything else */

        @media (max-width: 768px) {
            display: block; /* Show on small screens */
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

// --- Navbar and Routing Component (to house useLocation) ---
const AppContent = () => {
    const location = useLocation(); 
    const [isMenuOpen, setIsMenuOpen] = useState(false); // State for mobile menu

    // Close menu when navigating to a new page
    useEffect(() => { // <--- Corrected import and usage for useEffect
        setIsMenuOpen(false);
    }, [location.pathname]);
    
    // Define an array of paths where the "Login" link should NOT be shown
    const pathsToHideLogin = ['/', '/pricing', '/about', '/performance'];

    // Check if the current path is in the array of paths to hide login
    const shouldShowLoginLink = !pathsToHideLogin.includes(location.pathname);

    return (
        <GlobalStyle>
            {/* Navbar: Appears on ALL pages */}
            <NavbarContainer $isOpen={isMenuOpen}> {/* Pass isMenuOpen to styled component */}
                <Link to="/" className="logo-link">
                    <img src="/nexus-signal-logo.png" alt="Nexus Signal AI Logo" />
                    <div className="logo-text-wrapper">
                        <span className="logo-nexus">Nexus</span>
                        <span className="logo-signal">Signal</span>
                        <span className="logo-ai">.AI</span>
                    </div>
                </Link>

                <div className="hamburger-icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </div>

                <div className="nav-links"> {/* Removed conditional rendering here, now controlled by CSS transform */}
                    <Link to="/about">About</Link>
                    <Link to="/pricing">Pricing</Link>
                    <Link to="/performance">Performance</Link>
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
                <Route path="/privacy" element={<PrivacyPolicyPage />} /> {/* Ensure correct element prop */}
                <Route path="/terms" element={<TermsOfServicePage />} /> {/* Ensure correct element prop */}

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
    );
};

// --- Main App Component (Wrapper for Router) ---
const App = () => {
    return (
        <Router> {/* Router must be the outermost component for useLocation to work */}
            <AppContent /> {/* Render our new component here */}
        </Router>
    );
};

export default App;