const Operator = require("../models/operatorModel");
const { operators: seedOperators, microgrids } = require("./energyData");

function toOperatorPayload(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    name: doc.name,
    username: doc.username,
    password: doc.password,
    gridCount: Number(doc.gridCount || 0),
    location: doc.location || "Unassigned",
    assignedMicrogrids: Array.isArray(doc.assignedMicrogrids) ? doc.assignedMicrogrids : [],
    customers: Array.isArray(doc.customers) ? doc.customers : [],
  };
}

function buildAssignedMicrogrids(gridCount) {
  const requestedGridCount = Math.max(0, Number(gridCount) || 0);
  return microgrids
    .slice(0, Math.min(requestedGridCount, microgrids.length))
    .map((grid) => String(grid.id));
}

function toGridNumbers(assignedMicrogrids = []) {
  return assignedMicrogrids
    .map((entry) => Number(String(entry).replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

async function ensureSeedOperators() {
  const count = await Operator.countDocuments({});
  if (count > 0) {
    return;
  }

  if (!Array.isArray(seedOperators) || !seedOperators.length) {
    return;
  }

  const docs = seedOperators.map((entry) => {
    const gridCount = Number(entry.gridCount || entry.assignedMicrogrids?.length || 0);
    return {
      id: entry.id,
      name: entry.name,
      username: entry.username || entry.name,
      password: entry.password,
      gridCount,
      location: entry.location || "Unassigned",
      assignedMicrogrids: Array.isArray(entry.assignedMicrogrids)
        ? entry.assignedMicrogrids.map((value) => String(value))
        : buildAssignedMicrogrids(gridCount),
      customers: Array.isArray(entry.customers) ? entry.customers.map((value) => String(value)) : [],
    };
  });

  await Operator.insertMany(docs, { ordered: false });
}

async function listOperators() {
  await ensureSeedOperators();
  const rows = await Operator.find({}).sort({ name: 1 }).lean();
  return rows.map(toOperatorPayload);
}

async function getOperatorById(id, { fallbackFirst = false } = {}) {
  await ensureSeedOperators();

  let row = null;
  if (id) {
    row = await Operator.findOne({ id: String(id) }).lean();
  }

  if (!row && fallbackFirst) {
    row = await Operator.findOne({}).sort({ createdAt: 1 }).lean();
  }

  return toOperatorPayload(row);
}

async function getOperatorByLogin(username, password) {
  await ensureSeedOperators();

  const normalized = String(username || "").trim().toLowerCase();
  const rows = await Operator.find({ password: String(password || "") }).lean();
  const match = rows.find((entry) =>
    String(entry.username || entry.name || "").trim().toLowerCase() === normalized
  );

  return toOperatorPayload(match || null);
}

async function createOperator(payload) {
  await ensureSeedOperators();

  const name = String(payload.name || "").trim();
  const password = String(payload.password || "").trim();
  const gridCount = Math.max(0, Number(payload.gridCount) || 0);
  const location = String(payload.location || "Unassigned").trim() || "Unassigned";

  if (!name || !password) {
    throw new Error("name and password are required");
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const id = `op-${Date.now()}`;
  const operator = await Operator.create({
    id,
    name,
    username: slug || `operator-${Date.now()}`,
    password,
    gridCount,
    location,
    assignedMicrogrids: buildAssignedMicrogrids(gridCount),
    customers: [],
  });

  return toOperatorPayload(operator.toObject());
}

async function updateOperator(id, payload) {
  await ensureSeedOperators();

  const existing = await Operator.findOne({ id: String(id) }).lean();
  if (!existing) {
    return null;
  }

  const next = {
    name: payload?.name !== undefined ? String(payload.name).trim() : existing.name,
    password: payload?.password !== undefined ? String(payload.password).trim() : existing.password,
    location: payload?.location !== undefined ? String(payload.location).trim() : existing.location,
    gridCount: payload?.gridCount !== undefined
      ? Math.max(0, Number(payload.gridCount) || 0)
      : Number(existing.gridCount || 0),
  };

  const assignedMicrogrids = buildAssignedMicrogrids(next.gridCount);

  const updated = await Operator.findOneAndUpdate(
    { id: String(id) },
    {
      $set: {
        name: next.name || existing.name,
        password: next.password || existing.password,
        location: next.location || "Unassigned",
        gridCount: next.gridCount,
        assignedMicrogrids,
      },
    },
    { returnDocument: "after" }
  ).lean();

  return toOperatorPayload(updated);
}

async function deleteOperator(id) {
  await ensureSeedOperators();
  const deleted = await Operator.findOneAndDelete({ id: String(id) }).lean();
  return toOperatorPayload(deleted);
}

async function addCustomerToOperator(operatorId, customerId) {
  await ensureSeedOperators();
  const updated = await Operator.findOneAndUpdate(
    { id: String(operatorId) },
    { $addToSet: { customers: String(customerId) } },
    { returnDocument: "after" }
  ).lean();

  return toOperatorPayload(updated);
}

module.exports = {
  listOperators,
  getOperatorById,
  getOperatorByLogin,
  createOperator,
  updateOperator,
  deleteOperator,
  addCustomerToOperator,
  toGridNumbers,
};
