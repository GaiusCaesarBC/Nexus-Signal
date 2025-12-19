// server/middleware/requestLogger.js - HTTP request logging with request IDs

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Generate short request ID (first 8 chars of UUID)
const generateRequestId = () => uuidv4().split('-')[0];

// Request logging middleware
const requestLogger = (req, res, next) => {
    // Generate unique request ID
    const requestId = req.headers['x-request-id'] || generateRequestId();
    req.requestId = requestId;

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    // Record start time
    const startTime = Date.now();

    // Create child logger with request context
    req.log = logger.child({
        requestId,
        method: req.method,
        path: req.path,
        userAgent: req.get('user-agent'),
        ip: req.ip || req.connection.remoteAddress,
    });

    // Log request start (debug level)
    req.log.debug(`${req.method} ${req.originalUrl} started`);

    // Capture response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length'),
        };

        // Add user ID if authenticated
        if (req.user && req.user._id) {
            logData.userId = req.user._id.toString();
        }

        // Log level based on status code
        const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

        if (res.statusCode >= 500) {
            req.log.error(message, logData);
        } else if (res.statusCode >= 400) {
            req.log.warn(message, logData);
        } else {
            req.log.http(message, logData);
        }
    });

    next();
};

// Error logging middleware (use after routes)
const errorLogger = (err, req, res, next) => {
    const logContext = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: err.statusCode || 500,
    };

    // Add user ID if authenticated
    if (req.user && req.user._id) {
        logContext.userId = req.user._id.toString();
    }

    // Log the error with stack trace
    logger.error(err.message, {
        ...logContext,
        stack: err.stack,
        name: err.name,
    });

    next(err);
};

module.exports = { requestLogger, errorLogger };
