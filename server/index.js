require('dotenv').config(); // Load environment variables

const app = require('./app'); // Import the Express app from app.js

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});