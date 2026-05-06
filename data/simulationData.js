const UPDATE_INTERVAL_MS = 5000;
const MICROGRID_COUNT = 5;

const firstNames = [
  "Aarav",
  "Priya",
  "Rohan",
  "Sneha",
  "Karan",
  "Neha",
  "Arjun",
  "Meera",
  "Vikram",
  "Isha",
  "Rahul",
  "Ananya",
  "Kabir",
  "Pooja",
  "Dev",
  "Naina",
  "Siddharth",
  "Asha",
  "Ritika",
  "Manav",
];

const lastNames = [
  "Sharma",
  "Patel",
  "Rao",
  "Verma",
  "Singh",
  "Nair",
  "Joshi",
  "Das",
  "Kulkarni",
  "Iyer",
];

const simulationState = {
  lastUpdatedAt: null,
  customers: [],
  microgrids: [],
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Number((Math.random() * (max - min) + min).toFixed(2));

const randomName = () => {
  const firstName = firstNames[randomInt(0, firstNames.length - 1)];
  const lastName = lastNames[randomInt(0, lastNames.length - 1)];
  return `${firstName} ${lastName}`;
};

const generateCustomers = () => {
  const customerCount = randomInt(10, 20);

  return Array.from({ length: customerCount }, (_, index) => {
    const energyUsage = randomFloat(120, 900);
    const energyGenerated = randomFloat(30, 420);
    const billAmount = Number(Math.max(0, energyUsage - energyGenerated).toFixed(2));

    return {
      id: `sim-cust-${index + 1}`,
      name: randomName(),
      energyUsage,
      energyGenerated,
      billAmount,
      paymentStatus: billAmount > 250 ? "pending" : "paid",
    };
  });
};

const generateMicrogrids = () =>
  Array.from({ length: MICROGRID_COUNT }, (_, index) => {
    const energyGenerated = randomFloat(1500, 9800);
    const consumption = randomFloat(1200, 9000);
    const batteryLevel = randomInt(12, 98);

    return {
      id: `sim-mg-${index + 1}`,
      gridId: `SIM-GRID-${String(index + 1).padStart(2, "0")}`,
      energyGenerated,
      consumption,
      batteryLevel,
      status: batteryLevel < 25 || consumption > energyGenerated * 1.15 ? "fault" : "normal",
    };
  });

const refreshSimulationData = () => {
  simulationState.customers = generateCustomers();
  simulationState.microgrids = generateMicrogrids();
  simulationState.lastUpdatedAt = new Date().toISOString();
};

const getSimulationData = () => ({
  lastUpdatedAt: simulationState.lastUpdatedAt,
  customers: simulationState.customers,
  microgrids: simulationState.microgrids,
  summary: {
    totalCustomers: simulationState.customers.length,
    totalMicrogrids: simulationState.microgrids.length,
    totalEnergyGenerated: Number(
      simulationState.microgrids
        .reduce((total, grid) => total + grid.energyGenerated, 0)
        .toFixed(2)
    ),
    totalConsumption: Number(
      simulationState.microgrids
        .reduce((total, grid) => total + grid.consumption, 0)
        .toFixed(2)
    ),
  },
});

refreshSimulationData();
setInterval(refreshSimulationData, UPDATE_INTERVAL_MS);

module.exports = {
  getSimulationData,
  refreshSimulationData,
  UPDATE_INTERVAL_MS,
};
