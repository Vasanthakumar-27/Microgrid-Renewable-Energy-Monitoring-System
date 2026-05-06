const { microgrids } = require("../data/energyData");

const getAllMicrogrids = (req, res) => {
  return res.status(200).json(microgrids);
};

const getMicrogridById = (req, res) => {
  const { id } = req.params;
  const microgrid = microgrids.find((entry) => entry.id === id || entry.gridId === id);

  if (!microgrid) {
    return res.status(404).json({ message: "Microgrid not found" });
  }

  return res.status(200).json(microgrid);
};

module.exports = {
  getAllMicrogrids,
  getMicrogridById,
};
