// server/utils/symbolValidation.js - Symbol validation to prevent SSRF/Injection attacks

/**
 * Validates and sanitizes stock/crypto symbols to prevent:
 * - SSRF (Server-Side Request Forgery)
 * - Parameter injection attacks
 * - Path traversal attacks
 *
 * Valid symbols can contain:
 * - Alphanumeric characters (A-Z, 0-9)
 * - Dashes (for crypto pairs like BTC-USD)
 * - Dots (for certain exchanges like BRK.A)
 * - Colons (for DEX tokens like TOKEN:network)
 * - Underscores (for some futures/options)
 */

// Characters that are NEVER allowed in symbols (URL-dangerous)
const DANGEROUS_CHARS = /[&=?#@%\/\\<>'"`;|{}[\]()!$^*+]/;

// Maximum symbol length (most exchanges use 1-10 chars, DEX tokens can be longer)
// Contract addresses: EVM = 42 chars, Solana = 32-44 chars
const MAX_SYMBOL_LENGTH = 50;
const MAX_CONTRACT_LENGTH = 64; // Allow for contract addresses

// Minimum symbol length
const MIN_SYMBOL_LENGTH = 1;

// Valid symbol pattern: alphanumeric, dash, dot, colon, underscore
const VALID_SYMBOL_PATTERN = /^[A-Za-z0-9\-._:]+$/;

// Helper: Detect if input is a contract address
const isContractAddress = (input) => {
    if (!input) return false;
    // EVM address (0x followed by 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/i.test(input)) return 'evm';
    // Solana address (base58, typically 32-44 chars, no 0/O/I/l)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return 'solana';
    return false;
};

/**
 * Validates a symbol for use in external API requests
 * @param {string} symbol - The symbol to validate
 * @param {object} options - Validation options
 * @param {boolean} options.allowColon - Allow colons (for DEX tokens)
 * @param {boolean} options.allowDot - Allow dots (for exchanges like BRK.A)
 * @param {number} options.maxLength - Maximum length override
 * @returns {object} - { valid: boolean, sanitized: string, error: string|null }
 */
function validateSymbol(symbol, options = {}) {
    const {
        allowColon = true,
        allowDot = true,
        maxLength = MAX_SYMBOL_LENGTH
    } = options;

    // Check if symbol exists
    if (!symbol || typeof symbol !== 'string') {
        return {
            valid: false,
            sanitized: null,
            error: 'Symbol is required'
        };
    }

    // Trim whitespace
    const trimmed = symbol.trim();

    // Check length
    if (trimmed.length < MIN_SYMBOL_LENGTH) {
        return {
            valid: false,
            sanitized: null,
            error: 'Symbol is too short'
        };
    }

    // Check if it's a contract address (special handling)
    const contractType = isContractAddress(trimmed);
    if (contractType) {
        // Contract addresses have different length limits
        if (trimmed.length > MAX_CONTRACT_LENGTH) {
            return {
                valid: false,
                sanitized: null,
                error: `Contract address exceeds maximum length`
            };
        }

        // For EVM addresses, lowercase is standard
        // For Solana, preserve original case
        const sanitized = contractType === 'evm' ? trimmed.toLowerCase() : trimmed;

        return {
            valid: true,
            sanitized,
            error: null,
            isContract: true,
            contractType
        };
    }

    // Regular symbol validation
    if (trimmed.length > maxLength) {
        return {
            valid: false,
            sanitized: null,
            error: `Symbol exceeds maximum length of ${maxLength} characters`
        };
    }

    // Check for dangerous characters (SSRF/injection prevention)
    if (DANGEROUS_CHARS.test(trimmed)) {
        return {
            valid: false,
            sanitized: null,
            error: 'Symbol contains invalid characters'
        };
    }

    // Build pattern based on options
    let pattern = '^[A-Za-z0-9\\-_';
    if (allowDot) pattern += '.';
    if (allowColon) pattern += ':';
    pattern += ']+$';

    const validPattern = new RegExp(pattern);
    if (!validPattern.test(trimmed)) {
        return {
            valid: false,
            sanitized: null,
            error: 'Symbol contains invalid characters'
        };
    }

    // Convert to uppercase for consistency (regular symbols only)
    const sanitized = trimmed.toUpperCase();

    return {
        valid: true,
        sanitized,
        error: null
    };
}

/**
 * Express middleware to validate symbol parameter
 * Attaches validated symbol to req.validatedSymbol
 */
function validateSymbolMiddleware(options = {}) {
    return (req, res, next) => {
        const symbol = req.params.symbol || req.query.symbol;

        const result = validateSymbol(symbol, options);

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                message: result.error
            });
        }

        // Attach validated symbol to request
        req.validatedSymbol = result.sanitized;
        next();
    };
}

/**
 * Validates and returns sanitized symbol, or throws error
 * Use this for inline validation in routes
 */
function sanitizeSymbol(symbol, options = {}) {
    const result = validateSymbol(symbol, options);

    if (!result.valid) {
        const error = new Error(result.error);
        error.statusCode = 400;
        throw error;
    }

    return result.sanitized;
}

/**
 * URL-encode a validated symbol for use in query parameters
 * This adds an extra layer of protection
 */
function encodeSymbolForUrl(validatedSymbol) {
    return encodeURIComponent(validatedSymbol);
}

module.exports = {
    validateSymbol,
    validateSymbolMiddleware,
    sanitizeSymbol,
    encodeSymbolForUrl,
    isContractAddress,
    DANGEROUS_CHARS,
    MAX_SYMBOL_LENGTH,
    MAX_CONTRACT_LENGTH
};
