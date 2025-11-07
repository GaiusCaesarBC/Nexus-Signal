// client/src/context/AuthContext.js - REVISED FOR HTTPONLY COOKIES
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios'; // Import your new API instance from axios.js

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // True by default while we check auth status
    const navigate = useNavigate();

    // Function to fetch user data if authenticated (cookie present)
    const loadUser = useCallback(async () => {
        try {
            setLoading(true);
            // This GET request will automatically send the HttpOnly cookie set by the backend
            const res = await API.get('/auth/me');
            setUser(res.data);
            setIsAuthenticated(true);
            console.log("[AuthContext] User loaded successfully via /api/auth/me. User:", res.data.email);
        } catch (err) {
            // If /me fails (e.g., 401 Unauthorized, token expired, no cookie),
            // then the user is not authenticated.
            console.error("[AuthContext] Failed to load user via /api/auth/me. User is not authenticated or session expired.", err.response?.data?.msg || err.message);
            setIsAuthenticated(false);
            setUser(null);
            // No need to clear localStorage token as we're not using it.
            // Backend's logout route will clear the cookie when explicitly called.
        } finally {
            setLoading(false); // Authentication check is complete
        }
    }, []); // No dependencies as it uses stable API instance

    // Effect to check authentication status on initial load/mount
    useEffect(() => {
        console.log('AuthContext: Initial authentication check initiated.');
        loadUser(); // Attempt to load user from cookie
    }, [loadUser]); // Dependency on loadUser (stable via useCallback)

    // The login function
    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            console.log('AuthContext: Attempting login for', email);
            // When this POST request succeeds, the backend will set the HttpOnly cookie.
            // The response data will NOT contain the token directly.
           const res = await API.post('/auth/login', { email, password });
            console.log("[AuthContext] Login successful. Backend responded:", res.data.msg);

            // After successful login (and cookie set by backend),
            // immediately call loadUser to fetch the user's data from /me
            await loadUser();

            navigate('/dashboard'); // Navigate to dashboard after successful login and user load
            return { success: true, message: res.data.msg || 'Login successful' };
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            console.error("[AuthContext] Login failed:", errorMessage, 'Status:', err.response?.status);
            // On login failure, ensure auth status is false
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, message: errorMessage };
        }
    }, [loadUser, navigate]);

    // The register function (similar to login)
    const register = useCallback(async (userData) => {
        setLoading(true);
        try {
            console.log('AuthContext: Attempting registration for', userData.email);
            const res = await API.post('/api/auth/register', userData);
            console.log("[AuthContext] Registration successful. Backend responded:", res.data.msg);

            await loadUser(); // Load user after successful registration (cookie set by backend)

            navigate('/dashboard');
            return { success: true, message: res.data.msg || 'Registration successful' };
        } catch (err) {
            setLoading(false);
            const errorMessage = err.response?.data?.msg || err.message;
            console.error("[AuthContext] Registration failed:", errorMessage, 'Status:', err.response?.status);
            setIsAuthenticated(false);
            setUser(null);
            return { success: false, message: errorMessage };
        }
    }, [loadUser, navigate]);

    // The logout function
    const logout = useCallback(async () => {
        setLoading(true);
        try {
            // This POST request tells the backend to clear the HttpOnly cookie
            await API.post('/api/auth/logout');
            console.log("[AuthContext] Logout initiated. Backend instructed to clear cookie.");
            setIsAuthenticated(false);
            setUser(null);
            navigate('/login'); // Redirect to login page
        } catch (err) {
            console.error("[AuthContext] Logout failed:", err.response?.data?.msg || err.message);
            // Even if logout request fails, assume frontend is logged out
            setIsAuthenticated(false);
            setUser(null);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const value = {
        isAuthenticated,
        user,
        loading,
        login,
        register,
        logout,
        api: API
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