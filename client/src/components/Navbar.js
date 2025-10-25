// client/src/components/Navbar.js - Restored and refined
import React from 'react';
import styled from 'styled-components';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // Re-added useNavigate, useLocation
import { useAuth } from '../context/AuthContext'; // Re-added useAuth
import logoImage from '../assets/nexus-signal-logo.png';

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

const LogoWrapper = styled(Link)` /* Changed back to Link */
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

const NavLink = styled(Link)` /* Changed back to NavLink */
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
`;

const NavButton = styled.button` /* Re-added NavButton */
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
    // Re-added hooks
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if the current path is the root (Landing Page)
    const isOnLandingPage = location.pathname === '/';

    const handleLogout = () => {
        logout();
        navigate('/login'); // Redirect to login page after logout
    };

    return (
        <NavContainer>
            <LogoWrapper to="/">
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus Signal.AI</LogoText>
            </LogoWrapper>
            <NavLinks>
                {isOnLandingPage ? (
                    // On Landing Page: Only show Pricing
                    <NavLink to="/pricing">Pricing</NavLink>
                ) : (
                    // Not on Landing Page: Show full links (conditional on auth)
                    isAuthenticated ? (
                        <>
                            <NavLink to="/dashboard">Dashboard</NavLink>
                            <NavLink to="/predict">Predict</NavLink>
                            <NavLink to="/pricing">Pricing</NavLink>
                            <NavButton onClick={handleLogout}>Logout</NavButton>
                        </>
                    ) : (
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