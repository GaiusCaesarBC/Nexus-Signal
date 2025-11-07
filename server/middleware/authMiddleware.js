// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming you have a User model

module.exports = async (req, res, next) => {
    // 1. Check if cookie exists
    const token = req.cookies.token; // <<< Look here first! Is req.cookies.token actually getting the token?

    if (!token) {
        console.log("[AuthMiddleware] No token found in cookies.");
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("[AuthMiddleware] Token decoded:", decoded); // Log decoded payload

        // 3. Attach user to request
        // Ensure your User model findById doesn't throw if user not found, just returns null
        req.user = await User.findById(decoded.user.id).select('-password');

        if (!req.user) {
            console.log("[AuthMiddleware] User not found for token ID:", decoded.user.id);
            return res.status(401).json({ msg: 'Authorization denied: User not found' });
        }

        console.log("[AuthMiddleware] User authenticated:", req.user.email);
        next(); // Proceed to the next middleware/route handler
    } catch (err) {
        // 4. Handle token verification failure
        console.error("[AuthMiddleware] Token verification failed:", err.message);
        // Clear the invalid cookie if it exists to prevent future loops
        res.clearCookie('token', { path: '/', httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' });
        res.status(401).json({ msg: 'Token is not valid' });
    }
};