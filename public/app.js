const API_BASE = "http://localhost:5000";

// =====================================
// Auth Protection
// =====================================
const role = localStorage.getItem("role");
const token = localStorage.getItem("token");

if (role !== "admin" || !token) {
  window.location.href = "/dashboard/index.html";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("customerId");
  window.location.href = "/dashboard/index.html";
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function authFetch(url, options = {}) {
  const merged = {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
    },
  };

  const response = await fetch(url, merged);
  if (response.status === 401 || response.status === 403) {
    logout();
    throw new Error("Unauthorized");
  }
  return response;
}

function formatInsight(insight) {
  if (typeof insight === "string") {
    return insight;
  }

  const message = insight?.message || "Insight unavailable";
  const action = insight?.action ? ` Action: ${insight.action}` : "";
  return `${message}${action}`;
}

function formatInr(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

// =====================================
// View State
// =====================================
const views = {
  dashboard: document.getElementById("dashboardView"),
  operators: document.getElementById("operatorsView"),
  alerts: document.getElementById("alertsView"),
  billing: document.getElementById("billingView"),
};

const headerTitle = document.getElementById("headerTitle");
const navLinks = Array.from(document.querySelectorAll(".nav-link[data-view]"));
const adminOperatorFilter = document.getElementById("adminOperatorFilter");
const adminOperatorBadge = document.getElementById("adminOperatorBadge");
const clearOperatorFilterBtn = document.getElementById("clearOperatorFilterBtn");
let selectedOperatorId = "all";
let adminOperatorsCache = [];

function withOperatorFilter(url) {
  if (!selectedOperatorId || selectedOperatorId === "all") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}operatorId=${encodeURIComponent(selectedOperatorId)}`;
}

async function loadAdminOperatorFilterOptions() {
  try {
    const response = await authFetch(`${API_BASE}/company/operators`);
    const operators = await response.json();
    adminOperatorsCache = operators;

    adminOperatorFilter.innerHTML = '<option value="all">All Operators</option>';
    operators.forEach((operator) => {
      const option = document.createElement("option");
      option.value = operator.id;
      option.textContent = operator.name;
      adminOperatorFilter.appendChild(option);
    });

    const hasCurrent = operators.some((operator) => operator.id === selectedOperatorId);
    if (!hasCurrent) {
      selectedOperatorId = "all";
    }
    adminOperatorFilter.value = selectedOperatorId;
    updateAdminOperatorBadge();
  } catch (error) {
    console.error("Failed to load operator filter options:", error);
  }
}

function updateAdminOperatorBadge() {
  if (!adminOperatorBadge) {
    return;
  }

  if (!selectedOperatorId || selectedOperatorId === "all") {
    adminOperatorBadge.textContent = "Viewing: All Operators";
    return;
  }

  const match = adminOperatorsCache.find((operator) => operator.id === selectedOperatorId);
  adminOperatorBadge.textContent = `Viewing: ${match ? match.name : selectedOperatorId}`;
}

adminOperatorFilter.addEventListener("change", async () => {
  selectedOperatorId = adminOperatorFilter.value || "all";
  updateAdminOperatorBadge();
  await fetchDashboardData();

  if (!views.alerts.classList.contains("hidden")) {
    await loadAlertsModule();
  }
});

clearOperatorFilterBtn.addEventListener("click", async () => {
  selectedOperatorId = "all";
  adminOperatorFilter.value = "all";
  updateAdminOperatorBadge();
  await fetchDashboardData();

  if (!views.alerts.classList.contains("hidden")) {
    await loadAlertsModule();
  }
});

function switchAdminView(view) {
  Object.keys(views).forEach((key) => {
    views[key].classList.toggle("hidden", key !== view);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  const titleMap = {
    dashboard: "Overview",
    operators: "Operators Management",
    alerts: "Alerts Module",
    billing: "Billing Module",
  };
  headerTitle.textContent = titleMap[view] || "Overview";

  if (view === "operators") {
    loadOperators();
  } else if (view === "alerts") {
    loadAlertsModule();
  } else if (view === "billing") {
    loadBillingOverview();
    loadDisputes();
    loadMaintenanceTickets();
    loadAuditLogs();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const view = link.dataset.view;
    switchAdminView(view);
  });
});

// =====================================
// Dashboard Module
// =====================================
const kpiTotalGen = document.getElementById("kpiTotalGen");
const kpiTotalConsum = document.getElementById("kpiTotalConsum");
const kpiAvgBattery = document.getElementById("kpiAvgBattery");
const kpiAlerts = document.getElementById("kpiAlerts");
const kpiPrediction = document.getElementById("kpiPrediction");
const alertsKpiCard = document.getElementById("alertsKpiCard");

const microgridTableBody = document.getElementById("microgridTableBody");
const alertsList = document.getElementById("alertsList");
const insightsList = document.getElementById("insightsList");
const batteryHeatmap = document.getElementById("batteryHeatmap");

let energyChart = null;
let batteryChart = null;
let trendChart = null;
let distributionChart = null;
let predictionChart = null;

Chart.defaults.color = "#94a3b8";
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(15, 17, 21, 0.9)";

async function fetchDashboardData() {
  try {
    const [analyticsRes, alertsRes, energyRes] = await Promise.all([
      authFetch(withOperatorFilter(`${API_BASE}/analytics/admin`)),
      authFetch(withOperatorFilter(`${API_BASE}/alerts`)),
      authFetch(withOperatorFilter(`${API_BASE}/analytics/energy-data`)),
    ]);

    if (!analyticsRes.ok || !alertsRes.ok || !energyRes.ok) {
      throw new Error("Network response was not ok");
    }

    const analytics = await analyticsRes.json();
    const alerts = await alertsRes.json();
    const energy = await energyRes.json();
    const grids = (energy.grids || []).map((grid) => ({
      gridId: grid.gridId,
      energyGenerated: grid.generation,
      consumption: grid.consumption,
      batteryLevel: grid.batteryLevel,
      status: grid.status,
    }));

    updateDashboard(grids, alerts, analytics);
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
  }
}

function updateDashboard(grids, alerts, analytics) {
  const totGen = grids.reduce((sum, grid) => sum + Number(grid.energyGenerated || 0), 0);
  const totConsum = grids.reduce((sum, grid) => sum + Number(grid.consumption || 0), 0);
  const totBatt = grids.reduce((sum, grid) => sum + Number(grid.batteryLevel || 0), 0);

  const avgBatt = grids.length > 0 ? Math.round(totBatt / grids.length) : 0;

  kpiTotalGen.textContent = totGen.toLocaleString();
  kpiTotalConsum.textContent = totConsum.toLocaleString();
  kpiAvgBattery.textContent = `${avgBatt}%`;
  kpiAlerts.textContent = alerts.length;
  const lastPred = analytics.predictionSeries.predicted[analytics.predictionSeries.predicted.length - 1] || 0;
  kpiPrediction.textContent = `${lastPred} kWh`;

  alertsKpiCard.style.animation = alerts.length > 0 ? "pulse-red 2s infinite" : "none";

  microgridTableBody.innerHTML = "";
  grids.forEach((g) => {
    const tr = document.createElement("tr");

    let batColor = "#10b981";
    if (g.batteryLevel < 20) batColor = "#ef4444";
    else if (g.batteryLevel < 40) batColor = "#f59e0b";

    tr.innerHTML = `
      <td><strong>${g.gridId}</strong></td>
      <td>${g.energyGenerated}</td>
      <td>${g.consumption}</td>
      <td>
        <div class="bat-bar">
          ${g.batteryLevel}%
          <div class="bat-track">
            <div class="bat-fill" style="width: ${g.batteryLevel}%; background-color: ${batColor};"></div>
          </div>
        </div>
      </td>
    `;
    microgridTableBody.appendChild(tr);
  });

  alertsList.innerHTML = "";
  if (alerts.length === 0) {
    alertsList.innerHTML = '<li class="no-alerts">No active alerts</li>';
  } else {
    alerts.forEach((a) => {
      const li = document.createElement("li");
      const isCritical = String(a.severity || "").toUpperCase() === "HIGH";
      li.className = `alert-item ${isCritical ? "critical" : "warning"}`;
      li.innerHTML = `
        <div class="alert-icon">!</div>
        <div class="alert-content">
          <p>${a.type || "System Alert"} (${a.status || "OPEN"})</p>
          <small>Microgrid: ${a.gridId} | Severity: ${a.severity || "LOW"}</small>
        </div>
      `;
      alertsList.appendChild(li);
    });
  }

  insightsList.innerHTML = "";
  if (!analytics.insights.length) {
    insightsList.innerHTML = '<li class="no-alerts">No insights generated</li>';
  } else {
    analytics.insights.forEach((insight) => {
      const li = document.createElement("li");
      li.className = "alert-item warning";
      li.innerHTML = `
        <div class="alert-icon">i</div>
        <div class="alert-content">
          <p>${formatInsight(insight)}</p>
        </div>
      `;
      insightsList.appendChild(li);
    });
  }

  renderHeatmap(analytics.batteryHeatmap);
  updateCharts(analytics);
}

function renderHeatmap(items) {
  batteryHeatmap.innerHTML = "";
  items.forEach((item) => {
    const cell = document.createElement("div");
    const levelClass = item.batteryLevel < 20 ? "heatmap-level-low" : item.batteryLevel < 50 ? "heatmap-level-mid" : "heatmap-level-high";
    cell.className = `heatmap-cell ${levelClass}`;
    cell.innerHTML = `<strong>Grid ${item.gridId}</strong><span>${item.batteryLevel}%</span>`;
    batteryHeatmap.appendChild(cell);
  });
}

function updateCharts(analytics) {
  const labels = analytics.energyBalance.labels;
  const genData = analytics.energyBalance.generation;
  const consumData = analytics.energyBalance.consumption;
  const battData = analytics.batteryHeatmap.map((b) => b.batteryLevel);

  if (energyChart) {
    energyChart.data.labels = labels;
    energyChart.data.datasets[0].data = genData;
    energyChart.data.datasets[1].data = consumData;
    energyChart.update("none");
  } else {
    const ctx = document.getElementById("energyChart").getContext("2d");
    energyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Generation",
            data: genData,
            backgroundColor: "rgba(59, 130, 246, 0.8)",
            borderRadius: 4,
          },
          {
            label: "Consumption",
            data: consumData,
            backgroundColor: "rgba(139, 92, 246, 0.8)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 260, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  if (batteryChart) {
    batteryChart.data.labels = labels;
    batteryChart.data.datasets[0].data = battData;
    batteryChart.update("none");
  } else {
    const ctx = document.getElementById("batteryChart").getContext("2d");
    const battGrad = ctx.createLinearGradient(0, 0, 0, 400);
    battGrad.addColorStop(0, "rgba(16, 185, 129, 0.4)");
    battGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    batteryChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Battery Level %",
          data: battData,
          borderColor: "#10b981",
          backgroundColor: battGrad,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#10b981",
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  if (trendChart) {
    trendChart.data.labels = analytics.timeSeries.labels;
    trendChart.data.datasets[0].data = analytics.timeSeries.generation;
    trendChart.data.datasets[1].data = analytics.timeSeries.consumption;
    trendChart.update("none");
  } else {
    const ctx = document.getElementById("trendChart").getContext("2d");
    trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: analytics.timeSeries.labels,
        datasets: [
          { label: "Generation", data: analytics.timeSeries.generation, borderColor: "#10b981", tension: 0.35 },
          { label: "Consumption", data: analytics.timeSeries.consumption, borderColor: "#ef4444", tension: 0.35 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  if (distributionChart) {
    distributionChart.data.labels = analytics.distribution.labels;
    distributionChart.data.datasets[0].data = analytics.distribution.values;
    distributionChart.update("none");
  } else {
    const ctx = document.getElementById("distributionChart").getContext("2d");
    distributionChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: analytics.distribution.labels,
        datasets: [{
          data: analytics.distribution.values,
          backgroundColor: ["rgba(59, 130, 246, 0.8)", "rgba(245, 158, 11, 0.8)"],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  if (predictionChart) {
    predictionChart.data.labels = analytics.predictionSeries.labels;
    predictionChart.data.datasets[0].data = analytics.predictionSeries.actual;
    predictionChart.data.datasets[1].data = analytics.predictionSeries.predicted;
    predictionChart.update("none");
  } else {
    const ctx = document.getElementById("predictionChart").getContext("2d");
    predictionChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: analytics.predictionSeries.labels,
        datasets: [
          { label: "Actual", data: analytics.predictionSeries.actual, borderColor: "#3b82f6", tension: 0.3 },
          { label: "Predicted", data: analytics.predictionSeries.predicted, borderColor: "#8b5cf6", borderDash: [6, 6], tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

// =====================================
// Operator Module
// =====================================
const operatorForm = document.getElementById("operatorForm");
const operatorTableBody = document.getElementById("operatorTableBody");
const operatorEditModal = document.getElementById("operatorEditModal");
const operatorEditForm = document.getElementById("operatorEditForm");
const closeOperatorModal = document.getElementById("closeOperatorModal");
const cancelOperatorEdit = document.getElementById("cancelOperatorEdit");
const editOperatorName = document.getElementById("editOperatorName");
const editOperatorPassword = document.getElementById("editOperatorPassword");
const editOperatorGrids = document.getElementById("editOperatorGrids");
const editOperatorGridCount = document.getElementById("editOperatorGridCount");
const editOperatorLocation = document.getElementById("editOperatorLocation");
let editingOperatorId = null;

async function loadOperators() {
  try {
    const response = await authFetch(`${API_BASE}/company/operators`);
    const operators = await response.json();

    operatorTableBody.innerHTML = "";
    if (!operators.length) {
      operatorTableBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No operators available</td></tr>';
      return;
    }

    operators.forEach((operator) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${operator.name}</td>
        <td>********</td>
        <td>${operator.gridCount}</td>
        <td>${operator.location}</td>
        <td>
          <button class="ghost-btn" data-operator-edit-id="${operator.id}">Edit</button>
          <button class="ghost-btn danger-btn" data-operator-id="${operator.id}">Delete</button>
        </td>
      `;
      tr.dataset.operatorName = operator.name;
      tr.dataset.operatorGridCount = operator.gridCount;
      tr.dataset.operatorLocation = operator.location;
      tr.dataset.operatorGrids = (operator.assignedMicrogrids || []).join(",");
      operatorTableBody.appendChild(tr);
    });

    await loadAdminOperatorFilterOptions();
  } catch (error) {
    console.error("Failed to load operators:", error);
  }
}

operatorForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("operatorName").value.trim(),
    password: document.getElementById("operatorPassword").value.trim(),
    gridCount: Number(document.getElementById("operatorGridCount").value),
    location: document.getElementById("operatorLocation").value.trim(),
  };

  try {
    const response = await authFetch(`${API_BASE}/company/operators`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to add operator");
      return;
    }

    operatorForm.reset();
    await loadOperators();
  } catch (error) {
    console.error("Failed to add operator:", error);
  }
});

operatorTableBody.addEventListener("click", async (event) => {
  const editButton = event.target.closest("button[data-operator-edit-id]");
  if (editButton) {
    const operatorId = editButton.getAttribute("data-operator-edit-id");
    const row = editButton.closest("tr");
    editingOperatorId = operatorId;
    editOperatorName.value = row?.dataset?.operatorName || "";
    editOperatorPassword.value = "";
    editOperatorGrids.value = row?.dataset?.operatorGrids || "";
    editOperatorGridCount.value = row?.dataset?.operatorGridCount || "0";
    editOperatorLocation.value = row?.dataset?.operatorLocation || "";

    operatorEditModal.classList.add("active");
    return;
  }

  const button = event.target.closest("button[data-operator-id]");
  if (!button) {
    return;
  }

  const operatorId = button.getAttribute("data-operator-id");
  if (!operatorId) {
    return;
  }

  try {
    const response = await authFetch(`${API_BASE}/company/operators/${operatorId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to delete operator");
      return;
    }

    await loadOperators();
  } catch (error) {
    console.error("Failed to delete operator:", error);
  }
});

function closeOperatorEditModal() {
  operatorEditModal.classList.remove("active");
  editingOperatorId = null;
}

closeOperatorModal.addEventListener("click", closeOperatorEditModal);
cancelOperatorEdit.addEventListener("click", closeOperatorEditModal);

operatorEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingOperatorId) {
    return;
  }

  const payload = {
    name: editOperatorName.value.trim(),
    location: editOperatorLocation.value.trim(),
  };

  const password = editOperatorPassword.value.trim();
  if (password) {
    payload.password = password;
  }

  const gridListRaw = editOperatorGrids.value.trim();
  if (gridListRaw) {
    const numbers = gridListRaw
      .split(",")
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    payload.assignedMicrogrids = numbers.map((value) => `mg-${value}`);
  } else if (editOperatorGridCount.value !== "") {
    payload.gridCount = Number(editOperatorGridCount.value);
  }

  try {
    const response = await authFetch(`${API_BASE}/company/operators/${editingOperatorId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to update operator");
      return;
    }

    closeOperatorEditModal();
    await loadOperators();
  } catch (error) {
    console.error("Failed to update operator:", error);
  }
});

// =====================================
// Alerts Module
// =====================================
const alertsModuleList = document.getElementById("alertsModuleList");
const refreshAlertsBtn = document.getElementById("refreshAlertsBtn");
const resolvedAlertsBody = document.getElementById("resolvedAlertsBody");

async function loadAlertsModule() {
  try {
    const response = await authFetch(withOperatorFilter(`${API_BASE}/alerts`));
    const alerts = await response.json();

    alertsModuleList.innerHTML = "";
    if (!alerts.length) {
      alertsModuleList.innerHTML = '<li class="no-alerts">No active alerts</li>';
      return;
    }

    alerts.forEach((alertItem) => {
      const li = document.createElement("li");
      const isCritical = String(alertItem.severity || "").toUpperCase() === "HIGH";
      li.className = `alert-item ${isCritical ? "critical" : "warning"}`;
      const deleteLabel = alertItem.canDelete
        ? "Delete"
        : `Delete in ${alertItem.secondsToDelete}s`;
      li.innerHTML = `
        <div class="alert-icon">!</div>
        <div class="alert-content">
          <p>${alertItem.type} - ${alertItem.message}</p>
          <small>Grid ${alertItem.gridId} | Severity: ${alertItem.severity} | Status: ${alertItem.status} | Expires in ${alertItem.secondsToExpire}s</small>
        </div>
        <button class="ghost-btn danger-btn" data-alert-id="${alertItem.id}" ${alertItem.canDelete ? "" : "disabled"}>${deleteLabel}</button>
      `;
      alertsModuleList.appendChild(li);
    });

    await loadResolvedAlertsHistory();
  } catch (error) {
    console.error("Failed to load alerts module:", error);
  }
}

async function loadResolvedAlertsHistory() {
  try {
    const response = await authFetch(withOperatorFilter(`${API_BASE}/alerts/history/resolved?limit=50`));
    const payload = await response.json();
    const history = payload.history || [];

    resolvedAlertsBody.innerHTML = "";
    if (!history.length) {
      resolvedAlertsBody.innerHTML = '<tr><td colspan="6" class="no-alerts">No resolved alerts</td></tr>';
      return;
    }

    history.forEach((row) => {
      const tr = document.createElement("tr");
      const severityClass = String(row.severity || "").toUpperCase() === "HIGH" ? "text-danger" : "text-warning";
      tr.innerHTML = `
        <td>${row.type}</td>
        <td>${row.gridId}</td>
        <td><span class="${severityClass}">${row.severity}</span></td>
        <td>${row.status}</td>
        <td>${row.resolvedAt ? new Date(row.resolvedAt).toLocaleString() : "--"}</td>
        <td>${row.resolutionReason || "--"}</td>
      `;
      resolvedAlertsBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load resolved alerts history:", error);
  }
}

refreshAlertsBtn.addEventListener("click", loadAlertsModule);

alertsModuleList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-alert-id]");
  if (!button) {
    return;
  }

  const alertId = button.getAttribute("data-alert-id");
  if (!alertId) {
    return;
  }

  try {
    const response = await authFetch(`${API_BASE}/alerts/${alertId}`, {
      method: "DELETE",
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Failed to delete alert");
      return;
    }

    await loadAlertsModule();
    await fetchDashboardData();
  } catch (error) {
    console.error("Failed to delete alert:", error);
  }
});

// =====================================
// Billing Module - Tariff Rate Management
// =====================================
const tariffRateInput = document.getElementById("tariffRateInput");
const saveTariffRateBtn = document.getElementById("saveTariffRateBtn");
const tariffRateHistoryBody = document.getElementById("tariffRateHistoryBody");
const currentTariffRate = document.getElementById("currentTariffRate");
const totalCustomersCount = document.getElementById("totalCustomersCount");
const pendingBillsCount = document.getElementById("pendingBillsCount");
const totalRevenueAmount = document.getElementById("totalRevenueAmount");
const billingSummaryBody = document.getElementById("billingSummaryBody");
const disputesTableBody = document.getElementById("disputesTableBody");
const refreshDisputesBtn = document.getElementById("refreshDisputesBtn");
const maintenanceTableBody = document.getElementById("maintenanceTableBody");
const refreshMaintenanceBtn = document.getElementById("refreshMaintenanceBtn");
const auditTableBody = document.getElementById("auditTableBody");
const refreshAuditBtn = document.getElementById("refreshAuditBtn");

async function loadBillingOverview() {
  try {
    const [ratesRes, summaryRes] = await Promise.all([
      authFetch(`${API_BASE}/company/billing/tariff-rate`),
      authFetch(`${API_BASE}/company/billing/summary`),
    ]);

    const rates = await ratesRes.json();
    const summary = await summaryRes.json();

    currentTariffRate.textContent = `${Number(rates.currentRate || 0).toFixed(2)} ₹/kWh`;
    tariffRateInput.value = rates.currentRate || "";

    totalCustomersCount.textContent = summary.totalCustomers || 0;
    pendingBillsCount.textContent = summary.pendingBills || 0;
    totalRevenueAmount.textContent = `₹ ${Number(summary.totalRevenue || 0).toFixed(2)}`;

    renderBillingSummary(summary.customerBills || []);
    await loadTariffRateHistory();
  } catch (error) {
    console.error("Failed to load billing overview:", error);
  }
}

async function loadDisputes() {
  try {
    const response = await authFetch(`${API_BASE}/company/billing/disputes?limit=50`);
    const payload = await response.json();
    const disputes = payload.disputes || [];

    disputesTableBody.innerHTML = "";
    if (!disputes.length) {
      disputesTableBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No disputes found</td></tr>';
      return;
    }

    disputes.forEach((entry) => {
      const tr = document.createElement("tr");
      const statusClass = entry.status === "OPEN" ? "text-warning" : "text-success";
      const actionLabel = entry.status === "OPEN" ? "Resolve" : "View";
      tr.innerHTML = `
        <td>${entry.customerId}</td>
        <td>${entry.month}</td>
        <td>${entry.reason}</td>
        <td><span class="${statusClass}">${entry.status}</span></td>
        <td><button class="ghost-btn" data-dispute-id="${entry.id}" data-dispute-status="${entry.status}">${actionLabel}</button></td>
      `;
      disputesTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load disputes:", error);
  }
}

async function loadMaintenanceTickets() {
  try {
    const response = await authFetch(`${API_BASE}/company/maintenance/tickets?limit=50`);
    const payload = await response.json();
    const tickets = payload.tickets || [];

    maintenanceTableBody.innerHTML = "";
    if (!tickets.length) {
      maintenanceTableBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No maintenance tickets</td></tr>';
      return;
    }

    tickets.forEach((ticket) => {
      const statusClass = ticket.status === "RESOLVED" ? "text-success" : "text-warning";
      const actionLabel = ticket.status === "RESOLVED" ? "View" : "Resolve";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ticket.gridId}</td>
        <td>${ticket.title}</td>
        <td>${ticket.priority}</td>
        <td><span class="${statusClass}">${ticket.status}</span></td>
        <td><button class="ghost-btn" data-maintenance-id="${ticket.id}" data-maintenance-status="${ticket.status}">${actionLabel}</button></td>
      `;
      maintenanceTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load maintenance tickets:", error);
  }
}

async function loadAuditLogs() {
  try {
    const response = await authFetch(`${API_BASE}/company/audit/logs?limit=50`);
    const payload = await response.json();
    const rows = payload.rows || [];

    auditTableBody.innerHTML = "";
    if (!rows.length) {
      auditTableBody.innerHTML = '<tr><td colspan="4" class="no-alerts">No audit logs</td></tr>';
      return;
    }

    rows.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(entry.createdAt).toLocaleString()}</td>
        <td>${entry.actorRole} (${entry.actorId})</td>
        <td>${entry.action}</td>
        <td>${entry.targetType} ${entry.targetId}</td>
      `;
      auditTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load audit logs:", error);
  }
}

async function loadTariffRateHistory() {
  try {
    const response = await authFetch(`${API_BASE}/company/billing/tariff-rate/history`);
    const payload = await response.json();
    const history = payload.history || [];

    tariffRateHistoryBody.innerHTML = "";
    if (!history.length) {
      tariffRateHistoryBody.innerHTML = '<tr><td colspan="3" class="no-alerts">No rate history found</td></tr>';
      return;
    }

    history.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(entry.effectiveDate).toLocaleDateString()}</td>
        <td>₹ ${Number(entry.rate || 0).toFixed(2)}</td>
        <td>${entry.changedBy || "system"}</td>
      `;
      tariffRateHistoryBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load tariff rate history:", error);
  }
}

function renderBillingSummary(bills) {
  billingSummaryBody.innerHTML = "";

  if (!bills.length) {
    billingSummaryBody.innerHTML = '<tr><td colspan="6" class="no-alerts">No billing data available</td></tr>';
    return;
  }

  bills.forEach((bill) => {
    const tr = document.createElement("tr");
    const statusClass = bill.paymentStatus === "paid" ? "text-success" : "text-danger";
    tr.innerHTML = `
      <td>${bill.customerName}</td>
      <td>${Number(bill.usageUnits || 0).toFixed(2)} kWh</td>
      <td>₹ ${Number(bill.calculatedAmount || 0).toFixed(2)}</td>
      <td>₹ ${Number(bill.paidAmount || 0).toFixed(2)}</td>
      <td>₹ ${Number(bill.remainingAmount || 0).toFixed(2)}</td>
      <td><span class="${statusClass}">${bill.paymentStatus}</span></td>
    `;
    billingSummaryBody.appendChild(tr);
  });
}

async function saveTariffRate() {
  const rate = Number(tariffRateInput.value);
  if (!rate || rate <= 0) {
    alert("Please enter a valid tariff rate");
    return;
  }

  try {
    const response = await authFetch(`${API_BASE}/company/billing/tariff-rate`, {
      method: "POST",
      body: JSON.stringify({ rate }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Failed to update tariff rate");
      return;
    }

    alert("Tariff rate updated successfully");
    await loadBillingOverview();
  } catch (error) {
    console.error("Failed to save tariff rate:", error);
  }
}

saveTariffRateBtn.addEventListener("click", saveTariffRate);
refreshDisputesBtn.addEventListener("click", loadDisputes);
refreshMaintenanceBtn.addEventListener("click", loadMaintenanceTickets);
refreshAuditBtn.addEventListener("click", loadAuditLogs);

disputesTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-dispute-id]");
  if (!button) {
    return;
  }

  const disputeId = button.getAttribute("data-dispute-id");
  const status = button.getAttribute("data-dispute-status");
  if (!disputeId || status !== "OPEN") {
    return;
  }

  const resolution = prompt("Resolution notes");
  if (!resolution) {
    return;
  }

  const reject = confirm("Reject this dispute? Click OK to reject, Cancel to resolve.");
  const newStatus = reject ? "REJECTED" : "RESOLVED";

  try {
    const response = await authFetch(`${API_BASE}/company/billing/disputes/${disputeId}`, {
      method: "PUT",
      body: JSON.stringify({ resolution, status: newStatus }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to update dispute");
      return;
    }

    await loadDisputes();
  } catch (error) {
    console.error("Failed to update dispute:", error);
  }
});

maintenanceTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-maintenance-id]");
  if (!button) {
    return;
  }

  const ticketId = button.getAttribute("data-maintenance-id");
  const status = button.getAttribute("data-maintenance-status");
  if (!ticketId || status === "RESOLVED") {
    return;
  }

  const assignedTo = prompt("Assign to (optional)") || "";

  try {
    const response = await authFetch(`${API_BASE}/company/maintenance/tickets/${ticketId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "RESOLVED", assignedTo }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to update ticket");
      return;
    }

    await loadMaintenanceTickets();
  } catch (error) {
    console.error("Failed to update ticket:", error);
  }
});

// =====================================
// Reports
// =====================================
function triggerDownload(contentType, endpoint, filename) {
  authFetch(endpoint)
    .then((res) => res.blob())
    .then((blob) => {
      const fileBlob = new Blob([blob], { type: contentType });
      const url = window.URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch((error) => {
      console.error("Download failed:", error);
      alert("Report download failed. Please try again.");
    });
}

const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");

downloadJsonBtn.addEventListener("click", () => {
  triggerDownload(
    "application/json",
    `${API_BASE}/report/json`,
    `microgrid_report_${new Date().toISOString().slice(0, 10)}.json`
  );
});

downloadCsvBtn.addEventListener("click", () => {
  triggerDownload(
    "text/csv",
    `${API_BASE}/report/csv`,
    `microgrid_report_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

// =====================================
// Init
// =====================================
(async function init() {
  await loadAdminOperatorFilterOptions();
  await fetchDashboardData();
  setInterval(fetchDashboardData, 5000);
  switchAdminView("dashboard");
})();
