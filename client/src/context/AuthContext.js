import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// Use the specific Codespace forwarded URL for port 5000
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal-server.onrender.com'
    // Ensure this is your correct Codespace forwarded URL for the BACKEND (port 5000)
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev'; // Make sure this is correct

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [watchlist, setWatchlist] = useState([]);

    // Function to add cache-busting query parameter
    const addCacheBust = (url) => `${url}?_t=${new Date().getTime()}`;

    useEffect(() => {
        const validateToken = async () => {
            if (token) {
                try {
                    console.log("[AuthContext] Validating token...");
                    const decoded = jwtDecode(token);
                    if (decoded.exp * 1000 < Date.now()) {
                        console.log("[AuthContext] Token expired, logging out.");
                        logout();
                    } else {
                        console.log("[AuthContext] Token valid, setting user and fetching watchlist.");
                        setUser({ id: decoded.user.id }); // Set user based on decoded token
                        axios.defaults.headers.common['x-auth-token'] = token;
                        // Fetch watchlist only after confirming token is valid
                        try {
                            const res = await axios.get(addCacheBust(`${API_URL}/api/watchlist`));
                            setWatchlist(res.data);
                            console.log("[AuthContext] Watchlist fetched:", res.data);
                        } catch (watchListError) {
                            console.error("[AuthContext] Error fetching watchlist:", watchListError);
                            // Handle watchlist fetch error (e.g., if token becomes invalid between checks)
                            if (watchListError.response && watchListError.response.status === 401) {
                                logout(); // Log out if watchlist fetch fails due to auth
                            }
                        }
                    }
                } catch (err) {
                    console.error("[AuthContext] Invalid token:", err);
                    logout(); // If decoding fails, token is invalid
                }
            } else {
                 console.log("[AuthContext] No token found.");
            }
            setLoading(false);
        };
        validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]); // Rerun validation if token changes


    const login = async (username, password) => {
        console.log("[AuthContext] Attempting login for:", username);
        const res = await axios.post(addCacheBust(`${API_URL}/api/users/login`), { username, password });
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token); // This triggers the useEffect to validate and set user/watchlist
        console.log("[AuthContext] Login successful, token set.");
        // No need to set user/watchlist here, useEffect handles it
    };

    // --- MODIFIED REGISTER FUNCTION ---
    const register = async (username, password) => {
        console.log("[AuthContext] Attempting registration for:", username);
        // Step 1: Call the backend register endpoint
        await axios.post(addCacheBust(`${API_URL}/api/users/register`), { username, password });
        console.log("[AuthContext] Registration API call successful.");

        // Step 2: Automatically log the user in after successful registration
        console.log("[AuthContext] Automatically logging in after registration...");
        await login(username, password); // Reuse the login logic
        console.log("[AuthContext] Automatic login after registration complete.");
    };
    // --- END MODIFICATION ---

    const logout = () => {
        console.log("[AuthContext] Logging out.");
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setWatchlist([]);
        delete axios.defaults.headers.common['x-auth-token'];
    };

    const addToWatchlist = async (symbol) => {
        if (!token) return; // Ensure user is logged in
        try {
            console.log("[AuthContext] Adding to watchlist:", symbol);
            const res = await axios.post(addCacheBust(`${API_URL}/api/watchlist/add`), { symbol });
            setWatchlist(res.data);
            console.log("[AuthContext] Watchlist updated:", res.data);
        } catch (err) {
            console.error('[AuthContext] Failed to add to watchlist', err.response?.data?.msg || err.message);
        }
    };

    const removeFromWatchlist = async (symbol) => {
         if (!token) return; // Ensure user is logged in
        try {
            console.log("[AuthContext] Removing from watchlist:", symbol);
            const res = await axios.delete(addCacheBust(`${API_URL}/api/watchlist/remove/${symbol}`));
            setWatchlist(res.data);
            console.log("[AuthContext] Watchlist updated:", res.data);
        } catch (err) {
            console.error('[AuthContext] Failed to remove from watchlist', err.response?.data?.msg || err.message);
        }
    };

    // Add logging to see when context provider re-renders
    console.log("[AuthContext] Provider rendering. User:", user, "Token exists:", !!token);

    return (
        <AuthContext.Provider value={{ token, user, login, register, logout, loading, watchlist, addToWatchlist, removeFromWatchlist }}>
            {!loading && children} {/* Render children only when initial loading is done */}
        </AuthContext.Provider>
    );
};
