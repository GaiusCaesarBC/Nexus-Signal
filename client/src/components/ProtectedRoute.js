// client/src/components/ProtectedRoute.js - REVISED FOR ROBUST LOADING STATE
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    console.log('ProtectedRoute: Rendered. IsAuthenticated:', isAuthenticated, 'Loading:', loading);

    // 1. If AuthContext is still loading, render nothing (or a spinner).
    // This is crucial to prevent premature redirects.
    if (loading) {
        console.log('ProtectedRoute: AuthContext is still loading authentication status. Waiting...');
        return (
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                height: 'calc(100vh - var(--navbar-height) - var(--footer-height))', // Adjust height as needed
                backgroundColor: '#0d1a2f', color: '#e0e0e0', fontSize: '1.5rem'
            }}>
                Loading application...
            </div>
        );
    }

    // 2. Once loading is false, if not authenticated, redirect to login.
    if (!isAuthenticated) {
        console.log('ProtectedRoute: Not authenticated after loading. Redirecting to /login.');
        return <Navigate to="/login" replace />;
    }

    // 3. If authenticated and not loading, render the protected children.
    console.log('ProtectedRoute: Authenticated and loading complete. Rendering children.');
    return children;
};

export default ProtectedRoute;