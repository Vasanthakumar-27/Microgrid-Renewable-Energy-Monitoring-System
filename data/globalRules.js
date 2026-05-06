const roundToTwo = (value) => Number(value.toFixed(2));

function computeEnergyTotals(grids = []) {
  const totalGeneration = roundToTwo(
    grids.reduce((sum, grid) => sum + Number(grid.energyGenerated || 0), 0)
  );
  const totalConsumption = roundToTwo(
    grids.reduce((sum, grid) => sum + Number(grid.consumption || 0), 0)
  );

  return {
    totalGeneration,
    totalConsumption,
    energyGap: roundToTwo(totalGeneration - totalConsumption),
  };
}

function computeBillAmount(consumption, rate, fixedCharge) {
  const normalizedConsumption = Number(consumption || 0);
  const normalizedRate = Number(rate || 0);
  const normalizedFixed = Number(fixedCharge || 0);

  return roundToTwo((normalizedConsumption * normalizedRate) + normalizedFixed);
}

function computeSavings(expected, actual, rate) {
  const normalizedExpected = Number(expected || 0);
  const normalizedActual = Number(actual || 0);
  const normalizedRate = Number(rate || 0);

  return roundToTwo((normalizedExpected - normalizedActual) * normalizedRate);
}

module.exports = {
  roundToTwo,
  computeEnergyTotals,
  computeBillAmount,
  computeSavings,
};
