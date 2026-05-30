const AuditLog = require("../models/auditLogModel");

function buildLogId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function logAudit({ actorRole, actorId, action, targetType, targetId, metadata = {} }) {
  if (!actorRole || !actorId || !action || !targetType || !targetId) {
    return null;
  }

  const payload = {
    logId: buildLogId(),
    actorRole: String(actorRole),
    actorId: String(actorId),
    action: String(action),
    targetType: String(targetType),
    targetId: String(targetId),
    metadata,
  };

  return AuditLog.create(payload);
}

async function listAuditLogs({ limit = 100, page = 1 } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);

  const rows = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .skip((safePage - 1) * safeLimit)
    .lean();

  return rows.map((row) => ({
    id: row.logId,
    actorRole: row.actorRole,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata || {},
    createdAt: row.createdAt,
  }));
}

module.exports = {
  logAudit,
  listAuditLogs,
};
