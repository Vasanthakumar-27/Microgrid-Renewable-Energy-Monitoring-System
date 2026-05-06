const express = require("express");
const { getInsights } = require("../controllers/insightController");

const router = express.Router();

router.get("/insights", getInsights);

module.exports = router;
