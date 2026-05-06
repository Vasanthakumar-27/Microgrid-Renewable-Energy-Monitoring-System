const EnergyLog = require("../models/energyLogModel");
const AlertLog = require("../models/alertLogModel");

async function getLogSummary(req, res) {
  try {
    const [energyCount, alertCount, latestEnergy, latestAlerts] = await Promise.all([
      EnergyLog.countDocuments(),
      AlertLog.countDocuments(),
      EnergyLog.find().sort({ timestamp: -1 }).limit(5).lean(),
      AlertLog.find().sort({ timestamp: -1 }).limit(10).lean(),
    ]);

    res.json({
      energyLogCount: energyCount,
      alertLogCount: alertCount,
      latestEnergy,
      latestAlerts,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch log summary", error: error.message });
  }
}

module.exports = {
  getLogSummary,
};
