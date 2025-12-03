// server/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('CRITICAL ERROR: MONGODB_URI is not defined in environment variables.');
            // Exit the process if the DB URI is missing, as the app won't function
            process.exit(1);
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // These options are often recommended for Mongoose 6+ but may vary by version
            // Depending on your Mongoose version, some might be deprecated or default true.
            // Check Mongoose docs for your version.
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            // useCreateIndex: true, // Deprecated in Mongoose 6
            // useFindAndModify: false, // Deprecated in Mongoose 6
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000,       // Close sockets after 45 seconds of inactivity
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Exit process on connection failure
        process.exit(1);
    }
};

module.exports = connectDB;