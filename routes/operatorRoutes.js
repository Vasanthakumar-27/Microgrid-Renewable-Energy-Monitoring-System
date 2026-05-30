const express = require("express");
const {
  createCustomer,
  getOperatorMicrogrids,
  getOperatorAlerts,
  getOperatorMaintenance,
  getOperatorCustomers,
  getOperatorCustomerBillHistory,
  getOperatorEnergyComparison,
  updateOperatorCustomer,
} = require("../controllers/operatorController");
const {
  listOperatorDisputes,
  resolveDispute,
} = require("../controllers/disputeController");
const {
  createMaintenanceTicket,
  listMaintenanceTickets,
  updateMaintenanceTicket,
} = require("../controllers/maintenanceController");
const roleCheck = require("../middleware/roleMiddleware");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-customer", authRequired, roleCheck("operator"), createCustomer);
router.get("/microgrids", authRequired, roleCheck("operator"), getOperatorMicrogrids);
router.get("/alerts", authRequired, roleCheck("operator"), getOperatorAlerts);
router.get("/maintenance", authRequired, roleCheck("operator"), getOperatorMaintenance);
router.get("/maintenance/tickets", authRequired, roleCheck("operator"), listMaintenanceTickets);
router.post("/maintenance/tickets", authRequired, roleCheck("operator"), createMaintenanceTicket);
router.put("/maintenance/tickets/:id", authRequired, roleCheck("operator"), updateMaintenanceTicket);
router.get("/customers", authRequired, roleCheck("operator"), getOperatorCustomers);
router.get("/energy-comparison", authRequired, roleCheck("operator"), getOperatorEnergyComparison);
router.get("/customer/:id/bill-history", authRequired, roleCheck("operator"), getOperatorCustomerBillHistory);
router.put("/customer/:id", authRequired, roleCheck("operator"), updateOperatorCustomer);
router.get("/disputes", authRequired, roleCheck("operator"), listOperatorDisputes);
router.put("/disputes/:id", authRequired, roleCheck("operator"), resolveDispute);

module.exports = router;
