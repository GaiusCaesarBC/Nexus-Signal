import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import styled from 'styled-components';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register'; // Import Register page
import Login from './pages/Login';       // Import Login page

const AppContainer = styled.div`
  background-color: #1c1e22;
  color: #e0e0e0;
  min-height: 100vh;
`;

function App() {
  return (
    <Router>
      <AppContainer>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </AppContainer>
    </Router>
  );
}

export default App;


