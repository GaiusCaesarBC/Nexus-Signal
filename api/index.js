// api/index.js
// This file acts as the Vercel Serverless Function entry point.
// It should import your main Express app instance.

const app = require('../server/app'); // Adjust path as needed

// Vercel automatically handles the HTTP server and listening.
// We just need to export the Express app instance.
module.exports = app;