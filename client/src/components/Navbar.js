// client/src/components/Navbar.js - Corrected to hide Login/Register on footer pages
import React from 'react';
import styled from 'styled-components';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/nexus-signal-logo.png';
// Using generic NavLink for styling consistency, removed lucide-react icons here if not used
// import { Home, Settings, Bookmark, PieChart, LogOut, LogIn, UserPlus } from 'lucide-react';

const NavContainer = styled.nav`
    background-color: #1a273b;
    color: white;
    padding: 0 1.5rem;
    height: var(--navbar-height);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    position: sticky;
    top: 0;
    z-index: 1000;
`;

const LogoWrapper = styled(Link)`
    display: flex;
    align-items: center;
    text-decoration: none;
`;

const LogoImg = styled.img`
    height: 40px;
    margin-right: 10px;
`;

const LogoText = styled.span`
    font-size: 1.8rem;
    font-weight: bold;
    color: #e0e0e0;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    letter-spacing: -0.5px;
    white-space: nowrap;
`;

const NavLinks = styled.div`
    display: flex;
    align-items: center;
`;

// IMPORTANT: Using styled(Link) for NavLink to match your existing styling pattern
// If you want active state styling, you'd need to adjust this to `styled(NavLinkRouter)` and add styling for `.active`
const NavLink = styled(Link)`
    color: #b0c4de;
    text-decoration: none;
    font-size: 1rem;
    margin-left: 1.5rem;
    padding: 0.5rem 0.8rem;
    border-radius: 4px;
    transition: background-color 0.3s ease, color 0.3s ease;

    &:hover {
        color: #e0e0e0;
        background-color: rgba(0, 173, 237, 0.1);
    }
    /* If you want an 'active' state for the link, you'd add:
    &.active {
        color: #00adec; // A distinctive color for active link
        background-color: rgba(0, 173, 237, 0.2);
    }
    */
`;

const NavButton = styled.button`
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 1.2rem;
    font-size: 1.05rem;
    cursor: pointer;
    margin-left: 1.5rem;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #0056b3;
    }
`;

const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Define pages where Login/Register links should be hidden for non-authenticated users
    const pagesWithoutAuthLinks = [
        '/',
        '/pricing',
        '/terms',
        '/privacy',
        '/disclaimer'
    ];
    const shouldHideAuthLinks = pagesWithoutAuthLinks.includes(location.pathname);

    const handleLogout = () => {
        logout();
        navigate('/login'); // Redirect to login page after logout
    };

    return (
        <NavContainer>
            {/* Logo link: if authenticated, go to /dashboard, else go to / */}
            <LogoWrapper to={isAuthenticated ? "/dashboard" : "/"}> {/* <-- MODIFIED LINE */}
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus Signal.AI</LogoText>
            </LogoWrapper>
            <NavLinks>
                {/* Conditional rendering based on authentication and page */}
                {isAuthenticated ? (
                    // User is authenticated, show full navigation links
                    <>
                        <NavLink to="/dashboard">Dashboard</NavLink>
                        <NavLink to="/portfolio">Portfolio</NavLink> {/* <-- ADDED PORTFOLIO LINK */}
                        <NavLink to="/watchlist">Watchlist</NavLink> {/* <-- ADDED WATCHLIST LINK */}
                        <NavLink to="/predict">Predict</NavLink>
                        <NavLink to="/pricing">Pricing</NavLink>
                        <NavButton onClick={handleLogout}>Logout</NavButton>
                    </>
                ) : (
                    // User is NOT authenticated
                    shouldHideAuthLinks ? (
                        // On a page where auth links should be hidden (e.g., Landing, Pricing, Footer links)
                        <NavLink to="/pricing">Pricing</NavLink> // Only show Pricing
                    ) : (
                        // On other public pages, show Login/Register/Pricing
                        <>
                            <NavLink to="/login">Login</NavLink>
                            <NavLink to="/register">Register</NavLink>
                            <NavLink to="/pricing">Pricing</NavLink>
                        </>
                    )
                )}
            </NavLinks>
        </NavContainer>
    );
};

export default Navbar;