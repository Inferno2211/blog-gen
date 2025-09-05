/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password strength validation
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

class ValidationService {
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {Object} - Validation result
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { isValid: false, message: 'Email is required' };
        }

        if (!EMAIL_REGEX.test(email)) {
            return { isValid: false, message: 'Invalid email format' };
        }

        return { isValid: true };
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} - Validation result
     */
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { isValid: false, message: 'Password is required' };
        }

        if (password.length < 8) {
            return { isValid: false, message: 'Password must be at least 8 characters long' };
        }

        if (!PASSWORD_REGEX.test(password)) {
            return {
                isValid: false,
                message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            };
        }

        return { isValid: true };
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - Is valid URL
     */
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate anchor text
     * @param {string} anchorText - Anchor text to validate
     * @returns {Object} - Validation result
     */
    validateAnchorText(anchorText) {
        if (!anchorText || typeof anchorText !== 'string') {
            return { isValid: false, message: 'Anchor text is required' };
        }

        const trimmed = anchorText.trim();
        if (trimmed.length === 0) {
            return { isValid: false, message: 'Anchor text cannot be empty' };
        }

        if (trimmed.length > 200) {
            return { isValid: false, message: 'Anchor text too long (maximum 200 characters)' };
        }

        return { isValid: true };
    }

    /**
     * Validate required fields
     * @param {Object} data - Data object
     * @param {Array} requiredFields - Array of required field names
     * @returns {Object} - Validation result
     */
    validateRequired(data, requiredFields) {
        const missing = requiredFields.filter(field => !data[field]);
        if (missing.length > 0) {
            return {
                isValid: false,
                message: `Missing required fields: ${missing.join(', ')}`
            };
        }
        return { isValid: true };
    }
}

module.exports = ValidationService;
