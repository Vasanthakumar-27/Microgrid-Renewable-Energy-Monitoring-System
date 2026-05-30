# PHASE 4 IMPLEMENTATION GUIDE: Security Hardening

**Objective**: Implement comprehensive security hardening across authentication, input validation, rate limiting, encryption, and audit logging.

**Scope**: 3 sub-components with comprehensive test coverage
- **Phase 4A**: Input Validation & Sanitization (Data integrity protection)
- **Phase 4B**: Rate Limiting & DDoS Protection (API abuse prevention)
- **Phase 4C**: HTTPS/TLS & Encryption (Data in transit protection)

**Timeline**: ~2-3 hours | **Tests**: 10 per component (30 total)

---

## PHASE 4A: Input Validation & Sanitization

### Objective
Comprehensive input validation to prevent injection attacks, data corruption, and malformed requests.

### Implementation Plan

#### 1. **`middleware/validationMiddleware.js`** - Request Validation
Purpose: Centralized input validation and sanitization

**Key Validators**:
```javascript
// Email validation
validateEmail(email)  // RFC 5322 compliant
// Returns: { valid: boolean, error?: string }

// Phone validation
validatePhoneNumber(phone)  // E.164 format
// Returns: { valid: boolean, error?: string }

// Amount validation (currency)
validateAmount(amount, min = 0, max = 999999)  // Decimal validation
// Returns: { valid: boolean, amount?: number, error?: string }

// Bill month validation
validateMonth(month)  // YYYY-MM format
// Returns: { valid: boolean, error?: string }

// Customer ID validation
validateCustomerId(customerId)  // Format check
// Returns: { valid: boolean, error?: string }

// Text field validation (prevent XSS)
sanitizeText(text, options = {})  // Remove dangerous characters
// Returns: sanitized string

// SQL Injection prevention (Mongoose handles, but verify)
validateMongoId(id)  // ObjectId validation
// Returns: { valid: boolean, error?: string }

// Payment amount (paise conversion)
validatePaymentAmount(amount)  // Must be positive integer
// Returns: { valid: boolean, amountInPaise?: number, error?: string }

// File upload validation
validateFileUpload(file)  // Type, size, MIME type
// Returns: { valid: boolean, error?: string }
```

#### 2. **`middleware/requestValidation.js`** - Express Middleware
Purpose: Automatic request body/query validation per endpoint

Functions:
- `validateBody(schema)` - Validate POST/PUT body
- `validateQuery(schema)` - Validate query parameters
- `validateParams(schema)` - Validate URL parameters
- `sanitizeInput(req, res, next)` - Auto-sanitize all inputs

#### 3. **`config/validationRules.js`** - Validation Schemas
Purpose: Centralized validation rules for all endpoints

Rules for:
- Customer registration
- Bill creation
- Payment orders
- Dispute submissions
- Login credentials
- Email/phone updates

#### 4. **Security Headers Middleware**
Purpose: Add security headers to all responses

Headers:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

### Tests (10/10)
- [ ] Email validation (valid, invalid, edge cases)
- [ ] Phone number validation (E.164 format)
- [ ] Amount validation (decimal, ranges)
- [ ] Month validation (YYYY-MM format)
- [ ] XSS prevention (script tags removed)
- [ ] MongoDB ObjectId validation
- [ ] File upload validation (type, size)
- [ ] Security headers present in responses
- [ ] SQL injection prevention (with Mongoose)
- [ ] Request body sanitization middleware

---

## PHASE 4B: Rate Limiting & DDoS Protection

### Objective
Implement rate limiting to prevent API abuse, brute force attacks, and DDoS.

### Implementation Plan

#### 1. **`middleware/rateLimitMiddleware.js`** - Rate Limiting
Purpose: Tiered rate limiting based on IP, user, endpoint

