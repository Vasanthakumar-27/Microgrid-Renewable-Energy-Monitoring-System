let microgrids = [];
const history = {};
const { buildAlertsFromData } = require("./alertRules");
const { persistSnapshot } = require("./persistenceEngine");

function getHour() {
  return new Date().getHours();
}

function generateGridData(gridId) {
  const hour = getHour();

  const solar =
    hour >= 6 && hour <= 18
      ? Math.floor(Math.random() * 150 + 50)
      : Math.floor(Math.random() * 20);

  const wind = Math.floor(Math.random() * 50);
  const generation = solar + wind;

  const consumption =
    hour >= 18 && hour <= 22
      ? Math.floor(Math.random() * 150 + 100)
      : Math.floor(Math.random() * 80 + 40);

  const prevBattery =
    microgrids[gridId - 1]?.batteryLevel ?? Math.floor(Math.random() * 50 + 30);

  let battery = prevBattery;

  if (generation > consumption) {
    battery += (generation - consumption) * 0.1;
  } else {
    battery -= (consumption - generation) * 0.1;
  }

  battery = Math.max(0, Math.min(100, Math.round(battery)));

  if (!history[gridId]) {
    history[gridId] = [];
  }

  history[gridId].push(consumption);
  if (history[gridId].length > 12) {
    history[gridId].shift();
  }

  let status = "normal";
  if (battery < 10) {
    status = "critical";
  } else if (battery < 20) {
    status = "warning";
  }

  return {
    gridId,
    solar,
    wind,
    energyGenerated: generation,
    consumption,
    batteryLevel: battery,
    status,
    timestamp: new Date().toISOString(),
  };
}

function updateData() {
  const next = [];
  for (let i = 1; i <= 5; i += 1) {
    next.push(generateGridData(i));
  }
  microgrids = next;

  const alerts = buildAlertsFromData(microgrids);
  void persistSnapshot(microgrids, alerts);
}

setInterval(updateData, 5000);
updateData();

function getData() {
  return microgrids;
}

function getHistory() {
  return history;
}

module.exports = { getData, getHistory };
