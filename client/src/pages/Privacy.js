import React from 'react';
import styled, { keyframes } from 'styled-components';

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

// --- Styled Components (reusing the same style as Terms for consistency) ---
const LegalContainer = styled.div`
    padding: 3rem 2rem;
    animation: ${fadeIn} 0.6s ease-out;
    max-width: 800px;
    margin: 0 auto;
`;

const Title = styled.h1`
    font-size: 2.5rem;
    color: #ecf0f1;
    margin-bottom: 1rem;
    text-align: center;
`;

const Subtitle = styled.p`
    font-size: 1.1rem;
    color: #bdc3c7;
    text-align: center;
    margin-bottom: 3rem;
`;

const Section = styled.section`
    margin-bottom: 2.5rem;
`;

const SectionTitle = styled.h2`
    font-size: 1.8rem;
    color: #3498db;
    border-bottom: 2px solid #34495e;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
`;

const Paragraph = styled.p`
    color: #bdc3c7;
    line-height: 1.8;
`;

const List = styled.ul`
    color: #bdc3c7;
    line-height: 1.8;
    padding-left: 20px;
`;

const Privacy = () => {
    return (
        <LegalContainer>
            <Title>Privacy Policy</Title>
            <Subtitle>Last Updated: October 20, 2025</Subtitle>

            <Section>
                <SectionTitle>1. Introduction</SectionTitle>
                <Paragraph>
                    Welcome to Nexus Signal AI. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains what information we collect, how we use it, and what rights you have in relation to it.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>2. Information We Collect</SectionTitle>
                <Paragraph>
                    We collect personal information that you voluntarily provide to us when you register on the Service. The personal information that we collect depends on the context of your interactions with us and the Service, but may include the following:
                </Paragraph>
                <List>
                    <li>**Account Data:** We collect your username and hashed password to create and manage your account.</li>
                    <li>**User Content:** We collect the stock symbols you add to your watchlist to provide the watchlist feature.</li>
                    <li>**Usage Data:** We may collect anonymous information about how you access and use the Service to help us improve it.</li>
                </List>
            </Section>

            <Section>
                <SectionTitle>3. How We Use Your Information</SectionTitle>
                <Paragraph>
                    We use the information we collect in various ways, including to:
                </Paragraph>
                <List>
                    <li>Provide, operate, and maintain our Service</li>
                    <li>Improve, personalize, and expand our Service</li>
                    <li>Understand and analyze how you use our Service</li>
                    <li>Communicate with you for customer service and to provide updates</li>
                </List>
            </Section>
            
            <Section>
                <SectionTitle>4. Security of Your Information</SectionTitle>
                <Paragraph>
                    We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>5. Your Data Rights</SectionTitle>
                <Paragraph>
                    Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete the personal data we have collected. If you wish to exercise these rights, please contact us.
                </Paragraph>
            </Section>
        </LegalContainer>
    );
};

export default Privacy;
