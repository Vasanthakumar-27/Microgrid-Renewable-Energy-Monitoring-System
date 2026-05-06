const getRootStatus = (req, res) => {
  res.status(200).send("Microgrid API Running");
};

module.exports = {
  getRootStatus,
};
