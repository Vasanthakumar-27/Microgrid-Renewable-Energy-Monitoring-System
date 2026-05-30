const API_BASE = "http://localhost:5000";

const role = localStorage.getItem("role");
const token = localStorage.getItem("token");

if (role !== "operator" || !token) {
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

const views = {
  dashboard: document.getElementById("dashboardView"),
  customers: document.getElementById("customersView"),
  alerts: document.getElementById("alertsView"),
};

const operatorHeaderTitle = document.getElementById("operatorHeaderTitle");
const navLinks = Array.from(document.querySelectorAll(".nav-link[data-view]"));

function switchOperatorView(view) {
  Object.keys(views).forEach((key) => {
    views[key].classList.toggle("hidden", key !== view);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  const titleMap = {
    dashboard: "Operator View",
    customers: "Customer Management",
    alerts: "Alerts Module",
  };

  operatorHeaderTitle.textContent = titleMap[view] || "Operator View";

  if (view === "customers") {
    loadCustomerModule();
    loadOperatorDisputes();
  } else if (view === "alerts") {
    loadOperatorAlertsModule();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchOperatorView(link.dataset.view);
  });
});

const kpiAssignedGrids = document.getElementById("kpiAssignedGrids");
const kpiAvgBattery = document.getElementById("kpiAvgBattery");
const kpiAlerts = document.getElementById("kpiAlerts");
const alertsKpiCard = document.getElementById("alertsKpiCard");

const microgridTableBody = document.getElementById("microgridTableBody");
const alertsList = document.getElementById("alertsList");
const operatorInsightsList = document.getElementById("operatorInsightsList");

const customerCreateForm = document.getElementById("customerCreateForm");
const operatorCustomerTableBody = document.getElementById("operatorCustomerTableBody");
const operatorHistoryCustomerSelect = document.getElementById("operatorHistoryCustomerSelect");
const operatorHistoryLoadBtn = document.getElementById("operatorHistoryLoadBtn");
const operatorHistoryTableBody = document.getElementById("operatorHistoryTableBody");
const operatorDisputesBody = document.getElementById("operatorDisputesBody");
const refreshOperatorDisputesBtn = document.getElementById("refreshOperatorDisputesBtn");

const maintenanceTicketForm = document.getElementById("maintenanceTicketForm");
const maintenanceGridId = document.getElementById("maintenanceGridId");
const maintenanceTitle = document.getElementById("maintenanceTitle");
const maintenanceDescription = document.getElementById("maintenanceDescription");
const maintenancePriority = document.getElementById("maintenancePriority");
const refreshMaintenanceTicketsBtn = document.getElementById("refreshMaintenanceTicketsBtn");
const operatorMaintenanceBody = document.getElementById("operatorMaintenanceBody");

const customerEditModal = document.getElementById("customerEditModal");
const customerEditForm = document.getElementById("customerEditForm");
const closeCustomerModal = document.getElementById("closeCustomerModal");
const cancelCustomerEdit = document.getElementById("cancelCustomerEdit");
const editCustomerName = document.getElementById("editCustomerName");
const editCustomerPhone = document.getElementById("editCustomerPhone");
const editCustomerEmail = document.getElementById("editCustomerEmail");
const editCustomerLocation = document.getElementById("editCustomerLocation");
const editCustomerPassword = document.getElementById("editCustomerPassword");
let editingCustomerId = null;

const operatorAlertsModuleList = document.getElementById("operatorAlertsModuleList");
const refreshOperatorAlertsBtn = document.getElementById("refreshOperatorAlertsBtn");
const operatorResolvedAlertsBody = document.getElementById("operatorResolvedAlertsBody");

const operatorComparisonType = document.getElementById("operatorComparisonType");
const operatorComparisonRefreshBtn = document.getElementById("operatorComparisonRefreshBtn");

let energyChart = null;
let batteryChart = null;
let severityChart = null;
let operatorComparisonChart = null;

Chart.defaults.color = "#94a3b8";
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(15, 17, 21, 0.9)";

async function fetchDashboardData() {
  try {
    const [energyRes, alertsRes, analyticsRes] = await Promise.all([
      authFetch(`${API_BASE}/analytics/energy-data`),
      authFetch(`${API_BASE}/operator/alerts`),
      authFetch(`${API_BASE}/analytics/operator`),
    ]);

    if (!energyRes.ok || !alertsRes.ok || !analyticsRes.ok) {
      throw new Error("Network response error");
    }

    const energyPayload = await energyRes.json();
    const alerts = await alertsRes.json();
    const analytics = await analyticsRes.json();

    const grids = (energyPayload.grids || []).map((grid) => ({
      id: `mg-${grid.gridId}`,
      gridId: grid.gridId,
      energyGenerated: grid.generation,
      consumption: grid.consumption,
      batteryLevel: grid.batteryLevel,
      status: grid.status,
      timestamp: energyPayload.generatedAt,
    }));
    updateDashboard(grids, alerts, analytics);
    await loadOperatorEnergyComparison();
  } catch (error) {
    console.error("Failed to fetch operator dashboard data:", error);
  }
}

async function loadOperatorEnergyComparison() {
  try {
    const type = operatorComparisonType.value;
    const response = await authFetch(`${API_BASE}/analytics/energy-data?type=${type}`);
    const data = await response.json();
    const comparison = data.comparison || {};

    const ctx = document.getElementById("operatorComparisonChart").getContext("2d");

    if (operatorComparisonChart) {
      operatorComparisonChart.data.labels = comparison.labels || [];
      operatorComparisonChart.data.datasets[0].data = comparison.generation || [];
      operatorComparisonChart.data.datasets[1].data = comparison.consumption || [];
      operatorComparisonChart.update("none");
      return;
    }

    operatorComparisonChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: comparison.labels || [],
        datasets: [
          {
            label: "Generation",
            data: comparison.generation || [],
            borderColor: "#10b981",
            tension: 0.3,
          },
          {
            label: "Consumption",
            data: comparison.consumption || [],
            borderColor: "#ef4444",
            tension: 0.3,
          },
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
  } catch (error) {
    console.error("Failed to load operator energy comparison:", error);
  }
}

function updateDashboard(grids, alerts, analytics) {
  const totBatt = grids.reduce((sum, g) => sum + Number(g.batteryLevel), 0);
  const avgBatt = grids.length > 0 ? Math.round(totBatt / grids.length) : 0;

  kpiAssignedGrids.textContent = grids.length;
  kpiAvgBattery.textContent = `${avgBatt}%`;
  kpiAlerts.textContent = alerts.length;

  alertsKpiCard.style.animation = alerts.length > 0 ? "pulse-red 2s infinite" : "none";

  operatorInsightsList.innerHTML = "";
  (analytics.insights || []).forEach((insight) => {
    const li = document.createElement("li");
    li.className = "alert-item warning";
    li.innerHTML = `<div class="alert-icon">i</div><div class="alert-content"><p>${formatInsight(insight)}</p></div>`;
    operatorInsightsList.appendChild(li);
  });

  if (!operatorInsightsList.children.length) {
    operatorInsightsList.innerHTML = '<li class="no-alerts">No operational insights yet</li>';
  }

  microgridTableBody.innerHTML = "";
  grids.forEach((g) => {
    const tr = document.createElement("tr");
    const batLevel = Number(g.batteryLevel);

    let batColor = "#10b981";
    if (batLevel < 20) batColor = "#ef4444";
    else if (batLevel < 40) batColor = "#f59e0b";

    const sysStatus =
      batLevel < 20
        ? '<span style="color:var(--accent-danger)">Warning</span>'
        : '<span style="color:var(--accent-success)">Optimal</span>';

    tr.innerHTML = `
      <td><strong>${g.gridId}</strong></td>
      <td>
        <div class="bat-bar">
          ${batLevel}%
          <div class="bat-track">
            <div class="bat-fill" style="width: ${batLevel}%; background-color: ${batColor};"></div>
          </div>
        </div>
      </td>
      <td>${sysStatus}</td>
    `;
    microgridTableBody.appendChild(tr);
  });

  alertsList.innerHTML = "";
  if (!alerts.length) {
    alertsList.innerHTML = '<li class="no-alerts">No active alerts on assigned grids</li>';
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

  updateCharts(grids, alerts, analytics);
}

function updateCharts(grids, alerts, analytics) {
  const labels = grids.map((g) => `Grid ${g.gridId}`);
  const consumData = grids.map((g) => Number(g.consumption));
  const generationData = grids.map((g) => Number(g.energyGenerated));

  if (energyChart) {
    energyChart.data.labels = labels;
    energyChart.data.datasets[0].data = generationData;
    energyChart.data.datasets[1].data = consumData;
    energyChart.update("none");
  } else {
    const ctx = document.getElementById("energyChart").getContext("2d");
    energyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Generation", data: generationData, backgroundColor: "rgba(16, 185, 129, 0.8)", borderRadius: 4 },
          { label: "Consumption", data: consumData, backgroundColor: "rgba(239, 68, 68, 0.8)", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } },
      },
    });
  }

  if (batteryChart) {
    batteryChart.data.labels = labels;
    batteryChart.data.datasets[0].data = grids.map((g) => g.batteryLevel);
    batteryChart.update("none");
  } else {
    const ctx = document.getElementById("batteryChart").getContext("2d");
    batteryChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Battery %",
            data: grids.map((g) => g.batteryLevel),
            borderColor: "#10b981",
            fill: false,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } },
      },
    });
  }

  const severityValues = [
    alerts.filter((a) => a.type === "FAULT" || a.type === "LOW_BATTERY").length,
    alerts.filter((a) => a.type === "OVERLOAD").length,
    Math.max(0, grids.length - alerts.length),
  ];

  if (severityChart) {
    severityChart.data.datasets[0].data = severityValues;
    severityChart.update("none");
  } else {
    const ctx = document.getElementById("severityChart").getContext("2d");
    severityChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Critical", "Warning", "Normal"],
        datasets: [{ data: severityValues, backgroundColor: ["#ef4444", "#f59e0b", "#10b981"] }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

}

async function loadCustomerModule() {
  try {
    const response = await authFetch(`${API_BASE}/operator/customers`);
    const customers = await response.json();

    operatorCustomerTableBody.innerHTML = "";
    if (!customers.length) {
      operatorCustomerTableBody.innerHTML = '<tr><td colspan="7" class="no-alerts">No managed customers yet</td></tr>';
      return;
    }

    customers.forEach((customer) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${customer.name}</td>
        <td>${customer.phone}</td>
        <td>${customer.location}</td>
        <td>${customer.gridId}</td>
        <td>${customer.monthlyUsage}</td>
        <td>${formatInr(customer.amountDue)}</td>
        <td><span class="${customer.status === "paid" ? "text-success" : "text-danger"}">${customer.status}</span></td>
        <td><button class="ghost-btn" data-customer-edit-id="${customer.id}">Edit</button></td>
      `;
      tr.dataset.customerName = customer.name;
      tr.dataset.customerPhone = customer.phone || "";
      tr.dataset.customerLocation = customer.location || "";
      tr.dataset.customerEmail = customer.email || "";
      operatorCustomerTableBody.appendChild(tr);
    });

    operatorHistoryCustomerSelect.innerHTML = "";
    customers.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = `${customer.name} (${customer.id})`;
      operatorHistoryCustomerSelect.appendChild(option);
    });

    if (customers.length) {
      await loadOperatorCustomerHistory(customers[0].id);
    }
  } catch (error) {
    console.error("Failed to load customers module:", error);
  }
}

async function loadOperatorCustomerHistory(customerId) {
  try {
    const response = await authFetch(`${API_BASE}/operator/customer/${customerId}/bill-history`);
    const payload = await response.json();
    const history = payload.history || [];

    operatorHistoryTableBody.innerHTML = "";
    if (!history.length) {
      operatorHistoryTableBody.innerHTML = '<tr><td colspan="6" class="no-alerts">No billing history available</td></tr>';
      return;
    }

    history.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${entry.month}</td>
        <td>${entry.usageUnits}</td>
        <td>${formatInr(entry.calculatedAmount)}</td>
        <td>${formatInr(entry.paidAmount)}</td>
        <td>${formatInr(entry.remainingAmount)}</td>
        <td><span class="${entry.paymentStatus === "paid" ? "text-success" : "text-danger"}">${entry.paymentStatus}</span></td>
      `;
      operatorHistoryTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load operator customer history:", error);
  }
}

customerCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("customerName").value.trim(),
    password: document.getElementById("customerPassword").value.trim(),
    phone: document.getElementById("customerPhone").value.trim(),
    location: document.getElementById("customerLocation").value.trim(),
  };

  try {
    const response = await authFetch(`${API_BASE}/operator/create-customer`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Failed to add customer");
      return;
    }

    customerCreateForm.reset();
    await loadCustomerModule();
  } catch (error) {
    console.error("Failed to create customer:", error);
  }
});

operatorCustomerTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-customer-edit-id]");
  if (!button) {
    return;
  }

  const customerId = button.getAttribute("data-customer-edit-id");
  const row = button.closest("tr");
  editingCustomerId = customerId;
  editCustomerName.value = row?.dataset?.customerName || "";
  editCustomerPhone.value = row?.dataset?.customerPhone || "";
  editCustomerEmail.value = row?.dataset?.customerEmail || "";
  editCustomerLocation.value = row?.dataset?.customerLocation || "";
  editCustomerPassword.value = "";
  customerEditModal.classList.add("active");
});

function closeCustomerEditModal() {
  customerEditModal.classList.remove("active");
  editingCustomerId = null;
}

closeCustomerModal.addEventListener("click", closeCustomerEditModal);
cancelCustomerEdit.addEventListener("click", closeCustomerEditModal);

customerEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingCustomerId) {
    return;
  }

  const payload = {
    name: editCustomerName.value.trim(),
    phone: editCustomerPhone.value.trim(),
    email: editCustomerEmail.value.trim(),
    location: editCustomerLocation.value.trim(),
  };

  const password = editCustomerPassword.value.trim();
  if (password) {
    payload.password = password;
  }

  try {
    const response = await authFetch(`${API_BASE}/operator/customer/${editingCustomerId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Failed to update customer");
      return;
    }

    closeCustomerEditModal();
    await loadCustomerModule();
  } catch (error) {
    console.error("Failed to update customer:", error);
  }
});

async function loadOperatorDisputes() {
  try {
    const response = await authFetch(`${API_BASE}/operator/disputes`);
    const payload = await response.json();
    const disputes = payload.disputes || [];

    operatorDisputesBody.innerHTML = "";
    if (!disputes.length) {
      operatorDisputesBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No disputes</td></tr>';
      return;
    }

    disputes.forEach((entry) => {
      const statusClass = entry.status === "OPEN" ? "text-warning" : "text-success";
      const actionLabel = entry.status === "OPEN" ? "Resolve" : "View";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${entry.customerId}</td>
        <td>${entry.month}</td>
        <td>${entry.reason}</td>
        <td><span class="${statusClass}">${entry.status}</span></td>
        <td><button class="ghost-btn" data-dispute-id="${entry.id}" data-dispute-status="${entry.status}">${actionLabel}</button></td>
      `;
      operatorDisputesBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load disputes:", error);
  }
}

