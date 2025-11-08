// client/src/context/AuthContext.js - FINAL FIX FOR UNUSED AXIOS IMPORT

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // <-- REMOVE THIS LINE
import API from '../api/axios'; // IMPORTANT: Use your configured API instance for general calls

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null); // State for errors
    const navigate = useNavigate();
    
    // ----------------------------------------------------
    // Function to check user data if authenticated (cookie present)
    // ----------------------------------------------------
    const loadUser = useCallback(async () => {
        try {
            // Use the imported API instance which is already configured for cookies (withCredentials: true)
           const res = await API.get('/auth/me');
            setUser(res.data);
            setIsAuthenticated(true);
            return true; // Indicate success
        } catch (err) {
            // console.warn("[AuthContext] Failed to load user via /me (Expected for unauthenticated).");
            setIsAuthenticated(false);
            setUser(null);
            return false; // Indicate failure
        }
    }, []);

    // ----------------------------------------------------
    // Initial Auth Check (Runs once on mount)
    // ----------------------------------------------------
    useEffect(() => {
        const checkAuth = async () => {
            console.log('AuthContext: Initial checkAuth started.');
            setLoading(true);

            await loadUser(); // Attempt to load user from cookie

            setLoading(false); // Auth check is complete
            console.log('AuthContext: checkAuth finished. Loading set to false.');
        };

        checkAuth();
    }, [loadUser]); 

    // ----------------------------------------------------
    // Login and Register Logic
    // ----------------------------------------------------
    const login = useCallback(async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await API.post('/auth/login', { email, password });

            const userLoadedSuccessfully = await loadUser(); // CRITICAL: Validate the new cookie

            if (userLoadedSuccessfully) {
                navigate('/dashboard'); // Navigate ONLY if user successfully loaded
                return { success: true };
            } else {
                setError("Login failed: Could not establish secure session.");
                // If the POST succeeded but /me failed, clear state
                setIsAuthenticated(false);
                setUser(null);
                return { success: false, error: "Login failed: could not establish session." };
            }
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            setError(errorMessage);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [loadUser, navigate]);

    const register = useCallback(async (userData) => {
        setLoading(true);
        setError(null);
        try {
            await API.post('/auth/register', userData);
            const userLoadedSuccessfully = await loadUser(); 

            if (userLoadedSuccessfully) {
                navigate('/dashboard');
                return { success: true };
            } else {
                setError("Registration failed: Could not establish secure session.");
                setIsAuthenticated(false);
                setUser(null);
                return { success: false, error: "Registration failed: could not establish session." };
            }
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            setError(errorMessage);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: errorMessage };
        }
    }, [loadUser, navigate]);

    const logout = useCallback(async () => {
        try {
            setLoading(true);
            // Call backend to clear the cookie
            await API.post('/api/auth/logout'); 
        } catch (err) {
            console.error('AuthContext: Logout request failed:', err.response?.data?.msg || err.message);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setLoading(false);
            navigate('/login');
        }
    }, [navigate]);

    const value = {
        isAuthenticated,
        user,
        loading,
        error, // Provide error state
        login,
        register,
        logout,
        api: API, // Provide the primary API instance for other components
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