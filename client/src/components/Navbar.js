// client/src/components/Navbar.js - EVEN MORE SIMPLIFIED FOR DIAGNOSIS
import React from 'react';
import styled from 'styled-components';
// Removed: Link from 'react-router-dom'
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

const LogoWrapper = styled.div` /* Changed to div from Link */
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

const NavText = styled.div` /* Changed to div from NavLink */
    color: #b0c4de;
    font-size: 1rem;
    margin-left: 1.5rem;
    padding: 0.5rem 0.8rem;
    border-radius: 4px;
`;

const Navbar = () => {
    return (
        <NavContainer>
            <LogoWrapper> {/* Removed 'to="/"' */}
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus Signal.AI</LogoText>
            </LogoWrapper>
            <NavLinks>
                {/* Minimal text for testing compilation */}
                <NavText>Dashboard</NavText>
                <NavText>Predict</NavText>
                <NavText>Pricing</NavText>
                <NavText>Login</NavText>
                <NavText>Register</NavText>
            </NavLinks>
        </NavContainer>
    );
};

export default Navbar;