operatorDisputesBody.addEventListener("click", async (event) => {
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
    const response = await authFetch(`${API_BASE}/operator/disputes/${disputeId}`, {
      method: "PUT",
      body: JSON.stringify({ resolution, status: newStatus }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to update dispute");
      return;
    }

    await loadOperatorDisputes();
  } catch (error) {
    console.error("Failed to update dispute:", error);
  }
});

async function loadMaintenanceTickets() {
  try {
    const response = await authFetch(`${API_BASE}/operator/maintenance/tickets?limit=50`);
    const payload = await response.json();
    const tickets = payload.tickets || [];

    operatorMaintenanceBody.innerHTML = "";
    if (!tickets.length) {
      operatorMaintenanceBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No maintenance tickets</td></tr>';
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
        <td><button class="ghost-btn" data-ticket-id="${ticket.id}" data-ticket-status="${ticket.status}">${actionLabel}</button></td>
      `;
      operatorMaintenanceBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load maintenance tickets:", error);
  }
}

operatorMaintenanceBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-ticket-id]");
  if (!button) {
    return;
  }

  const ticketId = button.getAttribute("data-ticket-id");
  const status = button.getAttribute("data-ticket-status");
  if (!ticketId || status === "RESOLVED") {
    return;
  }

  try {
    const response = await authFetch(`${API_BASE}/operator/maintenance/tickets/${ticketId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.message || "Failed to update maintenance ticket");
      return;
    }

    await loadMaintenanceTickets();
  } catch (error) {
    console.error("Failed to update maintenance ticket:", error);
  }
});

