const simulator = require("../data/simulator");

function buildInsight({ gridId, type, priority, message, action }) {
  return {
    gridId,
    type,
    priority,
    message,
    action,
    createdAt: new Date().toISOString(),
  };
}

function generateInsights(data) {
  const insights = [];

  data.forEach((g) => {
    if (g.energyGenerated > g.consumption) {
      insights.push(
        buildInsight({
          gridId: g.gridId,
          type: "SURPLUS_ENERGY",
          priority: "medium",
          message: `Grid ${g.gridId} has surplus energy`,
          action: "Shift discretionary loads to this grid.",
        })
      );
    }

    if (g.batteryLevel < 20) {
      insights.push(
        buildInsight({
          gridId: g.gridId,
          type: "LOW_BATTERY",
          priority: "high",
          message: `Grid ${g.gridId} battery low`,
          action: "Dispatch battery recharge and reduce local peak load.",
        })
      );
    }
  });

  return insights;
}

function getInsights(req, res) {
  const data = simulator.getData();
  const insights = generateInsights(data);
  res.json(insights);
}

module.exports = {
  generateInsights,
  getInsights,
};
