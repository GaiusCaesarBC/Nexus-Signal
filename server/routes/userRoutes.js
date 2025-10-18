const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/users/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        user = new User({ username, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error('Server Error in /api/users/register:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // --- START OF DEBUG LOGGING ---
    console.log('\n--- New Live Login Attempt ---');
    console.log(`Attempting login for username: "${username}"`);

    try {
        // Find user by username
        let user = await User.findOne({ username });
        
        if (!user) {
            console.error('DEBUG: User not found in database.');
            return res.status(400).json({ msg: 'Invalid credentials' });
        }
        console.log('DEBUG: User found in database.');

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`DEBUG: Password match result: ${isMatch}`); // This will be true or false

        if (!isMatch) {
            console.error('DEBUG: Password comparison failed.');
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        console.log('DEBUG: Login successful. Creating token...');
        // --- END OF DEBUG LOGGING ---

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            console.log('DEBUG: Token sent to client.');
            res.json({ token });
        });
    } catch (err) {
        console.error('Server Error in /api/users/login:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
```

#### **Step 2: Deploy the Debugging Version to Your Live Server**

Now, we need to push this new, debug-enhanced version to your live server on Render.

1.  **Open your terminal** and navigate to your main `quantum-trade` root folder.
2.  **Run these three commands** one by one:
    ```bash
    git add .
    ```
    ```bash
    git commit -m "Add debug logs to live login route"
    ```
    ```bash
    git push
    

