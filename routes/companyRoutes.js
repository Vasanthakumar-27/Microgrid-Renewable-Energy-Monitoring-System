const express = require("express");
const {
	getCompanyDashboard,
	listOperators,
	createOperator,
	deleteOperator,
	updateOperator,
	listCustomers,
	getBillingOverview,
	getBillingRatesConfig,
	getBillingRatesHistory,
	setBillingRatesConfig,
	getTariffRate,
	setTariffRate,
	getTariffRateHistory,
	getBillingSummary,
	getAuditLogHistory,
} = require("../controllers/companyController");
const {
	listAllDisputes,
	resolveDispute,
} = require("../controllers/disputeController");
const {
	listMaintenanceTickets,
	updateMaintenanceTicket,
} = require("../controllers/maintenanceController");
const roleCheck = require("../middleware/roleMiddleware");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/dashboard", authRequired, roleCheck("admin"), getCompanyDashboard);
router.get("/operators", authRequired, roleCheck("admin"), listOperators);
router.post("/operators", authRequired, roleCheck("admin"), createOperator);
router.delete("/operators/:id", authRequired, roleCheck("admin"), deleteOperator);
router.put("/operators/:id", authRequired, roleCheck("admin"), updateOperator);
router.get("/customers", authRequired, roleCheck("admin"), listCustomers);
router.get("/billing/overview", authRequired, roleCheck("admin"), getBillingOverview);
router.get("/billing/rates", authRequired, roleCheck("admin"), getBillingRatesConfig);
router.get("/billing/rates/history", authRequired, roleCheck("admin"), getBillingRatesHistory);
router.put("/billing/rates", authRequired, roleCheck("admin"), setBillingRatesConfig);
router.get("/billing/tariff-rate", authRequired, roleCheck("admin"), getTariffRate);
router.post("/billing/tariff-rate", authRequired, roleCheck("admin"), setTariffRate);
router.get("/billing/tariff-rate/history", authRequired, roleCheck("admin"), getTariffRateHistory);
router.get("/billing/summary", authRequired, roleCheck("admin"), getBillingSummary);
router.get("/billing/disputes", authRequired, roleCheck("admin"), listAllDisputes);
router.put("/billing/disputes/:id", authRequired, roleCheck("admin"), resolveDispute);
router.get("/audit/logs", authRequired, roleCheck("admin"), getAuditLogHistory);
router.get("/maintenance/tickets", authRequired, roleCheck("admin"), listMaintenanceTickets);
router.put("/maintenance/tickets/:id", authRequired, roleCheck("admin"), updateMaintenanceTicket);

module.exports = router;
