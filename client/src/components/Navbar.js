import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, UserPlus, LogIn, LogOut, Home } from 'lucide-react';
import logo from '../assets/logo.png';

const Nav = styled.nav`
    background-color: #1f2937;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
`;

const LogoContainer = styled(Link)`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
`;

const Logo = styled.img`
    height: 40px;
    width: 40px;
`;

const BrandName = styled.h1`
    color: #ecf0f1;
    font-size: 1.5rem;
    margin: 0;
`;

const NavLinks = styled.div`
    display: flex;
    align-items: center;
    gap: 1.5rem;
`;

const NavLink = styled(Link)`
    color: #bdc3c7;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 5px;
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: #34495e;
        color: #ecf0f1;
    }
`;

const LogoutButton = styled.button`
    color: #bdc3c7;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 5px;
    transition: all 0.2s ease-in-out;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;

    &:hover {
        background-color: #34495e;
        color: #ecf0f1;
    }
`;

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <Nav>
            <LogoContainer to="/">
                <Logo src={logo} alt="Nexus Signal AI Logo" />
                <BrandName>Nexus Signal AI</BrandName>
            </LogoContainer>
            <NavLinks>
                {user ? (
                    <>
                        <NavLink to="/"><LayoutDashboard size={18} /> Dashboard</NavLink>
                        <LogoutButton onClick={handleLogout}><LogOut size={18} /> Log Out</LogoutButton>
                    </>
                ) : (
                    <>
                        <NavLink to="/"><Home size={18} /> Home</NavLink>
                        <NavLink to="/register"><UserPlus size={18} /> Register</NavLink>
                        <NavLink to="/login"><LogIn size={18} /> Log In</NavLink>
                    </>
                )}
            </NavLinks>
        </Nav>
    );
};

export default Navbar;

