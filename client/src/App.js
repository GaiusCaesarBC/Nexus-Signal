import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Login from './pages/Login';
import About from './pages/About';
import Pricing from './pages/Pricing';
import Performance from './pages/Performance';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Disclaimer from './pages/Disclaimer';
import LandingPage from './pages/LandingPage'; // Import the landing page

// --- Vercel Analytics Import ---
import { Analytics } from '@vercel/analytics/react';
// --- End Vercel Analytics Import ---

const AppContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

// --- FIX: Use $hasNavbar (transient prop) ---
const MainContent = styled.main`
  flex-grow: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  /* Adjust padding based on whether Navbar is present */
  padding: ${props => props.$hasNavbar ? '2rem 1rem' : '0 1rem'};

  /* On landing page, we remove top padding and allow full width */
  ${props => !props.$hasNavbar && `
    padding: 0;
    max-width: 100%;
  `}
`;

// Helper component to use react-router hooks
const AppContent = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/landing'; // Also ensure "/" (root) if you want it to behave like landing there
  // If you also want the root path "/" to be without navbar/footer, you can change this to:
  // const isLandingPage = location.pathname === '/landing' || location.pathname === '/';


  return (
    <AppContainer>
      {/* Conditionally render Navbar */}
      {!isLandingPage && <Navbar />}

      {/* --- FIX: Pass prop as $hasNavbar --- */}
      <MainContent $hasNavbar={!isLandingPage}>
        <Routes>
          {/* Note: If "/" is also your landing page, consider moving Dashboard to a protected route
             or changing the default route. For now, it will show Dashboard at root. */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/landing" element={<LandingPage />} /> {/* Use the real component */}
        </Routes>
      </MainContent>

      {/* Conditionally render Footer */}
      {!isLandingPage && <Footer />}

      {/* --- Vercel Analytics Component --- */}
      <Analytics />
      {/* --- End Vercel Analytics Component --- */}
    </AppContainer>
  );
};

// Main App component to include Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;