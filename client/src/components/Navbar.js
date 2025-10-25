// client/src/components/Navbar.js
import React from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Make sure this path is correct relative to Navbar.js

const NavContainer = styled.nav`
    background-color: #2c3e50; /* Dark blue-gray */
    color: white;
    padding: 0 1.5rem;
    height: var(--navbar-height); /* Use the CSS variable */
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    position: sticky;
    top: 0;
    z-index: 1000;
`;

const LogoLink = styled(Link)`
    font-size: 1.8rem;
    font-weight: bold;
    color: #4CAF50; /* Green logo */
    text-decoration: none;

    &:hover {
        color: #66bb6a;
        text-decoration: none;
    }
`;

const NavLinks = styled.div`
    display: flex;
    align-items: center;
`;

const NavLink = styled(Link)`
    color: white;
    text-decoration: none;
    font-size: 1.1rem;
    margin-left: 1.5rem;
    padding: 0.5rem 0;
    transition: color 0.3s ease;

    &:hover {
        color: #61dafb; /* Light blue on hover */
    }
`;

const NavButton = styled.button`
    background-color: #3f51b5; /* Blue button */
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 1.2rem;
    font-size: 1.05rem;
    cursor: pointer;
    margin-left: 1.5rem;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #5d74e3;
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
            <LogoLink to="/">Nexus Signal</LogoLink>
            <NavLinks>
                {isAuthenticated ? (
                    <>
                        <NavLink to="/dashboard">Dashboard</NavLink>
                        <NavLink to="/predict">Predict</NavLink>
                        <NavLink to="/pricing">Pricing</NavLink> {/* Pricing link for authenticated users */}
                        <NavButton onClick={handleLogout}>Logout</NavButton>
                    </>
                ) : (
                    <>
                        <NavLink to="/login">Login</NavLink>
                        <NavLink to="/register">Register</NavLink>
                        <NavLink to="/pricing">Pricing</NavLink> {/* Pricing link for non-authenticated users */}
                    </>
                )}
            </NavLinks>
        </NavContainer>
    );
};

export default Navbar;