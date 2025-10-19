import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import styled from 'styled-components';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Login from './pages/Login';

// This container is now transparent, allowing the body's gradient to show through.
const AppContainer = styled.div`
    width: 100%;
    min-height: 100vh;
`;

// This container ensures our main content is centered and has a max width,
// which is good practice for large screens.
const MainContent = styled.main`
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1rem;
`;

function App() {
    return (
        <Router>
            <AppContainer>
                <Navbar />
                <MainContent>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/login" element={<Login />} />
                    </Routes>
                </MainContent>
            </AppContainer>
        </Router>
    );
}

export default App;

