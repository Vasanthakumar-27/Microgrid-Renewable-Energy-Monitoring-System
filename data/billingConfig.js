const billingRates = {
  peakRate: 7,
  offPeakRate: 4,
  fixedCharge: 50,
  renewableDiscountThreshold: 50,
  renewableDiscountPercent: 10,
};

const rateHistory = [
  {
    id: `rate-${Date.now()}`,
    changedAt: new Date().toISOString(),
    changedBy: "system-seed",
    oldValues: null,
    newValues: { ...billingRates },
  },
];

function getBillingRates() {
  return { ...billingRates };
}

function getBillingRateHistory() {
  return [...rateHistory].sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
}

function updateBillingRates(payload = {}, meta = {}) {
  const next = { ...billingRates };

  if (payload.peakRate !== undefined) {
    const value = Number(payload.peakRate);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("peakRate must be a positive number");
    }
    next.peakRate = value;
  }

  if (payload.offPeakRate !== undefined) {
    const value = Number(payload.offPeakRate);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("offPeakRate must be a positive number");
    }
    next.offPeakRate = value;
  }

  if (payload.renewableDiscountThreshold !== undefined) {
    const value = Number(payload.renewableDiscountThreshold);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error("renewableDiscountThreshold must be between 0 and 100");
    }
    next.renewableDiscountThreshold = value;
  }

  if (payload.fixedCharge !== undefined) {
    const value = Number(payload.fixedCharge);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("fixedCharge must be zero or positive");
    }
    next.fixedCharge = value;
  }

  if (payload.renewableDiscountPercent !== undefined) {
    const value = Number(payload.renewableDiscountPercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error("renewableDiscountPercent must be between 0 and 100");
    }
    next.renewableDiscountPercent = value;
  }

  const oldValues = { ...billingRates };
  Object.assign(billingRates, next);

  const hasChanged = Object.keys(billingRates).some(
    (key) => Number(oldValues[key]) !== Number(billingRates[key])
  );

  if (hasChanged) {
    rateHistory.push({
      id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      changedAt: new Date().toISOString(),
      changedBy: meta.changedBy || "admin",
      oldValues,
      newValues: { ...billingRates },
    });
  }

  return getBillingRates();
}

module.exports = {
  getBillingRates,
  getBillingRateHistory,
  updateBillingRates,
};
