// client/src/components/Navbar.js
import React from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/nexus-signal-logo.png'; // <--- ASSUMING THIS PATH & FILENAME ARE CORRECT

const NavContainer = styled.nav`
    background-color: #1a273b; /* A sleek, dark blue for the Navbar */
    color: white;
    padding: 0 1.5rem;
    height: var(--navbar-height); /* Use the CSS variable */
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); /* Slightly stronger shadow */
    position: sticky;
    top: 0;
    z-index: 1000;
`;

const LogoWrapper = styled(Link)`
    display: flex;
    align-items: center;
    text-decoration: none; /* No underline for the logo link */
`;

const LogoImg = styled.img`
    height: 40px; /* Adjust size as needed, e.g., 40px, 50px */
    margin-right: 10px; /* Space between logo and text */
`;

const LogoText = styled.span`
    font-size: 1.8rem;
    font-weight: bold;
    color: #e0e0e0; /* White/light gray for the text part of the logo */
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* A sleek, modern font */
    letter-spacing: -0.5px;
    white-space: nowrap; /* Prevent text from wrapping */
`;

const NavLinks = styled.div`
    display: flex;
    align-items: center;
`;

const NavLink = styled(Link)`
    color: #b0c4de; /* Softer, light blue-gray for links */
    text-decoration: none;
    font-size: 1rem; /* Slightly smaller font for links */
    margin-left: 1.5rem;
    padding: 0.5rem 0.8rem; /* Add some padding for better click area/visuals */
    border-radius: 4px; /* Slightly rounded corners */
    transition: background-color 0.3s ease, color 0.3s ease;

    &:hover {
        color: #e0e0e0; /* White on hover */
        background-color: rgba(0, 173, 237, 0.1); /* Subtle accent blue background on hover */
    }
`;

const NavButton = styled.button`
    background-color: #007bff; /* A prominent blue for buttons */
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 1.2rem;
    font-size: 1.05rem;
    cursor: pointer;
    margin-left: 1.5rem;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #0056b3; /* Darker blue on hover */
    }
`;

const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login'); // Redirect to login page after logout
    };

    return (
        <NavContainer>
            <LogoWrapper to="/">
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus SIGNAL.AI</LogoText> {/* <--- CORRECTED: Full name "Nexus SIGNAL.AI" */}
            </LogoWrapper>
            <NavLinks>
                {isAuthenticated ? (
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
                )}
            </NavLinks>
        </NavContainer>
    );
};

export default Navbar;