// client/src/context/AuthContext.js - CORRECTED FOR BASEURL CONSISTENCY
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Define the base API URL without the /api suffix for now
// This should resolve to 'https://nexus-signal.onrender.com' on Vercel
// and 'http://localhost:5000' during local development.
const BASE_API_ROOT_URL = process.env.REACT_APP_API_URL_ROOT || 'http://localhost:5000';

// Create a pre-configured Axios instance for authenticated requests
// It will automatically attach the x-auth-token header.
// IMPORTANT: We add '/api' here once to the baseURL.
const authAxios = axios.create({
    baseURL: `${BASE_API_ROOT_URL}/api`, // This will be e.g. http://localhost:5000/api
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
        delete authAxios.defaults.headers.common['x-auth-token'];
        console.log('User logged out.');
    }, []);

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
                if (error.response && error.response.status === 401 && isAuthenticated) {
                    console.error('401 Unauthorized response received, logging out...');
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            authAxios.interceptors.request.eject(requestInterceptor);
            authAxios.interceptors.response.eject(responseInterceptor);
        };
    }, [isAuthenticated, logout]);

    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            // Use standard axios for login as it doesn't need the token yet
            // Use the full URL including /api here
            const res = await axios.post(`${BASE_API_ROOT_URL}/api/auth/login`, { email, password });
            const newToken = res.data.token;
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setIsAuthenticated(true);

            // Use authAxios for fetching user profile, it handles the token and base URL
            const userRes = await authAxios.get('/auth/me'); // path relative to baseURL (which is /api)
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

    useEffect(() => {
        const checkAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                setToken(storedToken);

                try {
                    // Use authAxios here, path relative to baseURL
                    const res = await authAxios.get('/auth/me');
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (err) {
                    console.error('Automatic token validation failed:', err.response?.data?.msg || err.message);
                    logout();
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [logout]);

    const value = {
        isAuthenticated,
        user,
        loading,
        token,
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};