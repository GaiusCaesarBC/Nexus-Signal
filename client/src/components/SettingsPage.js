import React, { useState, useEffect } from 'react';
// No need to import 'axios' directly, as we'll use the 'api' instance from AuthContext
// import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  // CORRECTED: Destructure 'api' instance from useAuth()
  const { logout, api } = useAuth(); // Now we have the pre-configured Axios instance
  const [settings, setSettings] = useState(null);
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

  // --- DEBUGGING LOGS FOR SETTINGSPAGE ---
  console.log('[SettingsPage Debug] api instance received from AuthContext:', api);
  if (api) {
      console.log('[SettingsPage Debug] api.defaults.baseURL:', api.defaults.baseURL);
      console.log('[SettingsPage Debug] api.defaults.headers.common["x-auth-token"]:', api.defaults.headers.common['x-auth-token'] ? api.defaults.headers.common['x-auth-token'].substring(0, 10) + '...' : 'No token');
  }
  // --- END DEBUGGING LOGS ---

  useEffect(() => {
    const fetchSettings = async () => {
      // No need to check API_BASE_URL or token here, the 'api' instance handles it
      // The ProtectedRoute should ensure a token exists anyway.
      if (!api) { // Check if the api instance is available (though useAuth should always provide it)
        setError("API client not available. Please ensure AuthProvider is correctly set up.");
        setLoading(false);
        return;
      }

      try {
        // CORRECTED: Use the 'api' instance directly. It already has the base URL and token.
        const res = await api.get('/api/auth/settings'); // Path is now relative to baseURL defined in AuthContext
        setSettings(res.data);

        setForm(prevForm => ({
          username: res.data.username,
          email: res.data.email,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
          notifications: res.data.notifications || prevForm.notifications,
          appPreferences: res.data.appPreferences || prevForm.appPreferences
        }));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to fetch settings. Please try again.');
        setLoading(false);
        if (err.response && err.response.status === 401) {
          logout(); // Log out if token is invalid/expired
        }
      }
    };

    fetchSettings();
  // CORRECTED: Dependencies are now 'api' and 'logout'
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

    if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
        setMessage("New passwords do not match.");
        return;
    }
    if (form.newPassword && form.newPassword.length < 6) {
        setMessage("New password must be at least 6 characters.");
        return;
    }
    if (form.newPassword && !form.currentPassword) {
        setMessage("Current password is required to change password.");
        return;
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
      // CORRECTED: Use the 'api' instance directly. It already has the base URL and token.
      const res = await api.put('/api/auth/settings', updateData);
      setSettings(res.data.user);
      setMessage('Settings updated successfully!');
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

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Loading settings...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>Error: {error}</div>;
  if (!settings) return <div style={{ textAlign: 'center', padding: '20px' }}>No settings data found.</div>;

  // The full UI will go here
  return (
    <div style={{ maxWidth: '800px', margin: 'auto', padding: '20px', backgroundColor: '#1a202c', color: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#667eea' }}>User Settings</h1>

      {message && (
        <div style={{
          backgroundColor: message.includes('successfully') ? '#2d3748' : '#c53030',
          color: message.includes('successfully') ? '#a0aec0' : '#e0e0e0',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Profile Management */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Profile Management</h2>
          <div style={formGroupStyle}>
            <label htmlFor="username" style={labelStyle}>Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="email" style={labelStyle}>Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>User ID:</label>
            <input type="text" value={settings.id} readOnly style={{ ...inputStyle, backgroundColor: '#2d3748' }} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Member Since:</label>
            <input type="text" value={new Date(settings.registrationDate).toLocaleDateString()} readOnly style={{ ...inputStyle, backgroundColor: '#2d3748' }} />
          </div>
        </section>

        {/* Password Change */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Change Password</h2>
          <div style={formGroupStyle}>
            <label htmlFor="currentPassword" style={labelStyle}>Current Password:</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="newPassword" style={labelStyle}>New Password:</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="confirmNewPassword" style={labelStyle}>Confirm New Password:</label>
            <input
              type="password"
              id="confirmNewPassword"
              name="confirmNewPassword"
              value={form.confirmNewPassword}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
        </section>

        {/* Notification Preferences */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Notification Preferences</h2>
          <div style={formGroupStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                name="notifications.email"
                checked={form.notifications.email}
                onChange={handleChange}
                style={checkboxStyle}
              /> Email Notifications
            </label>
          </div>
          <div style={formGroupStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                name="notifications.push"
                checked={form.notifications.push}
                onChange={handleChange}
                style={checkboxStyle}
              /> Push Notifications (Coming Soon)
            </label>
          </div>
          <div style={formGroupStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                name="notifications.dailySummary"
                checked={form.notifications.dailySummary}
                onChange={handleChange}
                style={checkboxStyle}
              /> Daily Market Summary
            </label>
          </div>
        </section>

        {/* Application Preferences */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Application Preferences</h2>
          <div style={formGroupStyle}>
            <label htmlFor="theme" style={labelStyle}>Theme:</label>
            <select
              id="theme"
              name="appPreferences.theme"
              value={form.appPreferences.theme}
              onChange={handleChange}
              style={selectStyle}
            >
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode</option>
            </select>
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="defaultView" style={labelStyle}>Default View:</label>
            <select
              id="defaultView"
              name="appPreferences.defaultView"
              value={form.appPreferences.defaultView}
              onChange={handleChange}
              style={selectStyle}
            >
              <option value="dashboard">Dashboard</option>
              <option value="watchlist">Watchlist</option>
              <option value="market-data">Market Data</option>
            </select>
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="refreshInterval" style={labelStyle}>Data Refresh Interval (min):</label>
            <select
              id="refreshInterval"
              name="appPreferences.refreshInterval"
              value={form.appPreferences.refreshInterval}
              onChange={handleChange}
              style={selectStyle}
            >
              <option value={1}>1 Minute</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
            </select>
          </div>
        </section>

        {/* Subscription & Billing (Placeholder for now) */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Subscription & Billing</h2>
          <p>Current Plan: {settings.subscriptionStatus}</p>
          <button type="button" style={buttonStyle}>Manage Subscription</button>
          <button type="button" style={buttonStyle}>View Billing History</button>
        </section>

        {/* Danger Zone */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Danger Zone</h2>
          <button type="button" style={{ ...buttonStyle, backgroundColor: '#c53030' }} onClick={() => alert('Account deletion not yet implemented.')}>Delete Account</button>
        </section>

        <button type="submit" style={{ ...buttonStyle, backgroundColor: '#48bb78', marginTop: '30px' }}>Save Changes</button>
      </form>
    </div>
  );
};

// Inline Styles for a sleek dark theme
const sectionStyle = {
  backgroundColor: '#2d3748',
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '20px',
  border: '1px solid #4a5568'
};

const sectionHeaderStyle = {
  color: '#667eea',
  marginBottom: '15px',
  borderBottom: '1px solid #4a5568',
  paddingBottom: '10px'
};

const formGroupStyle = {
  marginBottom: '15px',
  display: 'flex',
  flexDirection: 'column'
};

const labelStyle = {
  marginBottom: '5px',
  color: '#a0aec0'
};

const inputStyle = {
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #4a5568',
  backgroundColor: '#2d3748',
  color: '#e2e8f0',
  fontSize: '1rem'
};

const checkboxLabelStyle = {
  color: '#a0aec0',
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
};

const checkboxStyle = {
  transform: 'scale(1.2)'
};

const selectStyle = {
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #4a5568',
  backgroundColor: '#2d3748',
  color: '#e2e8f0',
  fontSize: '1rem'
};

const buttonStyle = {
  padding: '10px 15px',
  borderRadius: '5px',
  border: 'none',
  backgroundColor: '#4299e1',
  color: 'white',
  cursor: 'pointer',
  fontSize: '1rem',
  marginTop: '10px',
  transition: 'background-color 0.2s'
};

export default SettingsPage;