/**
 * Phase 3B: Query Optimization Service
 * 
 * Provides optimized query patterns using aggregation pipelines,
 * batch operations, and efficient pagination
 */

const Bill = require('../models/billModel');
const Payment = require('../models/paymentModel');
const Customer = require('../models/customerModel');
const BillDispute = require('../models/billDisputeModel');
const Notification = require('../models/notificationModel');

/**
 * BILL AGGREGATIONS
 */

/**
 * Get bills by month with aggregated statistics
 */
const getBillsWithAggregation = async (month, options = {}) => {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  try {
    return await Bill.aggregate([
      { $match: { month } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: 'customerId',
          as: 'customer'
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  } catch (error) {
    console.error('[QueryOptimization] Aggregation error:', error.message);
    throw error;
  }
};

/**
 * Get overdue bills efficiently
 */
const getOverdueBillsOptimized = async (beforeDate, options = {}) => {
  const { limit = 100, page = 1 } = options;
  const skip = (page - 1) * limit;

  try {
    const bills = await Bill.find({
      status: 'PENDING',
      dueDate: { $lt: beforeDate }
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .skip(skip)
      .lean(); // Use lean() for read-only queries

    const total = await Bill.countDocuments({
      status: 'PENDING',
      dueDate: { $lt: beforeDate }
    });

    return {
      bills,
      total,
      page,
      limit,
      hasMore: skip + limit < total
    };
  } catch (error) {
    console.error('[QueryOptimization] Overdue bills error:', error.message);
    throw error;
  }
};

/**
 * PAYMENT AGGREGATIONS
 */

/**
 * Get revenue statistics by month
 */
const getRevenueByMonthAggregation = async (startMonth, endMonth) => {
  try {
    return await Payment.aggregate([
      {
        $match: {
          month: { $gte: startMonth, $lte: endMonth },
          status: 'COMPLETED'
        }
      },
      {
        $group: {
          _id: '$month',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageTransaction: { $avg: '$amount' },
          methodBreakdown: {
            $push: {
              method: '$method',
              amount: '$amount'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  } catch (error) {
    console.error('[QueryOptimization] Revenue aggregation error:', error.message);
    throw error;
  }
};

/**
 * Get payment method distribution
 */
const getPaymentMethodDistribution = async () => {
  try {
    return await Payment.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          percentage: { $avg: 1 } // Will be calculated in post-processing
        }
      },
      { $sort: { count: -1 } }
    ]);
  } catch (error) {
    console.error('[QueryOptimization] Method distribution error:', error.message);
    throw error;
  }
};

/**
 * Get customer payment history with aggregation
 */
const getCustomerPaymentHistoryOptimized = async (customerId, options = {}) => {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  try {
    const payments = await Payment.find({ customerId })
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Payment.countDocuments({ customerId });

    const stats = await Payment.aggregate([
      { $match: { customerId } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] } },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          lastPaymentDate: { $max: '$date' }
        }
      }
    ]);

    return {
      payments,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
      stats: stats[0] || { totalPaid: 0, completedCount: 0, lastPaymentDate: null }
    };
  } catch (error) {
    console.error('[QueryOptimization] Customer payment history error:', error.message);
    throw error;
  }
};

/**
 * BATCH OPERATIONS
 */

/**
 * Batch update bill status
 */
const updateBillsStatusBatch = async (updates) => {
  // updates: [{ billId, newStatus }, ...]
  try {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.billId },
        update: { $set: { status: update.newStatus } }
      }
    }));

    const result = await Bill.bulkWrite(bulkOps);

    console.log(`[QueryOptimization] Batch update: ${result.modifiedCount} bills updated`);
    return {
      modifiedCount: result.modifiedCount,
      totalCount: updates.length
    };
  } catch (error) {
    console.error('[QueryOptimization] Batch update error:', error.message);
    throw error;
  }
};

/**
 * Batch update customer status
 */
const updateCustomerStatusBatch = async (updates) => {
  // updates: [{ customerId, newStatus }, ...]
  try {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { customerId: update.customerId },
        update: { $set: { status: update.newStatus } }
      }
    }));

    const result = await Customer.bulkWrite(bulkOps);

    console.log(`[QueryOptimization] Customer batch: ${result.modifiedCount} customers updated`);
    return {
      modifiedCount: result.modifiedCount,
      totalCount: updates.length
    };
  } catch (error) {
    console.error('[QueryOptimization] Customer batch error:', error.message);
    throw error;
  }
};

/**
 * Batch create notifications
 */
const createNotificationsBatch = async (notifications) => {
  try {
    const result = await Notification.insertMany(notifications, { ordered: false });

    console.log(`[QueryOptimization] Created ${result.length} notifications`);
    return {
      createdCount: result.length,
      totalCount: notifications.length
    };
  } catch (error) {
    // insertMany with ordered: false continues on error
    console.error('[QueryOptimization] Batch notification error:', error.message);
    return {
      partialSuccess: true,
      error: error.message
    };
  }
};

/**
 * CURSOR-BASED STREAMING
 */

/**
 * Stream large bill result sets using cursor
 */
const streamBillsCursor = (filter, batchSize = 1000) => {
  try {
    return Bill.find(filter).batchSize(batchSize).cursor();
  } catch (error) {
    console.error('[QueryOptimization] Cursor error:', error.message);
    throw error;
  }
};

/**
 * Stream large payment result sets using cursor
 */
const streamPaymentsCursor = (filter, batchSize = 1000) => {
  try {
    return Payment.find(filter).batchSize(batchSize).cursor();
  } catch (error) {
    console.error('[QueryOptimization] Cursor error:', error.message);
    throw error;
  }
};

/**
 * DISPUTE OPTIMIZATIONS
 */

/**
 * Get disputes with resolution statistics
 */
const getDisputeStatisticsAggregation = async (month) => {
  try {
    return await BillDispute.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          averageResolutionTime: {
            $avg: {
              $cond: [
                { $ne: ['$resolvedAt', null] },
                { $subtract: ['$resolvedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  } catch (error) {
    console.error('[QueryOptimization] Dispute stats error:', error.message);
    throw error;
  }
};

/**
 * Get active disputes needing resolution
 */
const getActiveDisputesOptimized = async (options = {}) => {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  try {
    const disputes = await BillDispute.find({ status: 'OPEN' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await BillDispute.countDocuments({ status: 'OPEN' });

    return {
      disputes,
      total,
      page,
      limit,
      hasMore: skip + limit < total
    };
  } catch (error) {
    console.error('[QueryOptimization] Active disputes error:', error.message);
    throw error;
  }
};

module.exports = {
  // Bill aggregations
  getBillsWithAggregation,
  getOverdueBillsOptimized,

  // Payment aggregations
  getRevenueByMonthAggregation,
  getPaymentMethodDistribution,
  getCustomerPaymentHistoryOptimized,

  // Batch operations
  updateBillsStatusBatch,
  updateCustomerStatusBatch,
  createNotificationsBatch,

  // Cursor-based streaming
  streamBillsCursor,
  streamPaymentsCursor,

  // Dispute optimizations
  getDisputeStatisticsAggregation,
  getActiveDisputesOptimized
};
