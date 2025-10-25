// client/src/App.js - Complete File with Global Footer

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { Menu, X } from 'lucide-react';

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

    .logo-link {
        display: flex;
        align-items: center;
        text-decoration: none;
        gap: 0.5rem;

        img {
            height: 100px; /* Logo size for Navbar */
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
            color: #00adef;
        }
        .logo-signal {
            color: #f8fafc;
            margin-left: 0.2rem;
        }
        .logo-ai {
            color: #94a3b8;
            font-size: 1.2rem;
            font-weight: normal;
            margin-left: 0.1rem;
        }
    }

    .nav-links {
        display: flex;

        @media (max-width: 768px) {
            flex-direction: column;
            position: absolute;
            top: var(--navbar-height, 60px);
            left: 0;
            width: 100%;
            background-color: #1a273b;
            border-top: 1px solid rgba(0, 173, 237, 0.1);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            transform: translateX(${props => (props.$isOpen ? '0' : '-100%')});
            transition: transform 0.3s ease-out;
            padding: 1rem 0;
            z-index: 999;
        }
    }

    .nav-links a {
        color: #94a3b8;
        text-decoration: none;
        margin-left: 1.5rem;
        font-size: 1.05rem;
        transition: color 0.3s ease;
        padding: 0.5rem 1rem;

        &:hover {
            color: #f8fafc;
        }

        @media (max-width: 768px) {
            margin: 0;
            text-align: center;
            width: 100%;
            border-bottom: 1px solid rgba(0, 0, 0, 0.2);
            &:last-child {
                border-bottom: none;
            }
        }
    }

    .hamburger-icon {
        display: none;
        color: #f8fafc;
        cursor: pointer;
        z-index: 1001;

        @media (max-width: 768px) {
            display: block;
        }
    }
`;

// Global styling container for consistent layout and CSS variables
const GlobalStyle = styled.div`
    --navbar-height: 60px; /* Can be adjusted if needed */
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #0d1a2f;
    font-family: 'Inter', sans-serif;
`;

// --- New Footer Styled Component (Defined in App.js) ---
const FooterContainer = styled.footer`
    background-color: #1a273b; /* Same as navbar */
    color: #94a3b8;
    padding: 1.5rem 2rem;
    text-align: center;
    border-top: 1px solid rgba(0, 173, 237, 0.1);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
    margin-top: auto; /* Pushes the footer to the bottom */

    .footer-links {
        margin-bottom: 1rem;
        display: flex;
        justify-content: center;
        flex-wrap: wrap; /* Allow links to wrap on small screens */
        gap: 1.5rem; /* Space between links */

        a {
            color: #00adef; /* Blue for footer links */
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.3s ease;

            &:hover {
                color: #f8fafc;
            }
        }
    }

    .footer-copyright {
        font-size: 0.85rem;
        color: #5b677a; /* Muted color for copyright */
    }
`;


// --- Navbar and Routing Component (to house useLocation) ---
const AppContent = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close menu when navigating to a new page
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    // Define an array of paths where the "Login" link should NOT be shown
    const pathsToHideLogin = ['/', '/pricing', '/about', '/performance'];

    // Check if the current path is in the array of paths to hide login
    const shouldShowLoginLink = !pathsToHideLogin.includes(location.pathname);

    return (
        <GlobalStyle>
            {/* Navbar: Appears on ALL pages */}
            <NavbarContainer $isOpen={isMenuOpen}>
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

                <div className="nav-links">
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

            {/* --- Global Footer (Correctly Placed) --- */}
            <FooterContainer>
                <div className="footer-links">
                    <Link to="/disclaimer">Disclaimer</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                    <Link to="/about">About Us</Link>
                    {/* Add more footer links if needed, e.g., social media */}
                </div>
                <div className="footer-copyright">
                    &copy; {new Date().getFullYear()} Nexus Signal.AI. All rights reserved.
                </div>
            </FooterContainer>
        </GlobalStyle>
    );
};

// --- Main App Component (Wrapper for Router) ---
const App = () => {
    return (
        <Router>
            <AppContent />
        </Router>
    );
};

export default App;