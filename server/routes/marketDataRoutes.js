// server/routes/marketDataRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Assuming this

const path = require('path'); // <--- Make sure this is at the top
const fs = require('fs');   // <--- And this is at the top

// --- Debugging lines start ---
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
// --- Debugging lines end ---


// THIS IS THE LINE THAT FAILS (now, hopefully with more info)
const {
    getSingleQuote,
    getMultipleQuotes
} = require('../controllers/marketDataController');

// ... rest of your route definitions ...

// Example routes (replace with your actual routes)
router.get('/single/:symbol', auth, getSingleQuote);
router.get('/quotes', auth, getMultipleQuotes);

module.exports = router;