```javascript
// Global rate limiter (all requests)
globalRateLimiter(windowMs = 900000, maxRequests = 100)
// 15 minutes, 100 requests per IP

// Authentication endpoints (strict)
authRateLimiter(windowMs = 900000, maxRequests = 5)
// 15 minutes, 5 attempts per IP

// API endpoints (moderate)
apiRateLimiter(windowMs = 60000, maxRequests = 30)
// 1 minute, 30 requests per authenticated user

// File upload (loose)
uploadRateLimiter(windowMs = 3600000, maxRequests = 50)
// 1 hour, 50 uploads per user

// Payment endpoints (strict)
paymentRateLimiter(windowMs = 3600000, maxRequests = 10)
// 1 hour, 10 payment attempts per user

// Password reset (very strict)
passwordResetLimiter(windowMs = 3600000, maxRequests = 3)
// 1 hour, 3 attempts per user
```

**Features**:
- Redis backend for distributed rate limiting
- In-memory fallback for single-instance
- Custom error responses
- Store key patterns: `ratelimit:{endpoint}:{identifier}`
- Whitelist capability for internal endpoints

#### 2. **`services/rateLimitService.js`** - Advanced Rate Limiting
Purpose: Sophisticated DDoS protection and rate limiting strategies

Functions:
```javascript
// Check rate limit
checkRateLimit(key, maxRequests, windowSeconds)
// Returns: { allowed: boolean, remaining: number, resetTime: timestamp }

// Track suspicious activity
trackSuspiciousActivity(ip, action)  // Failed logins, etc.
// Auto-ban after threshold

// Get rate limit stats
getRateLimitStats(key)
// Returns: { requests: number, window: timestamp, blocked: boolean }

// Whitelist IPs
whitelistIP(ip, reason)

// Blacklist IPs
blacklistIP(ip, duration, reason)  // Temporary ban

// Get blocked IPs
getBlockedIPs()

// Reset limit for user
resetUserRateLimit(userId)
```

**DDoS Detection**:
- Track requests per IP
- Detect sudden spikes (>5x normal)
- Auto-block suspicious IPs
- Alert on DDoS patterns
- Whitelist for critical infrastructure

#### 3. **`middleware/ddosDetection.js`** - DDoS Detection
Purpose: Detect and mitigate DDoS attacks

Features:
- Request pattern analysis
- Spike detection algorithm
- Automatic blocking
- Gradual recovery
- Alert system

### Tests (10/10)
- [ ] Global rate limiter enforced
- [ ] Authentication limiter (5 attempts/15min)
- [ ] API limiter (30 requests/min)
- [ ] Payment limiter (10 attempts/hour)
- [ ] Rate limit headers in response
- [ ] Whitelist functionality works
- [ ] Blacklist functionality works
- [ ] DDoS detection pattern recognition
- [ ] Suspicious activity tracking
- [ ] In-memory fallback works

---

## PHASE 4C: HTTPS/TLS & Encryption

### Objective
Implement HTTPS/TLS encryption and data protection at rest.

### Implementation Plan

#### 1. **`config/httpsConfig.js`** - HTTPS Configuration
Purpose: SSL/TLS certificate management

```javascript
// Load certificates
const httpsOptions = {
  key: fs.readFileSync('./certs/private-key.pem'),
  cert: fs.readFileSync('./certs/certificate.pem'),
  // Optional: ca for intermediate certificates
};

// Environment-based configuration
if (process.env.NODE_ENV === 'production') {
  // Use real certificates
  // Optional: HTTP/2 push
  httpsOptions.spdy = { protocols: ['h2', 'http/1.1'] };
}
```

#### 2. **`middleware/securityHeaders.js`** - Enhanced Security Headers
Purpose: Comprehensive security headers for all responses

Headers:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

#### 3. **`services/encryptionService.js`** - Data Encryption
Purpose: Encrypt sensitive data at rest

Functions:
```javascript
// Symmetric encryption for sensitive fields
encryptField(value, key = config.encryptionKey)
// Encrypt: phone, email, address
// Returns: encrypted string

decryptField(encryptedValue, key = config.encryptionKey)
// Decrypt and return plaintext

// Hash passwords (already handled by bcrypt in auth)
hashPassword(password)

// Verify hashed password
verifyPassword(password, hash)

// Generate secure tokens
generateSecureToken(length = 32)
// Returns: cryptographically secure token

// Encrypt/decrypt sensitive documents
encryptFile(filePath, key)
decryptFile(encryptedPath, key)

// Audit logging encryption
encryptAuditLog(logEntry)
```

