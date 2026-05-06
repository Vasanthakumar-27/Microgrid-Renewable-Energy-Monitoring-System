const express = require("express");
const { getLogSummary } = require("../controllers/logController");

const router = express.Router();

router.get("/logs/summary", getLogSummary);

module.exports = router;
