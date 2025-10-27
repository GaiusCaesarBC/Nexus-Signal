// client/src/App.js - **FULL CORRECTED VERSION (assuming TermsOfServicePage and PrivacyPolicyPage)**

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Import Layout/Structure Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Copilot from './components/Copilot';

// Import Page Components
import HomePage from './pages/HomePage'; // Ensure HomePage.js exists
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PredictPage from './pages/PredictPage'; // Ensure PredictPage.js exists
import PricingPage from './pages/PricingPage'; // Ensure PricingPage.js exists
import SettingsPage from './components/SettingsPage';

// *** IMPORTANT: These imports assume your files are named 'TermsOfServicePage.js' and 'PrivacyPolicyPage.js' ***
// *** If your actual filenames are different, you MUST change these imports and the corresponding <Route> elements below ***
import TermsOfServicePage from './pages/TermsOfServicePage';     // <--- VERIFY THIS FILENAME
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';       // <--- VERIFY THIS FILENAME
// ***********************************************************************************************************************

import DisclaimerPage from './pages/DisclaimerPage'; // Ensure DisclaimerPage.js exists
import NotFoundPage from './pages/NotFoundPage';     // Ensure NotFoundPage.js exists

// Import ProtectedRoute component
import ProtectedRoute from './components/ProtectedRoute'; // Ensure ProtectedRoute.js exists

function App() {
  const { loading } = useAuth(); // Get the global loading state from AuthContext

  // Show a loading indicator while the AuthContext is checking for a token/loading user
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0d1a2f',
        color: '#e0e0e0',
        fontSize: '1.5rem'
      }}>
        Loading application...
      </div>
    );
  }

  return (
    <>
      <Navbar /> {/* Navbar will use AuthContext to conditionally render links */}

      <main style={{ flexGrow: 1 }}> {/* A main tag for semantic structure and flexbox growth */}
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* *** IMPORTANT: These routes use the imported component names from above *** */}
          <Route path="/terms" element={<TermsOfServicePage />} />     {/* <--- Uses the imported component */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />     {/* <--- Uses the imported component */}
          {/* ************************************************************************* */}

          <Route path="/disclaimer" element={<DisclaimerPage />} />

          {/* Protected Routes */}
          {/* These routes will only be accessible if isAuthenticated is true */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/predict"
            element={
              <ProtectedRoute>
                <PredictPage />
              </ProtectedRoute>
            }
          />
          {/* Add more protected routes here */}
<Route
            path="/settings" // The URL path for your settings page
            element={
              <ProtectedRoute>
                <SettingsPage /> {/* The component to render */}
              </ProtectedRoute>
            }
          />
          {/* Add more protected routes here */}
          {/* Catch-all for 404 Not Found pages */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer /> {/* Your Footer */}
      <Copilot />
    </>
  );
}

export default App;