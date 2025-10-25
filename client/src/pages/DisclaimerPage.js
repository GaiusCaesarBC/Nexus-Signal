// client/src/pages/DisclaimerPage.js - Complete File

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { ShieldAlert, Info } from 'lucide-react'; // Icons for visual emphasis

// Keyframe for fade-in animation
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const DisclaimerContainer = styled.div`
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
        color: #f97316; /* Orange for warning/disclaimer tone */
        margin-bottom: 1rem;
        letter-spacing: -0.5px;
        text-shadow: 0 0 10px rgba(249, 115, 22, 0.4);
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
    border: 1px solid rgba(249, 115, 22, 0.2); /* Orange border for emphasis */
    margin-bottom: 3rem;

    h2 {
        font-size: 2rem;
        color: #00adef; /* Blue for section titles */
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        
        svg {
            color: #f97316; /* Orange icon */
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

    em {
        color: #f97316;
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

const DisclaimerPage = () => {
    return (
        <DisclaimerContainer>
            <Header>
                <h1>Important Disclaimers for Nexus Signal.AI</h1>
                <p>Please read these disclaimers carefully before using the Nexus Signal.AI platform or relying on any information or signals provided herein.</p>
            </Header>

            <ContentSection>
                <h2><ShieldAlert size={28} /> General Investment Disclaimer</h2>
                <p>
                    Nexus Signal.AI provides AI-generated signals and market analysis for informational purposes only. We are not a registered investment advisor, broker-dealer, or financial analyst.
                    The information provided should not be considered as financial advice, investment recommendations, or an offer to buy or sell any securities or financial products.
                </p>
                <p>
                    All trading involves risk, and you can lose money. Past performance is not indicative of future results. The value of investments and the income from them can go down as well as up.
                    You may not get back the amount you invested.
                </p>

                <h2><Info size={28} /> Hypothetical Performance Disclaimer</h2>
                <p>
                    Any performance figures, charts, or simulations displayed on this website or within the platform are hypothetical, backtested results and do not represent actual trading.
                    These results have inherent limitations. Unlike an actual performance record, simulated results do not represent actual trading and may not reflect the impact of market factors
                    such as liquidity, slippage, and execution costs.
                </p>
                <p>
                    Furthermore, simulated trading programs are often designed with the benefit of hindsight. No representation is being made that any account will or is likely to achieve profits or losses
                    similar to those shown. Individual results may vary significantly.
                </p>

                <h2><ShieldAlert size={28} /> Risk of Loss</h2>
                <p>
                    Trading in financial markets carries a high level of risk. You should be aware of all the risks associated with trading and seek advice from an independent financial advisor if you have any doubts.
                    Do not invest money you cannot afford to lose. Leverage can magnify both profits and losses.
                </p>

                <h2><Info size={28} /> Accuracy of Information</h2>
                <p>
                    While we strive to provide accurate and timely information, Nexus Signal.AI does not guarantee the accuracy, completeness, or timeliness of the information or signals provided.
                    Market conditions can change rapidly, and information may become outdated. We are not responsible for any errors or omissions, or for any results obtained from the use of this information.
                </p>

                <h2><ShieldAlert size={28} /> Third-Party Links</h2>
                <p>
                    Our website may contain links to third-party websites or services that are not owned or controlled by Nexus Signal.AI. We have no control over, and assume no responsibility for,
                    the content, privacy policies, or practices of any third-party websites or services. You further acknowledge and agree that Nexus Signal.AI shall not be responsible or liable,
                    directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods or services available on or through
                    any such websites or services.
                </p>

                <h3>Changes to Disclaimer</h3>
                <p>
                    Nexus Signal.AI reserves the right to modify or replace this Disclaimer at any time. We will provide notice of any changes by posting the new Disclaimer on this page.
                    Your continued use of the service after any such changes constitutes your acceptance of the new Disclaimer.
                </p>
            </ContentSection>

            <ContactInfo>
                <p>If you have any questions about this Disclaimer, please contact us:</p>
                <p>Email: <a href="mailto:support@nexussignal.ai">support@nexussignal.ai</a></p>
            </ContactInfo>
        </DisclaimerContainer>
    );
};

export default DisclaimerPage;