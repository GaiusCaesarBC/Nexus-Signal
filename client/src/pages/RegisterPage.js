// client/src/pages/RegisterPage.js - Complete File

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { UserPlus, User, Lock, CheckCircle, ArrowRight } from 'lucide-react'; // Icons for visual emphasis
import { Link } from 'react-router-dom'; // For navigation to other pages

// Keyframe for fade-in animation
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

// Keyframe for button glow effect
const buttonGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.4); } /* Green glow */
  50% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.8); }
  100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.4); }
`;

const RegisterPageContainer = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - var(--navbar-height));
    background: linear-gradient(180deg, #0d1a2f 0%, #1a273b 100%);
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    animation: ${fadeIn} 0.8s ease-out forwards;
    padding: 2rem;
`;

const RegisterFormCard = styled.div`
    background: linear-gradient(145deg, #1a273b 0%, #2c3e50 100%);
    border-radius: 15px;
    padding: 3rem 4rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(34, 197, 94, 0.3); /* Green border for sign-up */
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
    color: #22c55e; /* Green for sign-up */
    margin-bottom: 2rem;
    letter-spacing: -0.5px;
    text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);

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
            border-color: #22c55e; /* Green focus */
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3), inset 0 1px 3px rgba(0, 0, 0, 0.3);
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
        font-size: 1.2rem; /* Adjusted for Lucide icons */
    }
`;

const CheckboxGroup = styled.div`
    display: flex;
    align-items: center;
    margin-top: 1.5rem;
    margin-bottom: 1.8rem;
    font-size: 0.95rem;
    color: #cbd5e1;
    text-align: left;

    input[type="checkbox"] {
        margin-right: 0.8rem;
        width: 18px;
        height: 18px;
        appearance: none;
        background-color: #0f172a;
        border: 1px solid #334155;
        border-radius: 4px;
        cursor: pointer;
        position: relative;
        flex-shrink: 0;

        &:checked {
            background-color: #22c55e;
            border-color: #22c55e;
            
            &::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 6px;
                width: 5px;
                height: 10px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }
        }

        &:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
        }
    }

    a {
        color: #00adef;
        text-decoration: none;
        &:hover {
            text-decoration: underline;
        }
    }
`;

const StyledButton = styled.button`
    width: 100%;
    padding: 1rem 1.5rem;
    background: linear-gradient(90deg, #22c55e 0%, #10b981 100%); /* Green gradient */
    border: none;
    border-radius: 8px;
    color: #f8fafc;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 0.5rem; /* Adjusted margin due to checkbox */
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
    animation: ${buttonGlow} 2s infinite ease-in-out; /* Continuous glow */

    &:hover {
        background: linear-gradient(90deg, #10b981 0%, #22c55e 100%);
        box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6);
        transform: translateY(-2px);
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);
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

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            setLoading(false);
            return;
        }
        if (!agreeToTerms) {
            alert('You must agree to the Terms of Service and Privacy Policy.');
            setLoading(false);
            return;
        }
        // Here you would typically send the registration request to your backend
        console.log('Registration attempt:', { email, password, agreeToTerms });
        // Simulate an API call
        setTimeout(() => {
            alert('Registration functionality is not yet implemented on the frontend.');
            setLoading(false);
            // In a real app, you'd handle success/failure and potentially redirect to login or dashboard
        }, 2000);
    };

    return (
        <RegisterPageContainer>
            <RegisterFormCard>
                <Title>
                    <UserPlus size={40} /> Create Your Account
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
                    <FormGroup>
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <CheckCircle className="icon" size={20} />
                        <input
                            type="password"
                            id="confirmPassword"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </FormGroup>
                    <CheckboxGroup>
                        <input
                            type="checkbox"
                            id="agreeToTerms"
                            checked={agreeToTerms}
                            onChange={(e) => setAgreeToTerms(e.target.checked)}
                            required
                        />
                        <label htmlFor="agreeToTerms">
                            I agree to the <Link to="/terms-of-service">Terms of Service</Link> and <Link to="/privacy-policy">Privacy Policy</Link>
                        </label>
                    </CheckboxGroup>
                    <StyledButton type="submit" disabled={loading || !agreeToTerms}>
                        {loading ? 'Registering...' : 'Register'} <ArrowRight size={20} style={{ marginLeft: '10px' }} />
                    </StyledButton>
                </form>
                <LinksContainer>
                    <Link to="/login">Already have an account? Login</Link>
                </LinksContainer>
            </RegisterFormCard>
        </RegisterPageContainer>
    );
};

export default RegisterPage;