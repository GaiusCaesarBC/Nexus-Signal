import React, { useState, useContext } from 'react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, Star } from 'lucide-react'; // Only import used icons
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { AuthContext } from '../context/AuthContext'; // Import AuthContext

// --- START: Stripe Initialization ---
// Ensure you have this environment variable set in client/.env
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Define API URL based on environment (should match AuthContext)
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal-server.onrender.com'
    // Ensure this is your correct Codespace forwarded URL for the BACKEND (port 5000)
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev';

// --- END: Stripe Initialization ---


// --- Animations ---
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// --- Styled Components ---
const PricingContainer = styled.div`
    padding: 3rem 2rem;
    animation: ${fadeIn} 0.6s ease-out;
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 4rem;
`;

const Title = styled.h1`
    font-size: 3rem;
    color: #ecf0f1;
    margin-bottom: 1rem;
    text-shadow: 0 0 15px rgba(52, 152, 219, 0.5);
`;

const Subtitle = styled.p`
    font-size: 1.2rem;
    color: #bdc3c7;
    max-width: 700px;
    margin: 0 auto;
`;

const TiersContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 2rem; // Slightly increased gap
    flex-wrap: wrap;
    align-items: stretch;
`;

// Base shadow for all cards
const baseShadow = '0 15px 35px rgba(0, 0, 0, 0.7)';
// Glow effect variables
const premiumGlow = '0 0 15px 5px rgba(243, 156, 18, 0.5)'; // Orange glow
const eliteGlow = '0 0 15px 5px rgba(155, 89, 182, 0.5)'; // Purple glow


const TierCard = styled.div`
    background: rgba(44, 62, 80, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    box-shadow: ${baseShadow}; // Apply base shadow here
    width: 100%;
    max-width: 340px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;

    &:hover {
        transform: translateY(-10px);
        // Combine base shadow with potential glow on hover
        box-shadow: ${props => props.glow ? `${props.glow}, ${baseShadow}` : `0 25px 45px rgba(0, 0, 0, 0.8)`};
    }
`;

const PopularBadge = styled.div`
    position: absolute;
    top: -15px;
    background: linear-gradient(45deg, #f39c12, #e67e22);
    color: #1c2833;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: bold;
    box-shadow: 0 5px 10px rgba(243, 156, 18, 0.4);
    z-index: 1; // Ensure badge is above border glow
`;

const TierTitle = styled.h2`
    color: #ecf0f1;
    font-size: 1.6rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
`;

const TierDescription = styled.p`
    color: #95a5a6;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    min-height: 40px;
    text-align: center;
`;


const TierPrice = styled.p`
    color: #3498db;
    font-size: 2.2rem;
    font-weight: bold;
    margin: 0.5rem 0;
    span {
        font-size: 1rem;
        color: #bdc3c7;
        font-weight: normal;
    }
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    width: 100%;
    text-align: left;
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.6rem 0;
    color: #bdc3c7;
    border-bottom: 1px solid #34495e;
    font-size: 0.9rem;

    &:last-child {
        border-bottom: none;
    }
`;

const Button = styled.button`
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
    justify-content: center;
    gap: 0.75rem;
    transition: all 0.3s ease-in-out;
    margin-top: auto;
    width: 100%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    }

    &:disabled { // Style for disabled state
      background: #7f8c8d;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
`;

const ErrorMessage = styled.p` // For showing errors
    color: #e74c3c;
    text-align: center;
    margin-top: 1rem;
    font-size: 0.9rem;
`;


const Pricing = () => {
    const { user } = useContext(AuthContext); // Get user from context
    const [loading, setLoading] = useState(''); // Track which button is loading
    const [error, setError] = useState('');

    const handleCheckout = async (priceId, planName) => {
        setError(''); // Clear previous errors
        if (!user) {
            setError('Please log in or register to choose a plan.');
            // Optionally redirect to login: navigate('/login');
            return;
        }
        setLoading(planName); // Set loading state for the specific button

        try {
            // 1. Get Stripe.js instance
            const stripe = await stripePromise;
            if (!stripe) {
              throw new Error('Stripe.js failed to load.');
            }

            // 2. Call your backend to create the Checkout Session
             // Add cache-busting parameter to prevent stale requests
            const cacheBustUrl = `${API_URL}/api/payments/create-checkout-session?_t=${new Date().getTime()}`;
            const response = await axios.post(cacheBustUrl,
                { priceId, planName },
                {
                    headers: {
                        'x-auth-token': localStorage.getItem('token') // Send auth token
                    }
                }
            );

            const session = response.data;

            // 3. Redirect to Stripe Checkout
            const result = await stripe.redirectToCheckout({
                sessionId: session.id,
            });

            if (result.error) {
                // If `redirectToCheckout` fails due to a browser or network
                // error, display the localized error message to your customer.
                console.error("Stripe redirect error:", result.error.message);
                setError(result.error.message);
            }
        } catch (err) {
            console.error('Checkout error:', err);
            const errMsg = err.response?.data?.msg || err.message || 'An error occurred during checkout.';
            setError(errMsg);
        } finally {
            setLoading(''); // Clear loading state regardless of outcome
        }
    };


    return (
        <PricingContainer>
            <Header>
                <Title>Unlock Your Trading Edge</Title>
                <Subtitle>Nexus Signal.AI Pricing! Choose the plan that empowers your market strategy.</Subtitle>
            </Header>
            {error && <ErrorMessage>{error}</ErrorMessage>} {/* Display errors */}
            <TiersContainer>
                {/* Basic Tier (Free Trial) */}
                <TierCard>
                    <TierTitle>Basic</TierTitle>
                    <TierDescription>Explore the Fundamentals</TierDescription>
                    <TierPrice>7-Day Free Trial</TierPrice>
                    <span style={{color: '#95a5a6', fontSize: '0.9rem', marginBottom: '1.5rem'}}>(No Credit Card Required)</span>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Limited Daily Signals (2/day)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> 1 Watchlist (up to 10 assets)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Basic Market Overviews</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Email Support (Standard)</FeatureItem>
                    </FeatureList>
                    {/* Basic button might navigate to dashboard or just be informational */}
                    <Button disabled={!user} onClick={() => alert('Free trial activated (logic TBD)!')}>
                      {user ? 'Start Free Trial' : 'Log in to Start Trial'}
                    </Button>
                </TierCard>

                {/* Premium Tier */}
                <TierCard
                    style={{ border: '2px solid #f39c12', boxShadow: `${premiumGlow}, ${baseShadow}` }}
                    glow={premiumGlow} // Pass glow for hover effect
                >
                    <PopularBadge>MOST POPULAR</PopularBadge>
                    <TierTitle>Premium</TierTitle>
                    <TierDescription>Master Your Trades</TierDescription>
                    <TierPrice>$49 <span>/ month</span></TierPrice>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Comprehensive Daily Signals</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Live Market Data (Minute)</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Real-Time Price & Insights</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Algorithmic Analysis</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> In-depth Sector Analysis</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Priority Email Support</FeatureItem>
                    </FeatureList>
                    <Button
                        style={{ background: 'linear-gradient(45deg, #f39c12, #e67e22)' }}
                        onClick={() => handleCheckout(process.env.REACT_APP_STRIPE_PREMIUM_PRICE_ID, 'Premium')}
                        disabled={loading === 'Premium' || !user}
                    >
                        {loading === 'Premium' ? 'Processing...' : (user ? 'Choose Plan' : 'Log in to Choose')}
                    </Button>
                </TierCard>

                {/* Elite Tier */}
                <TierCard
                    style={{ border: '2px solid #9b59b6', boxShadow: `${eliteGlow}, ${baseShadow}` }}
                    glow={eliteGlow} // Pass glow for hover effect
                 >
                    <TierTitle>Elite</TierTitle>
                     <TierDescription>For the Ultimate Market Edge</TierDescription>
                    <TierPrice>$125 <span>/ month</span></TierPrice>
                    <FeatureList>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> All Premium Features +</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Ultra-Low Latency Data</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> API Access</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Unlimited Literacy Reports</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Custom Research Insights</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> Personalized Mentorship</FeatureItem>
                        <FeatureItem><CheckCircle color="#2ecc71" size={18}/> 24/7 Dedicated Account Manager</FeatureItem>
                    </FeatureList>
                    <Button
                        style={{ background: 'linear-gradient(45deg, #9b59b6, #8e44ad)' }}
                        onClick={() => handleCheckout(process.env.REACT_APP_STRIPE_ELITE_PRICE_ID, 'Elite')}
                        disabled={loading === 'Elite' || !user}
                    >
                      <Star size={18}/> {loading === 'Elite' ? 'Processing...' : (user ? 'Go Elite' : 'Log in to Choose')}
                    </Button>
                </TierCard>

            </TiersContainer>
        </PricingContainer>
    );
};

export default Pricing;

