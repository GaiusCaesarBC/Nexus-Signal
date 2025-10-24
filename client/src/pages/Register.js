import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../context/AuthContext';
import { UserPlus } from 'lucide-react'; // Assuming lucide-react is installed

const RegisterContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4rem 2rem;
`;

const RegisterForm = styled.form`
    background-color: #2c3e50;
    padding: 2.5rem;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const Title = styled.h2`
    color: #ecf0f1;
    text-align: center;
    margin-bottom: 1rem;
`;

const Input = styled.input`
    background: #34495e;
    border: 1px solid #4a627a;
    border-radius: 5px;
    padding: 0.8rem 1rem;
    color: #ecf0f1;
    font-size: 1rem;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s;

    &:focus {
        outline: none;
        border-color: #3498db;
    }
`;

const Button = styled.button`
    background-color: #3498db;
    border: none;
    border-radius: 5px;
    color: white;
    padding: 0.8rem 1.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #2980b9;
    }
`;

const ErrorMessage = styled.p`
    color: #e74c3c;
    text-align: center;
    margin: 0;
`;

const Register = () => {
    // --- UPDATED STATE TO INCLUDE 'email' ---
    const [formData, setFormData] = useState({ username: '', email: '', password: '', password2: '' });
    const [error, setError] = useState('');
    const { register, user } = useContext(AuthContext); // Added 'user' to check if already logged in
    const navigate = useNavigate();

    // Destructure email along with other fields
    const { username, email, password, password2 } = formData;

    // Redirect if user is already logged in
    // This is optional, but often good UX
    // useEffect(() => {
    //     if (user) {
    //         navigate('/dashboard'); // Or wherever logged-in users go
    //     }
    // }, [user, navigate]);

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();

        console.log('--- New Registration Submission ---');
        console.log('DEBUG: Submitting with data:', { username, email, password }); // Log all submitted data

        if (password !== password2) {
            console.error('DEBUG: Passwords do not match.');
            setError('Passwords do not match');
            return;
        }

        if (!register) {
            console.error('DEBUG: FATAL - The register function from AuthContext is not available!');
            setError('A critical error occurred. The register function is missing.');
            return;
        }

        try {
            console.log('DEBUG: Attempting to call register function from context...');
            // --- UPDATED CALL TO REGISTER FUNCTION TO INCLUDE 'email' ---
            const result = await register(username, email, password); // Pass email here

            if (result.success) {
                console.log('DEBUG: Register function from context completed successfully.');
                // Optionally navigate to dashboard if auto-login successful, otherwise to login
                console.log('DEBUG: Navigation to login page after successful registration...');
                navigate('/login');
                console.log('DEBUG: Navigation complete.');
            } else {
                console.error('DEBUG: Registration failed with backend error:', result.error);
                setError(result.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            console.error('DEBUG: An error was caught in handleSubmit on the live site.');
            console.error('DEBUG: Full error object:', err);

            const errorMessage = err.response?.data?.msg || err.message || 'An unexpected error occurred.';
            setError(errorMessage);
            console.error('DEBUG: Error message set to:', errorMessage);
        }
    };

    return (
        <RegisterContainer>
            <RegisterForm onSubmit={handleSubmit}>
                <Title>Create Account</Title>
                <Input
                    type="text"
                    placeholder="Username"
                    name="username"
                    value={username}
                    onChange={onChange}
                    required
                />
                {/* --- NEW EMAIL INPUT FIELD --- */}
                <Input
                    type="email" // Use type="email" for better mobile keyboard and basic browser validation
                    placeholder="Email Address"
                    name="email"
                    value={email}
                    onChange={onChange}
                    required
                />
                <Input
                    type="password"
                    placeholder="Password (min. 6 characters)"
                    name="password"
                    value={password}
                    onChange={onChange}
                    required
                    minLength="6"
                />
                <Input
                    type="password"
                    placeholder="Confirm Password"
                    name="password2"
                    value={password2}
                    onChange={onChange}
                    required
                    minLength="6"
                />
                <Button type="submit">
                    <UserPlus size={20} />
                    Register
                </Button>
                {error && <ErrorMessage>{error}</ErrorMessage>}
            </RegisterForm>
        </RegisterContainer>
    );
};

export default Register;