// client/src/pages/LoginPage.js - NO CHANGES NEEDED
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { LogIn, User, Lock, ArrowRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // This is where the login function is called from

// Keyframe for fade-in animation
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

// Keyframe for button glow effect
const buttonGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
    50% { box-shadow: 0 0 15px rgba(0, 173, 237, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 173, 237, 0.4); }
`;

const LoginPageContainer = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - var(--navbar-height)); /* Uses global --navbar-height */
    background: linear-gradient(180deg, #0d1a2f 0%, #1a273b 100%);
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    animation: ${fadeIn} 0.8s ease-out forwards;
    padding: 2rem;
`;

const LoginFormCard = styled.div`
    background: linear-gradient(145deg, #1a273b 0%, #2c3e50 100%);
    border-radius: 15px;
    padding: 3rem 4rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.3);
    text-align: center;
    max-width: 450px;
    width: 100%;
    animation: ${fadeIn} 1s ease-out forwards;

    @media (max-width: 768px) {
        padding: 2.5rem 2rem;
    }
`;

const Title = styled.h1`
    font-size: 2.8rem;
    color: #00adef;
    margin-bottom: 2rem;
    letter-spacing: -0.5px;
    text-shadow: 0 0 10px rgba(0, 173, 237, 0.5);

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;

    svg {
        margin-right: 0.5rem;
    }

    @media (max-width: 768px) {
        font-size: 2.2rem;
    }
`;

const FormGroup = styled.div`
    margin-bottom: 1.8rem;
    text-align: left;
    position: relative;

    label {
        display: block;
        font-size: 1rem;
        color: #94a3b8;
        margin-bottom: 0.5rem;
    }

    input {
        width: 100%;
        padding: 0.9rem 1.2rem 0.9rem 3.5rem; /* Left padding for icon */
        background-color: #0f172a;
        border: 1px solid #334155;
        border-radius: 8px;
        color: #f8fafc;
        font-size: 1rem;
        transition: all 0.3s ease;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);

        &:focus {
            border-color: #00adef;
            box-shadow: 0 0 0 3px rgba(0, 173, 237, 0.3), inset 0 1px 3px rgba(0, 0, 0, 0.3);
            outline: none;
        }

        &::placeholder {
            color: #64748b;
        }
    }

    .icon {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: #64748b;
        font-size: 1.2rem;
    }
`;

const StyledButton = styled.button`
    width: 100%;
    padding: 1rem 1.5rem;
    background: linear-gradient(90deg, #00adef 0%, #007bff 100%);
    border: none;
    border-radius: 8px;
    color: #f8fafc;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 1.5rem;
    box-shadow: 0 4px 15px rgba(0, 173, 237, 0.4);
    animation: ${buttonGlow} 2s infinite ease-in-out;

    &:hover {
        background: linear-gradient(90deg, #007bff 0%, #00adef 100%);
        box-shadow: 0 6px 20px rgba(0, 173, 237, 0.6);
        transform: translateY(-2px);
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 4px 10px rgba(0, 173, 237, 0.3);
    }

    &:disabled {
        background: #4a5568;
        cursor: not-allowed;
        box-shadow: none;
        animation: none;
    }
`;

const LinksContainer = styled.div`
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    font-size: 0.95rem;

    a {
        color: #00adef;
        text-decoration: none;
        transition: color 0.3s ease;

        &:hover {
            color: #f8fafc;
            text-decoration: underline;
        }
    }
`;

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState('');
 

    const { login, isAuthenticated, loading: authLoading } = useAuth();

    const isLoading = localLoading || authLoading;

    useEffect(() => {
        // console.log('LoginPage useEffect: isAuthenticated =', isAuthenticated, 'authLoading =', authLoading); // Removed
        // If there's no logic here that needs `isAuthenticated` or `authLoading`,
        // then no dependencies are needed.
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalLoading(true);
        setLocalError('');

        console.log('LoginPage handleSubmit: Submitting login form...');

        const success = await login(email, password); // Corrected this line

       if (!success) { // ONLY handle failure here, AuthContext handles success navigation
       setLocalError('Login failed. Please check your credentials.');
     console.error('LoginPage handleSubmit: Login failed via AuthContext: Check network tab for server response details.');
      }

        setLocalLoading(false);
    };

    // This ensures an immediate redirect if isAuthenticated is true and not still loading auth state
    if (isAuthenticated && !authLoading) {
        console.log('LoginPage (Render): User is authenticated and not loading. Redirecting to /dashboard.');
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <LoginPageContainer>
            <LoginFormCard>
                <Title>
                    <LogIn size={40} /> Login to Nexus Signal.AI
                </Title>
                <form onSubmit={handleSubmit}>
                    <FormGroup>
                        <label htmlFor="email">Email</label>
                        <User className="icon" size={20} />
                        <input
                            type="email"
                            id="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </FormGroup>
                    <FormGroup>
                        <label htmlFor="password">Password</label>
                        <Lock className="icon" size={20} />
                        <input
                            type="password"
                            id="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </FormGroup>
                    {localError && <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{localError}</p>}
                    <StyledButton type="submit" disabled={isLoading}>
                        {isLoading ? 'Logging In...' : 'Login'} <ArrowRight size={20} style={{ marginLeft: '10px' }} />
                    </StyledButton>
                </form>
                <LinksContainer>
                    <Link to="/forgot-password">Forgot Password?</Link>
                    <Link to="/signup">Don't have an account? Sign Up</Link>
                </LinksContainer>
            </LoginFormCard>
        </LoginPageContainer>
    );
};

export default LoginPage;