const {
  company,
  customers,
} = require("../data/energyData");
const operatorStore = require("../data/operatorStore");
const {
  getBillingRates,
  getBillingRateHistory,
  updateBillingRates,
} = require("../data/billingConfig");
const {
  currentMonthKey,
  ensureMonthlyBill,
  ensureBillsForYear,
  getBillHistory,
} = require("../data/billingStore");
const TariffRate = require("../models/tariffRateModel");

const roundToTwo = (value) => Number(value.toFixed(2));
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const CURRENCY = "INR";

function toMonthKey(year, month) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth)) {
    return null;
  }

  const key = `${normalizedYear}-${String(normalizedMonth).padStart(2, "0")}`;
  return monthPattern.test(key) ? key : null;
}

function getMonthKeysForYear(year) {
  const keys = [];
  for (let month = 1; month <= 12; month += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return keys;
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

function ensureBillingData(customer, year) {
  return ensureBillsForYear(customer, year);
}

function buildDailyBreakdown(monthlyBill) {
  const days = 30;
  const labels = [];
  const usage = [];
  const amount = [];
  const dailyRate = monthlyBill.usageUnits ? monthlyBill.calculatedAmount / monthlyBill.usageUnits : 0;

  for (let day = 1; day <= days; day += 1) {
    const dailyFactor = deterministicFactor(`${monthlyBill.month}-${day}-shape`, 0.55, 1.35);
    const dayUsage = roundToTwo((monthlyBill.usageUnits / days) * dailyFactor);
    labels.push(String(day));
    usage.push(dayUsage);
    amount.push(roundToTwo(dayUsage * dailyRate));
  }

  return {
    labels,
    usage,
    amount,
  };
}

const getCompanyDashboard = (req, res) => {
  const dashboard = {
    ...company,
    netEnergy: company.totalEnergyGenerated - company.totalConsumption,
  };

  res.status(200).json(dashboard);
};

const listOperators = async (req, res) => {
  const result = await operatorStore.listOperators();
  return res.status(200).json(result);
};

const createOperator = async (req, res) => {
  const { name, password, gridCount, location } = req.body;

  try {
    const operator = await operatorStore.createOperator({
      name,
      password,
      gridCount,
      location,
    });

    return res.status(201).json({
      message: "Operator added successfully",
      operator,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const deleteOperator = async (req, res) => {
  const { id } = req.params;

  const deleted = await operatorStore.deleteOperator(id);
  if (!deleted) {
    return res.status(404).json({ message: "Operator not found" });
  }

  return res.status(200).json({
    message: "Operator removed",
    operator: deleted,
  });
};

const updateOperator = async (req, res) => {
  const { id } = req.params;

  const operator = await operatorStore.updateOperator(id, req.body || {});
  if (!operator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  return res.status(200).json({
    message: "Operator updated",
    operator,
  });
};

const listCustomers = (req, res) => {
  return res.status(200).json(
    customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
    }))
  );
};

const getBillingOverview = async (req, res) => {
  const { customerId, year, month } = req.query;

  const targetCustomer =
    customers.find((customer) => customer.id === customerId) || customers[0];

  if (!targetCustomer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const selectedYear = Number(year) || new Date().getFullYear();
  const selectedMonth = Number(month) || new Date().getMonth() + 1;
  const selectedMonthKey = toMonthKey(selectedYear, selectedMonth);

  if (!selectedMonthKey) {
    return res.status(400).json({ message: "year/month parameters are invalid" });
  }

  await ensureBillingData(targetCustomer, selectedYear);
  await ensureBillingData(targetCustomer, selectedYear - 1);
  await ensureBillingData(targetCustomer, selectedYear - 2);

  const monthKeys = getMonthKeysForYear(selectedYear);
  const monthlyComparison = {
    labels: monthKeys.map((key) => key.split("-")[1]),
    consumption: [],
    amount: [],
  };

  for (const key of monthKeys) {
    const bill = await ensureMonthlyBill(targetCustomer, key);
    monthlyComparison.consumption.push(bill.usageUnits);
    monthlyComparison.amount.push(bill.calculatedAmount);
  }

  const yearlyLabels = [selectedYear - 2, selectedYear - 1, selectedYear].map(String);
  const yearlyComparison = {
    labels: yearlyLabels,
    amount: yearlyLabels.map((yearKey) => {
      return 0;
    }),
  };

  for (let i = 0; i < yearlyComparison.labels.length; i += 1) {
    const yearKey = Number(yearlyComparison.labels[i]);
    const keys = getMonthKeysForYear(yearKey);
    let sum = 0;
    for (const key of keys) {
      const bill = await ensureMonthlyBill(targetCustomer, key);
      sum += Number(bill.calculatedAmount || 0);
    }
    yearlyComparison.amount[i] = roundToTwo(sum);
  }

  const selectedMonthBill = await ensureMonthlyBill(targetCustomer, selectedMonthKey);
  const dailyComparison = buildDailyBreakdown(selectedMonthBill);

  const billHistory = await getBillHistory(targetCustomer, { limit: 24 });

  return res.status(200).json({
    customer: {
      id: targetCustomer.id,
      name: targetCustomer.name,
    },
    currency: CURRENCY,
    selected: {
      year: selectedYear,
      month: selectedMonth,
      monthKey: selectedMonthKey,
    },
    currentMonth: {
      consumption: selectedMonthBill.usageUnits,
      amount: selectedMonthBill.calculatedAmount,
      paidAmount: selectedMonthBill.paidAmount,
      remainingAmount: selectedMonthBill.remainingAmount,
      status: selectedMonthBill.paymentStatus,
    },
    dailyComparison,
    monthlyComparison,
    yearlyComparison,
    billHistory,
  });
};

const getBillingRatesConfig = (req, res) => {
  return res.status(200).json(getBillingRates());
};

const getBillingRatesHistory = (req, res) => {
  return res.status(200).json({ history: getBillingRateHistory() });
};

const setBillingRatesConfig = (req, res) => {
  try {
    const updated = updateBillingRates(req.body || {}, {
      changedBy: req.user?.sub || "admin",
    });
    return res.status(200).json({
      message: "Billing rates updated",
      rates: updated,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getTariffRate = async (req, res) => {
  const currentRates = getBillingRates();
  const latest = await TariffRate.findOne({}).sort({ effectiveDate: -1, createdAt: -1 }).lean();

  return res.status(200).json({
    currentRate: Number(latest?.rate ?? currentRates.offPeakRate ?? 0),
    currency: String(latest?.currency || CURRENCY),
    effectiveDate: latest?.effectiveDate || null,
    changedBy: latest?.changedBy || "system",
  });
};

const setTariffRate = async (req, res) => {
  const rate = Number(req.body?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ message: "rate must be a positive number" });
  }

  try {
    updateBillingRates(
      {
        offPeakRate: rate,
        peakRate: rate,
      },
      { changedBy: req.user?.sub || "admin" }
    );

    const saved = await TariffRate.create({
      rate,
      currency: CURRENCY,
      effectiveDate: new Date(),
      changedBy: req.user?.sub || "admin",
      description: "Tariff rate update",
    });

    return res.status(200).json({
      message: "Tariff rate updated",
      rate: saved.rate,
      currency: saved.currency,
      effectiveDate: saved.effectiveDate,
      changedBy: saved.changedBy,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tariff rate" });
  }
};

const getTariffRateHistory = async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 50));
  const rows = await TariffRate.find({}).sort({ effectiveDate: -1, createdAt: -1 }).limit(limit).lean();

  return res.status(200).json({
    history: rows.map((row) => ({
      rate: Number(row.rate || 0),
      currency: row.currency || CURRENCY,
      effectiveDate: row.effectiveDate,
      changedBy: row.changedBy || "admin",
    })),
  });
};

const getBillingSummary = async (req, res) => {
  const monthKey = currentMonthKey();
  const customerBills = [];

  for (const customer of customers) {
    const bill = await ensureMonthlyBill(customer, monthKey);
    customerBills.push({
      customerId: customer.id,
      customerName: customer.name,
      month: monthKey,
      usageUnits: Number(bill.usageUnits || 0),
      calculatedAmount: Number(bill.calculatedAmount || 0),
      paidAmount: Number(bill.paidAmount || 0),
      remainingAmount: Number(bill.remainingAmount || 0),
      paymentStatus: String(bill.paymentStatus || "pending"),
    });
  }

  const pendingBills = customerBills.filter((entry) => entry.paymentStatus !== "paid").length;
  const totalRevenue = roundToTwo(
    customerBills.reduce((sum, entry) => sum + Number(entry.paidAmount || 0), 0)
  );

  return res.status(200).json({
    month: monthKey,
    currency: CURRENCY,
    totalCustomers: customers.length,
    pendingBills,
    totalRevenue,
    customerBills,
  });
};

module.exports = {
  getCompanyDashboard,
  listOperators,
  createOperator,
  deleteOperator,
  updateOperator,
  listCustomers,
  getBillingOverview,
  getBillingRatesConfig,
  getBillingRatesHistory,
  setBillingRatesConfig,
  getTariffRate,
  setTariffRate,
  getTariffRateHistory,
  getBillingSummary,
};
