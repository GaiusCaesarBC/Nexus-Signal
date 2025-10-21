import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer`
    width: 100%;
    padding: 2rem 0;
    margin-top: 4rem;
    border-top: 1px solid rgba(52, 73, 94, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
`;

const FooterContent = styled.div`
    max-width: 1400px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;

    @media (max-width: 768px) {
        flex-direction: column;
        gap: 1rem;
    }
`;

const Copyright = styled.p`
    color: #95a5a6;
    margin: 0;
`;

const FooterLinks = styled.div`
    display: flex;
    gap: 1.5rem;
`;

const FooterLink = styled(Link)`
    color: #95a5a6;
    text-decoration: none;
    transition: color 0.2s ease-in-out;

    &:hover {
        color: #3498db;
    }
`;

const Footer = () => {
    return (
        <FooterContainer>
            <FooterContent>
                <Copyright>NexusSignal.AI | Proudly made in the USA.</Copyright>
                <FooterLinks>
                    <FooterLink to="/terms">Terms of Service</FooterLink>
                    <FooterLink to="/privacy">Privacy Policy</FooterLink>
                    <FooterLink to="/disclaimer">Disclaimer</FooterLink>
                </FooterLinks>
            </FooterContent>
        </FooterContainer>
    );
};

export default Footer;

