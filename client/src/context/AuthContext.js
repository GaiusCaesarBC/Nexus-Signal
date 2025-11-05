// client/src/context/AuthContext.js - REVISED FOR ROBUST STATE MANAGEMENT
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const authAxios = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Default to true while checking auth status
    const [token, setToken] = useState(null);

    const clearAuthData = useCallback(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        if (authAxios.defaults.headers.common['x-auth-token']) {
            delete authAxios.defaults.headers.common['x-auth-token'];
        }
        console.log('AuthContext: All authentication data cleared.');
    }, []);

    const logout = useCallback(() => {
        clearAuthData();
        console.log('AuthContext: User logged out.');
    }, [clearAuthData]);

    // Axios Interceptors setup for token attachment and 401 handling
    useEffect(() => {
        const requestInterceptor = authAxios.interceptors.request.use(
            (config) => {
                const currentToken = localStorage.getItem('token');
                if (currentToken && !config.headers['x-auth-token']) {
                    config.headers['x-auth-token'] = currentToken;
                    console.log('AuthContext: Request interceptor adding x-auth-token.');
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        const responseInterceptor = authAxios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    console.error('AuthContext: 401 Unauthorized response received. Clearing auth data.');
                    clearAuthData(); // Force logout on 401
                }
                return Promise.reject(error);
            }
        );

        return () => {
            authAxios.interceptors.request.eject(requestInterceptor);
            authAxios.interceptors.response.eject(responseInterceptor);
            console.log('AuthContext: Axios interceptors ejected.');
        };
    }, [clearAuthData]); // Depend on clearAuthData to ensure it's up-to-date

    // The login function
    const login = useCallback(async (email, password) => {
        setLoading(true); // Indicate loading for the login process
        try {
            console.log('AuthContext: Attempting login for', email);
            const res = await authAxios.post('/auth/login', { email, password });
            const newToken = res.data.token;

            localStorage.setItem('token', newToken); // Store token
            setToken(newToken); // Update state
            authAxios.defaults.headers.common['x-auth-token'] = newToken; // Set for current session immediately

            // Fetch user profile
            const userRes = await authAxios.get('/auth/me');
            setUser(userRes.data); // Update user state
            setIsAuthenticated(true); // Set authenticated state

            console.log('AuthContext: Login successful. User:', userRes.data);
            return true; // Indicate success
        } catch (err) {
            console.error('AuthContext: Login failed:', err.response?.data?.msg || err.message, 'Status:', err.response?.status);
            clearAuthData(); // Clear all auth data on failure
            return false; // Indicate failure
        } finally {
            setLoading(false); // Login process finished
            console.log('AuthContext: Login process finished. IsAuthenticated:', isAuthenticated); // Note: isAuthenticated might not be updated yet here
        }
    }, [clearAuthData, isAuthenticated]); // Add isAuthenticated to deps for console log accuracy

    // Effect to check authentication status on initial load/mount
    useEffect(() => {
        const checkAuth = async () => {
            console.log('AuthContext: Initial checkAuth started.');
            setLoading(true); // Ensure loading is true while this check runs

            const storedToken = localStorage.getItem('token');
            console.log('AuthContext: Stored token:', storedToken ? 'found' : 'not found');

            if (storedToken) {
                setToken(storedToken);
                authAxios.defaults.headers.common['x-auth-token'] = storedToken; // Set for initial validation

                try {
                    console.log('AuthContext: Attempting /auth/me to validate stored token.');
                    const res = await authAxios.get('/auth/me');
                    setUser(res.data);
                    setIsAuthenticated(true); // User is authenticated
                    console.log('AuthContext: Token validated, user is authenticated.', res.data);
                } catch (err) {
                    console.error('AuthContext: Token validation failed on startup:', err.response?.data?.msg || err.message, 'Status:', err.response?.status);
                    clearAuthData(); // Invalid token, clear all data
                }
            } else {
                setIsAuthenticated(false); // No token, not authenticated
                console.log('AuthContext: No stored token, user not authenticated.');
            }
            setLoading(false); // Auth check is complete
            console.log('AuthContext: checkAuth finished. Final isAuthenticated:', isAuthenticated); // Note: isAuthenticated might not be updated yet here
        };

        checkAuth();

        // No specific cleanup needed for this checkAuth effect as it's a one-time run on mount.
    }, [clearAuthData, isAuthenticated]); // Depend on clearAuthData and isAuthenticated

    const value = {
        isAuthenticated,
        user,
        loading,
        token,
        login,
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