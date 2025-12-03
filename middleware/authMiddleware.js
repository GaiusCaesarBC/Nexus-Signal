// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
    // ✅ FIXED: Check cookies, x-auth-token, AND Authorization Bearer header
    let token = req.cookies.token || req.header('x-auth-token');
    
    // Check Authorization header (Bearer token)
    const authHeader = req.header('Authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
    }

    if (!token) {
        console.log("[AuthMiddleware] No token found in cookies or headers.");
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("[AuthMiddleware] Token decoded:", decoded);

        // 3. Attach user to request
        req.user = await User.findById(decoded.user.id).select('-password');

        if (!req.user) {
            console.log("[AuthMiddleware] User not found for token ID:", decoded.user.id);
            return res.status(401).json({ msg: 'Authorization denied: User not found' });
        }

        console.log("[AuthMiddleware] User authenticated:", req.user.email);
        next();
    } catch (err) {
        console.error("[AuthMiddleware] Token verification failed:", err.message);
        res.clearCookie('token', { 
            path: '/', 
            httpOnly: true, 
            sameSite: 'Lax', 
            secure: process.env.NODE_ENV === 'production' 
        });
        res.status(401).json({ msg: 'Token is not valid' });
    }
};