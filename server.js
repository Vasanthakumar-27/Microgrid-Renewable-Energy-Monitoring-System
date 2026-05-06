const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

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
const responseLogger = require("./middleware/responseLogger");
const { runReminderSweep } = require("./data/reminderEngine");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
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
  .connect("mongodb://127.0.0.1:27017/microgrid")
  .then(() => console.log("DB Connected"))
  .catch((err) => console.log(err));

// Server start
app.listen(PORT, () => {
  runReminderSweep();
  console.log(`Server running on port ${PORT}`);
});