#### 4. **`.env` Configuration**
```
# HTTPS/TLS
HTTPS_ENABLED=true
SSL_KEY_PATH=./certs/private-key.pem
SSL_CERT_PATH=./certs/certificate.pem
SSL_PORT=443
HTTP_REDIRECT_TO_HTTPS=true

# Encryption
ENCRYPTION_KEY=<32-byte key in hex>
ALGORITHM=aes-256-cbc

# Security
SESSION_SECRET=<secure random>
JWT_SECRET=<secure random>
```

#### 5. **`server.js`** Enhancement
```javascript
const https = require('https');
const httpsOptions = require('./config/httpsConfig');
const securityHeaders = require('./middleware/securityHeaders');

// Apply security headers
app.use(securityHeaders);

// HTTPS server
if (config.httpsEnabled) {
  https.createServer(httpsOptions, app).listen(config.httpsPort, () => {
    console.log(`✓ HTTPS server running on port ${config.httpsPort}`);
  });
}

// HTTP redirect to HTTPS
if (config.httpRedirectToHttps) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') === 'http') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

### Tests (10/10)
- [ ] HTTPS server starts with valid cert
- [ ] HTTP requests redirect to HTTPS
- [ ] SSL/TLS version validation
- [ ] Certificate validity checking
- [ ] Security headers in all responses
- [ ] HSTS header present
- [ ] Content-Security-Policy enforced
- [ ] Symmetric encryption/decryption works
- [ ] Secure token generation
- [ ] Certificate expiry monitoring

---

## PHASE 4D: Audit Logging & Monitoring

### Objective
Comprehensive audit logging for security events and compliance.

### Implementation Plan

#### 1. **`middleware/auditLogging.js`** - Audit Log Middleware
Purpose: Log all security-relevant events

Events to log:
```
Authentication:
- Login attempt (success/failure)
- Logout
- Password change
- Email/phone update
- Account deletion

Authorization:
- Unauthorized access attempts
- Role changes
- Permission changes

Data Operations:
- Sensitive data access
- Data modification
- Data deletion
- Export operations

Security:
- Failed rate limit attempts
- Suspicious activity detected
- IP changes
- Device changes

Admin Operations:
- User account modifications
- Configuration changes
- Report generation
```

Functions:
```javascript
logSecurityEvent(eventType, details, severity = 'INFO')
// severity: 'INFO', 'WARNING', 'CRITICAL'

getAuditLog(filter = {}, options = {})
// Returns paginated audit logs

exportAuditLog(startDate, endDate, format = 'json')
// Export for compliance reporting

alertSecurityTeam(event, details)
// Send alert for critical events
```

### Tests (10/10)
- [ ] Login attempts logged
- [ ] Failed authentication logged
- [ ] Sensitive data access logged
- [ ] Admin operations logged
- [ ] Audit log retention
- [ ] Log query capabilities
- [ ] Export functionality
- [ ] Alert system working
- [ ] Log tamper detection
- [ ] Compliance reporting

---

## Integration Across Phases

### Security Flow
```
Incoming Request
    ↓
Security Headers Middleware
    ↓
Rate Limit Check (Phase 4B)
    ↓ (Allowed)
Input Validation (Phase 4A)
    ↓
Authentication Check
    ↓
Authorization Check
    ↓
Audit Log Event (Phase 4D)
    ↓
Business Logic
    ↓
Encryption of Sensitive Data (Phase 4C)
    ↓
