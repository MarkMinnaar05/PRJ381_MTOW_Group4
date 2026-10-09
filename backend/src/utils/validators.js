

/**
 * Validate that a value is a valid number
 * @param {any} value - The value to validate
 * @param {boolean} allowNegative - Whether negative numbers are allowed
 * @returns {Object} - Validation result
 */
exports.validateNumber = (value, allowNegative = false) => {
    const num = Number(value);
    
    if (isNaN(num)) {
        return {
            valid: false,
            error: 'Must be a valid number'
        };
    }
    
    if (!allowNegative && num < 0) {
        return {
            valid: false,
            error: 'Must be a positive number'
        };
    }
    
    if (!Number.isInteger(num)) {
        return {
            valid: false,
            error: 'Must be an integer'
        };
    }
    
    return {
        valid: true,
        value: num
    };
};

/**
 * Validate difficulty level
 * @param {number} difficulty - Difficulty level to validate
 * @returns {Object} - Validation result
 */
exports.validateDifficulty = (difficulty) => {
    const num = Number(difficulty);
    
    if (isNaN(num) || !Number.isInteger(num)) {
        return {
            valid: false,
            error: 'Difficulty must be an integer'
        };
    }
    
    if (num < 1 || num > 5) {
        return {
            valid: false,
            error: 'Difficulty must be between 1 and 5'
        };
    }
    
    return {
        valid: true,
        value: num
    };
};

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {Object} - Validation result
 */
exports.validateSessionId = (sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
        return {
            valid: false,
            error: 'Session ID must be a string'
        };
    }
    
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
        return {
            valid: false,
            error: 'Invalid session ID format'
        };
    }
    
    return {
        valid: true,
        value: sessionId
    };
};

/**
 * Validate player name
 * @param {string} name - Player name to validate
 * @returns {Object} - Validation result
 */
exports.validatePlayerName = (name) => {
    if (!name) {
        return {
            valid: false,
            error: 'Player name is required'
        };
    }
    
    if (typeof name !== 'string') {
        return {
            valid: false,
            error: 'Player name must be a string'
        };
    }
    
    if (name.length < 1 || name.length > 20) {
        return {
            valid: false,
            error: 'Player name must be between 1 and 20 characters'
        };
    }
    
    // Check for invalid characters (alphanumeric, spaces, underscores, hyphens)
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
        return {
            valid: false,
            error: 'Player name contains invalid characters'
        };
    }
    
    return {
        valid: true,
        value: name.trim()
    };
};