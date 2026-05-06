const { getBillingRates } = require("../data/billingConfig");

function calculateBill(usage, hour, renewablePercentage = 0) {
  const rates = getBillingRates();
  let rate;

  if (hour >= 18 && hour <= 22) {
    rate = rates.peakRate;
  } else {
    rate = rates.offPeakRate;
  }

  const baseCost = usage * rate;

  let discountRate = 0;
  if (renewablePercentage > rates.renewableDiscountThreshold) {
    discountRate = rates.renewableDiscountPercent / 100;
  }

  const usageSubtotal = baseCost * (1 - discountRate);
  const finalBill = usageSubtotal + Number(rates.fixedCharge || 0);

  return {
    usage,
    hour,
    rate,
    baseCost: Number(baseCost.toFixed(2)),
    usageSubtotal: Number(usageSubtotal.toFixed(2)),
    fixedCharge: Number((rates.fixedCharge || 0).toFixed(2)),
    renewablePercentage,
    discountPercentage: discountRate * 100,
    finalBill: Number(finalBill.toFixed(2)),
    isPeakHour: hour >= 18 && hour <= 22,
  };
}

module.exports = {
  calculateBill,
};
