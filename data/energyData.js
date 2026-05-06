const company = {
  id: "company-1",
  name: "City Renewables Ltd",
  totalEnergyGenerated: 15840,
  totalConsumption: 13310,
  batteryStatus: "82%",
};

const microgrids = [
  {
    id: "mg-1",
    gridId: "GRID-NORTH-01",
    energyGenerated: 6200,
    consumption: 5200,
    batteryLevel: 79,
    status: "normal",
  },
  {
    id: "mg-2",
    gridId: "GRID-EAST-03",
    energyGenerated: 4100,
    consumption: 4550,
    batteryLevel: 43,
    status: "fault",
  },
  {
    id: "mg-3",
    gridId: "GRID-SOUTH-02",
    energyGenerated: 5540,
    consumption: 3560,
    batteryLevel: 91,
    status: "normal",
  },
];

const customers = [
  {
    id: "cust-1",
    username: "customer",
    password: "customer123",
    name: "Ravi Sharma",
    phone: "9999000011",
    location: "North Block",
    gridId: 1,
    energyUsage: 420,
    energyGenerated: 180,
    billAmount: 96,
    paymentStatus: "pending",
    paymentHistory: [],
  },
  {
    id: "cust-2",
    username: "anita",
    password: "anita123",
    name: "Anita Rao",
    phone: "9999000022",
    location: "East Block",
    gridId: 2,
    energyUsage: 310,
    energyGenerated: 220,
    billAmount: 48,
    paymentStatus: "pending",
    paymentHistory: [],
  },
];

const operators = [
  {
    id: "op-1",
    username: "operator",
    password: "operator123",
    name: "Central Operator",
    gridCount: 2,
    location: "Central City",
    assignedMicrogrids: ["mg-1", "mg-2"],
    customers: ["cust-1", "cust-2"],
  },
];

const operatorAlerts = [
  {
    id: "alert-1",
    microgridId: "mg-2",
    message: "Battery level dropped below threshold",
    severity: "high",
    status: "active",
  },
  {
    id: "alert-2",
    microgridId: "mg-1",
    message: "Routine maintenance due in 48 hours",
    severity: "medium",
    status: "active",
  },
];

module.exports = {
  company,
  operators,
  customers,
  microgrids,
  operatorAlerts,
};
