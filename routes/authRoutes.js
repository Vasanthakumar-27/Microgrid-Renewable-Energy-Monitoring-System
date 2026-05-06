const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { customers } = require("../data/energyData");
const operatorStore = require("../data/operatorStore");

const router = express.Router();

const staticUsers = [
  {
    username: "company",
    password: "company123",
    role: "admin",
    dashboardPath: "/dashboard/admin.html",
  },
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    dashboardPath: "/dashboard/admin.html",
  },
];

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const normalizedUsername = String(username).trim().toLowerCase();

  let user = staticUsers.find(
    (entry) => entry.username === username && entry.password === password
  );

  if (!user) {
    const operator = await operatorStore.getOperatorByLogin(normalizedUsername, password);

    if (operator) {
      user = {
        username: operator.username || operator.name,
        password: operator.password,
        role: "operator",
        operatorId: operator.id,
        dashboardPath: "/dashboard/operator.html",
      };
    }
  }

  if (!user) {
    const customer = customers.find((entry) => {
      const loginName = String(entry.username || entry.id || "").trim().toLowerCase();
      return loginName === normalizedUsername && entry.password === password;
    });

    if (customer) {
      user = {
        username: customer.username || customer.id,
        password: customer.password,
        role: "customer",
        customerId: customer.id,
        dashboardPath: "/dashboard/customer.html",
      };
    }
  }

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const tokenPayload = {
    sub: user.username,
    role: user.role,
    operatorId: user.operatorId || null,
    customerId: user.customerId || null,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: "8h",
  });

  return res.status(200).json({
    token,
    role: user.role,
    operatorId: user.operatorId || null,
    customerId: user.customerId || null,
    dashboardPath: user.dashboardPath,
  });
});

module.exports = router;
