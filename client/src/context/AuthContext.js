import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

// Create a custom Axios instance
const API_BASE_URL = process.env.NODE_ENV === 'production'
    // This URL will be your Render backend service URL (e.g., https://your-service-name.onrender.com)
    // MAKE SURE TO REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL RENDER BACKEND URL!
    ? 'https://your-render-backend-name.onrender.com' // <--- REPLACE THIS LINE WITH YOUR RENDER BACKEND URL!
    : 'http://localhost:5000'; // Development API URL

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Create Auth Context
export const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null); // To store user profile data
    const [watchlist, setWatchlist] = useState([]); // State for user's watchlist
    const [portfolio, setPortfolio] = useState({ // State for user's portfolio
        holdings: [],
        totalValue: 0,
        totalProfitLoss: 0,
        totalProfitLossPercentage: 0
    });

    console.log('AuthContext Render: isAuthenticated=', isAuthenticated, 'loading=', loading, 'token=', token ? 'present' : 'absent');


    // Set auth token to default headers for all 'api' requests
    useEffect(() => {
        console.log('AuthContext useEffect [token]: token changed to', token ? 'present' : 'absent');
        if (token) {
            api.defaults.headers.common['x-auth-token'] = token;
            setIsAuthenticated(true); // <--- Make sure this is always called when token is present
        } else {
            delete api.defaults.headers.common['x-auth-token'];
            setIsAuthenticated(false);
        }
    }, [token]);

    // Function to load user, watchlist, and portfolio
    const loadUserAndData = useCallback(async () => {
        console.log('loadUserAndData: Initiated. Current token:', token ? 'present' : 'absent', 'Current isAuthenticated:', isAuthenticated);
        if (!token) {
            console.log('loadUserAndData: No token found. Setting unauthenticated state.');
            setIsAuthenticated(false);
            setLoading(false);
            setUser(null);
            setWatchlist([]);
            setPortfolio({ holdings: [], totalValue: 0, totalProfitLoss: 0, totalProfitLossPercentage: 0 });
            return;
        }

        try {
            console.log('loadUserAndData: Attempting to fetch user data...');
            const userRes = await api.get('/api/auth/me'); // Endpoint to get user data
            setUser(userRes.data);
            setIsAuthenticated(true); // This will re-set it, which is fine and ensures consistency
            console.log('loadUserAndData: User data fetched successfully.');

            console.log('loadUserAndData: Attempting to fetch watchlist...');
            const watchlistRes = await api.get('/api/watchlist');
            setWatchlist(watchlistRes.data);
            console.log('loadUserAndData: Watchlist fetched successfully.');

            console.log('loadUserAndData: Attempting to fetch portfolio...');
            const portfolioRes = await api.get('/api/portfolio');
            setPortfolio(portfolioRes.data);
            console.log('loadUserAndData: Portfolio fetched successfully.');

        } catch (err) {
            console.error('loadUserAndData: Error loading user data (profile, watchlist, portfolio):', err.response?.data?.msg || err.message, err);
            // Crucial: Clear token from localStorage and state if API calls fail
            setToken(null);
            localStorage.removeItem('token');
            delete api.defaults.headers.common['x-auth-token'];
            setIsAuthenticated(false);
            setUser(null);
            setWatchlist([]);
            setPortfolio({ holdings: [], totalValue: 0, totalProfitLoss: 0, totalProfitLossPercentage: 0 }); // Clear portfolio
        } finally {
            setLoading(false);
            // Log isAuthenticated from state directly after all updates
            console.log('loadUserAndData: Finished. Final loading:', false, 'isAuthenticated (from state):', isAuthenticated);
        }
    }, [token]); // Removed isAuthenticated from useCallback dependencies because it causes infinite loop if used.
                 // The 'token' change is sufficient to trigger it.

    // Load user and all data on initial mount and when token changes (via loadUserAndData callback)
    useEffect(() => {
        console.log('AuthContext useEffect [loadUserAndData]: Triggering loadUserAndData');
        loadUserAndData();
    }, [loadUserAndData]); // loadUserAndData is a useCallback, so its identity changes only if its dependencies change (i.e., token)

    // Register User
    const register = async (formData) => {
        console.log('AuthContext register function: Attempting registration...');
        try {
            const res = await api.post('/api/auth/register', formData);
            console.log('AuthContext register function: Registration API successful. Token received:', res.data.token ? 'present' : 'absent');
            setToken(res.data.token);
            localStorage.setItem('token', res.data.token);
            await loadUserAndData(); // Reload all data after successful registration
            console.log('AuthContext register function: loadUserAndData completed after register. IsAuthenticated:', isAuthenticated); // Might log outdated state
            return { success: true };
        } catch (err) {
            console.error('AuthContext Register error:', err.response?.data || err.message);
            // Ensure token is cleared if registration fails
            setToken(null);
            localStorage.removeItem('token');
            delete api.defaults.headers.common['x-auth-token'];
            setIsAuthenticated(false);
            return { success: false, errors: err.response?.data?.errors || [{ msg: 'Registration failed' }] };
        }
    };

    // Login User
    const login = async (formData) => {
        console.log('AuthContext login function: Attempting login...');
        try {
            const res = await api.post('/api/auth/login', formData);
            console.log('AuthContext login function: Login API successful. Token received:', res.data.token ? 'present' : 'absent');
            setToken(res.data.token); // This will trigger the useEffect [token]
            localStorage.setItem('token', res.data.token);
            // Await loadUserAndData to ensure user data and auth state are fully loaded before returning
            await loadUserAndData();
            console.log('AuthContext login function: loadUserAndData completed after login. IsAuthenticated (at end of login func):', isAuthenticated); // This might log outdated state
            return { success: true };
        } catch (err) {
            console.error('AuthContext Login error:', err.response?.data || err.message);
            // Ensure token is cleared if login itself fails
            setToken(null);
            localStorage.removeItem('token');
            delete api.defaults.headers.common['x-auth-token'];
            setIsAuthenticated(false);
            return { success: false, errors: err.response?.data?.errors || [{ msg: 'Login failed' }] };
        }
    };

    // Logout User
    const logout = () => {
        console.log('AuthContext logout function: Initiated.');
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setWatchlist([]);
        setPortfolio({ holdings: [], totalValue: 0, totalProfitLoss: 0, totalProfitLossPercentage: 0 }); // Clear portfolio
        localStorage.removeItem('token');
        delete api.defaults.headers.common['x-auth-token'];
        console.log('AuthContext logout function: State cleared, token removed.');
        // Optionally redirect to login page - this is usually handled by a router in the component
    };

    // Watchlist functions
    const addToWatchlist = async (symbol) => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot add to watchlist.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.post('/api/watchlist/add', { symbol });
            setWatchlist(res.data);
            return { success: true };
        } catch (err) {
            console.error('Error adding to watchlist:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to add to watchlist' };
        }
    };

    const removeFromWatchlist = async (symbol) => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot remove from watchlist.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.delete(`/api/watchlist/remove/${symbol}`);
            setWatchlist(res.data);
            return { success: true };
        } catch (err) {
            console.error('Error removing from watchlist:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to remove from watchlist' };
        }
    };

    // Portfolio functions
    const fetchPortfolio = useCallback(async () => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot fetch portfolio.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.get('/api/portfolio');
            setPortfolio(res.data);
            return { success: true, data: res.data };
        } catch (err) {
            console.error('Error fetching portfolio:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to fetch portfolio' };
        }
    }, [isAuthenticated]);

    const addHolding = async (holdingData) => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot add holding.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.post('/api/portfolio/add', holdingData);
            await fetchPortfolio(); // Re-fetch portfolio to get updated calculations
            return { success: true, data: res.data };
        } catch (err) {
            console.error('Error adding holding:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to add holding', errors: err.response?.data?.errors };
        }
    };

    const updateHolding = async (holdingId, updatedData) => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot update holding.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.put(`/api/portfolio/update/${holdingId}`, updatedData);
            await fetchPortfolio(); // Re-fetch portfolio to get updated calculations
            return { success: true, data: res.data };
        } catch (err) {
            console.error('Error updating holding:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to update holding', errors: err.response?.data?.errors };
        }
    };

    const deleteHolding = async (holdingId) => {
        if (!isAuthenticated) {
            console.warn('User not authenticated. Cannot delete holding.');
            return { success: false, msg: 'User not authenticated.' };
        }
        try {
            const res = await api.delete(`/api/portfolio/remove/${holdingId}`);
            await fetchPortfolio(); // Re-fetch portfolio to get updated calculations
            return { success: true, msg: res.data.msg };
        } catch (err) {
            console.error('Error deleting holding:', err.response?.data?.msg || err.message);
            return { success: false, msg: err.response?.data?.msg || 'Failed to delete holding' };
        }
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                isAuthenticated,
                loading,
                user, // Provide user profile data
                watchlist, // Provide watchlist data
                portfolio, // Provide portfolio data
                api, // Provide the axios instance for other components
                register,
                login,
                logout,
                addToWatchlist,
                removeFromWatchlist,
                fetchPortfolio, // Provide portfolio functions
                addHolding,
                updateHolding,
                deleteHolding
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use AuthContext
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};