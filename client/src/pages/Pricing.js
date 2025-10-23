import React, { useState, useContext } from 'react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, Star } from 'lucide-react';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { AuthContext } from '../context/AuthContext';

// --- Stripe Initialization ---
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal-server.onrender.com'
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev'; // Ensure this is correct BACKEND URL

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---
const PricingContainer = styled.div`
    padding: 3rem 2rem;
    animation: ${fadeIn} 0.6s ease-out;
`;

const Header = styled.div` /* ... */ `;
const Title = styled.h1` /* ... */ `;
const Subtitle = styled.p` /* ... */ `;
const TiersContainer = styled.div` /* ... */ `;
const baseShadow = '0 15px 35px rgba(0, 0, 0, 0.7)';
const premiumGlow = '0 0 15px 5px rgba(243, 156, 18, 0.5)';
const eliteGlow = '0 0 15px 5px rgba(155, 89, 182, 0.5)';

// --- MODIFIED TierCard ---
// Use shouldForwardProp to prevent 'glow' prop from reaching the DOM element
// Or alternatively, use transient prop `$glow` in the component JSX and check for `props.$glow` here.
const TierCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['glow'].includes(prop)
})`
    background: rgba(44, 62, 80, 0.85);
    // ... other styles ...
    box-shadow: ${baseShadow};
    position: relative;
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-10px);
        // Use the passed 'glow' prop for hover effect
        box-shadow: ${props => props.glow ? `${props.glow}, 0 25px 45px rgba(0, 0, 0, 0.8)` : `0 25px 45px rgba(0, 0, 0, 0.8)`};
    }
`;
// --- END MODIFICATION ---


const PopularBadge = styled.div` /* ... */ `;
const TierTitle = styled.h2` /* ... */ `;
const TierDescription = styled.p` /* ... */ `;
const TierPrice = styled.p` /* ... */ `;
const FeatureList = styled.ul` /* ... */ `;
const FeatureItem = styled.li` /* ... */ `;
const Button = styled.button` /* ... */ `;
const ErrorMessage = styled.p` /* ... */ `;


const Pricing = () => {
    // ... (handleCheckout function and state remain the same) ...
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
            {/* ... Header ... */}
             <Header>
                <Title>Unlock Your Trading Edge</Title>
                <Subtitle>Nexus Signal.AI Pricing! Choose the plan that empowers your market strategy.</Subtitle>
            </Header>
            {error && <ErrorMessage>{error}</ErrorMessage>}

            <TiersContainer>
                {/* Basic Tier */}
                <TierCard>
                    {/* ... Basic content ... */}
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
                    <Button disabled={!user} onClick={() => alert('Free trial activated (logic TBD)!')}>
                      {user ? 'Start Free Trial' : 'Log in to Start Trial'}
                    </Button>
                </TierCard>

                {/* Premium Tier */}
                <TierCard
                    style={{ border: '2px solid #f39c12', boxShadow: `${premiumGlow}, ${baseShadow}` }}
                    glow={premiumGlow} // Pass glow prop for hover
                >
                    {/* ... Premium content ... */}
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
                    glow={eliteGlow} // Pass glow prop for hover
                 >
                     {/* ... Elite content ... */}
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

