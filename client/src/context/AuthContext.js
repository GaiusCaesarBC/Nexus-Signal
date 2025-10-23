import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// --- API URL Configuration ---
// This defines where your frontend (this file) looks for your backend server.
const API_URL = process.env.NODE_ENV === 'production'
    // For your LIVE site (Vercel), it uses the Render URL
    ? 'https://nexus-signal-server.onrender.com'
    // For your DEVELOPMENT (Codespaces), it uses the 8081 port we set up
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev';
// ------------------------------

export const AuthContext = createContext();

// Helper function to add a timestamp to requests to prevent caching issues
const addCacheBust = (url) => `${url}?_t=${new Date().getTime()}`;

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem('token')); // Load token from storage on init
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [watchlist, setWatchlist] = useState([]);

    // --- Logout Function ---
    // We define logout here so it can be called from anywhere (like validateToken)
    const logout = useCallback(() => {
        console.log('[AuthContext] Logging out.');
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setWatchlist([]);
        delete axios.defaults.headers.common['x-auth-token'];
        setLoading(false);
    }, []);

    // --- Token Validation & Watchlist Fetching ---
    // This effect runs whenever the 'token' state changes
    useEffect(() => {
        const validateTokenAndFetchData = async () => {
            if (token) {
                try {
                    console.log('[AuthContext] Token found. Validating...');
                    const decoded = jwtDecode(token);
                    
                    // Check if token is expired
                    if (decoded.exp * 1000 < Date.now()) {
                        console.log('[AuthContext] Token is expired.');
                        logout();
                    } else {
                        // Token is valid
                        console.log('[AuthContext] Token is valid. Setting user and fetching watchlist.');
                        setUser({ id: decoded.user.id });
                        axios.defaults.headers.common['x-auth-token'] = token;
                        
                        // Fetch user's watchlist
                        const res = await axios.get(addCacheBust(`${API_URL}/api/watchlist`));
                        setWatchlist(res.data || []); // Ensure watchlist is an array
                        console.log('[AuthContext] Watchlist fetched:', res.data);
                    }
                } catch (err) {
                    console.error('[AuthContext] Token validation or data fetching failed', err.message);
                    logout(); // If any error (bad token, network error), log out
                }
            } else {
                console.log('[AuthContext] No token found.');
                // No token, so user is logged out
                setUser(null);
                setWatchlist([]);
                delete axios.defaults.headers.common['x-auth-token'];
            }
            // Finished initial load
            setLoading(false);
        };
        
        validateTokenAndFetchData();
    }, [token, logout]); // Re-run this check if the token changes

    // --- Login Function ---
    const login = async (username, password) => {
        try {
            console.log(`[AuthContext] Attempting login for: ${username}`);
            const res = await axios.post(addCacheBust(`${API_URL}/api/users/login`), { username, password });
            
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
                setToken(res.data.token); // This will trigger the useEffect above to fetch data
                console.log('[AuthContext] Login successful.');
            } else {
                throw new Error("No token received from login");
            }
        } catch (err) {
            console.error('[AuthContext] Login failed:', err.response ? err.response.data.msg : err.message);
            throw err; // Re-throw error so the Login page can catch it
        }
    };

    // --- Register Function ---
    const register = async (username, password) => {
        try {
            console.log(`[AuthContext] Attempting registration for: ${username}`);
            // 1. Create the account
            await axios.post(addCacheBust(`${API_URL}/api/users/register`), { username, password });
            
            console.log('[AuthContext] Registration successful. Now logging in...');
            // 2. Automatically log in the new user
            await login(username, password);
            
            console.log('[AuthContext] Auto-login after register successful.');
            
        } catch (err) {
            console.error('[AuthContext] Registration or auto-login failed:', err.response ? err.response.data.msg : err.message);
            throw err; // Re-throw error so the Register page can catch it
        }
    };

    // --- Watchlist Functions ---
    const addToWatchlist = async (symbol) => {
        if (!user) return; // Shouldn't be possible if button is hidden, but good safety check
        try {
            console.log(`[AuthContext] Adding ${symbol} to watchlist...`);
            const res = await axios.post(addCacheBust(`${API_URL}/api/watchlist/add`), { symbol });
            setWatchlist(res.data);
            console.log('[AuthContext] Watchlist updated:', res.data);
        } catch (err) {
            console.error('Failed to add to watchlist', err);
        }
    };

    const removeFromWatchlist = async (symbol) => {
        if (!user) return;
        try {
            console.log(`[AuthContext] Removing ${symbol} from watchlist...`);
            const res = await axios.delete(addCacheBust(`${API_URL}/api/watchlist/remove/${symbol}`));
            setWatchlist(res.data);
            console.log('[AuthContext] Watchlist updated:', res.data);
        } catch (err) {
            console.error('Failed to remove from watchlist', err);
        }
    };

    // --- Provide values to all children components ---
    console.log(`[AuthContext] Provider rendering. User: ${user ? user.id : 'null'} Token exists: ${!!token}`);
    return (
        <AuthContext.Provider value={{ token, user, login, register, logout, loading, watchlist, addToWatchlist, removeFromWatchlist }}>
            {!loading && children} {/* Don't render app until token check is complete */}
        </AuthContext.Provider>
    );
};

