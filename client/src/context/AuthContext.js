// client/src/context/AuthContext.js - CORRECTED
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Use a single environment variable that points directly to the API base URL
// e.g., 'https://nexus-signal.onrender.com/api'
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Create a pre-configured Axios instance for authenticated requests
// It will automatically attach the x-auth-token header.
const authAxios = axios.create({
    baseURL: API_BASE_URL, // Use the full API base URL here
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        // Ensure to remove the header if it was set globally on authAxios instance
        if (authAxios.defaults.headers.common['x-auth-token']) {
            delete authAxios.defaults.headers.common['x-auth-token'];
        }
        console.log('User logged out.');
    }, []);

    // Effect for Axios interceptors (to attach token to requests and handle 401s)
    useEffect(() => {
        const requestInterceptor = authAxios.interceptors.request.use(
            (config) => {
                const currentToken = localStorage.getItem('token');
                if (currentToken) {
                    config.headers['x-auth-token'] = currentToken;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        const responseInterceptor = authAxios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    // Check if token was present, to avoid logging out if user was already unauthenticated
                    const storedToken = localStorage.getItem('token');
                    if (storedToken) {
                        console.error('401 Unauthorized response received with a token, logging out...');
                        logout();
                    } else {
                        console.warn('401 Unauthorized response received, but no token was stored. User was likely already unauthenticated.');
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            authAxios.interceptors.request.eject(requestInterceptor);
            authAxios.interceptors.response.eject(responseInterceptor);
        };
    }, [logout]); // logout is a dependency because it's used inside the interceptor

    // The login function
    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            // Use the authAxios instance directly for login, its baseURL is already set
            const res = await authAxios.post('/auth/login', { email, password }); // Path relative to baseURL
            const newToken = res.data.token;
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setIsAuthenticated(true);

            // Fetch user profile (now authAxios will automatically include the new token)
            const userRes = await authAxios.get('/auth/me'); // Path relative to baseURL
            setUser(userRes.data);
            return true;
        } catch (err) {
            console.error('Login failed:', err.response?.data?.msg || err.message);
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect to check authentication status on initial load
    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true); // Ensure loading is true while checking auth
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                setToken(storedToken);
                // Set token for the default authAxios instance header immediately
                // This ensures subsequent requests within this initial render or before interceptor runs have the token
                authAxios.defaults.headers.common['x-auth-token'] = storedToken;

                try {
                    const res = await authAxios.get('/auth/me'); // Path relative to baseURL
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (err) {
                    console.error('Automatic token validation failed:', err.response?.data?.msg || err.message);
                    // This will also trigger the response interceptor which calls logout()
                    // So explicit logout() here is often redundant, but good for clarity.
                    logout();
                }
            } else {
                setIsAuthenticated(false);
            }
            setLoading(false);
        };
        checkAuth();
    }, [logout]); // logout is a dependency

    const value = {
        isAuthenticated,
        user,
        loading,
        token,
        login,
        logout,
        api: authAxios, // Provide the pre-configured Axios instance for other components
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