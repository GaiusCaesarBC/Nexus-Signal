// client/src/pages/PrivacyPolicyPage.js - Complete File

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Shield, Cookie, Mail, UserCheck } from 'lucide-react'; // Icons for sections

// Keyframe for fade-in animation
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const PrivacyPolicyContainer = styled.div`
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
        color: #00adef; /* Blue for official/trustworthy tone */
        margin-bottom: 1rem;
        letter-spacing: -0.5px;
        text-shadow: 0 0 10px rgba(0, 173, 237, 0.4);
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
    border: 1px solid rgba(0, 173, 237, 0.2); /* Blue border for emphasis */
    margin-bottom: 3rem;

    h2 {
        font-size: 2rem;
        color: #f8fafc; /* White for section titles */
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        
        svg {
            color: #00adef; /* Blue icon */
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

    ul {
        list-style: disc inside;
        color: #cbd5e1;
        padding-left: 1.5rem;
        margin-bottom: 1rem;
    }

    li {
        margin-bottom: 0.5rem;
        font-size: 0.95rem;
    }

    a {
        color: #00adef;
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

const PrivacyPolicyPage = () => {
    return (
        <PrivacyPolicyContainer>
            <Header>
                <h1>Privacy Policy for Nexus Signal.AI</h1>
                <p>
                    Your privacy is critically important to us. This Privacy Policy describes how Nexus Signal.AI collects, uses, and discloses your personal information
                    when you use our website and services.
                </p>
                <p><strong>Last updated: October 01, 2025</strong></p>
            </Header>

            <ContentSection>
                <h2><Shield size={28} /> Information We Collect</h2>
                <h3>Personal Information:</h3>
                <p>
                    When you register for an account, subscribe to our services, or interact with our platform, we may collect personal information that can identify you,
                    such as:
                </p>
                <ul>
                    <li><strong>Contact Information:</strong> Your name, email address, phone number, and billing address.</li>
                    <li><strong>Account Credentials:</strong> Username, password, and similar security information.</li>
                    <li><strong>Payment Information:</strong> Credit card details, billing details (processed securely by third-party payment processors like Stripe).</li>
                    <li><strong>Communication Data:</strong> Information you provide when contacting customer support or communicating with us.</li>
                </ul>

                <h3>Usage Data:</h3>
                <p>
                    We automatically collect information about your interactions with our website and services, including:
                </p>
                <ul>
                    <li>Your IP address, browser type, operating system.</li>
                    <li>Pages you view, features you use, and time spent on the platform.</li>
                    <li>Referring URLs and your navigation path through our site.</li>
                </ul>

                <h2><UserCheck size={28} /> How We Use Your Information</h2>
                <p>We use the collected information for various purposes, including:</p>
                <ul>
                    <li>To provide, operate, and maintain our services.</li>
                    <li>To process your transactions and manage your subscriptions.</li>
                    <li>To improve, personalize, and expand our services.</li>
                    <li>To understand and analyze how you use our services.</li>
                    <li>To communicate with you, including for customer support, service updates, and marketing (where you have opted in).</li>
                    <li>To detect and prevent fraud and other illegal activities.</li>
                    <li>To comply with legal obligations and enforce our terms and conditions.</li>
                </ul>

                <h2><Cookie size={28} /> Cookies and Tracking Technologies</h2>
                <p>
                    We use cookies and similar tracking technologies to track the activity on our service and hold certain information. Cookies are files with a small amount of data
                    which may include an anonymous unique identifier. Cookies are sent to your browser from a website and stored on your device.
                </p>
                <p>We use cookies for:</p>
                <ul>
                    <li><strong>Authentication:</strong> To identify you when you log in.</li>
                    <li><strong>Preferences:</strong> To remember your settings and preferences.</li>
                    <li><strong>Analytics:</strong> To analyze how our services are used.</li>
                    <li><strong>Security:</strong> For security purposes to detect and prevent malicious activity.</li>
                </ul>
                <p>
                    You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                </p>

                <h2><Shield size={28} /> Data Sharing and Disclosure</h2>
                <p>We may share your information in the following situations:</p>
                <ul>
                    <li><strong>With Service Providers:</strong> We may share your personal information with third-party service providers to perform functions on our behalf (e.g., payment processing, hosting, analytics, customer support).</li>
                    <li><strong>For Business Transfers:</strong> In connection with or during negotiations of any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                    <li><strong>For Legal Reasons:</strong> If required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).</li>
                    <li><strong>With Your Consent:</strong> We may disclose your personal information for any other purpose with your consent.</li>
                </ul>
                <p>
                    We do not sell, rent, or trade your personal information to third parties for their direct marketing purposes.
                </p>

                <h2><Shield size={28} /> Data Security</h2>
                <p>
                    The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure.
                    While we strive to use commercially acceptable means to protect your personal data, we cannot guarantee its absolute security.
                </p>

                <h2><UserCheck size={28} /> Your Data Protection Rights</h2>
                <p>
                    Depending on your location, you may have the following data protection rights:
                </p>
                <ul>
                    <li>The right to access, update, or delete the information we have on you.</li>
                    <li>The right to rectify any inaccurate information.</li>
                    <li>The right to object to our processing of your personal data.</li>
                    <li>The right to request restriction of processing your personal data.</li>
                    <li>The right to data portability.</li>
                    <li>The right to withdraw consent at any time where Nexus Signal.AI relied on your consent to process your personal information.</li>
                </ul>
                <p>
                    To exercise any of these rights, please contact us using the details below.
                </p>

                <h2><Mail size={28} /> Changes to This Privacy Policy</h2>
                <p>
                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top of this Privacy Policy.
                    You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                </p>
            </ContentSection>

            <ContactInfo>
                <p>If you have any questions about this Privacy Policy, please contact us:</p>
                <p>Email: <a href="mailto:support@nexussignal.ai">support@nexussignal.ai</a></p>
                <p>Website: <a href="https://www.nexussignal.ai/contact" target="_blank" rel="noopener noreferrer">Contact Us Page</a></p>
            </ContactInfo>
        </PrivacyPolicyContainer>
    );
};

export default PrivacyPolicyPage;