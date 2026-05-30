/**
 * Phase 4C: HTTPS/TLS & Data Encryption
 * 
 * SSL/TLS certificate management and data encryption at rest
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/appConfig');

/**
 * SYMMETRIC ENCRYPTION FOR SENSITIVE DATA
 */

// Get encryption key and algorithm
const getEncryptionKey = () => {
  const keyHex = config.encryptionKey || 'default-insecure-key-change-in-production';
  
  // If key is hex string, convert to buffer
  if (typeof keyHex === 'string' && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }
  
  // Otherwise, derive a key from the string
  return crypto.createHash('sha256').update(keyHex).digest();
};

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive field
 */
const encryptField = (value) => {
  try {
    if (!value) return null;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(String(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return: iv:encrypted
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption] Encrypt error:', error.message);
    return null;
  }
};

/**
 * Decrypt sensitive field
 */
const decryptField = (encryptedValue) => {
  try {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return null;
    }

    const [ivHex, encrypted] = encryptedValue.split(':');
    if (!ivHex || !encrypted) {
      return null;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Decrypt error:', error.message);
    return null;
  }
};

/**
 * HASHING FOR PASSWORDS (using built-in, not for sensitive fields)
 */

const hashPassword = async (password) => {
  try {
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('[Encryption] Hash error:', error.message);
    throw error;
  }
};

const verifyPassword = async (password, hash) => {
  try {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('[Encryption] Verify error:', error.message);
    return false;
  }
};

/**
 * GENERATE SECURE TOKEN
 */
const generateSecureToken = (length = 32) => {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    console.error('[Encryption] Token generation error:', error.message);
    return null;
  }
};

/**
 * HMAC SIGNING (For data integrity verification)
 */
const signData = (data, secret = config.jwtSecret) => {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
  } catch (error) {
    console.error('[Encryption] Sign error:', error.message);
    return null;
  }
};

const verifySignature = (data, signature, secret = config.jwtSecret) => {
  try {
    const expectedSignature = signData(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Encryption] Verify signature error:', error.message);
    return false;
  }
};

/**
 * CERTIFICATE MANAGEMENT
 */

const getCertificatePaths = () => {
  return {
    key: config.sslKeyPath || path.join(process.cwd(), 'certs', 'private-key.pem'),
    cert: config.sslCertPath || path.join(process.cwd(), 'certs', 'certificate.pem'),
    ca: config.sslCaPath || null
  };
};

const loadCertificates = () => {
  try {
    const paths = getCertificatePaths();

    if (!fs.existsSync(paths.key)) {
      console.warn('[HTTPS] Certificate not found. Generate with: openssl req -new -x509 -days 365 -nodes -out certificate.pem -keyout private-key.pem');
      return null;
    }

    const options = {
      key: fs.readFileSync(paths.key, 'utf8'),
      cert: fs.readFileSync(paths.cert, 'utf8')
    };

    // Load intermediate CA if provided
    if (paths.ca && fs.existsSync(paths.ca)) {
      options.ca = fs.readFileSync(paths.ca, 'utf8');
    }

    console.log('✓ [HTTPS] SSL/TLS certificates loaded');
    return options;
  } catch (error) {
    console.error('[HTTPS] Error loading certificates:', error.message);
    return null;
  }
};

/**
 * CHECK CERTIFICATE VALIDITY
 */
const checkCertificateValidity = () => {
  try {
    const certPath = getCertificatePaths().cert;

    if (!fs.existsSync(certPath)) {
      return { valid: false, error: 'Certificate file not found' };
    }

    const certData = fs.readFileSync(certPath, 'utf8');
    
    // Simple extraction of notBefore and notAfter dates
    const notBeforeMatch = certData.match(/notBefore=(.*)/);
    const notAfterMatch = certData.match(/notAfter=(.*)/);

    if (!notBeforeMatch || !notAfterMatch) {
      return {
        valid: true,
        message: 'Certificate loaded (detailed info not available)'
      };
    }

    const now = new Date();
    const notAfterStr = notAfterMatch[1];

    // Very basic validation
    const isExpired = notAfterStr < now.toString();

    if (isExpired) {
      return {
        valid: false,
        error: `Certificate expired: ${notAfterStr}`
      };
    }

    return {
      valid: true,
      notBefore: notBeforeMatch[1],
      notAfter: notAfterStr,
      message: 'Certificate is valid'
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
};

/**
 * SECURITY HEADERS CONFIGURATION
 */
const getSecurityHeaders = () => {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
};

/**
 * APPLY SECURITY HEADERS MIDDLEWARE
 */
const applySecurityHeaders = () => {
  return (req, res, next) => {
    const headers = getSecurityHeaders();
    for (const [header, value] of Object.entries(headers)) {
      res.setHeader(header, value);
    }
    next();
  };
};

/**
 * HTTPS REDIRECT MIDDLEWARE
 */
const httpsRedirect = () => {
  return (req, res, next) => {
    // Check if request is via proxy (x-forwarded-proto)
    if (req.header('x-forwarded-proto') === 'http') {
      return res.redirect(
        `https://${req.header('host')}${req.url}`
      );
    }

    // Check if request is not secure
    if (!req.secure && process.env.NODE_ENV === 'production') {
      return res.redirect(
        `https://${req.header('host')}${req.url}`
      );
    }

    next();
  };
};

/**
 * INITIALIZE HTTPS CONFIG
 */
const initializeHttpsConfig = () => {
  const httpsConfig = {
    httpsEnabled: config.httpsEnabled || false,
    httpsPort: config.httpsPort || 443,
    httpRedirectToHttps: config.httpRedirectToHttps || false,
    certificates: null,
    securityHeaders: getSecurityHeaders()
  };

  if (httpsConfig.httpsEnabled) {
    httpsConfig.certificates = loadCertificates();
    if (!httpsConfig.certificates) {
      console.warn('[HTTPS] HTTPS disabled - certificates not found');
      httpsConfig.httpsEnabled = false;
    }
  }

  return httpsConfig;
};

module.exports = {
  // Encryption
  encryptField,
  decryptField,

  // Password hashing
  hashPassword,
  verifyPassword,

  // Token generation
  generateSecureToken,

  // Data signing
  signData,
  verifySignature,

  // Certificate management
  getCertificatePaths,
  loadCertificates,
  checkCertificateValidity,

  // Security headers
  getSecurityHeaders,
  applySecurityHeaders,

  // HTTPS redirect
  httpsRedirect,

  // Configuration
  initializeHttpsConfig
};
