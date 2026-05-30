const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const config = require("./config/appConfig");

const rootRoutes = require("./routes/rootRoutes");
const companyRoutes = require("./routes/companyRoutes");
const operatorRoutes = require("./routes/operatorRoutes");
const customerRoutes = require("./routes/customerRoutes");
const microgridRoutes = require("./routes/microgridRoutes");
const simulateRoutes = require("./routes/simulateRoutes");
const alertsRoute = require("./routes/alerts");
const predictionRoutes = require("./routes/predictionRoutes");
const insightRoutes = require("./routes/insightRoutes");
const logRoutes = require("./routes/logRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const paymentGatewayRoutes = require("./routes/paymentGatewayRoutes");
const responseLogger = require("./middleware/responseLogger");
const { runReminderSweep } = require("./data/reminderEngine");
const { startBillScheduler } = require("./data/billingScheduler");
const { emailQueue, smsQueue } = require("./jobs/notificationJob");
const { createIndexes, checkIndexHealth } = require("./scripts/createIndexes");
const { setupQueryMonitoring } = require("./middleware/indexMiddleware");
const { sanitizeInputMiddleware, securityHeadersMiddleware } = require("./middleware/validationMiddleware");
const { globalRateLimiter, authRateLimiter } = require("./middleware/rateLimitMiddleware");
const { applySecurityHeaders } = require("./services/encryptionService");

const app = express();
const PORT = config.port;

// Phase 4: Security Headers (apply early)
app.use(applySecurityHeaders());

// CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Phase 4: Global rate limiting (before other middleware)
app.use(globalRateLimiter(100, 900)); // 100 requests per 15 minutes

// Phase 4: Input sanitization
app.use(sanitizeInputMiddleware());

app.use(responseLogger);

// Serve frontend under /dashboard to avoid conflicts with API root routes.
app.use("/dashboard", express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.send("Microgrid API Running");
});

// Routes
app.use("/", rootRoutes);
app.use("/auth", authRoutes);
app.use("/company", companyRoutes);
app.use("/operator", operatorRoutes);
app.use("/customer", customerRoutes);
app.use("/payment", paymentGatewayRoutes);
app.use("/microgrid", microgridRoutes);
app.use("/simulate", simulateRoutes);
app.use("/", alertsRoute);
app.use("/", predictionRoutes);
app.use("/", insightRoutes);
app.use("/", logRoutes);
app.use("/", analyticsRoutes);
app.use("/report", reportRoutes);

// DB
mongoose
  .connect(config.mongoUri)
  .then(async () => {
    console.log("DB Connected");
    // Phase 3A: Initialize database indexes
    await createIndexes();
    const indexHealth = await checkIndexHealth();
    console.log(`✓ [Indexing] ${Object.keys(indexHealth).length} collections indexed`);
  })
  .catch((err) => console.log(err));

// Initialize query monitoring (Phase 3A)
setupQueryMonitoring();

// Initialize job queues (Phase 2A)
try {
  emailQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      // Suppress Redis connection errors in fallback mode
    } else {
      console.error("✗ Email queue error:", error.message);
    }
  });

  smsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      // Suppress Redis connection errors in fallback mode
    } else {
      console.error("✗ SMS queue error:", error.message);
    }
  });
} catch (error) {
  // Queues initialized in fallback mode
}

// Server start
app.listen(PORT, () => {
  void runReminderSweep();
  startBillScheduler();
  console.log(`Server running on port ${PORT}`);
  console.log(`✓ Email queue ready: ${config.enableEmailNotifications ? "enabled" : "disabled"}`);
  console.log(`✓ SMS queue ready: ${config.enableSMSNotifications ? "enabled" : "disabled"}`);
});
