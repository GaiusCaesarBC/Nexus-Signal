// client/src/context/AuthContext.js - FINAL AND CONSOLIDATED FIXES

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // This is no longer needed as we use the 'API' instance directly
import API from '../api/axios'; // IMPORTANT: Use your configured API instance for general calls

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Start as true
    const [error, setError] = useState(null); // State for errors within AuthContext
    const navigate = useNavigate();

    // ----------------------------------------------------
    // Logout Function (defined first due to dependencies)
    // ----------------------------------------------------
    const logout = useCallback(async () => {
        try {
            setLoading(true);
            setError(null); // Clear any errors on logout
            // Call backend to clear the cookie
            await API.post('/auth/logout'); // Removed redundant /api/
            console.log("AuthContext: Backend logout successful.");
        } catch (err) {
            console.error('AuthContext: Logout request to backend failed:', err.response?.data?.msg || err.message);
            // Even if backend fails, clear frontend session
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            localStorage.removeItem('token'); // Ensure any stored token is removed
            setLoading(false);
            navigate('/login'); // Redirect to login page
            console.log("AuthContext: Frontend session cleared, redirected to login.");
        }
    }, [navigate]);

    // ----------------------------------------------------
    // Function to check user data if authenticated (cookie present)
    // ----------------------------------------------------
    const loadUser = useCallback(async () => {
        try {
            // Use the imported API instance which is already configured for cookies (withCredentials: true)
            const res = await API.get('/auth/me'); // Removed redundant /api/
            setUser(res.data);
            setIsAuthenticated(true);
            setError(null); // Clear errors if user successfully loaded
            console.log("AuthContext: User loaded successfully from /auth/me:", res.data.email);
            return true; // Indicate success
        } catch (err) {
            // console.warn("[AuthContext] Failed to load user via /me (Expected for unauthenticated or expired).");
            setIsAuthenticated(false);
            setUser(null);
            // Do NOT clear token here, backend handles invalid/expired cookie.
            // setToken(null); // No, let the initial check decide based on presence
            // setError is handled by specific login/register/checkAuth logic
            return false; // Indicate failure
        }
    }, []);

    // ----------------------------------------------------
    // Initial Auth Check (Runs once on mount or when key state changes)
    // ----------------------------------------------------
    useEffect(() => {
        const checkInitialAuth = async () => {
            console.log('AuthContext: Initial checkAuth started.');
            setLoading(true);
            setError(null); // Clear any previous errors on initial load

            // Attempt to load user from cookie. loadUser handles setting isAuthenticated and user.
            const userIsLoggedIn = await loadUser();

            // If userIsLoggedIn is false, and there's a token in local storage (but /me failed)
            // it means the token is likely invalid/expired. Initiate a clean logout.
            if (!userIsLoggedIn && localStorage.getItem('token')) {
                console.warn("AuthContext: Found token in localStorage but /auth/me failed. Initiating logout.");
                // Use the logout function which clears everything
                logout(); // Call logout to clean up token and state
            }

            setLoading(false); // Auth check is complete
            console.log(`AuthContext: checkAuth finished. Loading set to false. IsAuthenticated: ${userIsLoggedIn}`);
        };

        checkInitialAuth();
    }, [loadUser, logout]); // Dependencies for useEffect

    // ----------------------------------------------------
    // Login Logic
    // ----------------------------------------------------
    const login = useCallback(async (email, password) => {
        setLoading(true);
        setError(null); // Clear errors before attempting login
        try {
            await API.post('/auth/login', { email, password }); // Backend sets cookie
            console.log("AuthContext: Login POST successful, attempting to load user via /auth/me.");

            const userLoadedSuccessfully = await loadUser(); // CRITICAL: Validate the new cookie

            if (userLoadedSuccessfully) {
                navigate('/dashboard'); // Navigate ONLY if user successfully loaded
                return { success: true };
            } else {
                // If the POST succeeded but /me failed, it's a critical error.
                setError("Login failed: Could not establish secure session after successful login request.");
                setIsAuthenticated(false);
                setUser(null);
                // No navigate here, let user see error on login page
                return { success: false, error: "Login failed: could not establish session." };
            }
        } catch (err) {
            const errorMessage = err.response?.data?.msg || err.message;
            console.error("AuthContext: Login process failed:", errorMessage);
            setError(errorMessage);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false); // Ensure loading is off after login attempt
        }
    }, [loadUser, navigate]);

    // ----------------------------------------------------
    // Register Logic
    // ----------------------------------------------------
    const register = useCallback(async (userData) => {
        setLoading(true);
        setError(null); // Clear errors before attempting registration
        try {
            await API.post('/auth/register', userData); // Removed redundant /api/
            console.log("AuthContext: Registration POST successful, attempting to load user via /auth/me.");

            const userLoadedSuccessfully = await loadUser();

            if (userLoadedSuccessfully) {
                navigate('/dashboard');
                return { success: true };
            } else {
                setError("Registration failed: Could not establish secure session after successful registration request.");
                setIsAuthenticated(false);
                setUser(null);
                return { success: false, error: "Registration failed: could not establish session." };
            }
        } catch (err) {
            const errorMessage = err.response?.data?.msg || err.message;
            console.error("AuthContext: Registration process failed:", errorMessage);
            setError(errorMessage);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false); // Ensure loading is off after registration attempt
        }
    }, [loadUser, navigate]);


    // ----------------------------------------------------
    // Context Value Provider
    // ----------------------------------------------------
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