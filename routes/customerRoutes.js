const express = require("express");
const {
  getCustomerEnergyComparison,
  getCustomerBillSummary,
  getCustomerById,
  getCustomerUsage,
  getCustomerBill,
  getCustomerBillHistory,
  getCustomerBillComparison,
  getCustomerPaymentHistory,
  getCustomerReminders,
  makeCustomerPayment,
} = require("../controllers/customerController");
const roleCheck = require("../middleware/roleMiddleware");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

function ensureCustomerOwnership(req, res, next) {
  if (req.user?.role !== "customer") {
    return res.status(403).json({ message: "Access Denied" });
  }

  if (req.params.id && req.user.customerId && req.params.id !== req.user.customerId) {
    return res.status(403).json({ message: "Cannot access other customer records" });
  }

  if (req.body?.customerId && req.user.customerId && req.body.customerId !== req.user.customerId) {
    return res.status(403).json({ message: "Cannot pay for other customer accounts" });
  }

  return next();
}

router.get("/:id", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerById);
router.get("/:id/usage", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerUsage);
router.get("/:id/energy-comparison", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerEnergyComparison);
router.get("/:id/bill-summary", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerBillSummary);
router.get("/:id/bill", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerBill);
router.get("/:id/bills/history", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerBillHistory);
router.get("/:id/bills/comparison", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerBillComparison);
router.get("/:id/payments/history", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerPaymentHistory);
router.get("/:id/reminders", authRequired, roleCheck("customer"), ensureCustomerOwnership, getCustomerReminders);
router.post("/payment", authRequired, roleCheck("customer"), ensureCustomerOwnership, makeCustomerPayment);

module.exports = router;
