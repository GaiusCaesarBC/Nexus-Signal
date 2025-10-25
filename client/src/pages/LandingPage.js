// client/src/pages/LandingPage.js - Waitlist Section moved below Features Section
import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, Zap, Shield, Rocket, Mail } from 'lucide-react';
import axios from 'axios';

// Keyframes for animations
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

// Styled Components (No changes to actual styles, just their order in JSX)
const LandingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background: linear-gradient(145deg, #0d1a2f 0%, #1a273b 100%);
    color: #e0e0e0;
    font-family: 'Inter', sans-serif;
    animation: ${fadeIn} 0.8s ease-out forwards;
`;

const HeroSection = styled.section`
    text-align: center;
    margin-bottom: 5rem;
    max-width: 900px;
    animation: ${fadeIn} 1s ease-out forwards;

    h1 {
        font-size: 4.5rem;
        color: #00adef; /* Nexus blue */
        margin-bottom: 1.5rem;
        letter-spacing: -2px;
        text-shadow: 0 0 20px rgba(0, 173, 237, 0.7);
        line-height: 1.1;
        span {
            color: #f8fafc;
        }
    }

    p {
        font-size: 1.5rem;
        color: #94a3b8;
        line-height: 1.6;
        margin-bottom: 3rem;
    }
`;

const FeaturesSection = styled.section` // This section now comes before Waitlist
    width: 100%;
    max-width: 1200px;
    text-align: center;
    animation: ${fadeIn} 1s ease-out forwards;
    margin-bottom: 5rem; // Add margin to separate from next section

    h2 {
        font-size: 3rem;
        color: #f8fafc;
        margin-bottom: 3rem;
        text-shadow: 0 0 10px rgba(248, 250, 252, 0.3);
    }

    .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
    }
