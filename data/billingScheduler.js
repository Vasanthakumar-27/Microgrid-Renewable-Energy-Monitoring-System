const { customers } = require("./energyData");
const { currentMonthKey, ensureMonthlyBill } = require("./billingStore");
const config = require("../config/appConfig");
const Bill = require("../models/billModel");
const { createNotification } = require("./notificationStore");

async function runBillSweep() {
  const monthKey = currentMonthKey();
  for (const customer of customers) {
    const existing = await Bill.findOne({ customerId: customer.id, month: monthKey }).lean();
    if (existing) {
      continue;
    }

    const created = await ensureMonthlyBill(customer, monthKey);
    if (created) {
      await createNotification({
        userId: customer.id,
        role: "customer",
        title: "New bill generated",
        message: `Your bill for ${monthKey} is ready. Amount due INR ${Number(created.calculatedAmount || 0).toFixed(2)}.`,
        type: "INFO",
      });
    }
  }
}

function startBillScheduler() {
  void runBillSweep();
  setInterval(() => {
    void runBillSweep();
  }, config.billSweepMs);
}

module.exports = {
  runBillSweep,
  startBillScheduler,
};
