import React, { useContext } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
// The fix is on this line:
import { AuthContext } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { Home, UserPlus, LogIn, LogOut } from 'lucide-react';

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: #1f2937;
  color: white;
  border-bottom: 1px solid #374151;
`;

const LogoContainer = styled(Link)`
  display: flex;
  align-items: center;
  text-decoration: none;
  color: white;
`;

const LogoImage = styled.img`
  height: 40px;
  margin-right: 0.5rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const NavLink = styled(Link)`
  color: #d1d5db;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s;

  &:hover {
    color: #3498db;
  }
`;

const LogoutButton = styled.button`
  background: none;
  border: none;
  color: #d1d5db;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-family: inherit;
  transition: color 0.2s;

  &:hover {
    color: #e74c3c;
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
        <LogoImage src={logo} alt="Quantum Trade Logo" />
        <Title>Quantum Trade</Title>
      </LogoContainer>
      <NavLinks>
        <NavLink to="/"><Home size={18} />Dashboard</NavLink>
        {user ? (
          <LogoutButton onClick={handleLogout}>
            <LogOut size={18} />
            Log Out
          </LogoutButton>
        ) : (
          <>
            <NavLink to="/register"><UserPlus size={18} />Register</NavLink>
            <NavLink to="/login"><LogIn size={18} />Log In</NavLink>
          </>
        )}
      </NavLinks>
    </Nav>
  );
};

export default Navbar;

