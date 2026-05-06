const API_BASE = "http://localhost:5000";

const role = localStorage.getItem("role");
const token = localStorage.getItem("token");
const CUSTOMER_ID = localStorage.getItem("customerId") || "cust-1";

if (role !== "customer" || !token) {
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

const views = {
  energy: document.getElementById("energyView"),
  billing: document.getElementById("billingView"),
  history: document.getElementById("historyView"),
};

const customerHeaderTitle = document.getElementById("customerHeaderTitle");
const navLinks = Array.from(document.querySelectorAll(".nav-link[data-view]"));

function switchCustomerView(view) {
  Object.keys(views).forEach((key) => {
    views[key].classList.toggle("hidden", key !== view);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  const titleMap = {
    energy: "Customer Portal",
    billing: "Billing",
    history: "Payment History",
  };
  customerHeaderTitle.textContent = titleMap[view] || "Customer Portal";

  if (view === "billing") {
    loadBillSummary();
  } else if (view === "history") {
    loadPaymentHistory();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchCustomerView(link.dataset.view);
  });
});

const kpiCurrentUsage = document.getElementById("kpiCurrentUsage");
const kpiSavings = document.getElementById("kpiSavings");
const kpiEstBill = document.getElementById("kpiEstBill");
const billUsage = document.getElementById("billUsage");
const billRate = document.getElementById("billRate");
const billFixed = document.getElementById("billFixed");
const billTotal = document.getElementById("billTotal");
const payBtn = document.getElementById("payBtn");
const savingsMessage = document.getElementById("savingsMessage");
const reminderBanner = document.getElementById("reminderBanner");

const customerComparisonType = document.getElementById("customerComparisonType");
const customerComparisonLoadBtn = document.getElementById("customerComparisonLoadBtn");

const billMonthInput = document.getElementById("billMonthInput");
const billSummaryBody = document.getElementById("billSummaryBody");
const paymentHistoryBody = document.getElementById("paymentHistoryBody");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const customerInsightsList = document.getElementById("customerInsightsList");

let usageChart = null;
let costChart = null;
let savingsChart = null;
let usageLimitChart = null;
let customerComparisonChart = null;

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getSelectedMonthKey() {
  return billMonthInput.value || getCurrentMonthKey();
}

async function loadReminders() {
  try {
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/reminders`);
    const data = await response.json();

    if (data.reminders && data.reminders.length) {
      reminderBanner.classList.remove("hidden");
      reminderBanner.textContent = `Payment Pending: ${data.reminders[0].message}`;
    } else {
      reminderBanner.classList.add("hidden");
    }
  } catch (error) {
    console.error("Failed to load reminders:", error);
  }
}

async function fetchCustomerData() {
  try {
    const [analyticsRes, billRes, energyRes] = await Promise.all([
      authFetch(`${API_BASE}/analytics/customer/${CUSTOMER_ID}`),
      authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary?month=${getCurrentMonthKey()}`),
      authFetch(`${API_BASE}/analytics/energy-data`),
    ]);

    if (!analyticsRes.ok || !billRes.ok || !energyRes.ok) {
      throw new Error("Customer dashboard API error");
    }

    const analytics = await analyticsRes.json();
    const billSummary = await billRes.json();
    const energy = await energyRes.json();

    updateDashboard(analytics, billSummary, energy);
  } catch (err) {
    console.error("Dashboard Fetch Error:", err);
  }
}

