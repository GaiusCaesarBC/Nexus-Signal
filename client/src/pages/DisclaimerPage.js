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
    margin-bottom: 3rem;
    text-align: center;
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

const DisclaimerBox = styled.div`
    background-color: rgba(231, 76, 60, 0.1);
    border: 1px solid #e74c3c;
    border-radius: 8px;
    padding: 2rem;
    margin: 3rem 0;
`;

const DisclaimerText = styled.p`
    color: #e74c3c;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.7;
    font-size: 1.1rem;
    margin: 0;
`;

const Disclaimer = () => {
    return (
        <LegalContainer>
            <Title>Legal Disclaimer</Title>

            <Section>
                <SectionTitle>No Financial Advice</SectionTitle>
                <Paragraph>
                    Nexus Signal AI is a tool for educational and research purposes only. The information and data provided through our Service, including but not limited to AI-generated predictions, market analysis, news, and AI Copilot responses, do not constitute financial, investment, trading, or any other form of advice.
                </Paragraph>
                <Paragraph>
                    You should not construe any such information or other material as legal, tax, investment, financial, or other advice. Nothing contained on our Service constitutes a solicitation, recommendation, endorsement, or offer by Nexus Signal AI to buy or sell any securities or other financial instruments.
                </Paragraph>
            </Section>

            <DisclaimerBox>
                <DisclaimerText>
                    WE ARE NOT A LICENSED FINANCIAL ADVISOR OR BROKER. ALL INFORMATION IS FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY. YOU ARE SOLELY RESPONSIBLE FOR YOUR OWN TRADING DECISIONS AND CAPITAL.
                </DisclaimerText>
            </DisclaimerBox>

            <Section>
                <SectionTitle>Accuracy of Information</SectionTitle>
                <Paragraph>
                    While we strive to provide accurate and timely information, Nexus Signal AI makes no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Service. Past performance is not indicative of future results.
                </Paragraph>
            </Section>

        </LegalContainer>
    );
};

export default Disclaimer;