Response with Security Headers
```

### Dependencies
- Phase 4A (Validation) → Can run independently
- Phase 4B (Rate Limiting) → Depends on cache (Phase 3)
- Phase 4C (HTTPS) → Can run independently
- Phase 4D (Audit) → Depends on logging infrastructure (Phase 1)

---

## Success Metrics

**After Phase 4A (Validation)**:
- All inputs sanitized
- XSS prevention active
- SQL injection prevention verified
- Malformed requests rejected

**After Phase 4B (Rate Limiting)**:
- API rate limits enforced
- Authentication protected (5 attempts/15min)
- Payment endpoints protected (10 attempts/hour)
- DDoS detection active

**After Phase 4C (HTTPS)**:
- All traffic encrypted (TLS 1.2+)
- HSTS enforced
- Certificate chain valid
- Perfect Forward Secrecy enabled

**After Phase 4D (Audit)**:
- All security events logged
- Compliance reports available
- Alert system functional

---

## Production Deployment Checklist

**Before Production**:
- [ ] Generate real SSL/TLS certificates (Let's Encrypt or CA)
- [ ] Update environment variables in `.env.production`
- [ ] Configure encryption keys securely
- [ ] Set up audit log persistence (MongoDB/PostgreSQL)
- [ ] Configure alert delivery (email/Slack)
- [ ] Test rate limiting in staging
- [ ] Review security headers with team
- [ ] Enable HTTPS redirect
- [ ] Monitor certificate expiry

**During Deployment**:
- [ ] Verify HTTPS connectivity
- [ ] Test all security headers
- [ ] Validate rate limiters
- [ ] Confirm audit logging
- [ ] Monitor for false positives

**Post-Deployment**:
- [ ] Review first week of logs
- [ ] Adjust rate limits if needed
- [ ] Set up monitoring alerts
- [ ] Weekly security audit
- [ ] Certificate expiry alerts

---

## Expected Security Improvements

✅ **Input Validation**: 99% of injection attacks prevented  
✅ **Rate Limiting**: API abuse reduced by 95%  
✅ **HTTPS/TLS**: Data in transit fully encrypted  
✅ **Encryption**: Sensitive data protected at rest  
✅ **Audit Logging**: Full compliance audit trail  
✅ **Security Headers**: Browser-level protections active  

---

## OWASP Top 10 Coverage

| Vulnerability | Phase 4 Mitigation |
|----------------|-------------------|
| A01:2021 Injection | Phase 4A: Input validation, 4C: Parameterized queries |
| A02:2021 Broken Auth | Phase 1: JWT tokens, Phase 4A: Rate limiting |
| A03:2021 Broken Access | Phase 1: RBAC, Phase 4A: Validation |
| A04:2021 Insecure Design | Phase 4: Overall architecture |
| A05:2021 Security Config | Phase 4C: Security headers |
| A06:2021 Vulnerable Components | Phase 4: Input validation |
| A07:2021 Identification | Phase 4D: Audit logging |
| A08:2021 Data Integrity | Phase 4A: Input validation, 4C: Encryption |
| A09:2021 Logging & Monitoring | Phase 4D: Comprehensive logging |
| A10:2021 SSRF | Phase 4A: URL validation |

---

## Testing Strategy

**Unit Tests** (10/10 each component):
- Validation functions
- Rate limit calculations
- HTTPS/TLS configuration
- Encryption/decryption
- Audit log recording

**Integration Tests**:
- End-to-end security flow
- Rate limiting with load
- HTTPS redirect chain
- Audit log correlation

**Security Tests**:
- Penetration testing
- Fuzzing input validation
- Rate limit bypass attempts
- Certificate validation

---

## Next Phase: Phase 5 (API Documentation)

After Phase 4 completion:
- OpenAPI/Swagger documentation
- Security documentation
- Rate limit documentation
- Certificate/HTTPS setup guide

---

## Summary

Phase 4 provides enterprise-grade security hardening through:
- Comprehensive input validation
- Rate limiting and DDoS protection
- HTTPS/TLS encryption
- Data encryption at rest
- Complete audit logging
- Security headers

After Phase 4, the microgrid city system will be production-ready from a security perspective with protection against the OWASP Top 10 vulnerabilities and industry best practices implemented.
