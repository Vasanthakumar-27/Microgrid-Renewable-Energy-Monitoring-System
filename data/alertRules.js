function buildAlertsFromData(data) {
  const alerts = [];

  data.forEach((grid) => {
    if (grid.batteryLevel < 20) {
      alerts.push({ type: "LOW_BATTERY", gridId: grid.gridId });
    }

    if (grid.consumption > grid.energyGenerated) {
      alerts.push({ type: "OVERLOAD", gridId: grid.gridId });
    }

    if (!grid.energyGenerated && !grid.consumption) {
      alerts.push({ type: "FAULT", gridId: grid.gridId });
    }
  });

  return alerts;
}

module.exports = {
  buildAlertsFromData,
};