async function loadOperatorAlertsModule() {
  try {
    const response = await authFetch(`${API_BASE}/operator/alerts`);
    const alerts = await response.json();

    operatorAlertsModuleList.innerHTML = "";
    if (!alerts.length) {
      operatorAlertsModuleList.innerHTML = '<li class="no-alerts">No alerts on assigned grids</li>';
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
      operatorAlertsModuleList.appendChild(li);
    });

    await loadOperatorResolvedAlertsHistory();
  } catch (error) {
    console.error("Failed to load operator alerts module:", error);
  }
}

async function loadOperatorResolvedAlertsHistory() {
  try {
    const response = await authFetch(`${API_BASE}/alerts/history/resolved?limit=50`);
    const payload = await response.json();
    const history = payload.history || [];

    operatorResolvedAlertsBody.innerHTML = "";
    if (!history.length) {
      operatorResolvedAlertsBody.innerHTML = '<tr><td colspan="6" class="no-alerts">No resolved alerts</td></tr>';
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
      operatorResolvedAlertsBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load operator resolved alerts history:", error);
  }
}

refreshOperatorAlertsBtn.addEventListener("click", loadOperatorAlertsModule);
refreshOperatorDisputesBtn.addEventListener("click", loadOperatorDisputes);
refreshMaintenanceTicketsBtn.addEventListener("click", loadMaintenanceTickets);
operatorAlertsModuleList.addEventListener("click", async (event) => {
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

    await loadOperatorAlertsModule();
    await fetchDashboardData();
  } catch (error) {
    console.error("Failed to delete operator alert:", error);
  }
});
operatorComparisonRefreshBtn.addEventListener("click", loadOperatorEnergyComparison);
operatorComparisonType.addEventListener("change", loadOperatorEnergyComparison);
operatorHistoryLoadBtn.addEventListener("click", () => {
  if (!operatorHistoryCustomerSelect.value) {
    return;
  }
  loadOperatorCustomerHistory(operatorHistoryCustomerSelect.value);
});

maintenanceTicketForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    gridId: Number(maintenanceGridId.value),
    title: maintenanceTitle.value.trim(),
    description: maintenanceDescription.value.trim(),
    priority: maintenancePriority.value,
  };

  try {
    const response = await authFetch(`${API_BASE}/operator/maintenance/tickets`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Failed to create maintenance ticket");
      return;
    }

    maintenanceTicketForm.reset();
    maintenancePriority.value = "MEDIUM";
    await loadMaintenanceTickets();
  } catch (error) {
    console.error("Failed to create maintenance ticket:", error);
  }
});

(async function init() {
  await fetchDashboardData();
  setInterval(fetchDashboardData, 5000);
  switchOperatorView("dashboard");
  await loadOperatorDisputes();
  await loadMaintenanceTickets();
})();
