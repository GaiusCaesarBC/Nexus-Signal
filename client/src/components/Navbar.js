// client/src/components/Navbar.js - With integrated stock search & Hamburger Menu (FIXED ORDER)
import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components'; // <-- IMPORT keyframes and css
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/nexus-signal-logo.png';

// --- NEON GLOW PULSE KEYFRAMES ---
const neonGlowPulse = keyframes`
  0%, 100% {
    text-shadow:
      0 0 5px rgba(0, 255, 255, 0.7),
      0 0 10px rgba(0, 255, 255, 0.5),
      0 0 15px rgba(0, 255, 255, 0.3);
    color: #00FFFF; /* Bright Cyan/Aqua */
    transform: scale(1);
    opacity: 1;
  }
  50% {
    text-shadow:
      0 0 10px rgba(0, 255, 255, 1),
      0 0 20px rgba(0, 255, 255, 0.8),
      0 0 30px rgba(0, 255, 255, 0.6);
    color: #00EEFF; /* Slightly brighter blue */
    transform: scale(1.05); /* Slight pulsation effect */
    opacity: 0.9;
  }
`;

// --- NEW STYLED COMPONENTS FOR MOBILE MENU ---
// Define HamburgerIcon first, it doesn't depend on other styled components
const HamburgerIcon = styled.div`
    display: none; /* Hidden by default */
    flex-direction: column;
    cursor: pointer;
    span {
        height: 3px;
        width: 25px;
        background: #e0e6ed;
        margin-bottom: 4px;
        border-radius: 5px;
        transition: all 0.3s linear;
    }

    @media (max-width: 900px) { /* Adjust breakpoint as needed */
        display: flex;
        justify-content: space-around;
        align-items: center;
        width: 30px;
        height: 25px;
        position: relative; /* To position it above other elements */
        z-index: 1001; /* Ensure it's above the mobile menu itself */

        span {
            &:first-child {
                transform: ${({ open }) => (open ? 'rotate(45deg) translate(6px, 6px)' : 'rotate(0)')};
            }
            &:nth-child(2) {
                opacity: ${({ open }) => (open ? '0' : '1')};
                transform: ${({ open }) => (open ? 'translateX(20px)' : 'translateX(0)')};
            }
            &:nth-child(3) {
                transform: ${({ open }) => (open ? 'rotate(-45deg) translate(6px, -6px)' : 'rotate(0)')};
            }
        }
    }
`;

// Main Navbar container and basic elements
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

// NavLinks, NavLink, NavButton, SearchForm, SearchInput, SearchButton must be defined BEFORE MobileMenu
// because MobileMenu references them in its styles.

// Modify NavLinks to hide on mobile
const NavLinks = styled.div`
    display: flex;
    align-items: center;

    @media (max-width: 900px) { /* Adjust breakpoint to match HamburgerIcon */
        display: none; /* Hide on mobile when hamburger is active */
    }
`;

// --- MODIFIED NavLink to include the pulsating pricing style ---
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

    /* Apply the pulsating style if the 'ispulsating' prop is true */
    ${({ ispulsating }) => ispulsating && css`
        animation: ${neonGlowPulse} 1.5s infinite alternate;
        color: #00FFFF; /* Ensure the base color is neon blue */
        font-weight: bold;
    `}
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

const SearchForm = styled.form`
    display: flex;
    align-items: center;
    margin-right: 1.5rem;
    /* Adjust for mobile: hide on screens where mobile menu is active */
    @media (max-width: 900px) { /* Match breakpoint */
        display: none; /* Hide on mobile, will be in MobileMenu */
    }
`;

const SearchInput = styled.input`
    padding: 0.6rem 0.8rem;
    border: 1px solid #4a627a;
    border-radius: 4px;
    background-color: #0d1a2f;
    color: #e0e6ed;
    font-size: 0.95rem;
    width: 200px;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;

    &:focus {
        outline: none;
        border-color: #00adef;
        box-shadow: 0 0 0 2px rgba(0, 173, 237, 0.3);
    }

    &::placeholder {
        color: #94a3b8;
    }
`;

const SearchButton = styled.button`
    background-color: #00adef;
    color: white;
    border: none;
    border-radius: 0 4px 4px 0;
    padding: 0.6rem 0.9rem;
    font-size: 0.95rem;
    cursor: pointer;
    margin-left: -1px;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #007bff;
    }
`;

// MobileMenu MUST be defined after NavLink, NavButton, SearchForm, SearchInput, SearchButton
const MobileMenu = styled.div`
    display: none; /* Hidden by default */
    @media (max-width: 900px) { /* Adjust breakpoint as needed */
        display: flex;
        flex-direction: column;
        background-color: #1a273b; /* Same as Navbar background */
        position: fixed;
        top: var(--navbar-height); /* Position right below the fixed Navbar */
        left: 0;
        width: 100%;
        height: calc(100vh - var(--navbar-height)); /* Take remaining height */
        transform: ${({ open }) => (open ? 'translateX(0)' : 'translateX(-100%)')};
        transition: transform 0.3s ease-in-out;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
        z-index: 999; /* Below the hamburger icon, above other content */
        padding: 1rem 0;

        & > ${NavLink}, & > ${NavButton} { /* Target NavLink and NavButton inside MobileMenu */
            margin: 0.5rem 1.5rem; /* Adjust padding for mobile links */
            width: calc(100% - 3rem); /* Full width with padding */
            text-align: left;
            border-radius: 0; /* Remove border-radius for full-width links */
            &:hover {
                background-color: rgba(0, 173, 237, 0.2);
            }
        }

        & > ${SearchForm} { /* Target SearchForm inside MobileMenu */
            width: calc(100% - 3rem);
            margin: 0.5rem 1.5rem;
            display: flex; /* Ensure the search form displays flex within the mobile menu */
            ${SearchInput} {
                width: calc(100% - 60px); /* Adjust width of input within mobile form */
                border-radius: 4px 0 0 4px;
            }
            ${SearchButton} {
                border-radius: 0 4px 4px 0;
            }
        }
    }
`;


