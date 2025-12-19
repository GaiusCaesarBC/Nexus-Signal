// server/utils/logger.js - Structured logging for production debugging

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for console output
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'production' ? 'info' : 'debug';
};

// Custom format for structured logging
const structuredFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Pretty format for development console
const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            // Filter out stack for cleaner output, show separately if error
            const { stack, ...restMeta } = meta;
            if (Object.keys(restMeta).length > 0) {
                metaStr = ` ${JSON.stringify(restMeta)}`;
            }
            if (stack) {
                metaStr += `\n${stack}`;
            }
        }
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

// Define transports
const transports = [];

// Console transport - always enabled
transports.push(
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? structuredFormat : devFormat,
    })
);

// File transports - only in production or if LOG_TO_FILE is set
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
    const logsDir = process.env.LOGS_DIR || path.join(__dirname, '..', 'logs');

    // All logs (rotated daily)
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: structuredFormat,
        })
    );

    // Error logs only (rotated daily)
    transports.push(
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error',
            format: structuredFormat,
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    transports,
    // Don't exit on handled exceptions
    exitOnError: false,
});

// Helper method to create child logger with context
logger.child = (context) => {
    return {
        error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
        info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
        http: (message, meta = {}) => logger.http(message, { ...context, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
    };
};

// Stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

module.exports = logger;
