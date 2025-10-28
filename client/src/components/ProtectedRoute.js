// client/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    // STICKY NOTE: "Hey, bouncer here! Am I logged in? (`isAuthenticated`) Is the check still going on? (`loading`)"
    console.log('ProtectedRoute Render: isAuthenticated=', isAuthenticated, 'loading=', loading);

    if (loading) {
        // STICKY NOTE: "Still figuring out if they're logged in. Hold on."
        console.log('ProtectedRoute: Still loading auth state. Displaying message.');
        return (
            <div>Verifying access...</div> // Or your styled loading message
        );
    }

    if (isAuthenticated) {
        // STICKY NOTE: "Yup, they're logged in! Let them into the dashboard."
        console.log('ProtectedRoute: Authenticated. Rendering children.');
        return children; // This shows the Dashboard
    }

    // STICKY NOTE: "Nope, not logged in. Send them back to the login page."
    console.log('ProtectedRoute: Not authenticated. Redirecting to login.');
    return <Navigate to="/login" replace />; // This sends you back to /login
};

export default ProtectedRoute;