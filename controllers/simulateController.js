const {
  getSimulationData,
  UPDATE_INTERVAL_MS,
} = require("../data/simulationData");

const getSimulationSnapshot = (req, res) => {
  const payload = {
    updateIntervalSeconds: UPDATE_INTERVAL_MS / 1000,
    ...getSimulationData(),
  };

  return res.status(200).json(payload);
};

module.exports = {
  getSimulationSnapshot,
};
