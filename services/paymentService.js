const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/appConfig');

let razorpay;

// Initialize Razorpay only if credentials are provided
if (config.razorpayKeyId && config.razorpayKeySecret) {
  razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret
  });
} else {
  console.warn('[Razorpay] Not initialized - missing API credentials. Using mock mode.');
}

const paymentService = {
  // Check if Razorpay is enabled and configured
  isEnabled: () => {
    return !!razorpay;
  },

  // Create Razorpay order
  async createOrder(customerId, amount, billMonth, description = '') {
    try {
      if (!razorpay) {
        // Mock mode for testing without credentials
        return {
          success: true,
          orderId: `order_${Date.now()}_mock`,
          amount: Math.round(amount * 100),
          currency: 'INR',
          mock: true,
          message: 'Mock order created (Razorpay not configured)'
        };
      }

      const options = {
        amount: Math.round(amount * 100), // Amount in paise
        currency: 'INR',
        receipt: `bill_${customerId}_${billMonth}`,
        notes: {
          customerId,
          billMonth,
          description: description || `Bill Payment - ${billMonth}`
        }
      };

      const order = await razorpay.orders.create(options);
      
      console.log(`✓ [Razorpay] Order created: ${order.id}`);
      return {
        success: true,
        orderId: order.id,
        amount: order.amount / 100, // Convert back to INR
        currency: order.currency,
        clientOrderId: order.receipt,
        receipt: order.receipt
      };
    } catch (error) {
      console.error(`✗ [Razorpay] Failed to create order:`, error.message);
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  },

  // Verify payment signature (security critical)
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      if (!config.razorpayKeySecret) {
        console.warn('[Razorpay] No key secret for signature verification - using mock');
        return true; // Mock mode
      }

      const shasum = crypto.createHmac('sha256', config.razorpayKeySecret);
      shasum.update(`${orderId}|${paymentId}`);
      const digest = shasum.digest('hex');

      const isValid = digest === signature;
      console.log(`[Razorpay] Signature verification: ${isValid ? '✓' : '✗'}`);
      return isValid;
    } catch (error) {
      console.error('✗ [Razorpay] Signature verification error:', error.message);
      return false;
    }
  },

  // Fetch payment details from Razorpay
  async fetchPaymentDetails(paymentId) {
    try {
      if (!razorpay) {
        return {
          mock: true,
          id: paymentId,
          status: 'captured',
          message: 'Mock payment details'
        };
      }

      const payment = await razorpay.payments.fetch(paymentId);
      console.log(`✓ [Razorpay] Fetched payment: ${paymentId}`);
      return payment;
    } catch (error) {
      console.error(`✗ [Razorpay] Failed to fetch payment ${paymentId}:`, error.message);
      throw error;
    }
  },

  // Capture payment (for authorized payments)
  async capturePayment(paymentId, amount) {
    try {
      if (!razorpay) {
        return { success: true, mock: true };
      }

      const capturedPayment = await razorpay.payments.capture(paymentId, amount);
      console.log(`✓ [Razorpay] Payment captured: ${paymentId}`);
      return capturedPayment;
    } catch (error) {
      console.error(`✗ [Razorpay] Failed to capture payment:`, error.message);
      throw error;
    }
  },

  // Refund payment
  async refundPayment(paymentId, amount, reason = '') {
    try {
      if (!razorpay) {
        return { success: true, mock: true, refundId: `refund_${Date.now()}` };
      }

      const options = {};
      if (amount) options.amount = Math.round(amount * 100);
      if (reason) options.notes = { reason };

      const refund = await razorpay.payments.refund(paymentId, options);
      console.log(`✓ [Razorpay] Refund processed: ${refund.id}`);
      return refund;
    } catch (error) {
      console.error(`✗ [Razorpay] Failed to refund payment:`, error.message);
      throw error;
    }
  },

  // Get Razorpay key for frontend
  getPublicKey: () => {
    return config.razorpayKeyId || 'test_key_mock';
  }
};

module.exports = paymentService;
