const BillDispute = require("../models/billDisputeModel");
const { customers } = require("../data/energyData");
const operatorStore = require("../data/operatorStore");
const { validateMonthKey } = require("../data/billingStore");
const { logAudit } = require("../data/auditLogStore");

function buildDisputeId() {
  return `dispute-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function createDispute(req, res) {
  const { id, month } = req.params;
  const reason = String(req.body?.reason || "").trim();
  const monthKey = validateMonthKey(month);

  if (!reason) {
    return res.status(400).json({ message: "reason is required" });
  }

  if (!monthKey) {
    return res.status(400).json({ message: "month must be in YYYY-MM format" });
  }

  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const existing = await BillDispute.findOne({ customerId: id, month: monthKey, status: "OPEN" }).lean();
  if (existing) {
    return res.status(409).json({ message: "An open dispute already exists for this month" });
  }

  const dispute = await BillDispute.create({
    disputeId: buildDisputeId(),
    customerId: id,
    month: monthKey,
    reason,
    status: "OPEN",
  });

  await logAudit({
    actorRole: req.user?.role || "customer",
    actorId: id,
    action: "DISPUTE_CREATED",
    targetType: "bill",
    targetId: `${id}:${monthKey}`,
    metadata: { disputeId: dispute.disputeId },
  });

  return res.status(201).json({
    message: "Dispute created",
    disputeId: dispute.disputeId,
  });
}

async function listCustomerDisputes(req, res) {
  const { id } = req.params;
  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const rows = await BillDispute.find({ customerId: id }).sort({ createdAt: -1 }).lean();
  return res.status(200).json({
    customerId: id,
    disputes: rows.map((row) => ({
      id: row.disputeId,
      month: row.month,
      reason: row.reason,
      status: row.status,
      resolution: row.resolution,
      handledBy: row.handledBy,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })),
  });
}

async function listAllDisputes(req, res) {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);

  const rows = await BillDispute.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();

  return res.status(200).json({
    page,
    limit,
    disputes: rows.map((row) => ({
      id: row.disputeId,
      customerId: row.customerId,
      month: row.month,
      reason: row.reason,
      status: row.status,
      resolution: row.resolution,
      handledBy: row.handledBy,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })),
  });
}

async function listOperatorDisputes(req, res) {
  const operatorId = req.user?.operatorId;
  const operator = await operatorStore.getOperatorById(operatorId);
  if (!operator) {
    return res.status(404).json({ message: "Operator not found" });
  }

  const rows = await BillDispute.find({ customerId: { $in: operator.customers || [] } })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    operatorId,
    disputes: rows.map((row) => ({
      id: row.disputeId,
      customerId: row.customerId,
      month: row.month,
      reason: row.reason,
      status: row.status,
      resolution: row.resolution,
      handledBy: row.handledBy,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })),
  });
}

async function resolveDispute(req, res) {
  const disputeId = String(req.params.id);
  const resolution = String(req.body?.resolution || "").trim();
  const status = String(req.body?.status || "RESOLVED").toUpperCase();

  if (!resolution) {
    return res.status(400).json({ message: "resolution is required" });
  }

  if (![/^RESOLVED$/, /^REJECTED$/].some((re) => re.test(status))) {
    return res.status(400).json({ message: "status must be RESOLVED or REJECTED" });
  }

  const dispute = await BillDispute.findOneAndUpdate(
    { disputeId },
    {
      $set: {
        resolution,
        status,
        handledBy: req.user?.sub || req.user?.operatorId || "admin",
        resolvedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!dispute) {
    return res.status(404).json({ message: "Dispute not found" });
  }

  await logAudit({
    actorRole: req.user?.role || "admin",
    actorId: req.user?.sub || req.user?.operatorId || "admin",
    action: "DISPUTE_RESOLVED",
    targetType: "dispute",
    targetId: disputeId,
    metadata: { status: dispute.status },
  });

  return res.status(200).json({
    message: "Dispute updated",
    dispute: {
      id: dispute.disputeId,
      status: dispute.status,
      resolution: dispute.resolution,
      handledBy: dispute.handledBy,
      resolvedAt: dispute.resolvedAt,
    },
  });
}

module.exports = {
  createDispute,
  listCustomerDisputes,
  listAllDisputes,
  listOperatorDisputes,
  resolveDispute,
};
