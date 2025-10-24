import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// --- API URL Definition ---
// Define API URL based on environment
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal.onrender.com' // <-- CORRECTED THIS LINE!
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev'; // Assuming this is still your Codespaces backend URL

// Create the AuthContext
export const AuthContext = createContext();

// Create the AuthProvider component
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Axios instance for authenticated requests
    const api = axios.create({
        baseURL: API_URL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Interceptor to attach token to requests
    api.interceptors.request.use(
        (config) => {
            if (token) {
                config.headers['x-auth-token'] = token;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Effect to check token validity and load user on mount
    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                console.log('[AuthContext] Provider rendering. User:', user, 'Token exists:', !!token); // Debug
                try {
                    const res = await api.get('/api/users/auth');
                    setUser(res.data);
                    console.log('[AuthContext] User loaded:', res.data.username); // Debug
                } catch (err) {
                    console.error('[AuthContext] Failed to load user from token:', err.response?.data?.msg || err.message); // Debug
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
            } else {
                console.log('[AuthContext] No token found.'); // Debug
            }
            setLoading(false);
        };
        loadUser();
    }, [token]); // Re-run if token changes

    // Login function
    const login = async (username, password) => {
        setError(null);
        setLoading(true);
        console.log(`[AuthContext] Attempting login for: ${username}`); // Debug
        try {
            const res = await api.post('/api/users/login', { username, password });
            setToken(res.data.token);
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            console.log('[AuthContext] Login successful. User:', res.data.user.username); // Debug
            setLoading(false);
            return { success: true, user: res.data.user };
        } catch (err) {
            console.error('[AuthContext] Login failed:', err.response?.data?.msg || err.message); // Debug
            setError(err.response?.data?.msg || 'Login failed. Please check your credentials.');
            setLoading(false);
            return { success: false, error: err.response?.data?.msg || 'Login failed' };
        }
    };

    // Register function
    const register = async (username, email, password) => {
        setError(null);
        setLoading(true);
        console.log(`[AuthContext] Attempting registration for: ${username}`); // Debug
        try {
            const res = await api.post('/api/users/register', { username, email, password });
            // For registration, we might automatically log them in or just confirm success
            setToken(res.data.token); // Assuming backend sends token on register
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            console.log('[AuthContext] Registration successful. User:', res.data.user.username); // Debug
            setLoading(false);
            return { success: true, user: res.data.user };
        } catch (err) {
            console.error('[AuthContext] Registration or auto-login failed:', err.response?.data?.msg || err.message); // Debug
            setError(err.response?.data?.msg || 'Registration failed. Please try again.');
            setLoading(false);
            return { success: false, error: err.response?.data?.msg || 'Registration failed' };
        }
    };

    // Logout function
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        console.log('[AuthContext] User logged out.'); // Debug
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, api }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};