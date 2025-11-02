// server/routes/marketDataRoutes.js - DEBUGGING REQUIRE ERROR
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Assuming this path is correct

const path = require('path');
const fs = require('fs');

// --- Debugging lines (Keep for now) ---
const currentDir = __dirname;
const controllerFileName = 'marketDataController.js';
const pathToControllerDir = path.join(currentDir, '../controllers');
const fullPathToController = path.join(pathToControllerDir, controllerFileName);

console.log('--- Debugging marketDataController import ---');
console.log('Current directory (marketDataRoutes.js):', currentDir);
console.log('Expected controller directory:', pathToControllerDir);
console.log('Expected full path to controller file:', fullPathToController);

if (!fs.existsSync(pathToControllerDir)) {
    console.error('ERROR: Controller directory DOES NOT EXIST at:', pathToControllerDir);
} else {
    console.log('Controller directory EXISTS at:', pathToControllerDir);
    try {
        const dirContents = fs.readdirSync(pathToControllerDir);
        console.log('Contents of controller directory:', dirContents);

        if (!fs.existsSync(fullPathToController)) {
            console.error('ERROR: Controller file DOES NOT EXIST at:', fullPathToController);
            console.error('       This is the core problem. The file is missing or misspelled.');
        } else {
            console.log('Controller file EXISTS at:', fullPathToController);
            console.log('Attempting to require the module...');
        }
    } catch (readDirErr) {
        console.error('ERROR: Could not read controller directory:', readDirErr.message);
    }
}
console.log('-------------------------------------------');
// --- End Debugging lines ---


// THIS IS THE CRITICAL BLOCK - ADDING TRY/CATCH AROUND REQUIRE
let getSingleQuote, getMultipleQuotes;
try {
    const marketDataController = require(fullPathToController); // Use fullPathToController here for require
    getSingleQuote = marketDataController.getSingleQuote;
    getMultipleQuotes = marketDataController.getMultipleQuotes;
    console.log('SUCCESS: marketDataController.js loaded successfully!');
    console.log('getSingleQuote is:', typeof getSingleQuote);
    console.log('getMultipleQuotes is:', typeof getMultipleQuotes);
} catch (requireError) {
    console.error('FATAL ERROR: Failed to load marketDataController.js!');
    console.error('Details:', requireError);
    // You might want to crash the server or define dummy functions here
    getSingleQuote = (req, res) => res.status(500).json({ msg: 'Market data controller not loaded' });
    getMultipleQuotes = (req, res) => res.status(500).json({ msg: 'Market data controller not loaded' });
}


// Define your API routes (unchanged from last correct version)
router.get('/quote/:symbol', auth, getSingleQuote);
router.get('/single/:symbol', auth, getSingleQuote);
router.get('/quotes', auth, getMultipleQuotes);

module.exports = router;