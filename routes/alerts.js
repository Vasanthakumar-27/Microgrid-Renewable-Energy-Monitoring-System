const express = require("express");
const {
	getAlerts,
	getResolvedAlertHistory,
	deleteAlert,
} = require("../controllers/alertController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/alerts", authRequired, getAlerts);
router.get("/alerts/history/resolved", authRequired, getResolvedAlertHistory);
router.delete("/alerts/:id", authRequired, deleteAlert);

module.exports = router;
