import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [watchlist, setWatchlist] = useState([]);

    // Use your unique Render URL here
    const API_URL = 'https://quantum-trade-server.onrender.com';

    const loadUser = useCallback(async () => {
        if (token) {
            axios.defaults.headers.common['x-auth-token'] = token;
            try {
                // No specific user data route yet, so we fetch watchlist as validation
                const res = await axios.get(`${API_URL}/api/watchlist`);
                // Placeholder user object, can be expanded later
                setUser({ id: 'current_user' }); 
                setWatchlist(res.data);
            } catch (err) {
                console.error('Token validation failed', err);
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
                axios.defaults.headers.common['x-auth-token'] = null;
            }
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const login = async (userData) => {
        try {
            const res = await axios.post(`${API_URL}/api/users/login`, userData);
            localStorage.setItem('token', res.data.token);
            setToken(res.data.token);
            await loadUser(); // Reload user and watchlist after login
        } catch (err) {
            console.error('Login failed:', err.response ? err.response.data : err.message);
            throw err; // Re-throw error to be caught by the Login component
        }
    };

    const register = async (userData) => {
        await axios.post(`${API_URL}/api/users/register`, userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setWatchlist([]);
        delete axios.defaults.headers.common['x-auth-token'];
    };

    const addToWatchlist = async (symbol) => {
        try {
            const res = await axios.post(`${API_URL}/api/watchlist/add`, { symbol });
            setWatchlist(res.data);
        } catch (err) {
            console.error('Failed to add to watchlist', err);
        }
    };

    const removeFromWatchlist = async (symbol) => {
        try {
            const res = await axios.delete(`${API_URL}/api/watchlist/remove/${symbol}`);
            setWatchlist(res.data);
        } catch (err) {
            console.error('Failed to remove from watchlist', err);
        }
    };

    return (
        <AuthContext.Provider value={{ token, user, login, register, logout, loading, watchlist, addToWatchlist, removeFromWatchlist }}>
            {children}
        </AuthContext.Provider>
    );
};

