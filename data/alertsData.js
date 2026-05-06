const { getSimulationData } = require("./simulationData");

const buildAlert = ({ type, message, severity, microgridId = null, gridId = null }) => ({
  id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  message,
  severity,
  microgridId,
  gridId,
  status: "active",
  createdAt: new Date().toISOString(),
});

const getAllAlerts = () => {
  const { microgrids, lastUpdatedAt } = getSimulationData();
  const alerts = [];

  if (!lastUpdatedAt || !Array.isArray(microgrids) || microgrids.length === 0) {
    alerts.push(
      buildAlert({
        type: "system_fault",
        message: "No data available from microgrid telemetry",
        severity: "critical",
      })
    );

    return alerts;
  }

  microgrids.forEach((microgrid) => {
    const hasMissingData =
      microgrid.batteryLevel === null ||
      microgrid.batteryLevel === undefined ||
      microgrid.energyGenerated === null ||
      microgrid.energyGenerated === undefined ||
      microgrid.consumption === null ||
      microgrid.consumption === undefined;

    if (hasMissingData) {
      alerts.push(
        buildAlert({
          type: "system_fault",
          message: `No data for ${microgrid.gridId}`,
          severity: "critical",
          microgridId: microgrid.id,
          gridId: microgrid.gridId,
        })
      );
      return;
    }

    if (microgrid.batteryLevel < 20) {
      alerts.push(
        buildAlert({
          type: "low_battery",
          message: `Low battery alert on ${microgrid.gridId} (${microgrid.batteryLevel}%)`,
          severity: "high",
          microgridId: microgrid.id,
          gridId: microgrid.gridId,
        })
      );
    }

    if (microgrid.consumption > microgrid.energyGenerated) {
      alerts.push(
        buildAlert({
          type: "overload",
          message: `Overload alert on ${microgrid.gridId}: consumption exceeds generation`,
          severity: "high",
          microgridId: microgrid.id,
          gridId: microgrid.gridId,
        })
      );
    }
  });

  return alerts;
};

module.exports = {
  getAllAlerts,
};
