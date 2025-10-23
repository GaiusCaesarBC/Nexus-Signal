require('dotenv').config({ path: require('path').resolve(__dirname, './.env') }); // Explicit path load first
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors'); // Keep require

console.log(`[DEBUG index.js Start] CWD: ${process.cwd()}, Dirname: ${__dirname}`);
console.log(`[DEBUG index.js Start] STRIPE_SECRET_KEY loaded?: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No'}`);

const app = express();

// --- VERY EARLY CORS HEADER MIDDLEWARE ---
// Apply this BEFORE anything else to try and catch the OPTIONS preflight
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // --- THE FIX IS HERE: ADDING YOUR VERCEL URL ---
  const allowedOrigins = [
    'https://nexus-signal.vercel.app', // <<<=== THIS IS THE FIX
    'http://localhost:3000',           // Your local development frontend (standard)
    'https://refactored-robot-r456x9xvgqw7cpgjv-3000.app.github.dev', // Your Codespace FRONTEND URL (Port 3000)
    'https://refactored-robot-r456x9xvgqw7cpgjv-8081.app.github.dev' // Your Codespace FRONTEND URL (if backend is on 8081)
  ];
  // ------------------------------------------

  console.log(`>>> Request Received: ${req.method} ${req.originalUrl} Origin: ${origin}`); // Log every request

  if (origin && allowedOrigins.includes(origin)) {
    console.log(`>>> Setting CORS header for origin: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    console.log(">>> Request has no origin header.");
  } else {
    console.warn(`>>> Origin ${origin} not in allowedOrigins.`);
  }

  // Set other necessary CORS headers for preflight OPTIONS requests
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-auth-token,Authorization'); // Ensure x-auth-token is allowed
  res.setHeader('Access-Control-Allow-Credentials', true);

  // If this is an OPTIONS request, end the response here after setting headers
  if (req.method === 'OPTIONS') {
    console.log(`>>> Responding to OPTIONS preflight for ${req.originalUrl}`);
    return res.sendStatus(204); // OK, No Content
  }

  next(); // Pass control to the next middleware
});
// --- END EARLY CORS HEADER MIDDLEWARE ---


// Connect Database
connectDB();

// Init Middleware (Body Parser)
app.use(express.json({ extended: false }));


// --- Import and Define API Routes ---
console.log('[DEBUG index.js] Requiring route files...');
const predictionRoutes = require('./routes/predictionRoutes');
const userRoutes = require('./routes/userRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes'); // <-- Ensure this is here

app.use('/api/predict', predictionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.key in your `.env` file, but the Node.js process isn't picking it up when that specific file (`paymentRoutes.js`) is loaded.

Let's try the most common fixes for this:

**1. Verify `.env` File Location and Name:**
* Make absolutely sure the file containing your Stripe key is located at `/workspaces/Nexus-Signal/server/.env`.
* Ensure the filename is exactly `.env` (starts with a dot, all lowercase).

**2. Verify `.env` Content:**
* Open `server/.env`.
* Confirm the line looks like this (with your actual key): `STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE`
* There should be **no quotes** around the key.
* There should be **no extra spaces** before `STRIPE_SECRET_KEY` or around the `=`.
* Make sure you **saved** the file after adding the key.

**3. Restart the Codespace Environment:** Sometimes, changes to `.env` files require a more complete reload of the environment than just restarting the Node.js process.
* **Action:**
    1.  Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
    2.  Type `Reload Window` and select the command **"Developer: Reload Window"**.
    3.  Wait for the Codespace to fully reload.
    4.  Go back to your `server` terminal and try `npm start` again. See if the `STRIPE_SECRET_KEY value:` log now shows your key instead of `undefined`.

**4. Try Moving `dotenv.config()` (Temporary Diagnostic):**
* If reloading the window doesn't work, let's try explicitly loading the `.env` file inside `paymentRoutes.js` itself just to see if it helps. This isn't the standard way, but it helps diagnose module loading timing issues.
* **Action:**
    1.  Edit `server/routes/paymentRoutes.js`.
    2.  Add `require('dotenv').config();` at the very top of this file, *before* everything else.
        ```javascript
        require('dotenv').config(); // <-- ADD THIS LINE AT THE TOP
        const express = require('express');
        const router = express.Router();
        // ... rest of the file ...
        

