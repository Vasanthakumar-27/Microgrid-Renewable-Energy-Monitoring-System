const express = require('express');
const { authRequired } = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleMiddleware');

const {
  createPaymentOrder,
  handlePaymentWebhook,
  verifyPayment,
  refundPaymentEndpoint,
  getPaymentConfig
} = require('../controllers/paymentGatewayController');

const router = express.Router();

// Public endpoints (no auth required for webhook)
router.get('/config', getPaymentConfig);
router.post('/webhook', handlePaymentWebhook); // Razorpay webhook (webhook IP verification in production)

// Customer endpoints (auth required)
router.post('/order', authRequired, roleCheck('customer'), createPaymentOrder);
router.post('/verify', authRequired, roleCheck('customer'), verifyPayment);

// Admin endpoints
router.post('/refund', authRequired, roleCheck('admin'), refundPaymentEndpoint);

module.exports = router;
