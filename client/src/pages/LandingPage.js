import React from 'react';
import styled, { keyframes } from 'styled-components';
// Corrected import: Removed Mail, Added Github, Linkedin, MessageSquare (for Discord)
import { Send, Twitter, Linkedin, Github, MessageSquare } from 'lucide-react';
import logo from '../assets/logo.png'; // Assuming logo is here

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


// --- Styled Components ---
const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  /* Removed background override - will now inherit from body */
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
  /* Add a subtle background to make text readable over complex background if needed */
  background: rgba(26, 30, 38, 0.5); /* Semi-transparent dark layer */
  padding: 1.5rem;
  border-radius: 10px;
  backdrop-filter: blur(3px); /* Optional: slight blur */
  margin-bottom: 2rem; /* Add margin below hero */

  /* --- ADD THESE LINES FOR THE BLUE GLOW --- */
  border: 1px solid rgba(52, 152, 219, 0.3); /* Subtle blue border */
  box-shadow: 0 0 25px 3px rgba(52, 152, 219, 0.25); /* Blue glow */
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
  min-width: 250px; // Ensure decent width
  flex-grow: 1; // Allow input to grow

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
  animation: ${pulse} 2s infinite; // Add pulse animation

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(52, 152, 219, 0.5);
    animation-play-state: paused; // Pause animation on hover
  }
`;

const CtaText = styled.p`
  color: #95a5a6;
  font-size: 1rem;
  margin-bottom: 2.5rem;
`;

const ConfirmationMessage = styled.p`
  color: #2ecc71; // Green for success
  font-weight: bold;
  margin-top: -1rem;
  margin-bottom: 2.5rem;
`;


const SocialLinks = styled.div`
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 3rem;
  animation: ${fadeIn} 1.2s ease-out 0.4s backwards;
`;

const SocialLink = styled.a`
  color: #95a5a6;
  /* Add text-shadow to the transition list */
  transition: color 0.2s ease-in-out, transform 0.2s ease-in-out, text-shadow 0.2s ease-in-out;
  
  /* --- ADDED DEFAULT GLOW --- */
  /* A subtle blue glow, even in the default state */
  text-shadow: 0 0 10px rgba(52, 152, 219, 0.3);

  &:hover {
    color: #3498db;
    transform: scale(1.2);
    
    /* --- ENHANCE GLOW ON HOVER --- */
    text-shadow: 0 0 15px rgba(52, 152, 219, 0.7);
  }
`;

const Footer = styled.footer`
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-top: auto;
  padding-top: 2rem;
`;


const LandingPage = () => {
    const [email, setEmail] = React.useState('');
    const [submitted, setSubmitted] = React.useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }
        console.log('Email submitted:', email);
        setSubmitted(true);
        setEmail('');
        setTimeout(() => setSubmitted(false), 5000);
    };

    return (
        <PageWrapper>
            <Header>
                <Logo src={logo} alt="Nexus Signal AI Logo" />
                <BrandName>Nexus Signal.AI</BrandName>
            </Header>

            {/* HeroSection now provides a subtle background for readability */}
            <HeroSection>
                <Headline>Unlock Your Trading Edge with Advanced AI.</Headline>
                <Description>
                    Nexus Signal.AI is building a revolutionary AI-driven platform to empower traders with intelligent market insights, real-time data, and personalized strategies. Get ready to master your future in finance.
                </Description>
                <LaunchDate>Launching March 2026</LaunchDate>

                <CtaText>Get Early Access & Updates</CtaText>
                 {submitted ? (
                     <ConfirmationMessage>
                        Thank you! We'll keep you updated on our launch.
                    </ConfirmationMessage>
                 ) : (
                    <EmailForm onSubmit={handleSubmit}>
                        <EmailInput
                            type="email"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <SubmitButton type="submit">
                            <Send size={18} />
                            Notify Me
                        </SubmitButton>
                    </EmailForm>
                 )}
            </HeroSection>

            <SocialLinks>
                {/* Replace # with your actual URLs */}
                <SocialLink href="https://x.com/NexusSignalAI" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                    <Twitter size={28} />
                </SocialLink>
                <SocialLink href="https://discord.gg/sPXD2vXz" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                     <MessageSquare size={28} /> {/* Using MessageSquare for Discord */}
                </SocialLink>
                <SocialLink href="https://github.com/GaiusCaesarBC/Nexus-Signal" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                    <Github size={28} />
                </SocialLink>
                 <SocialLink href="https://www.linkedin.com/in/cody-watkins-b740a1390/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
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



