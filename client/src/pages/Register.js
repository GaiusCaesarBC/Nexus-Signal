import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const AuthContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #e0e0e0;
`;

const AuthForm = styled.form`
  display: flex;
  flex-direction: column;
  background-color: #2c2f36;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h1`
  margin-bottom: 1.5rem;
  text-align: center;
  color: #58a6ff;
`;

const Input = styled.input`
  background-color: #1c1e22;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #58a6ff;
  }
`;

const Button = styled.button`
  background-color: #58a6ff;
  color: #ffffff;
  border: none;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #4895e9;
  }
`;

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const navigate = useNavigate();

  const { username, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/users/register', formData);
      console.log('User registered:', res.data);
      // You can store the token and redirect
      navigate('/login'); // Redirect to login after successful registration
    } catch (err) {
      console.error('Registration error:', err.response.data);
      // Here you would show an error message to the user
    }
  };

  return (
    <AuthContainer>
      <AuthForm onSubmit={onSubmit}>
        <Title>Create Account</Title>
        <Input
          type="text"
          placeholder="Username"
          name="username"
          value={username}
          onChange={onChange}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          name="password"
          value={password}
          onChange={onChange}
          minLength="6"
          required
        />
        <Button type="submit">Register</Button>
      </AuthForm>
    </AuthContainer>
  );
};

export default Register;