`;

const FeatureItem = styled.div`
    background: linear-gradient(135deg, #1a273b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 173, 237, 0.1);
    text-align: left;

    .icon-wrapper {
        color: #00adef;
        margin-bottom: 1rem;
    }

    h3 {
        font-size: 1.8rem;
        color: #f8fafc;
        margin-bottom: 0.8rem;
    }

    p {
        font-size: 1rem;
        color: #94a3b8;
        line-height: 1.6;
    }
`;


const WaitlistSection = styled.section` // This section now comes after Features
    width: 100%;
    max-width: 700px;
    margin-bottom: 5rem;
    text-align: center;
    animation: ${fadeIn} 1s ease-out forwards;
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 3rem 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);

    h2 {
        font-size: 2.8rem;
        color: #f8fafc;
        margin-bottom: 1.5rem;
        text-shadow: 0 0 10px rgba(248, 250, 252, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
    }

    p {
        font-size: 1.2rem;
        color: #94a3b8;
        margin-bottom: 2rem;
        line-height: 1.6;
    }

    form {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 1rem;
        width: 100%;
    }
`;

const Input = styled.input`
    padding: 0.9rem 1.2rem;
    border: 1px solid #00adef;
    border-radius: 8px;
    font-size: 1.05rem;
    background-color: #1a273b;
    color: #f8fafc;
    flex-grow: 1;
    min-width: 250px;
    transition: all 0.3s ease;

    &::placeholder {
        color: #64748b;
    }

    &:focus {
        outline: none;
        border-color: #008cd4;
        box-shadow: 0 0 0 4px rgba(0, 173, 237, 0.4);
    }
`;

const Button = styled.button`
    padding: 0.9rem 1.8rem;
    background: linear-gradient(90deg, #00adef 0%, #008cd4 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.05rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 173, 237, 0.4);

    &:hover {
        background: linear-gradient(90deg, #008cd4 0%, #00adef 100%);
        box-shadow: 0 6px 20px rgba(0, 173, 237, 0.6);
        transform: translateY(-2px);
    }

    &:disabled {
        background: #4a5a6b;
        cursor: not-allowed;
        opacity: 0.7;
        transform: none;
        box-shadow: none;
    }
`;

const Message = styled.p`
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    color: ${(props) => (props.$isError ? '#ff6b6b' : '#32CD32')};
`;

const FooterContainer = styled.footer`
    width: 100%;
    background-color: #1a273b;
    color: #94a3b8;
    padding: 2rem 1.5rem;
    text-align: center;
    border-top: 1px solid rgba(0, 173, 237, 0.1);
    font-size: 0.9rem;
    margin-top: auto;

    .footer-links {
        margin-bottom: 1rem;
    }

    .footer-links a {
        color: #00adef;
        text-decoration: none;
        margin: 0 0.8rem;
        transition: color 0.3s ease;

        &:hover {
            color: #f8fafc;
        }
    }
`;


const LandingPage = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsError(false);

        if (!email) {
            setMessage('Please enter your email address.');
            setIsError(true);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setMessage('Please enter a valid email address.');
            setIsError(true);
            return;
        }

        setLoading(true);
        try {
            const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:10000';
            const res = await axios.post(`${backendUrl}/api/subscribers`, { email });
            setMessage(res.data.msg);
            setEmail('');
            setIsError(false);
        } catch (err) {
            console.error('Subscriber signup error:', err.response?.data?.msg || err.message);
            setMessage(err.response?.data?.msg || 'Failed to subscribe. Please try again.');
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LandingContainer>
            <HeroSection>
                <h1>Unleash the Power of <span>AI-Driven</span> Insights</h1>
                <p>
                    Nexus Signal AI provides advanced market predictions and real-time data, empowering you to make smarter,
                    more informed investment decisions in stocks and cryptocurrencies.
                </p>
            </HeroSection>

            {/* Features Section */}
            <FeaturesSection>
                <h2>Key Features</h2>
                <div className="feature-grid">
                    <FeatureItem>
                        <div className="icon-wrapper"><Zap size={40} /></div>
                        <h3>AI-Driven Predictions</h3>
                        <p>Leverage cutting-edge machine learning to forecast market movements with high accuracy.</p>
                    </FeatureItem>
                    <FeatureItem>
                        <div className="icon-wrapper"><Shield size={40} /></div>
                        <h3>Real-Time Data</h3>
                        <p>Access up-to-the-minute stock and cryptocurrency prices to stay ahead.</p>
                    </FeatureItem>
                    <FeatureItem>
                        <div className="icon-wrapper"><Rocket size={40} /></div>
                        <h3>Personalized Watchlists</h3>
                        <p>Track your favorite assets and get custom alerts to never miss an opportunity.</p>
                    </FeatureItem>
                    <FeatureItem>
                        <div className="icon-wrapper"><CheckCircle size={40} /></div>
                        <h3>Intuitive Dashboard</h3>
                        <p>All your essential market insights and tools presented in a clean, user-friendly interface.</p>
                    </FeatureItem>
                </div>
            </FeaturesSection>

            {/* Waitlist (Get Notified) Section - Moved below Features */}
            <WaitlistSection>
                <h2><Mail size={32} color="#00adef" /> Get Notified</h2>
                <p>
                    Be the first to know about new features, market insights, and special announcements. Join our list.
                </p>
                <form onSubmit={handleSubmit}>
                    <Input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                    />
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Submitting...' : 'Join Now'}
                    </Button>
                </form>
                {message && <Message $isError={isError}>{message}</Message>}
            </WaitlistSection>

            <FooterContainer>
                <div className="footer-links">
                    <a href="/about">About</a>
                    <a href="/pricing">Pricing</a>
                    <a href="/performance">Performance</a>
                    <a href="/disclaimer">Disclaimer</a>
                    <a href="/privacy">Privacy Policy</a>
                    <a href="/terms">Terms of Service</a>
                </div>
                <p>&copy; {new Date().getFullYear()} Nexus Signal AI. All rights reserved.</p>
            </FooterContainer>
        </LandingContainer>
    );
};

export default LandingPage;