// client/src/api/axios.js
import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api', // <-- THIS PART
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default API;