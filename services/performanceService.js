/**
 * Phase 3C: Performance Monitoring Service
 * 
 * Tracks and reports on system performance metrics
 */

const cacheService = require('./cacheService');
const { getQueryStatistics, getIndexHealthReport } = require('../middleware/indexMiddleware');

const metrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  totalResponseTime: 0,
  slowRequests: [],
  endpointMetrics: {},
  alerts: []
};

const thresholds = {
  slowQueryTime: 100, // ms
  slowResponseTime: 500, // ms
  cacheHitRateMin: 0.6, // 60%
  errorRateMax: 0.05 // 5%
};

/**
 * Record request metric
 */
const recordRequest = (endpoint, responseTime, success = true) => {
  try {
    metrics.requestCount++;
    if (!success) metrics.errorCount++;
    metrics.totalResponseTime += responseTime;

    // Track by endpoint
    if (!metrics.endpointMetrics[endpoint]) {
      metrics.endpointMetrics[endpoint] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        slowCount: 0,
        errorCount: 0
      };
    }

    const endpointMetric = metrics.endpointMetrics[endpoint];
    endpointMetric.count++;
    endpointMetric.totalTime += responseTime;
    endpointMetric.avgTime = endpointMetric.totalTime / endpointMetric.count;

    if (!success) {
      endpointMetric.errorCount++;
    }

    if (responseTime > thresholds.slowResponseTime) {
      endpointMetric.slowCount++;
      metrics.slowRequests.push({
        endpoint,
        responseTime,
        timestamp: new Date()
      });

      // Keep only last 100 slow requests
      if (metrics.slowRequests.length > 100) {
        metrics.slowRequests.shift();
      }
    }
  } catch (error) {
    console.error('[Performance] Record error:', error.message);
  }
};

/**
 * Get performance report
 */
const getPerformanceReport = async () => {
  try {
    const uptime = Date.now() - metrics.startTime;
    const avgResponseTime =
      metrics.requestCount > 0 ? metrics.totalResponseTime / metrics.requestCount : 0;
    const errorRate = metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0;

    const cacheStats = cacheService.getStats();
    const queryStats = getQueryStatistics();

    return {
      timestamp: new Date(),
      uptime: `${(uptime / 1000 / 60).toFixed(2)} minutes`,
      requests: {
        total: metrics.requestCount,
        errors: metrics.errorCount,
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`
      },
      cache: cacheStats,
      database: {
        totalQueries: queryStats.totalQueries,
        avgQueryTime: `${queryStats.averageQueryTime}ms`,
        slowQueries: queryStats.slowQueriesCount
      },
      endpoints: Object.entries(metrics.endpointMetrics)
        .map(([endpoint, metric]) => ({
          endpoint,
          count: metric.count,
          avgTime: `${metric.avgTime.toFixed(2)}ms`,
          slowCount: metric.slowCount,
          errorCount: metric.errorCount
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 endpoints
    };
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * Check performance health
 */
const checkPerformanceHealth = async () => {
  try {
    const report = await getPerformanceReport();
    const alerts = [];

    if (!report.error) {
      // Check error rate
      const errorRateValue = parseFloat(report.requests.errorRate) / 100;
      if (errorRateValue > thresholds.errorRateMax) {
        alerts.push({
          level: 'CRITICAL',
          message: `Error rate ${report.requests.errorRate} exceeds threshold ${thresholds.errorRateMax * 100}%`,
          timestamp: new Date()
        });
      }

      // Check response time
      const avgResponseTime = parseFloat(report.requests.avgResponseTime);
      if (avgResponseTime > 500) {
        alerts.push({
          level: 'WARNING',
          message: `Average response time ${report.requests.avgResponseTime} exceeds 500ms`,
          timestamp: new Date()
        });
      }

      // Check cache hit rate
      const hitRate = parseFloat(report.cache.hitRate) / 100;
      if (hitRate < thresholds.cacheHitRateMin && report.cache.totalOperations > 100) {
        alerts.push({
          level: 'WARNING',
          message: `Cache hit rate ${report.cache.hitRate} below target 60%`,
          timestamp: new Date()
        });
      }
    }

    metrics.alerts = alerts;
    return {
      healthy: alerts.length === 0,
      alerts,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * Get endpoint performance
 */
const getEndpointPerformance = (endpoint) => {
  if (!metrics.endpointMetrics[endpoint]) {
    return { error: `No metrics for endpoint: ${endpoint}` };
  }

  const metric = metrics.endpointMetrics[endpoint];
  return {
    endpoint,
    count: metric.count,
    totalTime: metric.totalTime,
    avgTime: metric.avgTime.toFixed(2),
    slowCount: metric.slowCount,
    errorCount: metric.errorCount,
    errorRate: ((metric.errorCount / metric.count) * 100).toFixed(2)
  };
};

/**
 * Get slow requests
 */
const getSlowRequests = (limit = 20) => {
  return metrics.slowRequests.slice(-limit).reverse();
};

/**
 * Reset metrics
 */
const resetMetrics = () => {
  metrics.requestCount = 0;
  metrics.errorCount = 0;
  metrics.totalResponseTime = 0;
  metrics.slowRequests = [];
  metrics.endpointMetrics = {};
  metrics.alerts = [];
  metrics.startTime = Date.now();
};

/**
 * Express middleware for automatic request tracking
 */
const createPerformanceMiddleware = () => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Override res.json to capture success
    const originalJson = res.json;
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      recordRequest(req.path, responseTime, success);
      return originalJson.call(this, data);
    };

    // Handle errors
    const originalSend = res.send;
    res.send = function(data) {
      if (!res.headersSent) {
        const responseTime = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;
        recordRequest(req.path, responseTime, success);
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  recordRequest,
  getPerformanceReport,
  checkPerformanceHealth,
  getEndpointPerformance,
  getSlowRequests,
  resetMetrics,
  createPerformanceMiddleware,
  thresholds
};