const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpen, setMenuOpen] = useState(false); // <--- NEW: State for hamburger menu

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
        navigate('/login');
        setMenuOpen(false); // Close menu on logout
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/stocks/${searchTerm.toUpperCase()}`);
            setSearchTerm('');
            setMenuOpen(false); // Close menu after search
        }
    };

    return (
        <NavContainer>
            <LogoWrapper to={isAuthenticated ? "/dashboard" : "/"}>
                <LogoImg src={logoImage} alt="Nexus Signal AI Logo" />
                <LogoText>Nexus Signal.AI</LogoText>
            </LogoWrapper>
            
            {/* NEW: Hamburger Icon - visible on mobile */}
            <HamburgerIcon open={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                <span></span>
                <span></span>
                <span></span>
            </HamburgerIcon>

            {/* Regular NavLinks (hidden on mobile) */}
            <NavLinks>
                {isAuthenticated && (
                    <>
                        {/* Search bar for desktop */}
                        <SearchForm onSubmit={handleSearchSubmit}>
                            <SearchInput
                                type="text"
                                placeholder="Search Symbol (e.g., AAPL)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <SearchButton type="submit">Search</SearchButton>
                        </SearchForm>

                        <NavLink to="/dashboard">Dashboard</NavLink>
                        {/* <NavLink to="/stocks/AAPL">Stocks</NavLink> */}
                        <NavLink to="/portfolio">Portfolio</NavLink>
                        <NavLink to="/watchlist">Watchlist</NavLink>
                        <NavLink to="/predict">Predict</NavLink>
                        {/* Pricing link for authenticated users - desktop */}
                        <NavLink to="/pricing" ispulsating="true">Pricing</NavLink>
                        <NavButton onClick={handleLogout}>Logout</NavButton>
                    </>
                )}
                {/* Non-authenticated links (desktop) */}
                {!isAuthenticated && !shouldHideAuthLinks && (
                    <>
                        <NavLink to="/login">Login</NavLink>
                        <NavLink to="/register">Register</NavLink>
                        {/* Pricing link for non-authenticated users - desktop */}
                        <NavLink to="/pricing" ispulsating="true">Pricing</NavLink>
                    </>
                )}
                {!isAuthenticated && shouldHideAuthLinks && (
                    // Pricing link for non-authenticated users on specific pages - desktop
                    <NavLink to="/pricing" ispulsating="true">Pricing</NavLink>
                )}
            </NavLinks>

            {/* NEW: Mobile Menu - visible and animated on mobile */}
            <MobileMenu open={menuOpen}>
                {isAuthenticated ? (
                    <>
                        {/* Search bar for mobile */}
                        <SearchForm onSubmit={handleSearchSubmit}>
                            <SearchInput
                                type="text"
                                placeholder="Search Symbol (e.g., AAPL)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <SearchButton type="submit">Search</SearchButton>
                        </SearchForm>

                        <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
                        <NavLink to="/stocks/AAPL" onClick={() => setMenuOpen(false)}>Stocks</NavLink>
                        <NavLink to="/portfolio" onClick={() => setMenuOpen(false)}>Portfolio</NavLink>
                        <NavLink to="/watchlist" onClick={() => setMenuOpen(false)}>Watchlist</NavLink>
                        <NavLink to="/predict" onClick={() => setMenuOpen(false)}>Predict</NavLink>
                        {/* Pricing link for authenticated users - mobile */}
                        <NavLink to="/pricing" onClick={() => setMenuOpen(false)} ispulsating="true">Pricing</NavLink>
                        <NavButton onClick={handleLogout}>Logout</NavButton>
                    </>
                ) : (
                    shouldHideAuthLinks ? (
                        // Pricing link for non-authenticated users on specific pages - mobile
                        <NavLink to="/pricing" onClick={() => setMenuOpen(false)} ispulsating="true">Pricing</NavLink>
                    ) : (
                        <>
                            <NavLink to="/login" onClick={() => setMenuOpen(false)}>Login</NavLink>
                            <NavLink to="/register" onClick={() => setMenuOpen(false)}>Register</NavLink>
                            {/* Pricing link for non-authenticated users - mobile */}
                            <NavLink to="/pricing" onClick={() => setMenuOpen(false)} ispulsating="true">Pricing</NavLink>
                        </>
                    )
                )}
            </MobileMenu>
        </NavContainer>
    );
};

export default Navbar;