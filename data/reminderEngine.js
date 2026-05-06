const { customers } = require("./energyData");

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function runReminderSweep() {
  const month = currentMonthKey();

  customers.forEach((customer) => {
    const bill = customer.monthlyBills?.[month];
    if (bill && Number(bill.remainingAmount || 0) > 0) {
      console.log(
        `Reminder: pending payment for ${customer.id} (${customer.name}) month=${month} remaining=INR ${bill.remainingAmount}`
      );
    }
  });
}

setInterval(runReminderSweep, 24 * 60 * 60 * 1000);

module.exports = {
  runReminderSweep,
};
