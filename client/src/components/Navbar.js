// client/src/components/Navbar.js - SUPER SIMPLIFIED FOR DIAGNOSIS
import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
// Removed: useNavigate, useLocation, useAuth
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
`;

// Removed NavButton
// Removed handleLogout

const Navbar = () => {
    // Removed: isAuthenticated, logout, navigate, location, isOnLandingPage, shouldHideAuthLinks, handleLogout

    return (
        <NavContainer>
            <LogoWrapper to="/">
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus Signal.AI</LogoText>
            </LogoWrapper>
            <NavLinks>
                {/* Minimal links for testing compilation */}
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/predict">Predict</NavLink>
                <NavLink to="/pricing">Pricing</NavLink>
                <NavLink to="/login">Login</NavLink>
                <NavLink to="/register">Register</NavLink>
            </NavLinks>
        </NavContainer>
    );
};

export default Navbar;