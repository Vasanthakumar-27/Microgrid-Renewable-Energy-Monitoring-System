const Bill = require('../models/billModel');
const Customer = require('../models/customerModel');
const Payment = require('../models/paymentModel');
const BillDispute = require('../models/billDisputeModel');
const Notification = require('../models/notificationModel');
const config = require('../config/appConfig');

// Try to load UsageLog if it exists
let UsageLog;
try {
  UsageLog = require('../models/usageLogModel');
} catch (error) {
  UsageLog = null;
}

const createIndexes = async () => {
  try {
    console.log('[Indexing] Creating database indexes...');

    // BILL MODEL INDEXES
    console.log('[Indexing] BillModel indexes...');
    await Bill.collection.createIndex({ customerId: 1, month: 1 }, { name: 'bill_customer_month' });
    await Bill.collection.createIndex({ month: 1 }, { name: 'bill_month' });
    await Bill.collection.createIndex({ status: 1, dueDate: 1 }, { name: 'bill_status_duedate' });
    await Bill.collection.createIndex({ createdAt: -1 }, { name: 'bill_createdat' });

    // CUSTOMER MODEL INDEXES
    console.log('[Indexing] CustomerModel indexes...');
    await Customer.collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'customer_email_unique' });
    await Customer.collection.createIndex({ accountId: 1 }, { name: 'customer_accountid' });
    await Customer.collection.createIndex({ status: 1 }, { name: 'customer_status' });
    await Customer.collection.createIndex({ createdAt: -1 }, { name: 'customer_createdat' });

    // PAYMENT MODEL INDEXES
    console.log('[Indexing] PaymentModel indexes...');
    await Payment.collection.createIndex({ customerId: 1, month: 1 }, { name: 'payment_customer_month' });
    await Payment.collection.createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true, name: 'payment_razorpay_unique' });
    await Payment.collection.createIndex({ date: -1 }, { name: 'payment_date' });
    await Payment.collection.createIndex({ status: 1, date: 1 }, { name: 'payment_status_date' });
    await Payment.collection.createIndex({ method: 1 }, { name: 'payment_method' });

    // BILL DISPUTE MODEL INDEXES
    console.log('[Indexing] BillDisputeModel indexes...');
    await BillDispute.collection.createIndex({ customerId: 1, month: 1, status: 1 }, { name: 'dispute_customer_month_status' });
    await BillDispute.collection.createIndex({ status: 1 }, { name: 'dispute_status' });
    await BillDispute.collection.createIndex({ resolvedAt: -1 }, { name: 'dispute_resolvedat' });
    await BillDispute.collection.createIndex({ createdAt: -1 }, { name: 'dispute_createdat' });

    // NOTIFICATION MODEL INDEXES
    console.log('[Indexing] NotificationModel indexes...');
    await Notification.collection.createIndex({ customerId: 1, type: 1 }, { name: 'notification_customer_type' });
    await Notification.collection.createIndex({ status: 1, createdAt: -1 }, { name: 'notification_status_createdat' });
    await Notification.collection.createIndex({ createdAt: -1 }, { name: 'notification_createdat' });
    // TTL index: auto-delete notifications after 90 days
    await Notification.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000, name: 'notification_ttl' });

    // USAGE LOG MODEL INDEXES (if exists)
    if (UsageLog.collection) {
      console.log('[Indexing] UsageLogModel indexes...');
      await UsageLog.collection.createIndex({ userId: 1, timestamp: -1 }, { name: 'usagelog_userid_timestamp' });
      await UsageLog.collection.createIndex({ action: 1 }, { name: 'usagelog_action' });
      // TTL index: auto-delete usage logs after 60 days
      await UsageLog.collection.createIndex({ timestamp: 1 }, { expireAfterSeconds: 5184000, name: 'usagelog_ttl' });
    }

    console.log('✓ [Indexing] All indexes created successfully');
    return true;
  } catch (error) {
    console.error('[Indexing] Error creating indexes:', error.message);
    // Don't throw - indexing failure shouldn't crash the app
    return false;
  }
};

const checkIndexHealth = async () => {
  try {
    console.log('[Indexing] Checking index health...');

    const collections = [
      { model: Bill, name: 'Bill' },
      { model: Customer, name: 'Customer' },
      { model: Payment, name: 'Payment' },
      { model: BillDispute, name: 'BillDispute' },
      { model: Notification, name: 'Notification' },
    ];

    const health = {};

    for (const { model, name } of collections) {
      try {
        const indexes = await model.collection.getIndexes();
        health[name] = {
          collection: model.collection.name,
          indexCount: Object.keys(indexes).length,
          indexes: Object.keys(indexes)
        };
      } catch (error) {
        health[name] = {
          collection: model.collection.name,
          error: error.message
        };
      }
    }

    console.log('[Indexing] Index health check complete');
    return health;
  } catch (error) {
    console.error('[Indexing] Error checking index health:', error.message);
    return { error: error.message };
  }
};

const getIndexStats = async (collectionName) => {
  try {
    let collection;

    switch (collectionName.toLowerCase()) {
      case 'bill':
        collection = Bill.collection;
        break;
      case 'customer':
        collection = Customer.collection;
        break;
      case 'payment':
        collection = Payment.collection;
        break;
      case 'dispute':
      case 'billdispute':
        collection = BillDispute.collection;
        break;
      case 'notification':
        collection = Notification.collection;
        break;
      default:
        throw new Error(`Unknown collection: ${collectionName}`);
    }

    const stats = await collection.stats();
    const indexes = await collection.getIndexes();

    return {
      collection: collectionName,
      documentCount: stats.count,
      avgDocumentSize: stats.avgObjSize,
      totalSize: stats.size,
      indexCount: Object.keys(indexes).length,
      indexes: Object.keys(indexes),
      indexSizes: stats.indexSizes || {}
    };
  } catch (error) {
    return {
      collection: collectionName,
      error: error.message
    };
  }
};

const getAllIndexStats = async () => {
  try {
    const collections = ['Bill', 'Customer', 'Payment', 'BillDispute', 'Notification'];
    const stats = {};

    for (const collectionName of collections) {
      stats[collectionName] = await getIndexStats(collectionName);
    }

    return stats;
  } catch (error) {
    return { error: error.message };
  }
};

const dropIndexesByName = async (collectionName, indexName) => {
  try {
    let collection;

    switch (collectionName.toLowerCase()) {
      case 'bill':
        collection = Bill.collection;
        break;
      case 'customer':
        collection = Customer.collection;
        break;
      case 'payment':
        collection = Payment.collection;
        break;
      case 'dispute':
      case 'billdispute':
        collection = BillDispute.collection;
        break;
      case 'notification':
        collection = Notification.collection;
        break;
      default:
        throw new Error(`Unknown collection: ${collectionName}`);
    }

    await collection.dropIndex(indexName);
    console.log(`✓ [Indexing] Dropped index: ${collectionName}.${indexName}`);
    return true;
  } catch (error) {
    console.error(`[Indexing] Error dropping index: ${error.message}`);
    return false;
  }
};

module.exports = {
  createIndexes,
  checkIndexHealth,
  getIndexStats,
  getAllIndexStats,
  dropIndexesByName
};
