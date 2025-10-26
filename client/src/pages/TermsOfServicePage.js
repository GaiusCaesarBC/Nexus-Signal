// client/src/pages/TermsOfServicePage.js - Complete File

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { FileText, User, Lock, ExternalLink, MessageSquare } from 'lucide-react'; // Icons for sections

// Keyframe for fade-in animation
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const TermsOfServiceContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background: linear-gradient(180deg, #0d1a2f 0%, #1a273b 100%);
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    animation: ${fadeIn} 0.8s ease-out forwards;
    line-height: 1.7;
`;

const Header = styled.div`
    text-align: center;
    max-width: 900px;
    margin-bottom: 3rem;
    animation: ${fadeIn} 1s ease-out forwards;

    h1 {
        font-size: 3.2rem;
        color: #8b5cf6; /* Purple for official/agreement tone */
        margin-bottom: 1rem;
        letter-spacing: -0.5px;
        text-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
        line-height: 1.2;

        @media (max-width: 768px) {
            font-size: 2.5rem;
        }
    }

    p {
        font-size: 1.1rem;
        color: #94a3b8;
        line-height: 1.6;

        @media (max-width: 768px) {
            font-size: 0.95rem;
        }
    }
`;

const ContentSection = styled.section`
    width: 100%;
    max-width: 900px;
    background-color: rgba(26, 39, 59, 0.6); /* Slightly darker, semi-transparent background */
    border-radius: 12px;
    padding: 2.5rem 3rem;
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(139, 92, 246, 0.2); /* Purple border for emphasis */
    margin-bottom: 3rem;

    h2 {
        font-size: 2rem;
        color: #f8fafc; /* White for section titles */
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        
        svg {
            color: #8b5cf6; /* Purple icon */
        }

        @media (max-width: 768px) {
            font-size: 1.6rem;
            flex-direction: column;
            text-align: center;
        }
    }

    h3 {
        font-size: 1.4rem;
        color: #f8fafc;
        margin-top: 2rem;
        margin-bottom: 0.8rem;
        @media (max-width: 768px) {
            font-size: 1.2rem;
        }
    }

    p {
        font-size: 1rem;
        color: #cbd5e1;
        margin-bottom: 1rem;
    }

    ol, ul {
        list-style: decimal inside;
        color: #cbd5e1;
        padding-left: 1.5rem;
        margin-bottom: 1rem;
    }

    li {
        margin-bottom: 0.5rem;
        font-size: 0.95rem;
    }

    a {
        color: #00adef; /* Blue for links */
        text-decoration: none;
        &:hover {
            text-decoration: underline;
        }
    }

    strong {
        color: #f8fafc;
    }
`;

const ContactInfo = styled.div`
    text-align: center;
    font-size: 1rem;
    color: #94a3b8;
    max-width: 600px;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);

    p {
        margin-bottom: 0.5rem;
    }

    a {
        color: #00adef;
        text-decoration: none;
        &:hover {
            text-decoration: underline;
        }
    }
`;

const TermsOfServicePage = () => {
    return (
        <TermsOfServiceContainer>
            <Header>
                <h1>Terms of Service for Nexus Signal.AI</h1>
                <p>
                    Welcome to Nexus Signal.AI\! These Terms of Service ("Terms") govern your access to and use of our website, services, and products.
                    Please read them carefully before using our platform.
                </p>
                <p><strong>Last updated: October 01, 2025</strong></p>
            </Header>

            <ContentSection>
                <h2><FileText size={28} /> 1. Acceptance of Terms</h2>
                <p>
                    By accessing or using Nexus Signal.AI, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to all the terms and conditions,
                    you may not access or use our services.
                </p>

                <h2><User size={28} /> 2. User Accounts</h2>
                <ol>
                    <li><strong>Account Creation:</strong> To access certain features of our service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.</li>
                    <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your password or account or any other breach of security.</li>
                    <li><strong>Eligibility:</strong> You must be at least 18 years old to use our services. By using our services, you represent and warrant that you are at least 18 years of age.</li>
                </ol>

                <h2><Lock size={28} /> 3. Subscriptions and Payments</h2>
                <ol>
                    <li><strong>Subscription Plans:</strong> Nexus Signal.AI offers various subscription plans. Details of these plans, including pricing and features, are available on our <a href="/pricing" target="_blank" rel="noopener noreferrer">Pricing Page</a>.</li>
                    <li><strong>Billing:</strong> You agree to pay all fees associated with your chosen subscription plan. Payments are processed securely by third-party payment processors (e.g., Stripe).</li>
                    <li><strong>Automatic Renewal:</strong> Subscriptions typically auto-renew unless canceled. You can manage your subscription settings within your account.</li>
                    <li><strong>Refunds:</strong> All sales are final. We do not offer refunds, except where required by law. Please refer to our specific refund policy if applicable.</li>
                </ol>

                <h2><ExternalLink size={28} /> 4. Prohibited Conduct</h2>
                <p>You agree not to:</p>
                <ul>
                    <li>Use the service for any illegal purpose or in violation of any local, state, national, or international law.</li>
                    <li>Engage in any activity that could damage, disable, overburden, or impair the service.</li>
                    <li>Attempt to gain unauthorized access to any part of the service, other accounts, computer systems, or networks.</li>
                    <li>Distribute or reproduce any content from Nexus Signal.AI without our express written permission.</li>
                    <li>Use our AI signals for purposes other than personal investment information, or attempt to reverse-engineer our algorithms.</li>
                </ul>

                <h2><MessageSquare size={28} /> 5. Disclaimers and Limitation of Liability</h2>
                <p>
                    Please refer to our separate <a href="/disclaimer" target="_blank" rel="noopener noreferrer">Disclaimer Page</a> for detailed information regarding investment risks, hypothetical performance, and other important disclaimers.
                </p>
                <p>
                    To the maximum extent permitted by applicable law, Nexus Signal.AI and its affiliates, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
                    including but not limited to, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the service; (ii) any conduct or content of
                    any third party on the service; (iii) any content obtained from the service; and (iv) unauthorized access, use, or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence)
                    or any other legal theory, whether or not we have been informed of the possibility of such damage.
                </p>

                <h2><Lock size={28} /> 6. Intellectual Property</h2>
                <p>
                    All content on Nexus Signal.AI, including text, graphics, logos, images, as well as the compilation thereof, and any software used on the site, is the property of Nexus Signal.AI or its suppliers and protected by copyright and other laws that protect intellectual property and proprietary rights.
                </p>

                <h2><FileText size={28} /> 7. Governing Law</h2>
                <p>
                    These Terms shall be governed and construed in accordance with the laws of [USA], without regard to its conflict of law provisions.
                </p>

                <h2><MessageSquare size={28} /> 8. Changes to Terms</h2>
                <p>
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </p>
            </ContentSection>

            <ContactInfo>
                <p>If you have any questions about these Terms of Service, please contact us:</p>
                <p>Email: <a href="mailto:support@nexussignal.ai">support@nexussignal.ai</a></p>
                <p>Website: <a href="https://www.nexussignal.ai/contact" target="_blank" rel="noopener noreferrer">Contact Us Page</a></p>
            </ContactInfo>
        </TermsOfServiceContainer>
    );
};

export default TermsOfServicePage;