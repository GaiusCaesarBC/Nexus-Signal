// client/src/components/SettingsPage.js - REFINED
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
    50% { box-shadow: 0 0 20px rgba(255, 107, 107, 0.8); }
    100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
`;

const SettingsWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - var(--navbar-height, 60px) - var(--footer-height, 60px)); /* Adjust for actual navbar/footer height */
    padding: 20px;
    background-color: #0d1a2f; /* Apply background to the whole area */
    color: #e2e8f0;
    position: relative; /* For absolute positioning of loader/error */
`;

const SettingsContainer = styled.div`
    max-width: 800px;
    width: 100%; /* Ensure it takes full width up to max-width */
    margin: auto; /* Center horizontally */
    padding: 2rem; /* Consistent padding */
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%); /* Consistent card background */
    border-radius: 12px; /* Consistent border radius */
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); /* Consistent shadow */
    border: 1px solid rgba(0, 173, 237, 0.2); /* Consistent border */
    display: flex;
    flex-direction: column;
    gap: 1.5rem; /* Consistent spacing */
`;

const Header = styled.h1`
    text-align: center;
    margin-bottom: 1.5rem; /* Consistent spacing */
    color: #00adef; /* Nexus blue for primary headers */
    font-size: 2rem; /* Make header more prominent */
`;

const Message = styled.div`
    background-color: ${props => props.$success ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}; /* Lighter background for messages */
    color: ${props => props.$success ? '#4CAF50' : '#FF6B6B'};
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
    border: 1px solid ${props => props.$success ? '#4CAF50' : '#FF6B6B'};
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 1.5rem; /* Consistent spacing */
`;

const Section = styled.section`
    background-color: #1a273b; /* Slightly darker background for sections */
    padding: 1.5rem; /* Consistent padding */
    border-radius: 8px;
    border: 1px solid rgba(0, 173, 237, 0.1);
`;

const SectionHeader = styled.h2`
    color: #00adef;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgba(0, 173, 237, 0.3);
    padding-bottom: 0.8rem;
    font-size: 1.3rem;
`;

const FormGroup = styled.div`
    margin-bottom: 1rem; /* Consistent spacing */
    display: flex;
    flex-direction: column;
`;

const Label = styled.label`
    margin-bottom: 0.5rem;
    color: #94a3b8;
    font-size: 0.95rem;
`;

const Input = styled.input`
    padding: 0.8rem 1rem;
    border-radius: 8px;
    border: 1px solid #00adef;
    background-color: #0d1a2f;
    color: #e0e0e0;
    font-size: 1rem;
    &:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 173, 237, 0.5);
    }
    &:disabled {
        background-color: #1a273b;
        cursor: not-allowed;
        color: #64748b;
    }
`;

const CheckboxLabel = styled.label`
    color: #a0aec0;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
    transform: scale(1.2);
    accent-color: #00adef; /* Style checkbox itself */
`;

const Select = styled.select`
    padding: 0.8rem 1rem;
    border-radius: 8px;
    border: 1px solid #00adef;
    background-color: #0d1a2f;
    color: #e0e0e0;
    font-size: 1rem;
    &:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 173, 237, 0.5);
    }
`;

const Button = styled.button`
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    border: none;
    background-color: #00adef;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    margin-top: 0.5rem;
    transition: background-color 0.3s ease, transform 0.2s ease;
    
    &:hover:not(:disabled) {
        background-color: #008cc7;
        transform: translateY(-2px);
    }
    &:active {
        transform: translateY(0);
    }
    &:disabled {
        background-color: #64748b;
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

const DangerButton = styled(Button)`
    background-color: #ef4444; /* Brighter red for danger */
    &:hover:not(:disabled) {
        background-color: #dc2626;
    }
`;

const SaveButton = styled(Button)`
    background-color: #22c55e; /* Green for save */
    &:hover:not(:disabled) {
        background-color: #16a34a;
    }
    align-self: flex-end; /* Align to the right */
    width: fit-content; /* Only take content width */
`;

const CenteredMessage = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    text-align: center;
    width: 90%;
    max-width: 400px; /* Limit width for readability */
`;

const StyledLoader = styled(Loader)`
    ${CenteredMessage}
`;

const ErrorMessage = styled(CenteredMessage)`
    color: #ff6b6b;
    font-weight: bold;
    animation: ${pulseGlow} 1.5s infinite alternate;
    background-color: rgba(255, 107, 107, 0.1);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #ff6b6b;
`;

