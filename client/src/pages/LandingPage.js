import React, { useState } from 'react'; // Import useState
import styled, { keyframes } from 'styled-components';
import { Send, Twitter, Linkedin, Github, MessageSquare } from 'lucide-react';
import logo from '../assets/logo.png';
import axios from 'axios'; // <-- 1. Import axios

// --- 2. API URL Definition ---
// Define API URL based on environment
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal-server.onrender.com'
    // Ensure this is your correct forwarded URL for the BACKEND (e.g., port 8081)
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 10px 15px rgba(52, 152, 219, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
`;


// --- Styled Components (No changes here) ---
const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  /* Will inherit the complex gradient from index.css */
  color: #ecf0f1;
  text-align: center;
  overflow: hidden;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 3rem;
  animation: ${fadeIn} 0.8s ease-out;
`;

const Logo = styled.img`
  height: 60px;
  width: 60px;
`;

const BrandName = styled.h1`
  font-size: 2.5rem;
  margin: 0;
  color: #ecf0f1;
  text-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
`;

const HeroSection = styled.section`
  max-width: 700px;
  animation: ${fadeIn} 1s ease-out 0.2s backwards;
  background: rgba(26, 30, 38, 0.5); /* Semi-transparent dark layer */
  padding: 1.5rem 2.5rem;
  border-radius: 12px;
  backdrop-filter: blur(3px);
  margin-bottom: 2rem;
  /* Glowing blue border */
  border: 1px solid rgba(52, 152, 219, 0.5);
  box-shadow: 0 0 20px 5px rgba(52, 152, 219, 0.2);
`;

const Headline = styled.h2`
  font-size: 3rem;
  color: #ecf0f1;
  margin-bottom: 1rem;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Description = styled.p`
  font-size: 1.2rem;
  color: #bdc3c7;
  line-height: 1.6;
  margin-bottom: 2rem;
`;

const LaunchDate = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: #3498db;
  margin-bottom: 2.5rem;
  padding: 0.5rem 1rem;
  display: inline-block;
  border: 1px solid #3498db;
  border-radius: 5px;
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.3);
`;

const EmailForm = styled.form`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap; // Allow wrapping on small screens
`;

const EmailInput = styled.input`
  padding: 0.8rem 1rem;
  border: 1px solid #4a627a;
  border-radius: 5px;
  background-color: #34495e;
  color: #ecf0f1;
  font-size: 1rem;
  min-width: 250px;
  flex-grow: 1;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 10px rgba(52, 152, 219, 0.3);
  }
`;

const SubmitButton = styled.button`
  background: linear-gradient(45deg, #3498db, #2980b9);
  border: none;
  border-radius: 5px;
  color: white;
  padding: 0.8rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  animation: ${pulse} 2s infinite;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    animation-play-state: paused;
  }
  
  &:disabled {
    background: #7f8c8d;
    cursor: not-allowed;
    animation: none;
  }
`;

const CtaText = styled.p`
  color: #95a5a6;
  font-size: 1rem;
  margin-bottom: 2.5rem;
`;

// --- 3. Styled Components for Messages ---
const MessageBase = styled.p`
  font-weight: bold;
  margin-top: -1rem;
  margin-bottom: 2.5rem;
  height: 20px; // Reserve space to prevent layout jump
`;

const ConfirmationMessage = styled(MessageBase)`
  color: #2ecc71; // Green for success
`;

const ErrorMessage = styled(MessageBase)`
  color: #e74c3c; // Red for error
`;
// ------------------------------------

const SocialLinks = styled.div`
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 3rem;
  animation: ${fadeIn} 1.2s ease-out 0.4s backwards;
`;

const SocialLink = styled.a`
  color: #95a5a6;
  transition: color 0.2s ease-in-out, transform 0.2s ease-in-out, text-shadow 0.2s ease-in-out;
  text-shadow: 0 0 3px rgba(52, 152, 219, 0.3); /* Subtle default glow */

  &:hover {
    color: #3498db;
    transform: scale(1.2);
    text-shadow: 0 0 10px rgba(52, 152, 219, 0.7); /* Brighter hover glow */
  }
`;

const Footer = styled.footer`
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-top: auto;
  padding-top: 2rem;
`;


const LandingPage = () => {
    // --- 3. Add States ---
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // ---------------------

    // --- 4. NEW HANDLE SUBMIT FUNCTION ---
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        
        // Reset states
        setSubmitted(false);
        setError('');

        // Simple validation
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setLoading(true); // Disable button

        try {
            // Send email to backend API endpoint
            const res = await axios.post(`${API_URL}/api/waitlist/join`, { email });
            
            console.log(res.data.msg); // Log success message from server
            setSubmitted(true); // Show success message
            setEmail(''); // Clear input
        
        } catch (err) {
            // Handle errors from the server (like "Email already exists" or 500)
            const errMsg = err.response?.data?.msg || 'An error occurred. Please try again.';
            console.error('Waitlist submit error:', errMsg);
            setError(errMsg);
        } finally {
            setLoading(false); // Re-enable button
        }
    };
    // ------------------------------------

    return (
        <PageWrapper>
            <Header>
                <Logo src={logo} alt="Nexus Signal AI Logo" />
                <BrandName>Nexus Signal.AI</BrandName>
            </Header>

            <HeroSection>
                <Headline>Unlock Your Trading Edge with Advanced AI.</Headline>
                <Description>
                    Nexus Signal.AI is building a revolutionary AI-driven platform to empower traders with intelligent market insights, real-time data, and personalized strategies. Get ready to master your future in finance.
                </Description>
                <LaunchDate>Launching March 2026</LaunchDate>

                <CtaText>Get Early Access & Updates</CtaText>
                
                {/* 4. Update Form and Button States */}
                <EmailForm onSubmit={handleSubmit}>
                    <EmailInput
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        // --- TYPO FIX IS HERE ---
                        onChange={(e) => setEmail(e.target.value)} 
                        // -------------------------
                        required
                        disabled={loading} // Disable input while loading
                    />
                    <SubmitButton type="submit" disabled={loading}> {/* Disable button while loading */}
                        <Send size={18} />
                        {loading ? 'Submitting...' : 'Notify Me'}
                    </SubmitButton>
                </EmailForm>

                {/* 4. Show Success or Error Message */}
                {submitted && (
                    <ConfirmationMessage>
                        Thank you! You're on the list.
                    </ConfirmationMessage>
                )}
                {error && (
                    <ErrorMessage>
                        {error}
                    </ErrorMessage>
                )}
                {/* Add a spacer if neither message is showing */}
                {!submitted && !error && <MessageBase />}
            
            </HeroSection>

            <SocialLinks>
                {/* Replace # with your actual URLs */}
                <SocialLink href="#" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                    <Twitter size={28} />
                </SocialLink>
                <SocialLink href="#" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                     <MessageSquare size={28} />
                </SocialLink>
                <SocialLink href="#" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                    <Github size={28} />
                </SocialLink>
                 <SocialLink href="#" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                    <Linkedin size={28} />
                </SocialLink>
            </SocialLinks>

            <Footer>
                © {new Date().getFullYear()} Nexus Signal.AI. All rights reserved.
            </Footer>
        </PageWrapper>
    );
};

export default LandingPage;

