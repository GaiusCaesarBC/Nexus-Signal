// server/testDb.js
require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
  const uri = process.env.MONGO_URI;

  console.log('--- Database Connection Test ---');
  if (!uri) {
    console.error('ERROR: MONGO_URI not found in .env file.');
    return;
  }

  console.log('Attempting to connect to MongoDB...');
  console.log('Using URI:', uri); // This will show us the exact string being used

  try {
    await mongoose.connect(uri);
    console.log('\nSUCCESS: MongoDB Connected successfully from test script!');
  } catch (err) {
    console.error('\nERROR: Connection failed.');
    console.error('Full Error Message:', err.message);
  }
};

testConnection();

