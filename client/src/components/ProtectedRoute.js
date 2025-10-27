// client/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Adjust path if AuthContext is elsewhere

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth(); // Get isAuthenticated and loading state from AuthContext

  // If the AuthContext is still loading (e.g., checking token in localStorage on app load)
  if (loading) {
    // You might want to render a spinner or a loading message here
    // This ensures a smooth user experience while authentication status is being determined.
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - var(--navbar-height))', /* Adjust for your navbar height */
        backgroundColor: '#1a273b', /* Background color from your theme */
        color: '#e0e0e0', /* Text color from your theme */
        fontSize: '1.2rem'
      }}>
        Verifying access...
      </div>
    );
  }

  // If user is authenticated, render the children (the component for the protected page)
  if (isAuthenticated) {
    return children;
  }

  // If not authenticated and not in a loading state, redirect to the login page.
  // The 'replace' prop ensures that if the user clicks the back button, they don't
  // land back on the protected route they were just redirected from.
  return <Navigate to="/login" replace />;
};

export default ProtectedRoute;