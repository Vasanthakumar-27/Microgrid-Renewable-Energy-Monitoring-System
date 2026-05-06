const { customers } = require("../data/energyData");
const EnergyLog = require("../models/energyLogModel");
const {
  CURRENCY,
  currentMonthKey,
  validateMonthKey,
  ensureMonthlyBill,
  getBillHistory,
  applyPayment,
  getPaymentHistory,
} = require("../data/billingStore");
const { roundToTwo } = require("../data/globalRules");

const getMonthKeyFromQuery = (value) => validateMonthKey(value);

const getCustomerEnergyComparison = async (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const comparisonType = String(req.query.type || "day").toLowerCase();
  const type = ["day", "month", "year"].includes(comparisonType) ? comparisonType : "day";
  const gridId = Number(customer.gridId || 1);

  const now = new Date();
  const lowerBound = new Date(now);
  if (type === "day") {
    lowerBound.setHours(now.getHours() - 23, 0, 0, 0);
  } else if (type === "month") {
    lowerBound.setDate(now.getDate() - 29);
    lowerBound.setHours(0, 0, 0, 0);
  } else {
    lowerBound.setMonth(now.getMonth() - 11, 1);
    lowerBound.setHours(0, 0, 0, 0);
  }

  const logs = await EnergyLog.find({
    gridId,
    timestamp: { $gte: lowerBound },
  })
    .sort({ timestamp: 1 })
    .lean();

  const grouped = new Map();
  logs.forEach((log) => {
    const t = new Date(log.timestamp);
    const key =
      type === "day"
        ? `${String(t.getHours()).padStart(2, "0")}:00`
        : type === "month"
          ? `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
          : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;

    if (!grouped.has(key)) {
      grouped.set(key, { generation: 0, consumption: 0 });
    }

    const bucket = grouped.get(key);
    bucket.generation += Number(log.generation || 0);
    bucket.consumption += Number(log.consumption || 0);
  });

  const labels = Array.from(grouped.keys());
  const generation = labels.map((label) => roundToTwo(grouped.get(label).generation));
  const consumption = labels.map((label) => roundToTwo(grouped.get(label).consumption));

  return res.status(200).json({
    customerId: customer.id,
    gridId,
    type,
    labels,
    generation,
    consumption,
  });
};

const getCustomerBillSummary = async (req, res) => {
  const { id } = req.params;
  const monthKey = getMonthKeyFromQuery(req.query.month);

  if (!monthKey) {
    return res.status(400).json({ message: "month must be in YYYY-MM format" });
  }

  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const monthlyBill = await ensureMonthlyBill(customer, monthKey);
  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    month: monthKey,
    currency: CURRENCY,
    usage: monthlyBill.usageUnits,
    usageRate: monthlyBill.pricingModel.rate,
    fixedCharge: monthlyBill.pricingModel.fixedCharge,
    subtotal: roundToTwo(monthlyBill.usageUnits * monthlyBill.pricingModel.rate),
    totalAmount: monthlyBill.calculatedAmount,
    paidAmount: monthlyBill.paidAmount,
    remainingAmount: monthlyBill.remainingAmount,
    paymentStatus: monthlyBill.paymentStatus,
  });
};

const getCustomerById = (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  return res.status(200).json(customer);
};

const getCustomerUsage = (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  return res.status(200).json({
    customerId: customer.id,
    energyUsage: customer.energyUsage,
    energyGenerated: customer.energyGenerated,
  });
};

const getCustomerBill = async (req, res) => {
  const { id } = req.params;
  const monthKey = getMonthKeyFromQuery(req.query.month);

  if (!monthKey) {
    return res.status(400).json({ message: "month must be in YYYY-MM format" });
  }

  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const monthlyBill = await ensureMonthlyBill(customer, monthKey);

  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    month: monthKey,
    renewablePercentage: 0,
    bill: monthlyBill,
  });
};

const getCustomerBillHistory = async (req, res) => {
  const { id } = req.params;
  const yearFilter = req.query.year ? Number(req.query.year) : null;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const currentMonth = currentMonthKey();
  await ensureMonthlyBill(customer, currentMonth);

  const history = await getBillHistory(customer, { year: yearFilter });

  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    year: yearFilter,
    history,
    bills: history,
  });
};

const getCustomerPaymentHistory = async (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const payments = await getPaymentHistory(customer.id);

  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    currency: CURRENCY,
    payments,
  });
};

const getCustomerBillComparison = async (req, res) => {
  const { id } = req.params;
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const monthKeys = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const monthlyBills = [];
  for (const monthKey of monthKeys) {
    monthlyBills.push(await ensureMonthlyBill(customer, monthKey));
  }
  const selectedMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  const selectedMonthBill = await ensureMonthlyBill(customer, selectedMonthKey);

  const dailyLabels = Array.from({ length: 30 }, (_, index) => String(index + 1));
  const dailyUsage = dailyLabels.map((day) => {
    const dayFactor = 0.65 + ((Number(day) % 7) * 0.06);
    return roundToTwo((selectedMonthBill.usageUnits / 30) * dayFactor);
  });

  const dailyAmounts = dailyUsage.map((usageUnits) =>
    roundToTwo((usageUnits / selectedMonthBill.usageUnits) * selectedMonthBill.calculatedAmount)
  );

  const yearlyLabels = [year - 2, year - 1, year].map(String);
  const yearlyAmounts = [];
  for (const yearLabel of yearlyLabels) {
    const keys = Array.from({ length: 12 }, (_, index) => `${yearLabel}-${String(index + 1).padStart(2, "0")}`);
    let total = 0;
    for (const key of keys) {
      const bill = await ensureMonthlyBill(customer, key);
      total += Number(bill.calculatedAmount || 0);
    }
    yearlyAmounts.push(roundToTwo(total));
  }

  return res.status(200).json({
    customerId: customer.id,
    selectedMonth: selectedMonthKey,
    dailyComparison: {
      labels: dailyLabels,
      usage: dailyUsage,
      amount: dailyAmounts,
    },
    monthlyComparison: {
      labels: monthKeys.map((key) => key.split("-")[1]),
      usage: monthlyBills.map((entry) => entry.usageUnits),
      amount: monthlyBills.map((entry) => entry.calculatedAmount),
    },
    yearlyComparison: {
      labels: yearlyLabels,
      amount: yearlyAmounts,
    },
  });
};

const makeCustomerPayment = async (req, res) => {
  const { customerId, amount, month, currency } = req.body;
  const monthKey = getMonthKeyFromQuery(month);

  if (!customerId || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ message: "customerId and positive numeric amount are required" });
  }

  if (!monthKey) {
    return res.status(400).json({ message: "month must be in YYYY-MM format" });
  }

  if (currency && String(currency).toUpperCase() !== CURRENCY) {
    return res.status(400).json({ message: "Only INR payments are supported" });
  }

  const customer = customers.find((entry) => entry.id === customerId);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const payment = await applyPayment(customer, monthKey, amount, req.body.method || "ONLINE");
  const monthlyBill = payment.bill;
  const appliedAmount = payment.appliedAmount;
  const paymentRecord = payment.paymentRecord;

  return res.status(200).json({
    message: "Payment processed",
    customerId: customer.id,
    month: monthKey,
    currency: CURRENCY,
    appliedAmount,
    remainingBillAmount: monthlyBill.remainingAmount,
    paymentStatus: monthlyBill.paymentStatus,
    paymentRecord,
    bill: monthlyBill,
  });
};

const getCustomerReminders = async (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const monthKey = currentMonthKey();
  const bill = await ensureMonthlyBill(customer, monthKey);

  const reminders = [];
  if (bill.remainingAmount > 0) {
    reminders.push({
      type: "PAYMENT_PENDING",
      message: `Payment pending for ${monthKey}. Remaining INR ${bill.remainingAmount}.`,
      severity: "warning",
    });
  }

  return res.status(200).json({
    customerId: customer.id,
    month: monthKey,
    currency: CURRENCY,
    reminders,
  });
};

module.exports = {
  getCustomerEnergyComparison,
  getCustomerBillSummary,
  getCustomerById,
  getCustomerUsage,
  getCustomerBill,
  getCustomerBillHistory,
  getCustomerBillComparison,
  getCustomerPaymentHistory,
  getCustomerReminders,
  makeCustomerPayment,
};
