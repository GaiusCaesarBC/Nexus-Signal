import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// The change is on this line: we now EXPORT the context directly.
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (token) {
      axios.defaults.headers.common['x-auth-token'] = token;
      try {
        const res = await axios.get('/api/watchlist');
        setWatchlist(res.data);
        setUser({ token });
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
    fetchUser();
  }, [fetchUser]);

  const login = async (username, password) => {
    try {
      const res = await axios.post('/api/users/login', { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      axios.defaults.headers.common['x-auth-token'] = res.data.token;
      setUser({ token: res.data.token });
      const watchlistRes = await axios.get('/api/watchlist');
      setWatchlist(watchlistRes.data);
      return true;
    } catch (err) {
      console.error('Login failed:', err.response ? err.response.data : err.message);
      return false;
    }
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
      const res = await axios.post('/api/watchlist/add', { symbol });
      setWatchlist(res.data);
    } catch (err) {
      console.error('Failed to add to watchlist', err);
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      const res = await axios.post('/api/watchlist/remove', { symbol });
      setWatchlist(res.data);
    } catch (err) {
      console.error('Failed to remove from watchlist', err);
    }
  };


  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, watchlist, addToWatchlist, removeFromWatchlist }}>
      {children}
    </AuthContext.Provider>
  );
};

// We no longer need a default export.
// export default AuthContext;

