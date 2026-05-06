const express = require("express");
const { Parser } = require("json2csv");
const simulator = require("../data/simulator");
const { authRequired } = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/json", authRequired, roleCheck("admin"), (req, res) => {
  const data = simulator.getData();
  res.json(data);
});

router.get("/csv", authRequired, roleCheck("admin"), (req, res) => {
  const data = simulator.getData();

  const fields = [
    "gridId",
    "solar",
    "wind",
    "energyGenerated",
    "consumption",
    "batteryLevel",
    "status",
    "timestamp",
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  res.header("Content-Type", "text/csv");
  res.attachment("microgrid_report.csv");
  res.send(csv);
});

module.exports = router;
