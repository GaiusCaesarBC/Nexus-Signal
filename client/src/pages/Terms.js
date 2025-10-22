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

// --- Styled Components ---
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

// --- REMOVED List styled component ---
// const List = styled.ul`
//     color: #bdc3c7;
//     line-height: 1.8;
//     padding-left: 20px;
// `;
// ------------------------------------

const Terms = () => {
    return (
        <LegalContainer>
            <Title>Terms of Service</Title>
            <Subtitle>Last Updated: October 20, 2025</Subtitle>

            <Section>
                <SectionTitle>1. Acceptance of Terms</SectionTitle>
                <Paragraph>
                    By accessing or using the Nexus Signal AI website ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, then you may not access the Service.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>2. Description of Service</SectionTitle>
                <Paragraph>
                    Nexus Signal AI provides users with AI-generated market predictions, data analysis, and related educational content for research purposes only. The Service is not intended to provide financial, investment, or trading advice.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>3. Subscriptions</SectionTitle>
                <Paragraph>
                    Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring basis. Subscriptions will automatically renew under the exact same conditions unless cancelled by you or Nexus Signal AI. You may cancel your Subscription renewal at any time.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>4. Intellectual Property</SectionTitle>
                <Paragraph>
                    The Service and its original content, features, and functionality (including but not limited to the AI prediction models and logic) are and will remain the exclusive property of Nexus Signal AI and its licensors.
                </Paragraph>
            </Section>

            <Section>
                <SectionTitle>5. Disclaimer of Warranties; Limitation of Liability</SectionTitle>
                <Paragraph>
                    The Service is provided on an "AS IS" and "AS AVAILABLE" basis. Nexus Signal AI makes no warranties, expressed or implied, and hereby disclaims all other warranties. In no event shall Nexus Signal AI be liable for any special, direct, indirect, consequential, or incidental damages or any damages whatsoever, whether in an action of contract, negligence or other tort, arising out of or in connection with the use of the Service or the contents of the Service.
                </Paragraph>
                <Paragraph>
                    <strong>WE ARE NOT A LICENSED FINANCIAL ADVISOR OR BROKER. ALL INFORMATION IS FOR EDUCATIONAL/RESEARCH PURPOSES ONLY. YOU ARE SOLELY RESPONSIBLE FOR YOUR OWN TRADING DECISIONS AND CAPITAL.</strong>
                </Paragraph>
            </Section>

             <Section>
                <SectionTitle>6. Governing Law</SectionTitle>
                <Paragraph>
                    These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which the company is based, without regard to its conflict of law provisions.
                </Paragraph>
            </Section>
        </LegalContainer>
    );
};

export default Terms;
