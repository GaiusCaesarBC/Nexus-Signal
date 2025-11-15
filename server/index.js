require('dotenv').config(); // Load environment variables

const app = require('./app'); // Import the Express app from app.js

console.log(`[DEBUG] process.env.PORT from Render env vars: ${process.env.PORT}`);
const PORT = process.env.PORT || 5000;
console.log(`[DEBUG] Final PORT decided by application: ${PORT}`);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});