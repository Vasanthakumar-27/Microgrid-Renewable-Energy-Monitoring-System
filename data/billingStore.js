const { getBillingRates } = require("./billingConfig");
const {
  roundToTwo,
  computeBillAmount,
} = require("./globalRules");
const Bill = require("../models/billModel");
const Payment = require("../models/paymentModel");

const CURRENCY = "INR";
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function validateMonthKey(value) {
  if (!value) {
    return currentMonthKey();
  }

  return monthPattern.test(value) ? value : null;
}

function deterministicFactor(seed, min, max) {
  let hash = 0;
  const source = String(seed);
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }

  const normalized = (Math.abs(hash) % 1000) / 1000;
  return min + ((max - min) * normalized);
}

function toPlainBill(doc) {
  if (!doc) {
    return null;
  }

  return {
    month: doc.month,
    currency: doc.currency || CURRENCY,
    usageUnits: doc.usageUnits,
    pricingModel: doc.pricingModel,
    billBreakdown: doc.billBreakdown,
    calculatedAmount: doc.calculatedAmount,
    paidAmount: doc.paidAmount,
    remainingAmount: doc.remainingAmount,
    paymentStatus: doc.paymentStatus,
    updatedAt: doc.updatedAt,
  };
}

async function ensureMonthlyBill(customer, monthKey, options = {}) {
  const existing = await Bill.findOne({ customerId: customer.id, month: monthKey }).lean();
  if (existing) {
    return toPlainBill(existing);
  }

  const rates = getBillingRates();
  const seededUsage = Number(customer.energyUsage || 0) * deterministicFactor(`${customer.id}-${monthKey}`, 0.75, 1.2);
  const usageUnits = roundToTwo(Math.max(1, Number(options.usageUnits ?? seededUsage)));
  const rate = roundToTwo(Number(options.rate ?? rates.offPeakRate));
  const fixedCharge = roundToTwo(Number(options.fixedCharge ?? rates.fixedCharge));
  const calculatedAmount = computeBillAmount(usageUnits, rate, fixedCharge);

  const monthlyBill = new Bill({
    customerId: customer.id,
    month: monthKey,
    currency: CURRENCY,
    usageUnits,
    pricingModel: {
      rate,
      fixedCharge,
      formula: "consumption * rate + fixed_charge",
      configuredPeakRate: rates.peakRate,
      configuredOffPeakRate: rates.offPeakRate,
      configuredRenewableDiscountPercent: rates.renewableDiscountPercent,
      configuredRenewableDiscountThreshold: rates.renewableDiscountThreshold,
    },
    billBreakdown: {
      consumption: usageUnits,
      rate,
      fixedCharge,
      finalBill: calculatedAmount,
    },
    calculatedAmount,
    paidAmount: 0,
    remainingAmount: calculatedAmount,
    paymentStatus: calculatedAmount === 0 ? "paid" : "pending",
  });

  await monthlyBill.save();
  customer.billAmount = monthlyBill.remainingAmount;
  customer.paymentStatus = monthlyBill.paymentStatus;

  return toPlainBill(monthlyBill);
}

async function ensureBillsForYear(customer, year) {
  for (let month = 1; month <= 12; month += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    await ensureMonthlyBill(customer, key);
  }
}

async function getBillHistory(customer, options = {}) {
  const yearFilter = options.year ? Number(options.year) : null;
  const query = { customerId: customer.id };

  if (yearFilter && Number.isInteger(yearFilter)) {
    query.month = { $regex: `^${yearFilter}-` };
  }

  let cursor = Bill.find(query).sort({ month: -1 });

  if (options.limit) {
    cursor = cursor.limit(Number(options.limit));
  }

  const docs = await cursor.lean();
  return docs.map(toPlainBill);
}

async function applyPayment(customer, monthKey, amount, method = "ONLINE") {
  const bill = await ensureMonthlyBill(customer, monthKey);
  const normalizedAmount = Number(amount || 0);
  const appliedAmount = roundToTwo(Math.min(normalizedAmount, bill.remainingAmount));

  const paidAmount = roundToTwo(Number(bill.paidAmount || 0) + appliedAmount);
  const remainingAmount = roundToTwo(Math.max(0, Number(bill.calculatedAmount || 0) - paidAmount));
  const paymentStatus = remainingAmount === 0 ? "paid" : "pending";

  const updatedBill = await Bill.findOneAndUpdate(
    { customerId: customer.id, month: monthKey },
    {
      $set: {
        paidAmount,
        remainingAmount,
        paymentStatus,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  customer.billAmount = Number(updatedBill?.remainingAmount || 0);
  customer.paymentStatus = String(updatedBill?.paymentStatus || "pending");

  const paymentRecord = {
    paymentId: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerId: customer.id,
    month: monthKey,
    amount: appliedAmount,
    currency: CURRENCY,
    status: "PAID",
    method,
    date: new Date(),
  };

  await Payment.create(paymentRecord);

  return {
    bill: toPlainBill(updatedBill),
    appliedAmount,
    paymentRecord: {
      id: paymentRecord.paymentId,
      customerId: paymentRecord.customerId,
      month: paymentRecord.month,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      status: paymentRecord.status,
      method: paymentRecord.method,
      date: paymentRecord.date,
    },
  };
}

async function getPaymentHistory(customerId) {
  const rows = await Payment.find({ customerId }).sort({ date: -1 }).lean();
  return rows.map((row) => ({
    id: row.paymentId,
    customerId: row.customerId,
    month: row.month,
    amount: row.amount,
    currency: row.currency || CURRENCY,
    status: row.status,
    method: row.method,
    date: row.date,
  }));
}

module.exports = {
  CURRENCY,
  currentMonthKey,
  validateMonthKey,
  ensureMonthlyBill,
  ensureBillsForYear,
  getBillHistory,
  applyPayment,
  getPaymentHistory,
};
