const {
  customers,
} = require("../data/energyData");
const operatorStore = require("../data/operatorStore");
const { getAlertsData } = require("./alertController");
const simulator = require("../data/simulator");
const EnergyLog = require("../models/energyLogModel");
const Payment = require("../models/paymentModel");
const {
  ensureMonthlyBill,
  ensureBillsForYear,
  getBillHistory,
  currentMonthKey,
} = require("../data/billingStore");
const { logAudit } = require("../data/auditLogStore");
const CURRENCY = "INR";

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

async function getTargetOperator(req) {
  const operatorId = req.user?.operatorId || req.query.operatorId;
  return operatorStore.getOperatorById(operatorId, { fallbackFirst: true });
}

function normalizeAssignedGridIds(assignedMicrogrids = []) {
  return operatorStore.toGridNumbers(assignedMicrogrids);
}

function roundToTwo(value) {
  return Number(value.toFixed(2));
}

async function ensureCurrentMonthlyBill(customer) {
  await ensureBillsForYear(customer, new Date().getFullYear());
  const monthKey = currentMonthKey();
  return ensureMonthlyBill(customer, monthKey);
}

const createCustomer = async (req, res) => {
  const {
    name,
    password,
    phone,
    location,
    gridId,
    energyUsage,
    energyGenerated,
    billAmount,
    paymentStatus,
  } = req.body;

  if (!name || !password || !phone || !location) {
    return res.status(400).json({
      message: "name, password, phone and location are required",
    });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ message: "phone must be 10-15 digits" });
  }

  if (req.body?.email && !isValidEmail(req.body.email)) {
    return res.status(400).json({ message: "email is invalid" });
  }

  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);

  if (!assignedGridNumbers.length) {
    return res.status(400).json({ message: "Operator has no assigned grids" });
  }
  const requestedGrid = Number.isFinite(Number(gridId)) && Number(gridId) > 0
    ? Number(gridId)
    : Number(assignedGridNumbers[0] || 1);

  if (!assignedGridNumbers.includes(requestedGrid)) {
    return res.status(403).json({
      message: "Selected grid is not assigned to this operator",
    });
  }

  const username = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const newCustomer = {
    id: `cust-${Date.now()}`,
    username: username || `customer-${Date.now()}`,
    password,
    name,
    phone,
    email: req.body?.email ? String(req.body.email).trim() : undefined,
    location,
    gridId: requestedGrid,
    energyUsage: energyUsage ?? 0,
    energyGenerated: energyGenerated ?? 0,
    billAmount: billAmount ?? 0,
    paymentStatus: paymentStatus || "pending",
  };

  customers.push(newCustomer);
  await operatorStore.addCustomerToOperator(targetOperator.id, newCustomer.id);

  await logAudit({
    actorRole: req.user?.role || "operator",
    actorId: targetOperator.id,
    action: "CUSTOMER_CREATED",
    targetType: "customer",
    targetId: newCustomer.id,
    metadata: { gridId: newCustomer.gridId },
  });

  return res.status(201).json({
    message: "Customer created successfully",
    customer: newCustomer,
    operatorId: targetOperator.id,
  });
};

const getOperatorMicrogrids = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);
  const liveGrids = simulator.getData();

  const assignedMicrogrids = liveGrids
    .filter((grid) => assignedGridNumbers.includes(Number(grid.gridId)))
    .map((grid) => ({
      id: `mg-${grid.gridId}`,
      gridId: grid.gridId,
      energyGenerated: grid.energyGenerated,
      consumption: grid.consumption,
      batteryLevel: grid.batteryLevel,
      status: grid.status,
      timestamp: grid.timestamp,
    }));

  return res.status(200).json({
    operatorId: targetOperator.id,
    microgrids: assignedMicrogrids,
  });
};

const getOperatorAlerts = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);
  const alerts = await getAlertsData({ gridIds: assignedGridNumbers });

  return res.status(200).json(alerts);
};

const getOperatorMaintenance = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);
  const liveGrids = simulator
    .getData()
    .filter((grid) => assignedGridNumbers.includes(Number(grid.gridId)));

  const maintenanceItems = liveGrids
    .filter((grid) => grid.batteryLevel < 30 || grid.status === "critical")
    .map((grid) => ({
      gridId: grid.gridId,
      issue:
        grid.batteryLevel < 30
          ? "Battery below 30% - maintenance needed"
          : "Grid critical status - inspect immediately",
      status: grid.batteryLevel < 15 || grid.status === "critical" ? "urgent" : "scheduled",
      batteryLevel: grid.batteryLevel,
      timestamp: grid.timestamp,
    }));

  return res.status(200).json(maintenanceItems);
};

