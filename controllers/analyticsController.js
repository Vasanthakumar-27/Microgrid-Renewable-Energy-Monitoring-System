const EnergyLog = require("../models/energyLogModel");
const simulator = require("../data/simulator");
const { customers } = require("../data/energyData");
const operatorStore = require("../data/operatorStore");
const { getAlertsData } = require("./alertController");
const {
  computeEnergyTotals,
  computeSavings,
  roundToTwo,
} = require("../data/globalRules");

function insight(type, priority, message, action, gridId = null) {
  return {
    type,
    priority,
    message,
    action,
    gridId,
    createdAt: new Date().toISOString(),
  };
}

function movingAverage(values, windowSize) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
    return Math.round(avg);
  });
}

function comparisonLowerBound(type) {
  const now = new Date();
  const lowerBound = new Date(now);

  if (type === "day") {
    lowerBound.setHours(now.getHours() - 23, 0, 0, 0);
  } else if (type === "month") {
    lowerBound.setDate(now.getDate() - 29);
    lowerBound.setHours(0, 0, 0, 0);
  } else {
    lowerBound.setMonth(now.getMonth() - 11, 1);
    lowerBound.setHours(0, 0, 0, 0);
  }

  return lowerBound;
}

function comparisonKey(type, dateValue) {
  const t = new Date(dateValue);
  if (type === "day") {
    return `${String(t.getHours()).padStart(2, "0")}:00`;
  }

  if (type === "month") {
    return `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeAssignedGridIds(assignedMicrogrids = []) {
  return assignedMicrogrids
    .map((entry) => Number(String(entry).replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

async function getScopedGridIds(req) {
  if (req.user?.role === "operator") {
    const operator = await operatorStore.getOperatorById(req.user?.operatorId);
    return normalizeAssignedGridIds(operator?.assignedMicrogrids || []);
  }

  if (req.user?.role === "customer") {
    const customer = customers.find((entry) => entry.id === req.user?.customerId);
    const gridId = Number(customer?.gridId || 0);
    return gridId > 0 ? [gridId] : [];
  }

  if (req.user?.role === "admin") {
    const operatorId = String(req.query.operatorId || "all").trim();
    if (!operatorId || operatorId.toLowerCase() === "all") {
      return null;
    }

    const operator = await operatorStore.getOperatorById(operatorId);
    return normalizeAssignedGridIds(operator?.assignedMicrogrids || []);
  }

  return null;
}

async function buildUnifiedEnergyData() {
  const [latestLogs, currentData] = await Promise.all([
    EnergyLog.find().sort({ timestamp: -1 }).limit(400).lean(),
    Promise.resolve(simulator.getData()),
  ]);

  const currentByGrid = [...currentData].sort((a, b) => Number(a.gridId) - Number(b.gridId));
  const totals = computeEnergyTotals(currentByGrid);

  const grouped = {};
  latestLogs.forEach((log) => {
    const key = new Date(log.timestamp).toISOString();
    if (!grouped[key]) {
      grouped[key] = { generation: 0, consumption: 0 };
    }
    grouped[key].generation += Number(log.generation || 0);
    grouped[key].consumption += Number(log.consumption || 0);
  });

  const sortedKeys = Object.keys(grouped).sort();
  const trimmedKeys = sortedKeys.slice(-24);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    grids: currentByGrid.map((grid) => ({
      gridId: grid.gridId,
      generation: Number(grid.energyGenerated || 0),
      consumption: Number(grid.consumption || 0),
      batteryLevel: Number(grid.batteryLevel || 0),
      status: grid.status,
    })),
    trend: {
      labels: trimmedKeys.map((key) => {
        const d = new Date(key);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }),
      generation: trimmedKeys.map((key) => roundToTwo(grouped[key].generation)),
      consumption: trimmedKeys.map((key) => roundToTwo(grouped[key].consumption)),
    },
  };
}

async function getEnergyData(req, res) {
  try {
    const energyData = await buildUnifiedEnergyData();
    const requestedType = String(req.query.type || "day").toLowerCase();
    const comparisonType = ["day", "month", "year"].includes(requestedType) ? requestedType : "day";
    const scopedGridIds = getScopedGridIds(req);

    let scopedGrids = [...energyData.grids];
    if (Array.isArray(scopedGridIds)) {
      const allowed = new Set(scopedGridIds);
      scopedGrids = scopedGrids.filter((grid) => allowed.has(Number(grid.gridId)));
    }

    const scopedGridIdList = scopedGrids
      .map((grid) => Number(grid.gridId))
      .filter((value) => Number.isFinite(value) && value > 0);

    const logs = await EnergyLog.find({
      gridId: { $in: scopedGridIdList.length ? scopedGridIdList : [-1] },
      timestamp: { $gte: comparisonLowerBound(comparisonType) },
    })
      .sort({ timestamp: 1 })
      .lean();

    const grouped = new Map();
    logs.forEach((row) => {
      const key = comparisonKey(comparisonType, row.timestamp);
      if (!grouped.has(key)) {
        grouped.set(key, { generation: 0, consumption: 0 });
      }

      const bucket = grouped.get(key);
      bucket.generation += Number(row.generation || 0);
      bucket.consumption += Number(row.consumption || 0);
    });

    const comparisonLabels = Array.from(grouped.keys());
    let comparisonGeneration = comparisonLabels.map((label) => roundToTwo(grouped.get(label).generation));
    let comparisonConsumption = comparisonLabels.map((label) => roundToTwo(grouped.get(label).consumption));

    if (!comparisonLabels.length) {
      comparisonLabels.push("Now");
      comparisonGeneration = [roundToTwo(scopedGrids.reduce((sum, grid) => sum + Number(grid.generation || 0), 0))];
      comparisonConsumption = [roundToTwo(scopedGrids.reduce((sum, grid) => sum + Number(grid.consumption || 0), 0))];
    }

    return res.status(200).json({
      ...energyData,
      grids: scopedGrids,
      comparison: {
        type: comparisonType,
        labels: comparisonLabels,
        generation: comparisonGeneration,
        consumption: comparisonConsumption,
      },
      totals: computeEnergyTotals(
        scopedGrids.map((grid) => ({
          energyGenerated: grid.generation,
          consumption: grid.consumption,
        }))
      ),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load unified energy data", error: error.message });
  }
}

async function getAdminAnalytics(req, res) {
  try {
    const [latestLogs, energyData] = await Promise.all([
      EnergyLog.find().sort({ timestamp: -1 }).limit(300).lean(),
      buildUnifiedEnergyData(),
    ]);

    const scopedGridIds = getScopedGridIds(req);
    const scopedEnergyGrids = Array.isArray(scopedGridIds)
      ? energyData.grids.filter((grid) => new Set(scopedGridIds).has(Number(grid.gridId)))
      : energyData.grids;

    const currentByGrid = scopedEnergyGrids.map((grid) => ({
      gridId: grid.gridId,
      energyGenerated: grid.generation,
      consumption: grid.consumption,
      batteryLevel: grid.batteryLevel,
      status: grid.status,
    }));

    const currentGridIds = currentByGrid
      .map((grid) => Number(grid.gridId))
      .filter((value) => Number.isFinite(value) && value > 0);

    const alerts = await getAlertsData({ gridIds: currentGridIds });

    const scopedLogs = latestLogs.filter((row) => currentGridIds.includes(Number(row.gridId)));

    const trendBuckets = {};
    scopedLogs.forEach((row) => {
      const key = new Date(row.timestamp).toISOString();
      if (!trendBuckets[key]) {
        trendBuckets[key] = { generation: 0, consumption: 0 };
      }
      trendBuckets[key].generation += Number(row.generation || 0);
      trendBuckets[key].consumption += Number(row.consumption || 0);
    });

    const trendKeys = Object.keys(trendBuckets).sort().slice(-24);
    const trendLabels = trendKeys.map((key) => {
      const d = new Date(key);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const trendGeneration = trendKeys.map((key) => roundToTwo(trendBuckets[key].generation));
    const trendConsumption = trendKeys.map((key) => roundToTwo(trendBuckets[key].consumption));

    if (!trendLabels.length) {
      trendLabels.push("Now");
      trendGeneration.push(roundToTwo(currentByGrid.reduce((sum, grid) => sum + Number(grid.energyGenerated || 0), 0)));
      trendConsumption.push(roundToTwo(currentByGrid.reduce((sum, grid) => sum + Number(grid.consumption || 0), 0)));
    }

    const scopedTotals = computeEnergyTotals(
      currentByGrid.map((grid) => ({
        energyGenerated: grid.energyGenerated,
        consumption: grid.consumption,
      }))
    );

    const energyBalance = {
      labels: currentByGrid.map((g) => `Grid ${g.gridId}`),
      generation: currentByGrid.map((g) => g.energyGenerated),
      consumption: currentByGrid.map((g) => g.consumption),
    };

    const batteryHeatmap = currentByGrid.map((g) => ({
      gridId: g.gridId,
      batteryLevel: g.batteryLevel,
      status: g.status,
    }));

    const distributionTotal = currentByGrid.reduce((sum, g) => sum + g.consumption, 0);
    const houses = Math.round(distributionTotal * 0.58);
    const industries = Math.max(0, distributionTotal - houses);

    const predictedSeries = movingAverage(trendConsumption, 3);

    const currentAvgBattery =
      currentByGrid.reduce((sum, g) => sum + g.batteryLevel, 0) /
      (currentByGrid.length || 1);

    let pastAvgBattery = currentAvgBattery;
    if (scopedLogs.length) {
      const olderSlice = scopedLogs.slice(-Math.min(50, scopedLogs.length));
      pastAvgBattery =
        olderSlice.reduce((sum, l) => sum + l.battery, 0) / olderSlice.length;
    }

    const drop = Math.round(pastAvgBattery - currentAvgBattery);

    const insights = [];
    alerts.forEach((a) => {
      insights.push(
        insight(
          a.type,
          "high",
          `Grid ${a.gridId} has ${a.type.toLowerCase().replace("_", " ")}`,
          "Review dispatch plan and rebalance connected loads.",
          a.gridId
        )
      );
    });
    if (drop >= 10) {
      insights.push(
        insight(
          "BATTERY_DROP",
          "high",
          `Battery efficiency dropped by ${drop}% compared to recent baseline`,
          "Schedule battery diagnostics and reduce discharge depth this cycle."
        )
      );
    }
    if (scopedTotals.energyGap < 0) {
      insights.push(
        insight(
          "NET_DEFICIT",
          "high",
          "City is in net deficit. Shift load to surplus grids.",
          "Trigger demand response for non-critical loads."
        )
      );
    }
    if (!insights.length) {
      insights.push(
        insight(
          "STABLE",
          "low",
          "System is stable. Keep current load strategy.",
          "Maintain monitoring cadence."
        )
      );
    }

    res.json({
      energyBalance,
      batteryHeatmap,
      timeSeries: {
        labels: trendLabels,
        generation: trendGeneration,
        consumption: trendConsumption,
      },
      distribution: {
        labels: ["Houses", "Industries"],
        values: [houses, industries],
      },
      predictionSeries: {
        labels: trendLabels,
        actual: trendConsumption,
        predicted: predictedSeries,
      },
      totals: scopedTotals,
      insights,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build admin analytics", error: error.message });
  }
}

async function getOperatorAnalytics(req, res) {
  try {
    const [latestLogs, energyData] = await Promise.all([
      EnergyLog.find().sort({ timestamp: -1 }).limit(400).lean(),
      buildUnifiedEnergyData(),
    ]);

    const currentData = energyData.grids.map((grid) => ({
      gridId: grid.gridId,
      energyGenerated: grid.generation,
      consumption: grid.consumption,
      batteryLevel: grid.batteryLevel,
      status: grid.status,
    }));

    const alerts = await getAlertsData();

    const severity = { critical: 0, warning: 0, normal: 0 };
    alerts.forEach((a) => {
      if (a.status && a.status !== "OPEN") {
        return;
      }

      if (String(a.severity || "").toUpperCase() === "HIGH") {
        severity.critical += 1;
      } else {
        severity.warning += 1;
      }
    });
    severity.normal = Math.max(0, currentData.length - severity.critical - severity.warning);

    const loadDistribution = {
      labels: currentData.map((g) => `Grid ${g.gridId}`),
      values: currentData.map((g) => g.consumption),
    };

    const batteryByGrid = {};
    latestLogs.forEach((log) => {
      if (!batteryByGrid[log.gridId]) {
        batteryByGrid[log.gridId] = [];
      }
      batteryByGrid[log.gridId].push(log);
    });

    const batteryTrend = {
      labels: [],
      series: [],
    };

    Object.keys(batteryByGrid)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((gridId) => {
        const logs = batteryByGrid[gridId]
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .slice(-12);

        if (!batteryTrend.labels.length) {
          batteryTrend.labels = logs.map((l) => {
            const t = new Date(l.timestamp);
            return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
          });
        }

        batteryTrend.series.push({
          label: `Grid ${gridId}`,
          data: logs.map((l) => l.battery),
        });
      });

    const maintenanceForecast = currentData.map((g) => {
      const recent = latestLogs.filter((l) => l.gridId === g.gridId).slice(0, 30);
      const overloadHits = recent.filter((l) => l.consumption > l.generation).length;
      const lowBatteryHits = recent.filter((l) => l.battery < 20).length;
      const risk = Math.min(95, Math.round(overloadHits * 2 + lowBatteryHits * 3 + (g.status === "critical" ? 20 : 0)));
      return { gridId: g.gridId, probability: risk };
    });

    const insights = [];
    const overloaded = currentData.filter((g) => g.consumption > g.energyGenerated);
    overloaded.forEach((g) => {
      insights.push(
        insight(
          "OVERLOAD",
          "high",
          `Grid ${g.gridId} overloaded. Consider load shift.`,
          "Shift non-critical load to adjacent grids.",
          g.gridId
        )
      );
    });
    const weakBattery = currentData.filter((g) => g.batteryLevel < 20);
    weakBattery.forEach((g) => {
      insights.push(
        insight(
          "LOW_BATTERY",
          "high",
          `Grid ${g.gridId} battery critical. Prioritize dispatch.`,
          "Dispatch charging support and cap heavy loads.",
          g.gridId
        )
      );
    });
    if (!insights.length) {
      insights.push(
        insight(
          "NORMAL",
          "low",
          "No immediate operator intervention required.",
          "Continue regular monitoring."
        )
      );
    }

    res.json({
      alertSeverity: severity,
      batteryTrend,
      loadDistribution,
      maintenanceForecast,
      totals: energyData.totals,
      insights,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build operator analytics", error: error.message });
  }
}

async function getCustomerAnalytics(req, res) {
  try {
    const customerId = req.params.id;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const latestLogs = await EnergyLog.find().sort({ timestamp: -1 }).limit(300).lean();
    const energyData = await buildUnifiedEnergyData();
    const currentData = energyData.grids;
    const numericCustomerId = Number(String(customer.id).replace(/\D/g, "")) || 1;
    const baseGrid = ((numericCustomerId - 1) % Math.max(currentData.length, 1)) + 1;
    const series = latestLogs
      .filter((l) => l.gridId === baseGrid)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-30);

    const fallbackUsage = Math.max(1, Math.round(Number(customer.energyUsage || 1) / 30));
    const usageValues = (series.length
      ? series.map((l) => Math.max(1, Math.round(l.consumption * 0.1)))
      : Array.from({ length: 30 }, () => fallbackUsage)
    );
    const labels = usageValues.map((_, i) => `Day ${i + 1}`);

    const totalUsage = usageValues.reduce((sum, v) => sum + v, 0);
    const baseRate = 5;
    const energyCost = roundToTwo(totalUsage * baseRate);
    const expectedUsage = roundToTwo(totalUsage * 1.2);
    const savingsAmount = computeSavings(expectedUsage, totalUsage, baseRate);
    const actualCost = energyCost;

    const savingsTrend = usageValues.map((v, i) => Math.round(v * 0.9 + i * 0.5));
    const usageLimit = 500;

    const insights = [];
    if (totalUsage > usageLimit) {
      insights.push(
        insight(
          "USAGE_LIMIT_EXCEEDED",
          "high",
          "Usage exceeded monthly limit. Consider shifting heavy loads to off-peak hours.",
          "Move pump/heating/EV loads to off-peak periods."
        )
      );
    } else {
      insights.push(
        insight(
          "USAGE_WITHIN_LIMIT",
          "low",
          "Usage is within limit. Good energy discipline this month.",
          "Maintain current usage pattern."
        )
      );
    }
    insights.push(
      insight(
        "RENEWABLE_SAVINGS",
        "medium",
        `You saved INR ${savingsAmount} this month through efficient usage.`,
        "Increase daytime renewable utilization to improve savings."
      )
    );

    res.json({
      customerId: customer.id,
      customerName: customer.name,
      usageTrend: {
        labels,
        values: usageValues,
      },
      costBreakdown: {
        labels: ["Energy Cost", "Expected Cost", "Savings"],
        values: [energyCost, roundToTwo(expectedUsage * baseRate), savingsAmount],
      },
      savingsTrend: {
        labels,
        values: savingsTrend,
      },
      usageVsLimit: {
        limit: usageLimit,
        actual: totalUsage,
      },
      savingsAmount,
      totals: energyData.totals,
      insights,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build customer analytics", error: error.message });
  }
}

module.exports = {
  getEnergyData,
  getAdminAnalytics,
  getOperatorAnalytics,
  getCustomerAnalytics,
};
