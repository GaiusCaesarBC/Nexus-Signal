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
    
    try {
        // Find user by username
        let user = await User.findOne({ username });
        
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error('Server Error in /api/users/login:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
```

---

#### **Step 2: Push the Fix to Your Live Server**

Now that your local file is guaranteed to be correct, we will upload this fix to GitHub. This will automatically tell Render to redeploy your server with the working code.

1.  **Open your terminal** and navigate to your main `quantum-trade` root folder.
2.  **Run these three commands** one by one. Please be careful to **only copy the command itself** and not any of my explanations.

    * This command stages your corrected file.
        ```bash
        git add .
        ```

    * This command saves the change with a clear message.
        ```bash
        git commit -m "Fix syntax error in userRoutes.js"
        ```

    * This command uploads the corrected code to GitHub.
        ```bash
        git push
        

