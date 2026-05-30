const MaintenanceTicket = require("../models/maintenanceTicketModel");
const operatorStore = require("../data/operatorStore");
const { logAudit } = require("../data/auditLogStore");

function buildTicketId() {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createMaintenanceTicket(req, res) {
  const { gridId, title, description, priority } = req.body;

  if (!gridId || !title || !description) {
    return res.status(400).json({ message: "gridId, title, and description are required" });
  }

  const operatorId = req.user?.operatorId;
  if (req.user?.role === "operator") {
    const operator = await operatorStore.getOperatorById(operatorId);
    if (!operator) {
      return res.status(404).json({ message: "Operator not found" });
    }

    const allowed = operatorStore.toGridNumbers(operator.assignedMicrogrids);
    if (!allowed.includes(Number(gridId))) {
      return res.status(403).json({ message: "Grid is not assigned to this operator" });
    }
  }

  const ticket = await MaintenanceTicket.create({
    ticketId: buildTicketId(),
    gridId: Number(gridId),
    title: String(title).trim(),
    description: String(description).trim(),
    priority: String(priority || "MEDIUM").toUpperCase(),
    status: "OPEN",
    createdByRole: req.user?.role || "operator",
    createdById: req.user?.operatorId || req.user?.sub || "system",
  });

  await logAudit({
    actorRole: req.user?.role || "operator",
    actorId: req.user?.operatorId || req.user?.sub || "system",
    action: "MAINTENANCE_CREATED",
    targetType: "maintenance",
    targetId: ticket.ticketId,
    metadata: { gridId: ticket.gridId },
  });

  return res.status(201).json({
    message: "Maintenance ticket created",
    ticketId: ticket.ticketId,
  });
}

async function listMaintenanceTickets(req, res) {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);

  let query = {};
  if (req.user?.role === "operator") {
    const operator = await operatorStore.getOperatorById(req.user?.operatorId);
    if (!operator) {
      return res.status(404).json({ message: "Operator not found" });
    }
    const allowed = operatorStore.toGridNumbers(operator.assignedMicrogrids);
    query = { gridId: { $in: allowed } };
  }

  const rows = await MaintenanceTicket.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();

  return res.status(200).json({
    page,
    limit,
    tickets: rows.map((row) => ({
      id: row.ticketId,
      gridId: row.gridId,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      createdByRole: row.createdByRole,
      createdById: row.createdById,
      assignedTo: row.assignedTo,
    })),
  });
}

async function updateMaintenanceTicket(req, res) {
  const ticketId = String(req.params.id);
  const status = req.body?.status ? String(req.body.status).toUpperCase() : null;
  const assignedTo = req.body?.assignedTo ? String(req.body.assignedTo).trim() : null;

  const updates = {};
  if (status) {
    if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      return res.status(400).json({ message: "status must be OPEN, IN_PROGRESS, or RESOLVED" });
    }
    updates.status = status;
    if (status === "RESOLVED") {
      updates.resolvedAt = new Date();
    }
  }

  if (assignedTo !== null) {
    updates.assignedTo = assignedTo || null;
  }

  const updated = await MaintenanceTicket.findOneAndUpdate(
    { ticketId },
    { $set: updates },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    return res.status(404).json({ message: "Maintenance ticket not found" });
  }

  await logAudit({
    actorRole: req.user?.role || "admin",
    actorId: req.user?.operatorId || req.user?.sub || "admin",
    action: "MAINTENANCE_UPDATED",
    targetType: "maintenance",
    targetId: ticketId,
    metadata: updates,
  });

  return res.status(200).json({
    message: "Maintenance ticket updated",
    ticketId: updated.ticketId,
    status: updated.status,
  });
}

module.exports = {
  createMaintenanceTicket,
  listMaintenanceTickets,
  updateMaintenanceTicket,
};
