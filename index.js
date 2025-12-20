require('dotenv').config(); // Load environment variables

const app = require('./app'); // Import the Express app from app.js
const { startPredictionChecker } = require('./services/predictionChecker'); // ✅ ADDED
const { startWebSocketService } = require('./services/websocketPriceService'); // Real-time price streaming

const MAX_RETRIES = 5;
let attempts = 0;

function startServer() {
    console.log(`[DEBUG] Attempt ${attempts + 1} to start server.`);
    console.log(`[DEBUG] process.env.PORT from Render env vars: ${process.env.PORT}`);
    const PORT = process.env.PORT || 5000;
    console.log(`[DEBUG] Final PORT decided by application: ${PORT}`);

    // Create the server instance explicitly to attach error handler
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Open your browser to http://localhost:${PORT}`);
        
        // ✅ START PREDICTION CHECKER AFTER SERVER STARTS
        startPredictionChecker();

        // ✅ START REAL-TIME PRICE STREAMING (Alpaca stocks, Binance crypto)
        startWebSocketService();
    });

    // Attach an error handler to the server instance
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`[ERROR] Port ${PORT} is already in use.`);
            attempts++;
            if (attempts < MAX_RETRIES) {
                console.log(`[RETRY] Retrying in 2 seconds... (Attempt ${attempts + 1}/${MAX_RETRIES})`);
                // Close the current server instance before retrying
                server.close(() => {
                    setTimeout(startServer, 2000); // Retry after 2 seconds
                });
            } else {
                console.error(`[FATAL] Max retries (${MAX_RETRIES}) reached. Could not start server.`);
                process.exit(1); // Exit with error
            }
        } else {
            console.error(`[FATAL] Server error: ${error.message}`);
            process.exit(1); // Exit with generic error
        }
    });
}

startServer(); // Initiate the server start process