function updateDashboard(analytics, billSummary, energy) {
  const usageTotal = Number(billSummary.usage || 0);
  const estimatedBill = Number(billSummary.totalAmount || 0);

  kpiCurrentUsage.textContent = usageTotal.toFixed(0);
  kpiEstBill.textContent = `INR ${estimatedBill.toFixed(2)}`;
  kpiSavings.textContent = `INR ${Number(analytics.savingsAmount || 0).toFixed(2)}`;

  billUsage.textContent = `${usageTotal.toFixed(2)} kWh`;
  billRate.textContent = `INR ${Number(billSummary.usageRate || 0).toFixed(2)} / kWh`;
  billFixed.textContent = `INR ${Number(billSummary.fixedCharge || 0).toFixed(2)}`;
  billTotal.textContent = `INR ${estimatedBill.toFixed(2)}`;
  savingsMessage.textContent = `You saved INR ${Number(analytics.savingsAmount || 0).toFixed(2)} this month`;

  payBtn.disabled = Number(billSummary.remainingAmount || 0) <= 0;
  payBtn.textContent = Number(billSummary.remainingAmount || 0) <= 0 ? "Paid" : "Pay Now";

  customerInsightsList.innerHTML = "";
  (analytics.insights || []).forEach((insight) => {
    const li = document.createElement("li");
    li.className = "alert-item warning";
    li.innerHTML = `<div class="alert-icon">i</div><div class="alert-content"><p>${formatInsight(insight)}</p></div>`;
    customerInsightsList.appendChild(li);
  });

  if (!customerInsightsList.children.length) {
    customerInsightsList.innerHTML = '<li class="no-alerts">No customer insights yet</li>';
  }

  renderAnalyticsCharts(analytics, energy);
}

