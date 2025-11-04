// client/src/components/ProtectedRoute.js - REFINED
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    console.log('ProtectedRoute: Rendered. isAuthenticated:', isAuthenticated, 'loading:', loading);

    // While authentication status is being determined, show nothing or a loading spinner
    if (loading) {
        console.log('ProtectedRoute: AuthContext is loading, showing nothing (or spinner).');
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#e0e0e0' }}>
                Loading content...
            </div>
        );
    }

    // If not authenticated and not loading anymore, redirect to login
    if (!isAuthenticated) {
        console.log('ProtectedRoute: Not authenticated and finished loading, redirecting to /login.');
        return <Navigate to="/login" replace />;
    }

    // If authenticated and not loading, render the protected children
    console.log('ProtectedRoute: Authenticated and finished loading, rendering children.');
    return children;
};

export default ProtectedRoute;