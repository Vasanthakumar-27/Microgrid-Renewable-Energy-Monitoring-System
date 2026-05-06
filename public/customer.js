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
  if (typeof insight === "string") return insight;
  const message = insight?.message || "Insight unavailable";
  const action = insight?.action ? ` Action: ${insight.action}` : "";
  return `${message}${action}`;
}

function formatInr(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

// =====================================
// View Management
// =====================================
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
    loadCurrentBill();
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

// =====================================
// Energy Dashboard
// =====================================
const kpiCurrentUsage = document.getElementById("kpiCurrentUsage");
const kpiSavings = document.getElementById("kpiSavings");
const kpiEstBill = document.getElementById("kpiEstBill");
const reminderBanner = document.getElementById("reminderBanner");
const customerComparisonType = document.getElementById("customerComparisonType");
const customerComparisonLoadBtn = document.getElementById("customerComparisonLoadBtn");

let usageChart = null;
let costChart = null;
let savingsChart = null;
let usageLimitChart = null;
let customerComparisonChart = null;

async function fetchCustomerData() {
  try {
    const [analyticsRes, currentBillRes, energyRes] = await Promise.all([
      authFetch(`${API_BASE}/analytics/customer/${CUSTOMER_ID}`),
      authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary`),
      authFetch(`${API_BASE}/analytics/energy-data`),
    ]);

    if (!analyticsRes.ok || !currentBillRes.ok || !energyRes.ok) {
      throw new Error("Failed to fetch customer data");
    }

    const analytics = await analyticsRes.json();
    const currentBill = await currentBillRes.json();
    const energy = await energyRes.json();

    updateEnergyDashboard(analytics, currentBill, energy);
  } catch (error) {
    console.error("Error fetching customer data:", error);
  }
}

function updateEnergyDashboard(analytics, currentBill, energy) {
  const usage = Number(currentBill.usage || 0);
  const billAmount = Number(currentBill.totalAmount || 0);
  const savings = Number(analytics.savingsAmount || 0);

  kpiCurrentUsage.textContent = usage.toFixed(0);
  kpiEstBill.textContent = formatInr(billAmount);
  kpiSavings.textContent = formatInr(savings);

  // Update reminder banner
  if (currentBill.remainingAmount > 0) {
    reminderBanner.classList.remove("hidden");
    reminderBanner.textContent = `Payment Pending: ${formatInr(currentBill.remainingAmount)} due`;
  } else {
    reminderBanner.classList.add("hidden");
  }

  renderEnergyCharts(analytics, energy);
}

function renderEnergyCharts(analytics, energy) {
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Usage Chart
  const usageCtx = document.getElementById("usageChart");
  if (usageCtx && !usageChart) {
    usageChart = new Chart(usageCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: energy?.trend?.labels || [],
        datasets: [{
          label: "Consumption (kWh)",
          data: energy?.trend?.consumption || [],
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });
  } else if (usageChart) {
    usageChart.data.labels = energy?.trend?.labels || [];
    usageChart.data.datasets[0].data = energy?.trend?.consumption || [];
    usageChart.update("none");
  }

  // Cost Breakdown
  const costCtx = document.getElementById("costChart");
  if (costCtx && !costChart) {
    costChart = new Chart(costCtx.getContext("2d"), {
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
  } else if (costChart) {
    costChart.data.datasets[0].data = [
      Number(energy?.totals?.totalGeneration || 0),
      Number(energy?.totals?.totalConsumption || 0),
      Number(analytics.savingsAmount || 0),
    ];
    costChart.update("none");
  }

  // Savings Chart
  const savingsCtx = document.getElementById("savingsChart");
  if (savingsCtx && !savingsChart) {
    savingsChart = new Chart(savingsCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: analytics.savingsTrend?.labels || [],
        datasets: [{
          label: "Savings (INR)",
          data: analytics.savingsTrend?.values || [],
          borderColor: "#10b981",
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });
  } else if (savingsChart) {
    savingsChart.data.labels = analytics.savingsTrend?.labels || [];
    savingsChart.data.datasets[0].data = analytics.savingsTrend?.values || [];
    savingsChart.update("none");
  }

  // Usage vs Limit
  const limitCtx = document.getElementById("usageLimitChart");
  if (limitCtx && !usageLimitChart) {
    usageLimitChart = new Chart(limitCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Actual Usage", "Monthly Limit"],
        datasets: [{
          data: [
            analytics.usageVsLimit?.actual || 0,
            analytics.usageVsLimit?.limit || 0,
          ],
          backgroundColor: ["#8b5cf6", "#3b82f6"],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  } else if (usageLimitChart) {
    usageLimitChart.data.datasets[0].data = [
      analytics.usageVsLimit?.actual || 0,
      analytics.usageVsLimit?.limit || 0,
    ];
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
            label: "Generation (kWh)",
            data: comparison.generation || [],
            borderColor: "#10b981",
            tension: 0.3,
          },
          {
            label: "Consumption (kWh)",
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

// =====================================
// Billing Section
// =====================================
const billMonth = document.getElementById("billMonth");
const billUnitsUsed = document.getElementById("billUnitsUsed");
const billCurrentRate = document.getElementById("billCurrentRate");
const billTotalDue = document.getElementById("billTotalDue");
const billStatus = document.getElementById("billStatus");
const billStatusRow = document.getElementById("billStatusRow");
const payNowBtn = document.getElementById("payNowBtn");
const energyBillUsage = document.getElementById("billUsage");
const energyBillRate = document.getElementById("billRate");
const energyBillFixed = document.getElementById("billFixed");
const energyBillTotal = document.getElementById("billTotal");
const payBtn = document.getElementById("payBtn");
const billHistoryBody = document.getElementById("billHistoryBody");

async function loadCurrentBill() {
  try {
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary`);
    const bill = await response.json();

    const monthDate = new Date(bill.month + "-01");
    const monthName = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    billMonth.textContent = monthName;
    billUnitsUsed.textContent = `${Number(bill.usage || 0).toFixed(2)} kWh`;
    billCurrentRate.textContent = `${formatInr(bill.usageRate)} / kWh`;
    billTotalDue.textContent = formatInr(bill.totalAmount);

    if (energyBillUsage) {
      energyBillUsage.textContent = `${Number(bill.usage || 0).toFixed(2)} kWh`;
    }
    if (energyBillRate) {
      energyBillRate.textContent = `${formatInr(bill.usageRate)} / kWh`;
    }
    if (energyBillFixed) {
      energyBillFixed.textContent = formatInr(bill.fixedCharge);
    }
    if (energyBillTotal) {
      energyBillTotal.textContent = formatInr(bill.totalAmount);
    }
    
    // Update status
    billStatus.textContent = bill.paymentStatus === "paid" ? "Paid ✓" : "Pending";
    if (bill.paymentStatus === "paid") {
      billStatusRow.style.color = "#10b981";
      payNowBtn.textContent = "Bill Paid";
      payNowBtn.disabled = true;
      if (payBtn) {
        payBtn.textContent = "Bill Paid";
        payBtn.disabled = true;
      }
    } else {
      billStatusRow.style.color = "#f59e0b";
      payNowBtn.textContent = "Pay Now";
      payNowBtn.disabled = false;
      if (payBtn) {
        payBtn.textContent = "Pay Now";
        payBtn.disabled = false;
      }
    }

    // Load previous bills
    await loadBillHistory();
  } catch (error) {
    console.error("Failed to load current bill:", error);
  }
}

async function loadBillHistory() {
  try {
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bills/history?limit=12`);
    const data = await response.json();
    const bills = data.bills || [];

    billHistoryBody.innerHTML = "";

    if (!bills.length) {
      billHistoryBody.innerHTML = '<tr><td colspan="6" class="no-alerts">No bill history</td></tr>';
      return;
    }

    bills.forEach((bill) => {
      const tr = document.createElement("tr");
      const statusClass = bill.paymentStatus === "paid" ? "text-success" : "text-danger";
      tr.innerHTML = `
        <td>${bill.month}</td>
        <td>${Number(bill.usageUnits || 0).toFixed(2)} kWh</td>
        <td>${formatInr(bill.calculatedAmount)}</td>
        <td>${formatInr(bill.paidAmount)}</td>
        <td>${formatInr(bill.remainingAmount)}</td>
        <td><span class="${statusClass}">${bill.paymentStatus}</span></td>
      `;
      billHistoryBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load bill history:", error);
  }
}

async function payCurrentBill() {
  try {
    const billRes = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/bill-summary`);
    const bill = await billRes.json();

    const amount = Number(bill.totalAmount || 0);
    if (amount <= 0 || bill.paymentStatus === "paid") {
      alert("This bill is already paid or invalid");
      return;
    }

    const response = await authFetch(`${API_BASE}/customer/payment`, {
      method: "POST",
      body: JSON.stringify({
        customerId: CUSTOMER_ID,
        amount,
        month: bill.month,
        currency: "INR",
        method: "ONLINE",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.message || "Payment failed");
      return;
    }

    alert(`Payment Successful\nAmount Paid: ${formatInr(data.appliedAmount)}`);

    // Refresh all views
    await Promise.all([
      fetchCustomerData(),
      loadCurrentBill(),
      loadPaymentHistory(),
    ]);
  } catch (error) {
    console.error("Payment error:", error);
  }
}

// =====================================
// Payment History Section
// =====================================
const paymentHistoryBody = document.getElementById("paymentHistoryBody");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

async function loadPaymentHistory() {
  try {
    const response = await authFetch(`${API_BASE}/customer/${CUSTOMER_ID}/payments/history?limit=50`);
    const data = await response.json();
    const payments = data.payments || [];

    paymentHistoryBody.innerHTML = "";

    if (!payments.length) {
      paymentHistoryBody.innerHTML = '<tr><td colspan="5" class="no-alerts">No payment history</td></tr>';
      return;
    }

    payments.forEach((payment) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(payment.date).toLocaleDateString()}</td>
        <td>${payment.month}</td>
        <td>${formatInr(payment.amount)}</td>
        <td>${payment.method || "ONLINE"}</td>
        <td><span class="text-success">${payment.status}</span></td>
      `;
      paymentHistoryBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Failed to load payment history:", error);
  }
}

// =====================================
// Event Listeners
// =====================================
customerComparisonLoadBtn.addEventListener("click", loadCustomerEnergyComparison);
payNowBtn.addEventListener("click", payCurrentBill);
if (payBtn) {
  payBtn.addEventListener("click", payCurrentBill);
}
refreshHistoryBtn.addEventListener("click", loadPaymentHistory);

// =====================================
// Init
// =====================================
(async function init() {
  await Promise.all([
    fetchCustomerData(),
    loadCustomerEnergyComparison(),
    loadCurrentBill(),
    loadPaymentHistory(),
  ]);

  setInterval(fetchCustomerData, 5000);

  switchCustomerView("energy");
})();
