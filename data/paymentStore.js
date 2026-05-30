const Payment = require('../models/paymentModel');

function buildPaymentId() {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function recordPayment({
  customerId,
  billMonth,
  amount,
  method = 'RAZORPAY',
  status = 'PAID',
  razorpayOrderId = null,
  razorpayPaymentId = null,
  transactionDate = null,
  notes = ''
}) {
  if (!customerId || !billMonth || !amount) {
    throw new Error('customerId, billMonth, and amount are required');
  }

  const payment = new Payment({
    paymentId: buildPaymentId(),
    customerId: String(customerId),
    month: String(billMonth),
    amount: Number(amount),
    currency: 'INR',
    status: String(status),
    method: String(method),
    date: transactionDate || new Date(),
    razorpayOrderId: razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || null,
    notes: notes || ''
  });

  await payment.save();
  console.log(`✓ [Payment Store] Recorded: ${payment.paymentId}`);
  return payment;
}

async function getPaymentsByCustomer(customerId, { limit = 50, page = 1 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);

  const payments = await Payment.find({ customerId: String(customerId) })
    .sort({ date: -1 })
    .limit(safeLimit)
    .skip((safePage - 1) * safeLimit)
    .lean();

  return payments.map((p) => ({
    id: p.paymentId,
    customerId: p.customerId,
    month: p.month,
    amount: p.amount,
    method: p.method,
    status: p.status,
    date: p.date,
    razorpayPaymentId: p.razorpayPaymentId
  }));
}

async function getPaymentByRazorpayId(razorpayPaymentId) {
  const payment = await Payment.findOne({ razorpayPaymentId })
    .lean();

  if (!payment) return null;

  return {
    id: payment.paymentId,
    customerId: payment.customerId,
    month: payment.month,
    amount: payment.amount,
    status: payment.status,
    razorpayPaymentId: payment.razorpayPaymentId
  };
}

async function getPaymentsByMonth(billMonth) {
  const payments = await Payment.find({ month: String(billMonth) })
    .sort({ date: -1 })
    .lean();

  return payments.map((p) => ({
    id: p.paymentId,
    customerId: p.customerId,
    month: p.month,
    amount: p.amount,
    method: p.method,
    status: p.status,
    date: p.date
  }));
}

async function getTotalPaymentsForMonth(billMonth) {
  const result = await Payment.aggregate([
    { $match: { month: String(billMonth) } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (result.length === 0) {
    return { total: 0, count: 0 };
  }

  return {
    total: result[0].total,
    count: result[0].count
  };
}

async function getAllPayments({ limit = 100, page = 1 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);

  const payments = await Payment.find({})
    .sort({ date: -1 })
    .limit(safeLimit)
    .skip((safePage - 1) * safeLimit)
    .lean();

  return payments.map((p) => ({
    id: p.paymentId,
    customerId: p.customerId,
    month: p.month,
    amount: p.amount,
    method: p.method,
    status: p.status,
    date: p.date
  }));
}

module.exports = {
  recordPayment,
  getPaymentsByCustomer,
  getPaymentByRazorpayId,
  getPaymentsByMonth,
  getTotalPaymentsForMonth,
  getAllPayments
};
