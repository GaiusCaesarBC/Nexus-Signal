// client/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Start as true
    const [api, setApi] = useState(null); // Axios instance
    const [token, setToken] = useState(localStorage.getItem('token')); // Load token from localStorage initially

    // Function to initialize axios instance with token
    const setupApi = useCallback((authToken) => {
        if (!authToken) {
            console.log("[AuthContext] setupApi: No auth token provided, creating unauthenticated API.");
            setApi(axios.create({
                baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
            }));
            return;
        }

        console.log("[AuthContext] setupApi: Setting up authenticated API with token.");
        const instance = axios.create({
            baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        // Add an interceptor for token expiration or unauthorized responses
        instance.interceptors.response.use(
            response => response,
            async error => {
                if (error.response && error.response.status === 401) {
                    console.warn("[AuthContext] API Interceptor: 401 Unauthorized. Logging out user.");
                    // Token expired or invalid, log out
                    logout();
                }
                return Promise.reject(error);
            }
        );
        setApi(instance);
    }, []);

    // Function to check authentication status (e.g., on app load)
    const checkAuth = useCallback(async () => {
        console.log("AuthContext: checkAuth initiated. Current token:", token ? "Exists" : "None");
        setLoading(true); // Ensure loading is true while checking

        if (!token) {
            console.log("[AuthContext] checkAuth: No token found. User is not authenticated.");
            setIsAuthenticated(false);
            setUser(null);
            setupApi(null); // Setup unauthenticated API
            setLoading(false); // Finished loading
            return;
        }

        try {
            // Validate token with backend
            const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log("[AuthContext] checkAuth: /auth/me response:", response.data);

            if (response.data.success) {
                console.log(`[AuthContext] User loaded successfully. User: ${response.data.user.email}`);
                setIsAuthenticated(true);
                setUser(response.data.user);
                setupApi(token); // Setup authenticated API
            } else {
                console.log("[AuthContext] checkAuth: /auth/me reported non-success. Logging out.");
                logout(); // Log out if backend says token is invalid
            }
        } catch (error) {
            console.error("[AuthContext] checkAuth: Error validating token:", error.response?.data?.msg || error.message);
            // If token validation fails, likely expired or invalid
            logout(); // Perform logout to clear invalid token
        } finally {
            console.log(`AuthContext: checkAuth finished. Loading set to false. IsAuthenticated: ${isAuthenticated}`); // Note: isAuthenticated here might be stale
            setLoading(false);
        }
    }, [token, isAuthenticated, setupApi]); // Added isAuthenticated to dependencies for logging accuracy

    // Effect to run checkAuth on component mount
    useEffect(() => {
        console.log("AuthContext: Initial authentication check initiated.");
        checkAuth();
    }, [checkAuth]); // Dependency: checkAuth to rerun if its definition changes

    // Login function
    const login = useCallback(async (email, password) => {
        setLoading(true);
        setError(null); // Assuming you have an error state, add it if not
        try {
            const res = await api.post('/auth/login', { email, password });
            console.log("[AuthContext] Login successful:", res.data);
            localStorage.setItem('token', res.data.token);
            setToken(res.data.token); // Update token state, which should trigger checkAuth via useEffect below
            setIsAuthenticated(true);
            setUser(res.data.user);
            setupApi(res.data.token);
            return { success: true };
        } catch (err) {
            console.error("[AuthContext] Login failed:", err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Login failed'); // Set error
            return { success: false, error: err.response?.data?.msg || 'Login failed' };
        } finally {
            setLoading(false); // Only set loading to false here if checkAuth is not re-triggered
        }
    }, [api, setupApi]); // Dependencies for useCallback

    // Logout function
    const logout = useCallback(() => {
        console.log("[AuthContext] Performing logout.");
        localStorage.removeItem('token');
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setupApi(null); // Revert to unauthenticated API
        setLoading(false); // Not loading after logout
    }, [setupApi]);


    // Provide the context values
    return (
        <AuthContext.Provider value={{ isAuthenticated, user, loading, api, login, logout }}>
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