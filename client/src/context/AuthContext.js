// client/src/context/AuthContext.js - REFINED
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
    const [loading, setLoading] = useState(true); // Default to true while checking auth
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
        console.log('AuthContext: User logged out. LocalStorage token removed.');
    }, []);

    // Effect for Axios interceptors (to attach token to requests and handle 401s)
    useEffect(() => {
        const requestInterceptor = authAxios.interceptors.request.use(
            (config) => {
                const currentToken = localStorage.getItem('token');
                if (currentToken && !config.headers['x-auth-token']) { // Only set if not already present
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
                    const storedToken = localStorage.getItem('token');
                    if (storedToken) {
                        console.error('AuthContext: 401 Unauthorized response received with a token, logging out...');
                        logout();
                    } else {
                        console.warn('AuthContext: 401 Unauthorized response received, but no token was stored. User was likely already unauthenticated or token was invalid.');
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            authAxios.interceptors.request.eject(requestInterceptor);
            authAxios.interceptors.response.eject(responseInterceptor);
            console.log('AuthContext: Axios interceptors ejected.');
        };
    }, [logout]);

    // The login function
    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            console.log('AuthContext: Attempting login for', email);
            const res = await authAxios.post('/auth/login', { email, password }); // Path relative to baseURL
            const newToken = res.data.token;
            localStorage.setItem('token', newToken);
            setToken(newToken);
            authAxios.defaults.headers.common['x-auth-token'] = newToken; // Set immediately for current session
            setIsAuthenticated(true);

            console.log('AuthContext: Login successful, fetching user profile.');
            const userRes = await authAxios.get('/auth/me'); // Path relative to baseURL
            setUser(userRes.data);
            console.log('AuthContext: User data fetched:', userRes.data);
            return true;
        } catch (err) {
            console.error('AuthContext: Login failed:', err.response?.data?.msg || err.message, err.response?.status);
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            // Ensure header is cleared on login failure as well
            if (authAxios.defaults.headers.common['x-auth-token']) {
                delete authAxios.defaults.headers.common['x-auth-token'];
            }
            return false;
        } finally {
            setLoading(false);
            console.log('AuthContext: Login process finished.');
        }
    }, []);

    // Effect to check authentication status on initial load/mount
    useEffect(() => {
        const checkAuth = async () => {
            console.log('AuthContext: Initial checkAuth started.');
            const storedToken = localStorage.getItem('token');
            console.log('AuthContext: Stored token:', storedToken ? 'found' : 'not found');

            if (storedToken) {
                setToken(storedToken);
                // Set token for the default authAxios instance header immediately
                authAxios.defaults.headers.common['x-auth-token'] = storedToken;

                try {
                    console.log('AuthContext: Attempting /auth/me to validate token.');
                    const res = await authAxios.get('/auth/me'); // Path relative to baseURL
                    setUser(res.data);
                    setIsAuthenticated(true);
                    console.log('AuthContext: Token validated, user is authenticated.', res.data);
                } catch (err) {
                    console.error('AuthContext: Token validation failed on startup:', err.response?.data?.msg || err.message, err.response?.status);
                    logout(); // Token invalid or expired, log out
                }
            } else {
                setIsAuthenticated(false);
                console.log('AuthContext: No stored token, user not authenticated.');
            }
            setLoading(false); // Authentication check is complete
            console.log('AuthContext: checkAuth finished. isAuthenticated:', isAuthenticated, 'loading:', false);
        };
        
        checkAuth();

        // Cleanup function for useEffect (optional, but good practice if you had
        // listeners that needed cleanup when component unmounts)
        return () => {
            console.log('AuthContext: AuthProvider unmounting.');
            // No specific cleanup needed for this checkAuth effect as it's a one-time run on mount.
        };
    }, [logout, isAuthenticated]); // Added isAuthenticated to dependency array to reflect state changes immediately in console.log

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