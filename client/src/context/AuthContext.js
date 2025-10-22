// client/src/context/AuthContext.js

import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// client/src/context/AuthContext.js

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://nexus-signal-server.onrender.com'
   
    : 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev'; 

export const AuthContext = createContext();

// ... (rest of the AuthProvider component remains the same)

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [watchlist, setWatchlist] = useState([]);

    const addCacheBust = (url) => `${url}?_t=${new Date().getTime()}`;

    useEffect(() => {
        const validateToken = async () => {
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    if (decoded.exp * 1000 < Date.now()) {
                        logout();
                    } else {
                        setUser({ id: decoded.user.id });
                        axios.defaults.headers.common['x-auth-token'] = token;
                        const res = await axios.get(addCacheBust(`${API_URL}/api/watchlist`));
                        setWatchlist(res.data);
                    }
                } catch (err) {
                    console.error("Token validation failed", err);
                    logout();
                }
            }
            setLoading(false);
        };
        validateToken();
    }, [token]);

    const login = async (username, password) => {
        const res = await axios.post(addCacheBust(`${API_URL}/api/users/login`), { username, password });
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        axios.defaults.headers.common['x-auth-token'] = res.data.token;
        const decoded = jwtDecode(res.data.token);
        setUser({ id: decoded.user.id });
        const watchlistRes = await axios.get(addCacheBust(`${API_URL}/api/watchlist`));
        setWatchlist(watchlistRes.data);
    };

    const register = async (username, password) => {
        await axios.post(addCacheBust(`${API_URL}/api/users/register`), { username, password });
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
            const res = await axios.post(addCacheBust(`${API_URL}/api/watchlist/add`), { symbol });
            setWatchlist(res.data);
        } catch (err) {
            console.error('Failed to add to watchlist', err);
        }
    };

    const removeFromWatchlist = async (symbol) => {
        try {
            const res = await axios.delete(addCacheBust(`${API_URL}/api/watchlist/remove/${symbol}`));
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

