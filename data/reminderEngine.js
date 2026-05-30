const { customers } = require("./energyData");
const Bill = require("../models/billModel");
const config = require("../config/appConfig");
const Notification = require("../models/notificationModel");
const { createNotification } = require("./notificationStore");

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

async function runReminderSweep() {
  const month = currentMonthKey();
  const bills = await Bill.find({ month, remainingAmount: { $gt: 0 } }).lean();

  bills.forEach((bill) => {
    const customer = customers.find((entry) => entry.id === bill.customerId);
    const displayName = customer ? `${customer.name}` : bill.customerId;
    console.log(
      `Reminder: pending payment for ${bill.customerId} (${displayName}) month=${month} remaining=INR ${bill.remainingAmount}`
    );
  });

  for (const bill of bills) {
    const title = "Payment reminder";
    const message = `Payment pending for ${month}. Remaining INR ${Number(bill.remainingAmount || 0).toFixed(2)}.`;
    const recent = await Notification.findOne({
      userId: bill.customerId,
      title,
      message,
      createdAt: { $gte: new Date(Date.now() - config.reminderSweepMs) },
    }).lean();

    if (!recent) {
      await createNotification({
        userId: bill.customerId,
        role: "customer",
        title,
        message,
        type: "WARNING",
      });
    }
  }
}

setInterval(() => {
  void runReminderSweep();
}, config.reminderSweepMs);

module.exports = {
  runReminderSweep,
};
