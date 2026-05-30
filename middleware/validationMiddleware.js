/**
 * Phase 4A: Input Validation & Sanitization
 * 
 * Comprehensive validation and sanitization of all user inputs
 * to prevent injection attacks, XSS, malformed data
 */

const validator = require('validator');

/**
 * EMAIL VALIDATION
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' };
  }

  const trimmed = email.trim().toLowerCase();

  if (!validator.isEmail(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email too long (max 254 characters)' };
  }

  return { valid: true, email: trimmed };
};

/**
 * PHONE VALIDATION (E.164 format)
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required and must be a string' };
  }

  const trimmed = phone.replace(/\s/g, '');

  // E.164 format: +[country code][number]
  if (!validator.isMobilePhone(trimmed, 'any', { strictMode: true })) {
    return { valid: false, error: 'Invalid phone number format (use E.164: +1234567890)' };
  }

  if (trimmed.length > 15) {
    return { valid: false, error: 'Phone number too long' };
  }

  return { valid: true, phone: trimmed };
};

/**
 * AMOUNT VALIDATION (Currency in rupees)
 */
const validateAmount = (amount, min = 0, max = 999999) => {
  if (amount === null || amount === undefined) {
    return { valid: false, error: 'Amount is required' };
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (numAmount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }

  if (numAmount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` };
  }

  // Check decimal places (max 2 for currency)
  if ((numAmount * 100) % 1 !== 0) {
    return { valid: false, error: 'Amount can have at most 2 decimal places' };
  }

  return { valid: true, amount: numAmount };
};

/**
 * BILL MONTH VALIDATION (YYYY-MM format)
 */
const validateMonth = (month) => {
  if (!month || typeof month !== 'string') {
    return { valid: false, error: 'Month is required (format: YYYY-MM)' };
  }

  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(month)) {
    return { valid: false, error: 'Invalid month format (use YYYY-MM)' };
  }

  const [year, monthPart] = month.split('-');
  const yearNum = parseInt(year);
  const monthNum = parseInt(monthPart);

  if (yearNum < 2020 || yearNum > 2100) {
    return { valid: false, error: 'Invalid year' };
  }

  if (monthNum < 1 || monthNum > 12) {
    return { valid: false, error: 'Invalid month (must be 01-12)' };
  }

  return { valid: true, month };
};

/**
 * CUSTOMER ID VALIDATION
 */
const validateCustomerId = (customerId) => {
  if (!customerId || typeof customerId !== 'string') {
    return { valid: false, error: 'Customer ID is required' };
  }

  // Format: cust-[alphanumeric]
  const idRegex = /^cust-[a-zA-Z0-9]+$/;
  if (!idRegex.test(customerId)) {
    return { valid: false, error: 'Invalid customer ID format' };
  }

  if (customerId.length > 50) {
    return { valid: false, error: 'Customer ID too long' };
  }

  return { valid: true, customerId };
};

/**
 * HTML ESCAPE (Encode HTML entities)
 */
const htmlEscape = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return validator.escape(text);
};

/**
 * SANITIZE TEXT (Remove XSS, HTML, scripts)
 */
const sanitizeText = (text, options = {}) => {
  if (!text) return '';

  if (typeof text !== 'string') {
    return '';
  }

  // Remove script tags and other dangerous elements
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove event handlers (onerror, onclick, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove HTML tags
  sanitized = validator.stripLow(sanitized);
  sanitized = validator.escape(sanitized);

  // Remove dangerous characters
  if (options.allowNewlines !== true) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }

  // Trim and limit length
  const maxLength = options.maxLength || 1000;
  sanitized = sanitized.trim().substring(0, maxLength);

  return sanitized;
};

/**
 * MONGODB OBJECTID VALIDATION
 */
const validateMongoId = (id) => {
  if (!id) {
    return { valid: false, error: 'ID is required' };
  }

  if (!validator.isMongoId(id.toString())) {
    return { valid: false, error: 'Invalid ObjectId format' };
  }

  return { valid: true, id };
};

/**
 * PAYMENT AMOUNT VALIDATION (For Razorpay, convert to paise)
 */
const validatePaymentAmount = (amount) => {
  const validation = validateAmount(amount, 1, 999999);
  if (!validation.valid) {
    return validation;
  }

  // Convert to paise (multiply by 100)
  const amountInPaise = Math.round(validation.amount * 100);

  if (amountInPaise < 100) {
    // Minimum 1 INR (100 paise)
    return { valid: false, error: 'Minimum payment amount is ₹1.00' };
  }

  if (amountInPaise > 999999 * 100) {
    return { valid: false, error: 'Maximum payment amount exceeded' };
  }

  return {
    valid: true,
    amount: validation.amount,
    amountInPaise
  };
};

/**
 * FILE UPLOAD VALIDATION
 */
const validateFileUpload = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (!allowedMimes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, PDF' };
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 5MB limit' };
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = file.originalname.toLowerCase();
  const hasValidExt = allowedExtensions.some(e => ext.endsWith(e));

  if (!hasValidExt) {
    return { valid: false, error: 'Invalid file extension' };
  }

  return { valid: true };
};

/**
 * PASSWORD VALIDATION
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password too long' };
  }

  // Check for at least one uppercase, one lowercase, one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, and number'
    };
  }

  return { valid: true };
};

/**
 * NAME VALIDATION
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Name too long (max 100 characters)' };
  }

  // Allow letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, name: trimmed };
};

/**
 * URL VALIDATION (Prevent SSRF)
 */
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  if (!validator.isURL(url)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Prevent internal/private IPs
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^::1$/,
    /^fc/,
    /^fd/
  ];

  const isPrivate = privatePatterns.some(pattern => pattern.test(hostname));
  if (isPrivate) {
    return { valid: false, error: 'Internal/private URLs not allowed' };
  }

  return { valid: true, url };
};

/**
 * SANITIZE INPUT MIDDLEWARE
 * Automatically sanitizes request body, query, and params
 */
const sanitizeInputMiddleware = () => {
  return (req, res, next) => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string') {
            req.body[key] = sanitizeText(value);
          }
        }
      }

      // Sanitize query
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            req.query[key] = sanitizeText(value);
          }
        }
      }

      // Sanitize params
      if (req.params && typeof req.params === 'object') {
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            req.params[key] = sanitizeText(value);
          }
        }
      }

      next();
    } catch (error) {
      console.error('[Validation] Sanitization error:', error.message);
      next();
    }
  };
};

/**
 * SECURITY HEADERS MIDDLEWARE
 */
const securityHeadersMiddleware = () => {
  return (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );

    // Strict Transport Security
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  };
};

module.exports = {
  // Validators
  validateEmail,
  validatePhoneNumber,
  validateAmount,
  validateMonth,
  validateCustomerId,
  validatePaymentAmount,
  validateFileUpload,
  validatePassword,
  validateName,
  validateUrl,
  validateMongoId,

  // Sanitizers
  sanitizeText,
  htmlEscape,

  // Middleware
  sanitizeInputMiddleware,
  securityHeadersMiddleware
};
