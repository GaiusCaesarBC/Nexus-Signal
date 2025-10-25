// client/src/pages/AccountSettingsPage.js - Expanded information and warning cleanup
import React, { useEffect } from 'react'; // Removed useState as it wasn't used
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { User, Zap, Key, LogOut, Hash, Calendar, Heart, Award } from 'lucide-react'; // Added Hash, Calendar, Heart, Award, removed Mail

// Keyframes for animations
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
`;

const slideInLeft = keyframes`
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
`;

// Styled Components
const SettingsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    min-height: calc(100vh - var(--navbar-height));
    background: linear-gradient(145deg, #0d1a2f 0%, #1a273b 100%);
    color: #e0e0e0;
    font-family: 'Inter', sans-serif;
    animation: ${fadeIn} 0.8s ease-out forwards;
`;

const SettingsBox = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 3rem;
    max-width: 700px;
    width: 100%;
    border: 1px solid rgba(0, 173, 237, 0.2);
    animation: ${slideInLeft} 0.8s ease-out forwards;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const Header = styled.h2`
    font-size: 2.5rem;
    color: #00adef;
    margin-bottom: 1.5rem;
    text-align: center;
    text-shadow: 0 0 10px rgba(0, 173, 237, 0.5);
`;

const SectionTitle = styled.h3`
    font-size: 1.8rem;
    color: #f8fafc;
    margin-top: 2rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(0, 173, 237, 0.4);
    display: flex;
    align-items: center;
    gap: 0.8rem;
`;

const InfoGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.8rem;
    background-color: #1a273b;
    border-radius: 8px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);

    span {
        font-size: 1.1rem;
        color: #94a3b8;
        font-weight: 500;
        min-width: 120px; /* Aligned labels */
    }
    p {
        font-size: 1.1rem;
        color: #e0e0e0;
        flex-grow: 1;
    }
`;

const Button = styled.button`
    padding: 0.9rem 1.8rem;
    background: linear-gradient(90deg, #00adef 0%, #008cd4 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.05rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 173, 237, 0.4);
    margin-top: 2rem;
    align-self: flex-start;

    &:hover {
        background: linear-gradient(90deg, #008cd4 0%, #00adef 100%);
        box-shadow: 0 6px 20px rgba(0, 173, 237, 0.6);
        transform: translateY(-2px);
    }

    &:disabled {
        background: #4a5a6b;
        cursor: not-allowed;
        opacity: 0.7;
        transform: none;
        box-shadow: none;
    }
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: 1rem;
    font-size: 0.95rem;
    text-align: center;
`;

const AccountSettingsPage = () => {
    const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (authLoading) {
        return <Loader />;
    }

    if (!isAuthenticated || !user) {
        return (
            <SettingsContainer>
                <SettingsBox>
                    <ErrorMessage>You need to be logged in to view account settings.</ErrorMessage>
                    <Button onClick={() => navigate('/login')}>Login Now</Button>
                </SettingsBox>
            </SettingsContainer>
        );
    }

    // Helper to format dates
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    return (
        <SettingsContainer>
            <SettingsBox>
                <Header>Account Settings</Header>

                <SectionTitle><User size={24} color="#00adef" /> Profile Information</SectionTitle>
                <InfoGroup>
                    <span>Username:</span> <p>{user.username}</p>
                </InfoGroup>
                <InfoGroup>
                    <span>Email:</span> <p>{user.email}</p>
                </InfoGroup>
                {/* Assuming user._id exists */}
                <InfoGroup>
                    <span>User ID:</span> <p>{user._id || 'N/A'}</p>
                </InfoGroup>
                {/* Assuming user.createdAt exists (from MongoDB models) */}
                <InfoGroup>
                    <span>Joined:</span> <p>{formatDate(user.createdAt)}</p>
                </InfoGroup>

                <SectionTitle><Zap size={24} color="#f97316" /> Subscription & Plan</SectionTitle>
                <InfoGroup>
                    <span>Tier:</span> <p>{user.subscriptionTier || 'Free'}</p>
                </InfoGroup>
                {/* Assuming user.watchlist is an array */}
                <InfoGroup>
                    <span>Watchlist Items:</span> <p>{user.watchlist ? user.watchlist.length : 0}</p>
                </InfoGroup>
                {/* Placeholder for future subscription details */}
                <InfoGroup>
                    <span>Next Billing:</span> <p>N/A (Future Feature)</p>
                </InfoGroup>


                <SectionTitle><Key size={24} color="#94a3b8" /> Security</SectionTitle>
                <p>For security reasons, changing your password or other sensitive details requires re-authentication.</p>
                {/* Future implementation: <Button>Change Password</Button> */}
                {/* Future implementation: <Button>Enable 2FA</Button> */}
                <InfoGroup>
                    <span>2FA Status:</span> <p>Disabled (Future Feature)</p>
                </InfoGroup>


                <Button onClick={handleLogout}><LogOut size={20} style={{marginRight: '8px'}} /> Logout</Button>
            </SettingsBox>
        </SettingsContainer>
    );
};

export default AccountSettingsPage;