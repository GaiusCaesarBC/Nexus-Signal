// client/src/context/AuthContext.js - FINAL FIX FOR COOKIE PERSISTENCE

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios'; // Import your new API instance from axios.js

const AuthContext = createContext(null);

// Define the base API URL (Assuming it includes /api)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Create the configured Axios instance
const authAxios = API.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Function to fetch user data if authenticated (cookie present)
    const loadUser = useCallback(async () => {
        let success = false;
        try {
            // Note: We avoid setting setLoading(true) here, as it's done once in the useEffect block below.
            const res = await authAxios.get('/auth/me'); // Hits protected /me endpoint
            setUser(res.data);
            setIsAuthenticated(true);
            success = true;
            console.log("[AuthContext] User loaded successfully. User:", res.data.email);
        } catch (err) {
            // If /me fails (e.g., 401 Unauthorized, token expired, no cookie)
            // This is the expected failure for an unauthenticated user, do not log loudly.
            setIsAuthenticated(false);
            setUser(null);
        }
        return success; // Return status for login/register functions
    }, []);

    // Effect to check authentication status on initial load/mount
    useEffect(() => {
        const checkAuth = async () => {
            console.log('AuthContext: Initial authentication check initiated.');
            setLoading(true); // CRITICAL: Ensure loading starts as true

            await loadUser(); // Attempt to load user from cookie

            setLoading(false); // CRITICAL: Authentication check is complete ONLY here
            console.log('AuthContext: Initial checkAuth finished. Loading set to false.');
        };

        checkAuth();
    }, [loadUser]);

    // The login function
    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            console.log('AuthContext: Attempting login for', email);
            await authAxios.post('/auth/login', { email, password }); // Backend sets cookie

            // SUCCESS PATH: Call loadUser to fetch data and update isAuthenticated
            await loadUser(); // This must succeed for the login process to be validated

            return { success: true }; // Indicate success to LoginPage
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            console.error('AuthContext: Login failed:', errorMessage, 'Status:', err.response?.status);
            setIsAuthenticated(false); // Ensure auth is false on failure
            setUser(null);
            return { success: false, message: errorMessage }; // Indicate failure
        }
    }, [loadUser]);

    // The register function (simplified)
    const register = useCallback(async (userData) => {
        setLoading(true);
        try {
            await authAxios.post('/api/auth/register', userData);
            await loadUser(); // Validate and load user after registration (cookie set)
            return { success: true };
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            console.error('AuthContext: Registration failed:', errorMessage, 'Status:', err.response?.status);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, message: errorMessage };
        }
    }, [loadUser]);

    // The logout function
    const logout = useCallback(async () => {
        setLoading(true);
        try {
            await authAxios.post('/api/auth/logout'); // Clear cookie on backend
        } catch (err) {
            console.error('AuthContext: Logout request failed:', err.response?.data?.msg || err.message);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setLoading(false);
            navigate('/login'); // Redirect to login page
        }
    }, [navigate]);

    const value = {
        isAuthenticated,
        user,
        loading,
        login,
        register,
        logout,
        api: authAxios,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};