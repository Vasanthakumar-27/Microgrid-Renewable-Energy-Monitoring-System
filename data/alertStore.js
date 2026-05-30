const simulator = require("./simulator");
const operatorStore = require("./operatorStore");
const Alert = require("../models/alertModel");
const config = require("../config/appConfig");

const ALERT_TTL_MS = config.alertTtlMs;
const MANUAL_DELETE_DELAY_MS = config.alertDeleteDelayMs;
const GENERATE_INTERVAL_MS = config.alertGenerateIntervalMs;
const MAX_ALERTS = config.alertMaxOpen;

let generatorStarted = false;

function normalizeAssignedGridIds(assignedMicrogrids = []) {
  return assignedMicrogrids
    .map((entry) => {
      const number = Number(String(entry).replace(/\D/g, ""));
      return Number.isFinite(number) && number > 0 ? number : null;
    })
    .filter(Boolean);
}

async function getOperatorGridIds(operatorId) {
  const operator = await operatorStore.getOperatorById(operatorId);
  if (!operator) {
    return [];
  }

  return normalizeAssignedGridIds(operator.assignedMicrogrids);
}

function makeAlert({ gridId, type, severity, message }) {
  const now = Date.now();
  return {
    alertId: `alert-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    gridId: Number(gridId),
    status: "OPEN",
    message,
    fake: true,
    createdAt: new Date(now),
    deletableAt: new Date(now + MANUAL_DELETE_DELAY_MS),
    expiresAt: new Date(now + ALERT_TTL_MS),
  };
}

async function cleanupExpiredAlerts() {
  const now = new Date();
  await Alert.updateMany(
    { status: "OPEN", expiresAt: { $lte: now } },
    {
      $set: {
        status: "RESOLVED",
        resolvedAt: now,
        resolutionReason: "AUTO_EXPIRED",
      },
    }
  );
}

function listAvailableGridIds() {
  const live = simulator.getData();
  if (Array.isArray(live) && live.length) {
    return live
      .map((grid) => Number(grid.gridId))
      .filter((gridId) => Number.isFinite(gridId) && gridId > 0);
  }

  return [1, 2, 3, 4, 5];
}

function buildSensorSnapshot(grid) {
  const generation = Number(grid.energyGenerated || 0);
  const consumption = Number(grid.consumption || 0);
  const battery = Number(grid.batteryLevel || 0);

  const voltage = Math.round(220 + ((generation - consumption) * 0.1));
  const current = Math.max(0, Number((consumption / 10).toFixed(2)));
  const temperature = Math.round(28 + (consumption > generation ? 8 : 2) + ((100 - battery) * 0.05));
  const motorLoad = Number((consumption / Math.max(generation, 1)).toFixed(2));
  const lightOn = generation > 0;

  return {
    voltage,
    current,
    temperature,
    motorLoad,
    lightOn,
    supplyAvailable: generation > 0,
  };
}

function evaluateSensorAlerts(grid) {
  const sensors = buildSensorSnapshot(grid);
  const rules = [];

  if (sensors.voltage > 245 || sensors.voltage < 195) {
    rules.push({
      type: sensors.voltage > 245 ? "BATTERY_OVERCHARGE_ALERT" : "VOLTAGE_FLUCTUATION",
      severity: "HIGH",
      message: `Voltage anomaly detected on Grid ${grid.gridId} (${sensors.voltage}V)`,
      sensorData: sensors,
    });
  }

  if (sensors.current > 18) {
    rules.push({
      type: "SYSTEM_OVERLOAD",
      severity: "HIGH",
      message: `High current overload on Grid ${grid.gridId} (${sensors.current}A)`,
      sensorData: sensors,
    });
  }

  if (sensors.temperature > 55) {
    rules.push({
      type: "HIGH_TEMPERATURE_ALERT",
      severity: "HIGH",
      message: `Overheating risk on Grid ${grid.gridId} (${sensors.temperature}C)`,
      sensorData: sensors,
    });
  }

  if (sensors.current > 14 && sensors.temperature > 50) {
    rules.push({
      type: "MOTOR_OVERLOAD_ALERT",
      severity: "HIGH",
      message: `Motor overload detected on Grid ${grid.gridId}`,
      sensorData: sensors,
    });
  }

  if (sensors.temperature > 58 && sensors.current > 16) {
    rules.push({
      type: "FIRE_RISK_ALERT",
      severity: "HIGH",
      message: `Possible overheating hazard on Grid ${grid.gridId}`,
      sensorData: sensors,
    });
  }

  if (sensors.voltage > 210 && sensors.current < 0.2) {
    rules.push({
      type: "WASTAGE_ALERT",
      severity: "LOW",
      message: `Power available but no usage on Grid ${grid.gridId}`,
      sensorData: sensors,
    });
  }

  if (sensors.motorLoad > 1.3) {
    rules.push({
      type: "MOTOR_ABNORMAL_USAGE",
      severity: "LOW",
      message: `Motor running inefficiently on Grid ${grid.gridId}`,
      sensorData: sensors,
    });
  }

  return rules;
}

async function generateFakeAlert() {
  const gridIds = listAvailableGridIds();
  if (!gridIds.length) {
    return null;
  }

  const live = simulator.getData();
  const chosenGridId = gridIds[Math.floor(Math.random() * gridIds.length)];
  const grid = live.find((item) => Number(item.gridId) === Number(chosenGridId));
  if (!grid) {
    return null;
  }

  const derived = evaluateSensorAlerts(grid);
  if (!derived.length) {
    return null;
  }

  const chosenRule = derived[Math.floor(Math.random() * derived.length)];
  const alert = makeAlert({
    gridId: chosenGridId,
    type: chosenRule.type,
    severity: chosenRule.severity,
    message: chosenRule.message,
  });
  alert.sensorData = chosenRule.sensorData;

  await Alert.create(alert);
  await cleanupExpiredAlerts();

  const openCount = await Alert.countDocuments({ status: "OPEN" });
  if (openCount > MAX_ALERTS) {
    const overflow = openCount - MAX_ALERTS;
    const overflowRows = await Alert.find({ status: "OPEN" })
      .sort({ createdAt: 1 })
      .limit(overflow)
      .lean();
    const ids = overflowRows.map((row) => row.alertId);
    if (ids.length) {
      await Alert.updateMany(
        { alertId: { $in: ids } },
        {
          $set: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolutionReason: "CAP_TRIMMED",
          },
        }
      );
    }
  }

  return alert;
}

async function ensureSeedAlerts() {
  await cleanupExpiredAlerts();
  const count = await Alert.countDocuments({ status: "OPEN" });
  if (count > 0) {
    return;
  }

  for (let i = 0; i < 3; i += 1) {
    await generateFakeAlert();
  }
}

function withDeleteState(alert) {
  const now = Date.now();
  const deletableAtMs = new Date(alert.deletableAt).getTime();
  const expiresAtMs = new Date(alert.expiresAt).getTime();

  return {
    ...alert,
    canDelete: now >= deletableAtMs,
    secondsToDelete: Math.max(0, Math.ceil((deletableAtMs - now) / 1000)),
    secondsToExpire: Math.max(0, Math.ceil((expiresAtMs - now) / 1000)),
  };
}

function toUiAlert(alert) {
  const plain = {
    id: alert.alertId,
    type: alert.type,
    severity: alert.severity,
    gridId: alert.gridId,
    status: alert.status,
    message: alert.message,
    fake: alert.fake,
    sensorData: alert.sensorData || {},
    createdAt: alert.createdAt,
    deletableAt: alert.deletableAt,
    expiresAt: alert.expiresAt,
    resolvedAt: alert.resolvedAt,
    resolutionReason: alert.resolutionReason,
  };
  return withDeleteState(plain);
}

async function listAlerts({ gridIds, status = "OPEN", limit } = {}) {
  await ensureSeedAlerts();
  await cleanupExpiredAlerts();

  const query = { status };
  if (Array.isArray(gridIds) && gridIds.length) {
    query.gridId = { $in: gridIds.map((value) => Number(value)) };
  }

  let cursor = Alert.find(query).sort({ createdAt: -1 });
  if (limit) {
    cursor = cursor.limit(Number(limit));
  }
  const rows = await cursor.lean();
  return rows.map(toUiAlert);
}

async function listResolvedAlerts({ gridIds, limit = 50 } = {}) {
  return listAlerts({ gridIds, status: "RESOLVED", limit });
}

async function deleteAlertById(id, { role, operatorId } = {}) {
  await cleanupExpiredAlerts();
  const alert = await Alert.findOne({ alertId: id }).lean();
  if (!alert) {
    return { ok: false, code: "NOT_FOUND", message: "Alert not found" };
  }

  const now = Date.now();
  const deletableAtMs = new Date(alert.deletableAt).getTime();

  if (now < deletableAtMs) {
    return {
      ok: false,
      code: "LOCKED",
      message: "Delete is enabled after a short delay",
      secondsToDelete: Math.max(0, Math.ceil((deletableAtMs - now) / 1000)),
    };
  }

  if (role === "operator") {
    const allowedGridIds = await getOperatorGridIds(operatorId);
    if (!allowedGridIds.includes(Number(alert.gridId))) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Cannot delete alerts outside assigned grids",
      };
    }
  }

  if (role !== "admin" && role !== "operator") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only admin or operator can delete alerts",
    };
  }

  const updated = await Alert.findOneAndUpdate(
    { alertId: id, status: "OPEN" },
    {
      $set: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionReason: "MANUAL_DELETE",
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    return { ok: false, code: "NOT_FOUND", message: "Alert already resolved" };
  }

  return { ok: true, deleted: toUiAlert(updated) };
}

function startAlertGenerator() {
  if (generatorStarted) {
    return;
  }

  generatorStarted = true;
  void ensureSeedAlerts();

  setInterval(async () => {
    await generateFakeAlert();
    await cleanupExpiredAlerts();
  }, GENERATE_INTERVAL_MS);

  setInterval(async () => {
    await cleanupExpiredAlerts();
  }, 15 * 1000);
}

module.exports = {
  startAlertGenerator,
  listAlerts,
  listResolvedAlerts,
  deleteAlertById,
  normalizeAssignedGridIds,
};
