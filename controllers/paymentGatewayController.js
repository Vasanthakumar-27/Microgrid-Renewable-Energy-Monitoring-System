const paymentService = require('../services/paymentService');
const paymentStore = require('../data/paymentStore');
const notificationStore = require('../data/notificationStore');
const auditLog = require('../data/auditLogStore');
const config = require('../config/appConfig');

// Create payment order
const createPaymentOrder = async (req, res) => {
  try {
    const { customerId, amount, billMonth } = req.body;

    // Validation
    if (!customerId || !amount || !billMonth) {
      return res.status(400).json({
        success: false,
        message: 'customerId, amount, and billMonth are required'
      });
    }

    if (amount <= 0 || amount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between 1 and 100000'
      });
    }

    // Create order via Razorpay
    const order = await paymentService.createOrder(
      customerId,
      amount,
      billMonth,
      `Bill Payment - ${billMonth}`
    );

    console.log(`[Payment] Order created for customer ${customerId}: ${order.orderId}`);

    // Log action
    await auditLog.log({
      role: req.user?.role || 'system',
      action: 'CREATE_PAYMENT_ORDER',
      entityType: 'PAYMENT',
      entityId: order.orderId,
      changes: {
        customerId,
        amount,
        billMonth,
        status: 'PENDING'
      }
    });

    return res.status(200).json({
      success: true,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: paymentService.getPublicKey(),
      description: `Bill Payment for ${billMonth}`
    });
  } catch (error) {
    console.error('[Payment] Order creation failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Order creation failed: ${error.message}`
    });
  }
};

// Handle payment webhook from Razorpay
const handlePaymentWebhook = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify webhook signature
    const isSignatureValid = paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isSignatureValid && config.razorpayKeySecret) {
      console.error('[Payment] Invalid webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    console.log(`[Payment] Webhook received: order=${razorpay_order_id}, payment=${razorpay_payment_id}`);

    // Fetch payment details
    const paymentDetails = await paymentService.fetchPaymentDetails(razorpay_payment_id);

    if (paymentDetails.status !== 'captured') {
      return res.status(200).json({
        success: false,
        message: 'Payment not captured'
      });
    }

    // Parse order receipt to get customerId and billMonth
    const receipt = paymentDetails.receipt || '';
    const match = receipt.match(/bill_(.+?)_(.+)$/);
    
    if (!match) {
      console.error('[Payment] Could not parse receipt:', receipt);
      return res.status(200).json({
        success: false,
        message: 'Invalid receipt format'
      });
    }

    const customerId = match[1];
    const billMonth = match[2];
    const amount = paymentDetails.amount / 100; // Convert from paise to INR

    console.log(`[Payment] Processing payment: customer=${customerId}, month=${billMonth}, amount=${amount}`);

    // Record payment in database
    const payment = await paymentStore.recordPayment({
      customerId,
      billMonth,
      amount,
      method: 'RAZORPAY',
      status: 'PAID',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      transactionDate: new Date(),
      notes: 'Payment received via Razorpay'
    });

    console.log(`[Payment] Payment recorded: ${payment.id}`);

    // Create payment receipt notification
    await notificationStore.createNotification({
      userId: customerId,
      role: 'customer',
      title: 'Payment Received',
      message: `Payment of ₹${amount} received for ${billMonth}`,
      type: 'PAYMENT_RECEIPT',
      email: paymentDetails.email,
      billData: {
        amount,
        method: 'RAZORPAY',
        transactionId: razorpay_payment_id
      }
    });

    // Log action
    await auditLog.log({
      role: 'system',
      action: 'PAYMENT_RECEIVED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      changes: {
        customerId,
        amount,
        billMonth,
        razorpayPaymentId: razorpay_payment_id,
        status: 'PAID'
      }
    });

    console.log(`[Payment] ✓ Payment processed successfully`);

    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      paymentId: payment.id,
      amount: amount
    });
  } catch (error) {
    console.error('[Payment] Webhook processing failed:', error.message);
    
    // Always return 200 to Razorpay to prevent retries
    return res.status(200).json({
      success: false,
      message: error.message
    });
  }
};

// Verify payment (manual verification)
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify signature
    const isValid = paymentService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid && config.razorpayKeySecret) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Fetch payment details
    const paymentDetails = await paymentService.fetchPaymentDetails(razorpayPaymentId);

    return res.status(200).json({
      success: true,
      payment: {
        id: paymentDetails.id,
        amount: paymentDetails.amount / 100,
        currency: paymentDetails.currency,
        status: paymentDetails.status,
        method: paymentDetails.method,
        email: paymentDetails.email
      }
    });
  } catch (error) {
    console.error('[Payment] Verification failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Verification failed: ${error.message}`
    });
  }
};

// Refund payment (admin only)
const refundPaymentEndpoint = async (req, res) => {
  try {
    const { razorpayPaymentId, amount, reason } = req.body;

    if (!razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'razorpayPaymentId is required'
      });
    }

    // Process refund
    const refund = await paymentService.refundPayment(
      razorpayPaymentId,
      amount,
      reason || 'Refund processed'
    );

    // Log action
    await auditLog.log({
      role: req.user?.role || 'admin',
      action: 'PAYMENT_REFUNDED',
      entityType: 'PAYMENT',
      entityId: razorpayPaymentId,
      changes: {
        refundId: refund.id || refund.refundId,
        amount: amount || 'full',
        reason: reason || 'N/A'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refundId: refund.id || refund.refundId
    });
  } catch (error) {
    console.error('[Payment] Refund failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Refund failed: ${error.message}`
    });
  }
};

// Get payment configuration
const getPaymentConfig = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      razorpayEnabled: paymentService.isEnabled(),
      publicKey: paymentService.getPublicKey(),
      supportedMethods: ['RAZORPAY', 'OFFLINE_CASH', 'CHEQUE', 'BANK_TRANSFER', 'E_WALLET']
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createPaymentOrder,
  handlePaymentWebhook,
  verifyPayment,
  refundPaymentEndpoint,
  getPaymentConfig
};
