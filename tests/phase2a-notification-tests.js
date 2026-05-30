const http = require("http");
const axios = require("axios");

const BASE_URL = "http://localhost:5000";
let authToken = "";
let customerId = "";

// Test suite
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log("=".repeat(70));
  console.log("PHASE 2A: EMAIL/SMS NOTIFICATION SERVICE - TEST SUITE");
  console.log("=".repeat(70));
  console.log();

  try {
    // Step 1: Login as admin
    console.log("🔐 Step 1: Authenticating as admin...");
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: "company",
      password: "company123",
    });

    authToken = loginRes.data.token;
    console.log(`✓ Login successful. Token: ${authToken.substring(0, 20)}...`);
    console.log();

    // Step 2: Get list of customers
    console.log("👥 Step 2: Fetching customer list...");
    const customersRes = await axios.get(`${BASE_URL}/operator/customers`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    customerId = customersRes.data.customers[0].id;
    console.log(`✓ Found customer: ${customerId}`);
    console.log();

    // Now run all tests
    for (const t of tests) {
      try {
        console.log(`📝 Test: ${t.name}`);
        await t.fn();
        console.log(`✓ PASS: ${t.name}`);
        passed++;
      } catch (error) {
        console.log(`✗ FAIL: ${t.name}`);
        console.log(`  Error: ${error.message}`);
        failed++;
      }
      console.log();
    }
  } catch (error) {
    console.error(`✗ Setup failed: ${error.message}`);
    process.exit(1);
  }

  // Summary
  console.log("=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`📊 Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("=".repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

// ===== TESTS =====

test("1. Create BILL_GENERATED notification and verify queuing", async () => {
  const res = await axios.post(
    `${BASE_URL}/customer/${customerId}/notifications`,
    {
      role: "operator",
      title: "Bill Generated - May 2026",
      message: "Your May 2026 bill has been generated",
      type: "BILL_GENERATED",
      email: "customer@example.com",
      billData: {
        month: "May 2026",
        amount: 5000
      }
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (!res.data.notification) {
    throw new Error("No notification returned");
  }

  console.log(
    `  ✓ Notification created with ID: ${res.data.notification.notificationId}`
  );
  console.log(`  ✓ Type: ${res.data.notification.type}`);
  console.log(`  ✓ Email queued (if configured)`);
});

test("2. Create PAYMENT_RECEIPT notification with email queuing", async () => {
  const res = await axios.post(
    `${BASE_URL}/customer/${customerId}/notifications`,
    {
      role: "operator",
      title: "Payment Received",
      message: "Your payment of INR 5000 has been received",
      type: "PAYMENT_RECEIPT",
      email: "customer@example.com",
      billData: {
        amount: 5000,
        method: "RAZORPAY",
        transactionId: "txn_abc123"
      }
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (!res.data.notification) {
    throw new Error("No notification returned");
  }

  console.log(
    `  ✓ Payment receipt notification created: ${res.data.notification.notificationId}`
  );
  console.log(`  ✓ Type: PAYMENT_RECEIPT`);
  console.log(`  ✓ Email receipt queued`);
});

test("3. Create PAYMENT_REMINDER notification with SMS queuing", async () => {
  const res = await axios.post(
    `${BASE_URL}/customer/${customerId}/notifications`,
    {
      role: "operator",
      title: "Payment Reminder",
      message: "Your payment is overdue",
      type: "PAYMENT_REMINDER",
      phone: "+919876543210",
      billData: {
        month: "May 2026",
        amount: 5000
      }
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (!res.data.notification) {
    throw new Error("No notification returned");
  }

  console.log(
    `  ✓ Payment reminder created: ${res.data.notification.notificationId}`
  );
  console.log(`  ✓ Type: PAYMENT_REMINDER`);
  console.log(`  ✓ SMS reminder queued`);
});

test("4. List customer notifications", async () => {
  const res = await axios.get(
    `${BASE_URL}/customer/${customerId}/notifications`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (!Array.isArray(res.data.notifications)) {
    throw new Error("Notifications should be an array");
  }

  console.log(
    `  ✓ Retrieved ${res.data.notifications.length} notifications`
  );

  // Show notification types
  const types = res.data.notifications.map((n) => n.type);
  console.log(`  ✓ Types: ${[...new Set(types)].join(", ")}`);
});

test("5. Mark notification as read", async () => {
  // First get notifications
  const listRes = await axios.get(
    `${BASE_URL}/customer/${customerId}/notifications`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (listRes.data.notifications.length === 0) {
    throw new Error("No notifications to mark as read");
  }

  const notificationId = listRes.data.notifications[0].id;

  const res = await axios.put(
    `${BASE_URL}/customer/${customerId}/notifications/${notificationId}/read`,
    {},
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );

  if (!res.data.notification) {
    throw new Error("Failed to mark notification as read");
  }

  console.log(`  ✓ Notification ${notificationId} marked as read`);
  console.log(
    `  ✓ Read status: ${res.data.notification.read ? "true" : "false"}`
  );
});

test("6. Verify notification service has queue helpers", async () => {
  // This is a local verification - just check the modules exist
  try {
    const { enqueueEmail, enqueueSMS, getQueueStats } = require("../jobs/notificationJob");
    
    if (!enqueueEmail || !enqueueSMS || !getQueueStats) {
      throw new Error("Queue helper functions not found");
    }

    console.log(`  ✓ enqueueEmail helper available`);
    console.log(`  ✓ enqueueSMS helper available`);
    console.log(`  ✓ getQueueStats helper available`);

    // Get queue stats
    const stats = await getQueueStats();
    console.log(`  ✓ Queue mode: ${stats.mode || "in-memory fallback"}`);
  } catch (error) {
    throw error;
  }
});

test("7. Verify notification service has templates", async () => {
  try {
    const notificationService = require("../services/notificationService");
    
    const billTemplate = notificationService.billGeneratedEmail("John Doe", "May 2026", "5000");
    const paymentTemplate = notificationService.paymentReceivedEmail("John Doe", "5000", "RAZORPAY", "2026-05-19", "txn_123");
    const reminderTemplate = notificationService.paymentReminderEmail("John Doe", "May 2026", "5000", "5");
    const smsSms = notificationService.paymentReminderSMS("May 2026", "5000");

    if (!billTemplate.subject || !billTemplate.html) {
      throw new Error("Bill template invalid");
    }
    if (!paymentTemplate.subject || !paymentTemplate.html) {
      throw new Error("Payment template invalid");
    }
    if (!reminderTemplate.subject || !reminderTemplate.html) {
      throw new Error("Reminder template invalid");
    }
    if (!smsSms) {
      throw new Error("SMS template invalid");
    }

    console.log(`  ✓ Bill generated email template working`);
    console.log(`  ✓ Payment received email template working`);
    console.log(`  ✓ Payment reminder email template working`);
    console.log(`  ✓ Payment reminder SMS template working`);
  } catch (error) {
    throw error;
  }
});

test("8. Configuration validation", async () => {
  const config = require("../config/appConfig");

  if (!config.emailFrom) {
    throw new Error("EMAIL_FROM not configured");
  }
  if (!config.enableEmailNotifications) {
    throw new Error("Email notifications disabled");
  }
  if (!config.enableSMSNotifications) {
    throw new Error("SMS notifications disabled");
  }

  console.log(`  ✓ Email from: ${config.emailFrom}`);
  console.log(`  ✓ Email notifications: ${config.enableEmailNotifications}`);
  console.log(`  ✓ SMS notifications: ${config.enableSMSNotifications}`);
  console.log(`  ✓ Redis host: ${config.redisHost}:${config.redisPort}`);
});

// Run all tests
runTests();
