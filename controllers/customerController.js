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
const { logAudit } = require("../data/auditLogStore");
const {
  createNotification,
  listNotifications,
  markNotificationRead,
} = require("../data/notificationStore");

function isValidPhone(value) {
  if (!value) {
    return false;
  }
  return /^\d{10,15}$/.test(String(value).trim());
}

function isValidEmail(value) {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

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

const updateCustomerProfile = (req, res) => {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  if (req.body?.name !== undefined) {
    const nextName = String(req.body.name).trim();
    if (nextName) {
      customer.name = nextName;
    }
  }

  if (req.body?.phone !== undefined) {
    const nextPhone = String(req.body.phone).trim();
    if (nextPhone) {
      if (!isValidPhone(nextPhone)) {
        return res.status(400).json({ message: "phone must be 10-15 digits" });
      }
      customer.phone = nextPhone;
    }
  }

  if (req.body?.email !== undefined) {
    const nextEmail = String(req.body.email).trim();
    if (nextEmail) {
      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ message: "email is invalid" });
      }
      customer.email = nextEmail;
    }
  }

  if (req.body?.location !== undefined) {
    const nextLocation = String(req.body.location).trim();
    if (nextLocation) {
      customer.location = nextLocation;
    }
  }

  if (req.body?.password !== undefined) {
    const nextPassword = String(req.body.password).trim();
    if (nextPassword) {
      customer.password = nextPassword;
    }
  }

  return res.status(200).json({
    message: "Profile updated",
    customer,
  });
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
  const limit = req.query.limit ? Number(req.query.limit) : null;
  const page = req.query.page ? Number(req.query.page) : null;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const currentMonth = currentMonthKey();
  await ensureMonthlyBill(customer, currentMonth);

  const history = await getBillHistory(customer, {
    year: yearFilter,
    limit,
    page,
  });

  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    year: yearFilter,
    page: page || 1,
    limit: limit || null,
    history,
    bills: history,
  });
};

const getCustomerPaymentHistory = async (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : null;
  const page = req.query.page ? Number(req.query.page) : null;
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const payments = await getPaymentHistory(customer.id, { limit, page });

  return res.status(200).json({
    customerId: customer.id,
    customerName: customer.name,
    currency: CURRENCY,
    page: page || 1,
    limit: limit || null,
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

  let payment;
  try {
    payment = await applyPayment(customer, monthKey, amount, req.body.method || "ONLINE");
  } catch (error) {
    return res.status(400).json({ message: error.message || "Payment failed" });
  }
  const monthlyBill = payment.bill;
  const appliedAmount = payment.appliedAmount;
  const paymentRecord = payment.paymentRecord;

  const capped = Number(appliedAmount) < Number(amount);

  await logAudit({
    actorRole: req.user?.role || "customer",
    actorId: customer.id,
    action: "PAYMENT_MADE",
    targetType: "bill",
    targetId: `${customer.id}:${monthKey}`,
    metadata: {
      requestedAmount: amount,
      appliedAmount,
      method: paymentRecord.method,
      currency: CURRENCY,
      capped,
    },
  });

  await createNotification({
    userId: customer.id,
    role: "customer",
    title: "Payment received",
    message: `Payment of INR ${appliedAmount.toFixed(2)} applied for ${monthKey}.`,
    type: capped ? "WARNING" : "SUCCESS",
  });

  return res.status(200).json({
    message: "Payment processed",
    customerId: customer.id,
    month: monthKey,
    currency: CURRENCY,
    requestedAmount: amount,
    appliedAmount,
    capped,
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

const getCustomerNotifications = async (req, res) => {
  const { id } = req.params;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);

  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const rows = await listNotifications(customer.id, { limit, page });
  return res.status(200).json({
    customerId: customer.id,
    page,
    limit,
    notifications: rows,
  });
};

const markCustomerNotificationRead = async (req, res) => {
  const { id, notificationId } = req.params;
  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const updated = await markNotificationRead(customer.id, notificationId);
  if (!updated) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.status(200).json({ message: "Notification marked as read" });
};

module.exports = {
  getCustomerEnergyComparison,
  getCustomerBillSummary,
  getCustomerById,
  updateCustomerProfile,
  getCustomerUsage,
  getCustomerBill,
  getCustomerBillHistory,
  getCustomerBillComparison,
  getCustomerPaymentHistory,
  getCustomerReminders,
  getCustomerNotifications,
  markCustomerNotificationRead,
  makeCustomerPayment,
};
