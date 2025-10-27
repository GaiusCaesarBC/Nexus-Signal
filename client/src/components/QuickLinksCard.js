// client/src/components/dashboard/QuickLinksCard.js
import React from 'react';
import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';

const Card = styled.div` /* Re-define Card for self-containment, or import from a shared styles file later */
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    h3 {
        color: #e0e0e0;
        margin-bottom: 1.2rem;
        font-size: 1.6rem;
    }
`;

const StyledNavLink = styled(RouterNavLink)`
    color: #00adef;
    text-decoration: none;
    font-weight: bold;
    transition: color 0.2s ease-in-out;
    &:hover {
        color: #74ccf4;
        text-decoration: underline;
    }
`;

const QuickLinksCard = () => {
    return (
        <Card>
            <h3>Quick Links</h3>
            <p>This section can host quick links to other parts of your app or external resources.</p>
            <ul>
                <li><StyledNavLink to="/predict">Go to Predictions</StyledNavLink></li>
                <li><StyledNavLink to="/settings">Account Settings</StyledNavLink></li>
                {/* Add more links */}
            </ul>
        </Card>
    );
};

export default QuickLinksCard;