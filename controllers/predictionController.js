const simulator = require("../data/simulator");

function predictLoad(history) {
  if (!history.length) {
    return 0;
  }

  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  return Math.round(avg);
}

function getPrediction(req, res) {
  const historyByGrid = simulator.getHistory();
  const predictions = Object.entries(historyByGrid).map(([gridId, values]) => ({
    gridId: Number(gridId),
    nextHourDemand: predictLoad(values),
  }));

  const overallPrediction =
    predictions.length > 0
      ? Math.round(
          predictions.reduce((sum, item) => sum + item.nextHourDemand, 0) /
            predictions.length
        )
      : 0;

  res.json({
    overallNextHourDemand: overallPrediction,
    predictions,
  });
}

module.exports = {
  predictLoad,
  getPrediction,
};
