const { getAllIndexStats } = require('../scripts/createIndexes');

// Track query performance metrics
const queryMetrics = {
  totalQueries: 0,
  totalQueryTime: 0,
  slowQueries: [],
  queriesByCollection: {}
};

const slowQueryThreshold = 100; // milliseconds

/**
 * Monitor MongoDB query execution time
 * @param {string} collectionName
 * @param {string} operation
 * @param {number} executionTime
 */
const logQueryTime = (collectionName, operation, executionTime) => {
  try {
    queryMetrics.totalQueries++;
    queryMetrics.totalQueryTime += executionTime;

    if (!queryMetrics.queriesByCollection[collectionName]) {
      queryMetrics.queriesByCollection[collectionName] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        slowCount: 0
      };
    }

    queryMetrics.queriesByCollection[collectionName].count++;
    queryMetrics.queriesByCollection[collectionName].totalTime += executionTime;
    queryMetrics.queriesByCollection[collectionName].avgTime =
      queryMetrics.queriesByCollection[collectionName].totalTime /
      queryMetrics.queriesByCollection[collectionName].count;

    if (executionTime > slowQueryThreshold) {
      queryMetrics.queriesByCollection[collectionName].slowCount++;
      queryMetrics.slowQueries.push({
        collection: collectionName,
        operation,
        time: executionTime,
        timestamp: new Date()
      });

      // Keep only last 100 slow queries
      if (queryMetrics.slowQueries.length > 100) {
        queryMetrics.slowQueries.shift();
      }

      console.warn(
        `⚠ [Query] Slow query detected: ${collectionName}.${operation} took ${executionTime}ms`
      );
    }
  } catch (error) {
    console.error('[Query Monitoring] Error logging query time:', error.message);
  }
};

/**
 * Get query performance statistics
 */
const getQueryStatistics = () => {
  const avgQueryTime = queryMetrics.totalQueries > 0
    ? (queryMetrics.totalQueryTime / queryMetrics.totalQueries).toFixed(2)
    : 0;

  return {
    totalQueries: queryMetrics.totalQueries,
    totalQueryTime: queryMetrics.totalQueryTime,
    averageQueryTime: parseFloat(avgQueryTime),
    slowQueriesCount: queryMetrics.slowQueries.length,
    slowQueries: queryMetrics.slowQueries.slice(-10), // Last 10
    queriesByCollection: queryMetrics.queriesByCollection
  };
};

/**
 * Get comprehensive index health report
 */
const getIndexHealthReport = async () => {
  try {
    const indexStats = await getAllIndexStats();

    const report = {
      timestamp: new Date(),
      indexStats,
      queryMetrics: getQueryStatistics(),
      recommendations: []
    };

    // Generate recommendations
    for (const [collection, stats] of Object.entries(indexStats)) {
      if (!stats.error) {
        if (stats.indexCount < 3) {
          report.recommendations.push(
            `${collection}: Only ${stats.indexCount} indexes. Consider adding more for frequently queried fields.`
          );
        }

        if (stats.documentCount > 100000 && stats.indexCount < 5) {
          report.recommendations.push(
            `${collection}: Large collection (${stats.documentCount} docs) with few indexes. Consider optimization.`
          );
        }
      }
    }

    return report;
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * Reset query metrics
 */
const resetQueryMetrics = () => {
  queryMetrics.totalQueries = 0;
  queryMetrics.totalQueryTime = 0;
  queryMetrics.slowQueries = [];
  queryMetrics.queriesByCollection = {};
};

/**
 * Express middleware to automatically log query times
 * Wraps Mongoose query execution
 */
const setupQueryMonitoring = () => {
  try {
    const originalExec = require('mongoose').Query.prototype.exec;

    require('mongoose').Query.prototype.exec = async function(...args) {
      const startTime = Date.now();
      const collection = this.model?.collection?.name || 'unknown';
      const operation = this.op || 'unknown';

      try {
        const result = await originalExec.apply(this, args);
        const executionTime = Date.now() - startTime;
        logQueryTime(collection, operation, executionTime);
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logQueryTime(collection, operation, executionTime);
        throw error;
      }
    };

    console.log('✓ [Query Monitoring] Automatic query timing enabled');
  } catch (error) {
    console.error('[Query Monitoring] Error setting up monitoring:', error.message);
  }
};

module.exports = {
  logQueryTime,
  getQueryStatistics,
  getIndexHealthReport,
  resetQueryMetrics,
  setupQueryMonitoring
};
