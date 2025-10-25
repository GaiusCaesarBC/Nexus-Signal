// client/src/pages/AboutPage.js - Your existing AboutPage component
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Target, ShieldCheck, Users } from 'lucide-react';

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
const AboutContainer = styled.div`
    padding: 3rem 2rem;
    animation: ${fadeIn} 0.6s ease-out;
    min-height: calc(100vh - var(--navbar-height)); /* Ensure it fills remaining screen height */
    background-color: #0d1a2f; /* Background color for the page */
    font-family: 'Inter', sans-serif;
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

const ContentGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: 2.5rem;
    max-width: 900px;
    margin: 0 auto;
`;

const SectionCard = styled.div`
    background: rgba(44, 62, 80, 0.75);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(52, 73, 94, 0.5);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    padding: 2rem;
    display: flex;
    gap: 2rem;
    align-items: flex-start;

    @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
`;

const IconWrapper = styled.div`
    background: #34495e;
    border-radius: 50%;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3498db;
    flex-shrink: 0;
`;

const TextContent = styled.div``;

const SectionTitle = styled.h2`
    margin-top: 0;
    color: #ecf0f1;
    font-size: 1.8rem;
`;

const SectionText = styled.p`
    color: #bdc3c7;
    line-height: 1.7;
`;

const AboutPage = () => { // Renamed from 'About' to 'AboutPage' for consistency with filename
    return (
        <AboutContainer>
            <Header>
                <Title>Our Philosophy</Title>
                <Subtitle>Moving beyond the black box. We believe in transparent, data-driven insights for the modern trader.</Subtitle>
            </Header>
            <ContentGrid>
                <SectionCard>
                    <IconWrapper><Target size={40} /></IconWrapper>
                    <TextContent>
                        <SectionTitle>The Problem with "Black Box" AI</SectionTitle>
                        <SectionText>
                            The world of trading AI is often a mystery. Many services provide signals without explanation, leaving users guessing the "why" behind the trade. This lack of transparency creates uncertainty and prevents traders from developing their own market intuition.
                        </SectionText>
                    </TextContent>
                </SectionCard>
                <SectionCard>
                    <IconWrapper><ShieldCheck size={40} /></IconWrapper>
                    <TextContent>
                        <SectionTitle>The Nexus Solution: Clarity & Confidence</SectionTitle>
                        <SectionText>
                            Nexus Signal AI is built on a foundation of clarity. Our predictions are not magic; they are the result of analyzing key technical indicators like SMA, RSI, and MACD. We show you the drivers behind each signal, empowering you to understand the rationale and trade with greater confidence.
                        </SectionText>
                    </TextContent>
                </SectionCard>
                <SectionCard>
                    <IconWrapper><Users size={40} /></IconWrapper>
                    <TextContent>
                        <SectionTitle>Our Team</SectionTitle>
                        <SectionText>
                            We are a passionate team of developers, data analysts, and trading enthusiasts dedicated to demystifying the market. Our background is rooted in data science and software engineering, with a shared goal of building powerful, transparent tools that give retail traders a professional edge.
                        </SectionText>
                    </TextContent>
                </SectionCard>
            </ContentGrid>
        </AboutContainer>
    );
};

export default AboutPage;