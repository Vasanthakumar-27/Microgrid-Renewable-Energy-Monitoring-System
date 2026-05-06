const express = require("express");
const {
  getEnergyData,
  getAdminAnalytics,
  getOperatorAnalytics,
  getCustomerAnalytics,
} = require("../controllers/analyticsController");
const { authRequired } = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/analytics/energy-data", authRequired, getEnergyData);
router.get("/analytics/admin", authRequired, roleCheck("admin"), getAdminAnalytics);
router.get("/analytics/operator", authRequired, roleCheck("operator"), getOperatorAnalytics);
router.get("/analytics/customer/:id", authRequired, roleCheck("customer"), getCustomerAnalytics);

module.exports = router;
