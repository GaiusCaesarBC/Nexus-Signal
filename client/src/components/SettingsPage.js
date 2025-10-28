// client/src/components/SettingsPage.js
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components'; // Import keyframes for ErrorMessage pulse
import { useAuth } from '../context/AuthContext';
import Loader from './Loader'; // Assuming you have a Loader component

// Keyframes for error message glow
const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
    50% { box-shadow: 0 0 20px rgba(255, 107, 107, 0.8); }
    100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
`;

// Styled components for the SettingsPage
const SettingsContainer = styled.div`
    max-width: 800px;
    margin: auto;
    padding: 20px;
    background-color: #1a202c;
    color: #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Header = styled.h1`
    text-align: center;
    margin-bottom: 30px;
    color: #667eea;
`;

const Message = styled.div`
    background-color: ${props => props.success ? '#2d3748' : '#c53030'};
    color: ${props => props.success ? '#a0aec0' : '#e0e0e0'};
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
    text-align: center;
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const Section = styled.section`
    background-color: #2d3748;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid #4a5568;
`;

const SectionHeader = styled.h2`
    color: #667eea;
    margin-bottom: 15px;
    border-bottom: 1px solid #4a5568;
    padding-bottom: 10px;
`;

const FormGroup = styled.div`
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
`;

const Label = styled.label`
    margin-bottom: 5px;
    color: #a0aec0;
`;

const Input = styled.input`
    padding: 10px;
    border-radius: 5px;
    border: 1px solid #4a5568;
    background-color: #2d3748;
    color: #e2e8f0;
    font-size: 1rem;
    &:disabled {
        background-color: #3b4556;
        cursor: not-allowed;
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
`;

const Select = styled.select`
    padding: 10px;
    border-radius: 5px;
    border: 1px solid #4a5568;
    background-color: #2d3748;
    color: #e2e8f0;
    font-size: 1rem;
`;

const Button = styled.button`
    padding: 10px 15px;
    border-radius: 5px;
    border: none;
    background-color: #4299e1;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 10px;
    transition: background-color 0.2s;
    &:hover:not(:disabled) {
        background-color: #3182ce;
    }
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const DangerButton = styled(Button)`
    background-color: #c53030;
    &:hover:not(:disabled) {
        background-color: #9b2c2c;
    }
`;

const SaveButton = styled(Button)`
    background-color: #48bb78;
    margin-top: 30px;
    &:hover:not(:disabled) {
        background-color: #38a169;
    }
`;

// Define ErrorMessage and InfoMessage for SettingsPage
const ErrorMessage = styled.div`
    color: #ff6b6b;
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
    animation: ${pulseGlow} 1.5s infinite alternate;
`;

const InfoMessage = styled.div`
    color: #94a3b8;
    margin-top: 1.5rem;
    font-size: 1rem;
    text-align: center;
`;


const SettingsPage = () => {
    const { logout, api } = useAuth();
    const [userProfile, setUserProfile] = useState(null); // State to store fetched user data
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
                // Fetch user data from the /api/auth/me endpoint
                const res = await api.get('/api/auth/me');
                const userData = res.data;

                setUserProfile(userData); // Store the raw user data

                // Populate form with fetched data
                setForm(prevForm => ({
                    ...prevForm, // Keep default values for fields not returned by API
                    username: userData.username || (userData.email ? userData.email.split('@')[0] : ''), // Use username if exists, else derive from email
                    email: userData.email,
                    // If your User model has these, they will be populated. Otherwise, defaults are used.
                    notifications: userData.notifications || prevForm.notifications,
                    appPreferences: userData.appPreferences || prevForm.appPreferences,
                }));
                setLoading(false);
            } catch (err) {
                console.error('Error fetching user profile:', err.response?.data?.msg || err.message);
                setError('Failed to fetch user profile. Please try again.');
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
            const res = await api.put('/api/auth/update-profile', updateData); // Updated endpoint
            setUserProfile(res.data.user); // Update local state with the new user profile
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

    if (loading) return <Loader text="Loading settings..." />; // Use your Loader component
    if (error) return <ErrorMessage>{error}</ErrorMessage>;
    if (!userProfile) return <InfoMessage>No user profile data found.</InfoMessage>;

    return (
        <SettingsContainer>
            <Header>User Settings</Header>

            {message && (
                <Message success={message.includes('successfully')}>
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
                        <Input type="text" value={userProfile._id} readOnly disabled /> {/* Use _id from userProfile */}
                    </FormGroup>
                    <FormGroup>
                        <Label>Member Since:</Label>
                        <Input
                            type="text"
                            value={new Date(userProfile.date).toLocaleDateString()} // Use userProfile.date
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
                        <InfoMessage>No subscription details available.</InfoMessage>
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
    );
};

export default SettingsPage;