const InfoMessage = styled(CenteredMessage)`
    color: #94a3b8;
    background-color: rgba(148, 163, 184, 0.1);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #94a3b8;
`;


const SettingsPage = () => {
    const { logout, api } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({
        username: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        notifications: {
            email: true,
            push: false,
            dailySummary: true
        },
        appPreferences: {
            theme: 'dark',
            defaultView: 'dashboard',
            refreshInterval: 5
        }
    });
    const [message, setMessage] = useState(''); // For success/error messages

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!api) {
                setError("API client not available. Please ensure AuthProvider is correctly set up.");
                setLoading(false);
                return;
            }

            try {
                // Ensure correct endpoint: remove leading `/api` if `axios.baseURL` already ends with `/api`
                const res = await api.get('/auth/me'); // Corrected endpoint if base URL includes /api
                const userData = res.data;

                setUserProfile(userData);

                setForm(prevForm => ({
                    ...prevForm,
                    username: userData.username || (userData.email ? userData.email.split('@')[0] : ''),
                    email: userData.email,
                    notifications: userData.notifications || prevForm.notifications,
                    appPreferences: userData.appPreferences || prevForm.appPreferences,
                }));
                setLoading(false);
            } catch (err) {
                console.error('Error fetching user profile:', err.response?.data?.msg || err.message);
                setError(err.response?.data?.msg || 'Failed to fetch user profile. Please try again.');
                setLoading(false);
                if (err.response && err.response.status === 401) {
                    logout(); // Log out if token is invalid/expired
                }
            }
        };

        fetchUserProfile();
    }, [api, logout]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('notifications.')) {
            const subFieldName = name.split('.')[1];
            setForm(prevForm => ({
                ...prevForm,
                notifications: {
                    ...prevForm.notifications,
                    [subFieldName]: type === 'checkbox' ? checked : value
                }
            }));
        } else if (name.startsWith('appPreferences.')) {
            const subFieldName = name.split('.')[1];
            setForm(prevForm => ({
                ...prevForm,
                appPreferences: {
                    ...prevForm.appPreferences,
                    [subFieldName]: type === 'checkbox' ? checked : value
                }
            }));
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!api) {
            setMessage("Authentication error. API client not available.");
            return;
        }

        if (form.newPassword) {
            if (form.newPassword !== form.confirmNewPassword) {
                setMessage("New passwords do not match.");
                return;
            }
            if (form.newPassword.length < 6) {
                setMessage("New password must be at least 6 characters.");
                return;
            }
            if (!form.currentPassword) {
                setMessage("Current password is required to change password.");
                return;
            }
        }

        const updateData = {
            username: form.username,
            email: form.email,
            notifications: form.notifications,
            appPreferences: form.appPreferences
        };

        if (form.newPassword) {
            updateData.currentPassword = form.currentPassword;
            updateData.newPassword = form.newPassword;
        }

        try {
            // Ensure correct endpoint: remove leading `/api` if `axios.baseURL` already ends with `/api`
            const res = await api.put('/auth/update-profile', updateData); // Corrected endpoint
            setUserProfile(res.data.user);
            setMessage(res.data.msg || 'Settings updated successfully!');
            setForm(prevForm => ({
                ...prevForm,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: ''
            }));
        } catch (err) {
            console.error('Error updating settings:', err.response ? err.response.data : err.message);
            setMessage(err.response ? err.response.data.msg || 'Failed to update settings.' : 'Failed to update settings.');
        }
    };

    // Render loading, error, or info messages centrally if no profile data
    if (loading) return <StyledLoader text="Loading settings..." />;
    if (error) return <ErrorMessage>{error}</ErrorMessage>;
    if (!userProfile) return <InfoMessage>No user profile data found.</InfoMessage>;

    return (
        <SettingsWrapper>
            <SettingsContainer>
                <Header>User Settings</Header>

                {message && (
                    <Message $success={message.includes('successfully')}>
                        {message}
                    </Message>
                )}

                <Form onSubmit={handleSubmit}>
                    {/* Profile Management */}
                    <Section>
                        <SectionHeader>Profile Management</SectionHeader>
                        <FormGroup>
                            <Label htmlFor="username">Username:</Label>
                            <Input
                                type="text"
                                id="username"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label htmlFor="email">Email:</Label>
                            <Input
                                type="email"
                                id="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label>User ID:</Label>
                            <Input type="text" value={userProfile._id} readOnly disabled />
                        </FormGroup>
                        <FormGroup>
                            <Label>Member Since:</Label>
                            <Input
                                type="text"
                                value={new Date(userProfile.date).toLocaleDateString()}
                                readOnly
                                disabled
                            />
                        </FormGroup>
                    </Section>

                    {/* Password Change */}
                    <Section>
                        <SectionHeader>Change Password</SectionHeader>
                        <FormGroup>
                            <Label htmlFor="currentPassword">Current Password:</Label>
                            <Input
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                value={form.currentPassword}
                                onChange={handleChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label htmlFor="newPassword">New Password:</Label>
                            <Input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                value={form.newPassword}
                                onChange={handleChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label htmlFor="confirmNewPassword">Confirm New Password:</Label>
                            <Input
                                type="password"
                                id="confirmNewPassword"
                                name="confirmNewPassword"
                                value={form.confirmNewPassword}
                                onChange={handleChange}
                                autoComplete="new-password" // Helps browsers not auto-fill
                            />
                        </FormGroup>
                    </Section>

                    {/* Notification Preferences */}
                    <Section>
                        <SectionHeader>Notification Preferences</SectionHeader>
                        <FormGroup>
                            <CheckboxLabel>
                                <Checkbox
                                    name="notifications.email"
                                    checked={form.notifications.email}
                                    onChange={handleChange}
                                /> Email Notifications
                            </CheckboxLabel>
                        </FormGroup>
                        <FormGroup>
                            <CheckboxLabel>
                                <Checkbox
                                    name="notifications.push"
                                    checked={form.notifications.push}
                                    onChange={handleChange}
                                /> Push Notifications (Coming Soon)
                            </CheckboxLabel>
                        </FormGroup>
                        <FormGroup>
                            <CheckboxLabel>
                                <Checkbox
                                    name="notifications.dailySummary"
                                    checked={form.notifications.dailySummary}
                                    onChange={handleChange}
                                /> Daily Market Summary
                            </CheckboxLabel>
                        </FormGroup>
                    </Section>

                    {/* Application Preferences */}
                    <Section>
                        <SectionHeader>Application Preferences</SectionHeader>
                        <FormGroup>
                            <Label htmlFor="theme">Theme:</Label>
                            <Select
                                id="theme"
                                name="appPreferences.theme"
                                value={form.appPreferences.theme}
                                onChange={handleChange}
                            >
                                <option value="dark">Dark Mode</option>
                                <option value="light">Light Mode</option>
                            </Select>
                        </FormGroup>
                        <FormGroup>
                            <Label htmlFor="defaultView">Default View:</Label>
                            <Select
                                id="defaultView"
                                name="appPreferences.defaultView"
                                value={form.appPreferences.defaultView}
                                onChange={handleChange}
                            >
                                <option value="dashboard">Dashboard</option>
                                <option value="watchlist">Watchlist</option>
                                <option value="market-data">Market Data</option>
                            </Select>
                        </FormGroup>
                        <FormGroup>
                            <Label htmlFor="refreshInterval">Data Refresh Interval (min):</Label>
                            <Select
                                id="refreshInterval"
                                name="appPreferences.refreshInterval"
                                value={form.appPreferences.refreshInterval}
                                onChange={handleChange}
                            >
                                <option value={1}>1 Minute</option>
                                <option value={5}>5 Minutes</option>
                                <option value={10}>10 Minutes</option>
                            </Select>
                        </FormGroup>
                    </Section>

                    {/* Subscription & Billing (Placeholder for now) */}
                    <Section>
                        <SectionHeader>Subscription & Billing</SectionHeader>
                        {userProfile.subscriptionStatus ? (
                            <p>Current Plan: {userProfile.subscriptionStatus}</p>
                        ) : (
                            <InfoMessage as="p">No subscription details available.</InfoMessage>
                        )}
                        <Button type="button">Manage Subscription</Button>
                        <Button type="button">View Billing History</Button>
                    </Section>

                    {/* Danger Zone */}
                    <Section>
                        <SectionHeader>Danger Zone</SectionHeader>
                        <DangerButton type="button" onClick={() => alert('Account deletion not yet implemented.')}>Delete Account</DangerButton>
                    </Section>

                    <SaveButton type="submit">Save Changes</SaveButton>
                </Form>
            </SettingsContainer>
        </SettingsWrapper>
    );
};

export default SettingsPage;