function renderAnalyticsCharts(analytics, energy) {
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.font.family = "'Inter', sans-serif";

  const usageCtx = document.getElementById("usageChart").getContext("2d");
  if (!usageChart) {
    usageChart = new Chart(usageCtx, {
      type: "line",
      data: {
        labels: energy?.trend?.labels?.length ? energy.trend.labels : analytics.usageTrend.labels,
        datasets: [{
          label: "Consumption (kWh)",
          data: energy?.trend?.consumption?.length ? energy.trend.consumption : analytics.usageTrend.values,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } },
      },
    });
  } else {
    usageChart.data.labels = energy?.trend?.labels?.length ? energy.trend.labels : analytics.usageTrend.labels;
    usageChart.data.datasets[0].data = energy?.trend?.consumption?.length ? energy.trend.consumption : analytics.usageTrend.values;
    usageChart.update("none");
  }

  const costCtx = document.getElementById("costChart").getContext("2d");
  if (!costChart) {
    costChart = new Chart(costCtx, {
      type: "pie",
      data: {
        labels: ["Generation", "Consumption", "Savings"],
        datasets: [{
          data: [
            Number(energy?.totals?.totalGeneration || 0),
            Number(energy?.totals?.totalConsumption || 0),
            Number(analytics.savingsAmount || 0),
          ],
          backgroundColor: ["#3b82f6", "#f59e0b", "#10b981"],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  } else {
    costChart.data.datasets[0].data = [
      Number(energy?.totals?.totalGeneration || 0),
      Number(energy?.totals?.totalConsumption || 0),
      Number(analytics.savingsAmount || 0),
    ];
    costChart.update("none");
  }

  const savingsCtx = document.getElementById("savingsChart").getContext("2d");
  if (!savingsChart) {
    savingsChart = new Chart(savingsCtx, {
      type: "line",
      data: {
        labels: analytics.savingsTrend.labels,
        datasets: [{ label: "Savings", data: analytics.savingsTrend.values, borderColor: "#10b981", tension: 0.35 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } }, x: { grid: { display: false } } },
      },
    });
  } else {
    savingsChart.data.labels = analytics.savingsTrend.labels;
    savingsChart.data.datasets[0].data = analytics.savingsTrend.values;
    savingsChart.update("none");
  }

  const limitCtx = document.getElementById("usageLimitChart").getContext("2d");
  if (!usageLimitChart) {
    usageLimitChart = new Chart(limitCtx, {
      type: "bar",
      data: {
        labels: ["Actual Usage", "Monthly Limit"],
        datasets: [{
          data: [analytics.usageVsLimit.actual, analytics.usageVsLimit.limit],
          backgroundColor: ["#8b5cf6", "#3b82f6"],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  } else {
    usageLimitChart.data.datasets[0].data = [analytics.usageVsLimit.actual, analytics.usageVsLimit.limit];
    usageLimitChart.update("none");
  }
}

async function loadCustomerEnergyComparison() {
  try {
    const type = customerComparisonType.value;
    const response = await authFetch(`${API_BASE}/analytics/energy-data?type=${type}`);
    const data = await response.json();
    const comparison = data.comparison || {};

    const ctx = document.getElementById("customerComparisonChart").getContext("2d");

    if (customerComparisonChart) {
      customerComparisonChart.data.labels = comparison.labels || [];
      customerComparisonChart.data.datasets[0].data = comparison.generation || [];
      customerComparisonChart.data.datasets[1].data = comparison.consumption || [];
      customerComparisonChart.update("none");
      return;
    }

    customerComparisonChart = new Chart(ctx, {
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
    console.error("Failed to load energy comparison:", error);
  }
}

async function loadBillSummary() {
  try {
    const month = getSelectedMonthKey();
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary?month=${month}`);
    const data = await response.json();

    billSummaryBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.month}</td>
      <td>${Number(data.usage).toFixed(2)} kWh</td>
      <td>INR ${Number(data.usageRate).toFixed(2)}</td>
      <td>INR ${Number(data.fixedCharge).toFixed(2)}</td>
      <td>INR ${Number(data.totalAmount).toFixed(2)}</td>
      <td>INR ${Number(data.paidAmount).toFixed(2)}</td>
      <td>INR ${Number(data.remainingAmount).toFixed(2)}</td>
      <td><span class="${data.paymentStatus === "paid" ? "text-success" : "text-danger"}">${data.paymentStatus}</span></td>
    `;
    billSummaryBody.appendChild(tr);
  } catch (error) {
    console.error("Failed to load bill summary:", error);
  }
}

async function loadPaymentHistory() {
  try {
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/payments/history`);
    const data = await response.json();

    paymentHistoryBody.innerHTML = "";
    const payments = data.payments || [];

    if (!payments.length) {
      paymentHistoryBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No payments yet</td></tr>';
      return;
    }

    payments.forEach((payment) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(payment.date).toLocaleString()}</td>
        <td>${payment.month}</td>
        <td>INR ${Number(payment.amount).toFixed(2)}</td>
        <td>${payment.method}</td>
        <td><span class="text-success">${payment.status}</span></td>
      `;
      paymentHistoryBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load payment history:", error);
  }
}

async function payCurrentBill() {
  try {
    const month = getCurrentMonthKey();
    const billResponse = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary?month=${month}`);
    const bill = await billResponse.json();

    const amount = Number(bill.remainingAmount || 0);
    if (amount <= 0) {
      alert("Current bill is already paid");
      return;
    }

    const response = await authFetch(`${API_BASE}/customer/payment`, {
      method: "POST",
      body: JSON.stringify({
        customerId: CUSTOMER_ID,
        amount,
        month,
        currency: "INR",
        method: "ONLINE",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Payment failed");
      return;
    }

    alert(`Payment successful. Paid INR ${Number(data.appliedAmount).toFixed(2)}`);

    await Promise.all([
      fetchCustomerData(),
      loadBillSummary(),
      loadPaymentHistory(),
      loadReminders(),
    ]);
  } catch (error) {
    console.error("Payment error:", error);
  }
}

billMonthInput.addEventListener("change", loadBillSummary);
customerComparisonLoadBtn.addEventListener("click", loadCustomerEnergyComparison);
payBtn.addEventListener("click", payCurrentBill);
refreshHistoryBtn.addEventListener("click", loadPaymentHistory);

(async function init() {
  billMonthInput.value = getCurrentMonthKey();
  await Promise.all([
    fetchCustomerData(),
    loadCustomerEnergyComparison(),
    loadBillSummary(),
    loadPaymentHistory(),
    loadReminders(),
  ]);

  setInterval(async () => {
    await fetchCustomerData();
    await loadReminders();
  }, 5000);

  switchCustomerView("energy");
})();