const getOperatorCustomers = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);

  const managedCustomers = [];
  for (const customer of customers.filter((entry) => targetOperator.customers.includes(entry.id))) {
    const bill = await ensureCurrentMonthlyBill(customer);
    const paymentHistoryCount = await Payment.countDocuments({ customerId: customer.id });
    const candidateGrid = Number(customer.gridId || assignedGridNumbers[0] || 0);

    managedCustomers.push({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "NA",
      email: customer.email || "",
      location: customer.location || "NA",
      gridId: candidateGrid,
      currency: CURRENCY,
      monthlyUsage: bill.usageUnits,
      amountDue: bill.remainingAmount,
      billedAmount: bill.calculatedAmount,
      status: bill.paymentStatus,
      paidAmount: bill.paidAmount,
      paymentHistoryCount,
    });
  }

  return res.status(200).json(managedCustomers);
};

const getOperatorCustomerBillHistory = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const customer = customers.find((entry) => entry.id === req.params.id);
  if (!customer || !targetOperator.customers.includes(customer.id)) {
    return res.status(404).json({ message: "Customer not managed by this operator" });
  }

  const limit = req.query.limit ? Number(req.query.limit) : null;
  const page = req.query.page ? Number(req.query.page) : null;
  const history = await getBillHistory(customer, { limit, page });

  return res.status(200).json({
    customer: {
      id: customer.id,
      name: customer.name,
      gridId: customer.gridId || null,
    },
    currency: CURRENCY,
    page: page || 1,
    limit: limit || null,
    history,
  });
};

const getOperatorEnergyComparison = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const comparisonType = String(req.query.type || "day").toLowerCase();
  const validTypes = ["day", "month", "year"];
  const type = validTypes.includes(comparisonType) ? comparisonType : "day";

  const assignedGridNumbers = normalizeAssignedGridIds(targetOperator.assignedMicrogrids);
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
    gridId: { $in: assignedGridNumbers },
    timestamp: { $gte: lowerBound },
  })
    .sort({ timestamp: 1 })
    .lean();

  const grouped = new Map();

  logs.forEach((log) => {
    const t = new Date(log.timestamp);
    let key;

    if (type === "day") {
      key = `${String(t.getHours()).padStart(2, "0")}:00`;
    } else if (type === "month") {
      key = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    } else {
      key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!grouped.has(key)) {
      grouped.set(key, { generation: 0, consumption: 0 });
    }

    const bucket = grouped.get(key);
    bucket.generation += Number(log.generation || 0);
    bucket.consumption += Number(log.consumption || 0);
  });

  if (!grouped.size) {
    const fallback = simulator
      .getData()
      .filter((grid) => assignedGridNumbers.includes(Number(grid.gridId)));

    const generation = fallback.reduce((sum, g) => sum + Number(g.energyGenerated || 0), 0);
    const consumption = fallback.reduce((sum, g) => sum + Number(g.consumption || 0), 0);

    return res.status(200).json({
      type,
      labels: ["Now"],
      generation: [roundToTwo(generation)],
      consumption: [roundToTwo(consumption)],
    });
  }

  const labels = Array.from(grouped.keys());
  const generation = labels.map((label) => roundToTwo(grouped.get(label).generation));
  const consumption = labels.map((label) => roundToTwo(grouped.get(label).consumption));

  return res.status(200).json({
    type,
    labels,
    generation,
    consumption,
  });
};

const updateOperatorCustomer = async (req, res) => {
  const targetOperator = await getTargetOperator(req);

  if (!targetOperator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const customer = customers.find((entry) => entry.id === req.params.id);
  if (!customer || !targetOperator.customers.includes(customer.id)) {
    return res.status(404).json({ message: "Customer not managed by this operator" });
  }

  if (req.body?.name !== undefined) {
    const nextName = String(req.body.name).trim();
    if (nextName) {
      customer.name = nextName;
    }
  }

  if (req.body?.password !== undefined) {
    const nextPassword = String(req.body.password).trim();
    if (nextPassword) {
      customer.password = nextPassword;
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

  const bill = await ensureCurrentMonthlyBill(customer);

  await logAudit({
    actorRole: req.user?.role || "operator",
    actorId: targetOperator.id,
    action: "CUSTOMER_UPDATED",
    targetType: "customer",
    targetId: customer.id,
  });

  return res.status(200).json({
    message: "Customer updated",
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "NA",
      email: customer.email || "",
      location: customer.location || "NA",
      gridId: customer.gridId || null,
      currency: CURRENCY,
      monthlyUsage: bill.usageUnits,
      amountDue: bill.remainingAmount,
      billedAmount: bill.calculatedAmount,
      status: bill.paymentStatus,
      paidAmount: bill.paidAmount,
    },
  });
};

module.exports = {
  createCustomer,
  getOperatorMicrogrids,
  getOperatorAlerts,
  getOperatorMaintenance,
  getOperatorCustomers,
  getOperatorCustomerBillHistory,
  getOperatorEnergyComparison,
  updateOperatorCustomer,
};
