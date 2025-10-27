// client/src/context/AuthContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Determine API_URL based on environment
// Ensure REACT_APP_API_URL is set correctly in client/.env
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Initial loading state
    const [token, setToken] = useState(localStorage.getItem('token')); // Get token from localStorage

    // Set a global Axios default for withCredentials for all instances
    // This is generally a good practice for apps that always need to send cookies/tokens.
    axios.defaults.withCredentials = true;

    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                axios.defaults.headers.common['x-auth-token'] = token;
                try {
                    // Assuming you have a /api/auth/me route to get user details
                    const res = await axios.get(`${API_URL}/api/auth/me`); // withCredentials already set globally
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (err) {
                    console.error('[AuthContext] Token validation failed:', err.response?.data?.msg || err.message);
                    // If token is invalid, clear it
                    localStorage.removeItem('token');
                    setToken(null);
                    setIsAuthenticated(false);
                    setUser(null);
                    delete axios.defaults.headers.common['x-auth-token'];
                }
            }
            setLoading(false);
        };

        loadUser();
    }, [token]);


    const login = async (email, password) => {
        console.log(`[AuthContext] Attempting login for: ${email}`);
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { email, password }); // withCredentials already set globally

            localStorage.setItem('token', res.data.token);
            setToken(res.data.token);
            axios.defaults.headers.common['x-auth-token'] = res.data.token;
            
            // Fetch user data after setting token
            const userRes = await axios.get(`${API_URL}/api/auth/me`); // withCredentials already set globally
            setUser(userRes.data);
            setIsAuthenticated(true);
            console.log('[AuthContext] Login successful.');
            return { success: true };
        } catch (err) {
            console.error('[AuthContext] Login failed:', err.response?.data?.msg || err.message);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: err.response?.data?.msg || 'Network Error' };
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await axios.post(`${API_URL}/api/auth/register`, { username, email, password }); // withCredentials already set globally
            
            // Assuming register endpoint also returns a token and logs in
            localStorage.setItem('token', res.data.token);
            setToken(res.data.token);
            axios.defaults.headers.common['x-auth-token'] = res.data.token;
            
            const userRes = await axios.get(`${API_URL}/api/auth/me`); // withCredentials already set globally
            setUser(userRes.data);
            setIsAuthenticated(true);
            return { success: true };
        } catch (err) {
            console.error('[AuthContext] Registration failed:', err.response?.data?.msg || err.message);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: err.response?.data?.msg || 'Network Error' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        delete axios.defaults.headers.common['x-auth-token'];
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, loading, token, login, register, logout, api: axios }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};