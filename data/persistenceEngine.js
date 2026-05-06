const mongoose = require("mongoose");
const EnergyLog = require("../models/energyLogModel");
const AlertLog = require("../models/alertLogModel");

async function persistSnapshot(grids, alerts) {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const now = new Date();

    const energyDocs = grids.map((grid) => ({
      gridId: grid.gridId,
      solar: grid.solar,
      wind: grid.wind,
      generation: grid.energyGenerated,
      consumption: grid.consumption,
      battery: grid.batteryLevel,
      status: grid.status,
      timestamp: now,
    }));

    if (energyDocs.length) {
      await EnergyLog.insertMany(energyDocs, { ordered: false });
    }

    const alertDocs = alerts.map((alert) => ({
      type: alert.type,
      gridId: alert.gridId,
      timestamp: now,
    }));

    if (alertDocs.length) {
      await AlertLog.insertMany(alertDocs, { ordered: false });
    }
  } catch (error) {
    console.error("Persistence engine error", error.message);
  }
}

module.exports = {
  persistSnapshot,
};
