const {
  startAlertGenerator,
  listAlerts,
  listResolvedAlerts,
  deleteAlertById,
  normalizeAssignedGridIds,
} = require("../data/alertStore");
const operatorStore = require("../data/operatorStore");

startAlertGenerator();

async function getAlertsData(options = {}) {
  return listAlerts(options);
}

async function getScopedGridIds(req) {
  if (req.user?.role === "operator") {
    const operator = await operatorStore.getOperatorById(req.user?.operatorId);
    return normalizeAssignedGridIds(operator?.assignedMicrogrids || []);
  }

  if (req.user?.role === "admin") {
    const operatorId = String(req.query.operatorId || "all").trim();
    if (!operatorId || operatorId.toLowerCase() === "all") {
      return undefined;
    }

    const operator = await operatorStore.getOperatorById(operatorId);
    return normalizeAssignedGridIds(operator?.assignedMicrogrids || []);
  }

  return undefined;
}

const getAlerts = async (req, res) => {
  try {
    const gridIds = await getScopedGridIds(req);
    const alerts = await getAlertsData({ gridIds });
    return res.status(200).json(alerts);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load alerts", error: error.message });
  }
};

const getResolvedAlertHistory = async (req, res) => {
  try {
    const gridIds = await getScopedGridIds(req);

    const rows = await listResolvedAlerts({
      gridIds,
      limit: Number(req.query.limit || 50),
    });
    return res.status(200).json({ history: rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load resolved alert history", error: error.message });
  }
};

const deleteAlert = async (req, res) => {
  const result = await deleteAlertById(req.params.id, {
    role: req.user?.role,
    operatorId: req.user?.operatorId,
  });

  if (result.ok) {
    return res.status(200).json({
      message: "Alert deleted",
      alert: result.deleted,
    });
  }

  if (result.code === "NOT_FOUND") {
    return res.status(404).json({ message: result.message });
  }

  if (result.code === "LOCKED") {
    return res.status(409).json({
      message: result.message,
      secondsToDelete: result.secondsToDelete,
    });
  }

  return res.status(403).json({ message: result.message });
};

module.exports = {
  getAlertsData,
  getAlerts,
  getResolvedAlertHistory,
  deleteAlert,
};
