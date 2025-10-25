// client/src/context/AuthContext.js - FINAL Update for useEffect dependencies and stable 'api' instance
import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react'; // Added useCallback
import axios from 'axios';

// Create the AuthContext
export const AuthContext = createContext();

// Create the AuthProvider component
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_BASE_URL = process.env.REACT_APP_API_URL;
    console.log('[AuthContext] API_BASE_URL:', API_BASE_URL);

    // Memoize the axios instance to ensure it's stable across renders
    const api = useMemo(() => {
        const instance = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // This interceptor needs to use the current 'token' from state,
        // so it has to be defined within `useMemo`'s closure for 'token'.
        // This ensures the interceptor always has the latest token.
        instance.interceptors.request.use(
            (config) => {
                if (token) {
                    config.headers['x-auth-token'] = token;
                }
                return config;
            },
            (err) => {
                return Promise.reject(err);
            }
        );
        return instance;
    }, [API_BASE_URL, token]); // Recreate 'api' only if baseURL or token changes

    // Memoize the loadUser function using useCallback
    const loadUser = useCallback(async () => {
        if (token) {
            console.log('[AuthContext] Provider rendering. User:', user, 'Token exists:', !!token);
            try {
                const res = await api.get('/api/users/auth');
                setUser(res.data);
                console.log('[AuthContext] User loaded:', res.data.username);
            } catch (err) {
                console.error('[AuthContext] Failed to load user from token:', err.response?.data?.msg || err.message);
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
            }
        } else {
            console.log('[AuthContext] No token found.');
        }
        setLoading(false);
    }, [token, api, user]); // Dependencies for loadUser: token, the stable 'api', and 'user' for logging (or if its change should trigger re-auth)

    // Effect to call loadUser on mount or when token/api changes
    useEffect(() => {
        loadUser();
    }, [loadUser]); // Dependency is the memoized loadUser function

    // Login function
    const login = async (username, password) => {
        setError(null);
        setLoading(true);
        console.log(`[AuthContext] Attempting login for: ${username}`);
        try {
            const res = await api.post('/api/users/login', { username, password });
            setToken(res.data.token);
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            console.log('[AuthContext] Login successful. User:', res.data.user.username);
            setLoading(false);
            return { success: true, user: res.data.user };
        } catch (err) {
            console.error('[AuthContext] Login failed:', err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Login failed. Please check your credentials.');
            setLoading(false);
            return { success: false, error: err.response?.data?.msg || 'Login failed' };
        }
    };

    // Register function
    const register = async (username, email, password) => {
        setError(null);
        setLoading(true);
        console.log(`[AuthContext] Attempting registration for: ${username}`);
        try {
            const res = await api.post('/api/users/register', { username, email, password });
            setToken(res.data.token);
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            console.log('[AuthContext] Registration successful. User:', res.data.user.username);
            setLoading(false);
            return { success: true, user: res.data.user };
        } catch (err) {
            console.error('[AuthContext] Registration or auto-login failed:', err.response?.data?.msg || err.message);
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
        console.log('[AuthContext] User logged out.');
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, api, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};