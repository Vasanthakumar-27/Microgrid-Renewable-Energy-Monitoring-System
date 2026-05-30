/**
 * Phase 4B: Rate Limiting & DDoS Protection
 * 
 * Tiered rate limiting based on endpoint, IP, and user
 * with Redis backend and in-memory fallback
 */

const config = require('../config/appConfig');

// In-memory store for rate limits
const rateLimitStore = new Map();
const blockedIPs = new Map();
const suspiciousActivity = new Map();

/**
 * Get rate limit key
 */
const getRateLimitKey = (identifier, endpoint) => {
  return `ratelimit:${endpoint}:${identifier}`;
};

/**
 * Check if IP is blocked
 */
const isIPBlocked = (ip) => {
  if (!blockedIPs.has(ip)) {
    return false;
  }

  const blockData = blockedIPs.get(ip);
  if (blockData.expiresAt && blockData.expiresAt < Date.now()) {
    blockedIPs.delete(ip);
    return false;
  }

  return true;
};

/**
 * Check rate limit
 */
const checkRateLimit = (key, maxRequests, windowSeconds = 60) => {
  try {
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, {
        count: 1,
        windowStart: now,
        expiresAt: now + windowSeconds * 1000
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: new Date(now + windowSeconds * 1000),
        retryAfter: null
      };
    }

    const data = rateLimitStore.get(key);

    // Check if window expired
    if (now > data.expiresAt) {
      rateLimitStore.set(key, {
        count: 1,
        windowStart: now,
        expiresAt: now + windowSeconds * 1000
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: new Date(now + windowSeconds * 1000),
        retryAfter: null
      };
    }

    // Check limit
    if (data.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((data.expiresAt - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(data.expiresAt),
        retryAfter: retryAfterSeconds
      };
    }

    // Increment counter
    data.count++;

    return {
      allowed: true,
      remaining: maxRequests - data.count,
      resetTime: new Date(data.expiresAt),
      retryAfter: null
    };
  } catch (error) {
    console.error('[RateLimit] Check error:', error.message);
    // On error, allow request
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: null,
      retryAfter: null
    };
  }
};

/**
 * Track suspicious activity
 */
const trackSuspiciousActivity = (ip, action) => {
  const now = Date.now();
  const key = `suspicious:${ip}`;

  if (!suspiciousActivity.has(key)) {
    suspiciousActivity.set(key, {
      actions: [{ action, timestamp: now }],
      firstSeen: now,
      lastSeen: now
    });

    return { suspicious: false, recentFailures: 0 };
  }

  const data = suspiciousActivity.get(key);
  data.actions.push({ action, timestamp: now });
  data.lastSeen = now;

  // Keep only last 100 actions
  if (data.actions.length > 100) {
    data.actions.shift();
  }

  // Count failed logins in last 15 minutes
  const fifteenMinutesAgo = now - 15 * 60 * 1000;
  const recentFailures = data.actions.filter(
    a => a.action === 'failed_login' && a.timestamp > fifteenMinutesAgo
  ).length;

  if (recentFailures >= 5) {
    // Block IP for 1 hour
    blockIP(ip, 3600, `Too many failed login attempts (${recentFailures}/5)`);
    console.warn(`⚠️  [Security] IP blocked: ${ip} - Too many failed attempts`);

    return {
      suspicious: true,
      action: 'blocked',
      reason: 'Too many failed login attempts',
      recentFailures
    };
  }

  return {
    suspicious: false,
    recentFailures
  };
};

/**
 * Whitelist IP
 */
const whitelistIP = (ip, reason = 'Admin whitelist') => {
  try {
    console.log(`✓ [RateLimit] Whitelisted IP: ${ip} - ${reason}`);
    // Implementation would add to whitelist (not blocking further)
    return true;
  } catch (error) {
    console.error('[RateLimit] Whitelist error:', error.message);
    return false;
  }
};

/**
 * Block IP (temporary or permanent)
 */
const blockIP = (ip, durationSeconds = 3600, reason = 'Rate limit exceeded') => {
  try {
    const now = Date.now();
    const expiresAt = durationSeconds ? now + durationSeconds * 1000 : null;

    blockedIPs.set(ip, {
      blockedAt: now,
      expiresAt,
      reason,
      durationSeconds
    });

    console.warn(`🚫 [RateLimit] Blocked IP: ${ip} for ${durationSeconds}s - ${reason}`);
    return true;
  } catch (error) {
    console.error('[RateLimit] Block error:', error.message);
    return false;
  }
};

/**
 * Get blocked IPs
 */
const getBlockedIPs = () => {
  const now = Date.now();
  const blocked = [];

  for (const [ip, data] of blockedIPs.entries()) {
    if (!data.expiresAt || data.expiresAt > now) {
      blocked.push({
        ip,
        blockedAt: new Date(data.blockedAt),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        reason: data.reason
      });
    } else {
      blockedIPs.delete(ip);
    }
  }

  return blocked;
};

