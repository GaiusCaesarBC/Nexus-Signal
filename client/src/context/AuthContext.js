import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Create a context for authentication
const AuthContext = createContext(null);

// Get the base API URL from environment variables
// This should resolve to 'https://nexus-signal.onrender.com/api' on Vercel
// and 'http://localhost:5000' during local development.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create a pre-configured Axios instance for authenticated requests
// This instance will automatically attach the x-auth-token header
const authAxios = axios.create({
    baseURL: API_URL, // Base URL for all authAxios requests
    headers: {
        'Content-Type': 'application/json',
        // 'x-auth-token' will be added/updated by the interceptor
    },
});

// AuthProvider component
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null); // Stores user profile data
    const [loading, setLoading] = useState(true); // Initial loading state for auth check
    const [token, setToken] = useState(null); // Stores the raw JWT token

    // Callback to perform logout actions
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        // Remove token from the default headers of authAxios
        delete authAxios.defaults.headers.common['x-auth-token'];
        console.log('User logged out.');
    }, []);

    // Effect to set up Axios request interceptor for attaching the token
    // and a response interceptor for handling 401 (Unauthorized) errors globally.
    useEffect(() => {
        // Request Interceptor: Attach token from state or local storage
        const requestInterceptor = authAxios.interceptors.request.use(
            (config) => {
                const currentToken = localStorage.getItem('token'); // Always get freshest token
                if (currentToken) {
                    config.headers['x-auth-token'] = currentToken;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response Interceptor: Handle 401 Unauthorized errors
        const responseInterceptor = authAxios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401 && isAuthenticated) {
                    // Only auto-logout if we thought the user *was* authenticated.
                    // This prevents double-logging if they're already logged out
                    // and hit a public route that returns a 401 (less common).
                    console.error('401 Unauthorized response received, logging out...');
                    logout();
                }
                return Promise.reject(error);
            }
        );

        // Cleanup interceptors on component unmount
        return () => {
            authAxios.interceptors.request.eject(requestInterceptor);
            authAxios.interceptors.response.eject(responseInterceptor);
        };
    }, [isAuthenticated, logout]); // Depend on isAuthenticated and logout callback

    // Callback for user login
    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            // FIX HERE (1 of 2): Removed the extra '/api' from login endpoint
            const res = await axios.post(`${API_URL}/auth/login`, { email, password }); 
            const newToken = res.data.token;
            localStorage.setItem('token', newToken);
            setToken(newToken); // Update token state
            setIsAuthenticated(true);

            // FIX HERE (2 of 2): Removed the extra '/api' from /auth/me endpoint
            // Since authAxios has baseURL set to API_URL (which includes /api),
            // we just need to provide the path *relative* to that base.
            const userRes = await authAxios.get(`/auth/me`); 
            setUser(userRes.data);
            return true; // Indicate success
        } catch (err) {
            console.error('Login failed:', err.response?.data?.msg || err.message);
            // Ensure state is reset on login failure
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            localStorage.removeItem('token'); // Clear any bad token
            return false; // Indicate failure
        } finally {
            setLoading(false);
        }
    }, []); // No need for API_URL dependency here because authAxios has it

    // Effect to check authentication status on initial app load
    useEffect(() => {
        const checkAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                setToken(storedToken); // Set token state from local storage

                try {
                    // FIX HERE (3 of 3): Removed the extra '/api' from /auth/me endpoint
                    // Again, authAxios has baseURL set to API_URL (which includes /api).
                    const res = await authAxios.get(`/auth/me`); 
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (err) {
                    // Token validation failed (e.g., expired, invalid)
                    console.error('Automatic token validation failed:', err.response?.data?.msg || err.message);
                    logout(); // Log out the user
                }
            }
            setLoading(false); // Authentication check is complete
        };

        checkAuth();
    }, [logout]); // Depend on logout to ensure it's always the latest version

    // Value provided by the context
    const value = {
        isAuthenticated,
        user,
        loading,
        token, // Provide the raw token if needed by components for non-Axios uses
        login,
        logout,
        api: authAxios, // Provide the pre-configured Axios instance
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the authentication context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};