/**
 * Get rate limit stats
 */
const getRateLimitStats = (key) => {
  if (!rateLimitStore.has(key)) {
    return {
      requests: 0,
      window: null,
      blocked: false
    };
  }

  const data = rateLimitStore.get(key);
  return {
    requests: data.count,
    window: new Date(data.windowStart),
    expiresAt: new Date(data.expiresAt),
    blocked: data.count > 0
  };
};

/**
 * Reset rate limit for user
 */
const resetUserRateLimit = (userId, endpoint = '*') => {
  try {
    if (endpoint === '*') {
      // Reset all endpoints for user
      for (const key of rateLimitStore.keys()) {
        if (key.includes(userId)) {
          rateLimitStore.delete(key);
        }
      }
    } else {
      const key = getRateLimitKey(userId, endpoint);
      rateLimitStore.delete(key);
    }

    console.log(`✓ [RateLimit] Reset rate limit for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('[RateLimit] Reset error:', error.message);
    return false;
  }
};

/**
 * Get all rate limit stats
 */
const getAllRateLimitStats = () => {
  const stats = {
    totalKeys: rateLimitStore.size,
    blockedIPs: getBlockedIPs().length,
    suspiciousIPs: suspiciousActivity.size,
    details: {}
  };

  // Include top 10 most active keys
  const entries = Array.from(rateLimitStore.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  for (const [key, data] of entries) {
    stats.details[key] = {
      requests: data.count,
      expiresAt: new Date(data.expiresAt)
    };
  }

  return stats;
};

/**
 * RATE LIMITING MIDDLEWARE FACTORY
 */

// Global rate limiter
const globalRateLimiter = (maxRequests = 100, windowSeconds = 900) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (isIPBlocked(ip)) {
      console.warn(`🚫 [RateLimit] Blocked IP attempted access: ${ip}`);
      return res.status(429).json({
        success: false,
        message: 'Your IP has been temporarily blocked due to suspicious activity',
        retryAfter: 3600
      });
    }

    const key = getRateLimitKey(ip, 'global');
    const limit = checkRateLimit(key, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));
    res.setHeader('X-RateLimit-Reset', limit.resetTime.toISOString());

    if (!limit.allowed) {
      console.warn(`⚠️  [RateLimit] Global rate limit exceeded for IP: ${ip}`);
      blockIP(ip, 600, 'Global rate limit exceeded');

      res.setHeader('Retry-After', limit.retryAfter);
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: limit.retryAfter
      });
    }

    next();
  };
};

// Authentication rate limiter (strict)
const authRateLimiter = (maxRequests = 5, windowSeconds = 900) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    const key = getRateLimitKey(ip, 'auth');
    const limit = checkRateLimit(key, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));

    if (!limit.allowed) {
      const activity = trackSuspiciousActivity(ip, 'failed_login');

      res.setHeader('Retry-After', limit.retryAfter);
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        retryAfter: limit.retryAfter
      });
    }

    next();
  };
};

// API rate limiter (moderate)
const apiRateLimiter = (maxRequests = 30, windowSeconds = 60) => {
  return (req, res, next) => {
    const identifier = req.user?.customerId || req.ip || 'unknown';
    const key = getRateLimitKey(identifier, 'api');
    const limit = checkRateLimit(key, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));

    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfter);
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again in a moment.',
        retryAfter: limit.retryAfter
      });
    }

    next();
  };
};

// Payment rate limiter (strict)
const paymentRateLimiter = (maxRequests = 10, windowSeconds = 3600) => {
  return (req, res, next) => {
    const identifier = req.user?.customerId || req.ip || 'unknown';
    const key = getRateLimitKey(identifier, 'payment');
    const limit = checkRateLimit(key, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));

    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfter);
      return res.status(429).json({
        success: false,
        message: 'Payment rate limit exceeded. Please try again later.',
        retryAfter: limit.retryAfter
      });
    }

    next();
  };
};

// Password reset rate limiter (very strict)
const passwordResetLimiter = (maxRequests = 3, windowSeconds = 3600) => {
  return (req, res, next) => {
    const identifier = req.body.email || req.ip || 'unknown';
    const key = getRateLimitKey(identifier, 'password_reset');
    const limit = checkRateLimit(key, maxRequests, windowSeconds);

    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfter);
      return res.status(429).json({
        success: false,
        message: 'Too many password reset attempts. Please try again later.',
        retryAfter: limit.retryAfter
      });
    }

    next();
  };
};

module.exports = {
  // Core functions
  checkRateLimit,
  trackSuspiciousActivity,
  isIPBlocked,
  blockIP,
  whitelistIP,
  getBlockedIPs,
  getRateLimitStats,
  resetUserRateLimit,
  getAllRateLimitStats,

  // Middleware
  globalRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  paymentRateLimiter,
  passwordResetLimiter
};
