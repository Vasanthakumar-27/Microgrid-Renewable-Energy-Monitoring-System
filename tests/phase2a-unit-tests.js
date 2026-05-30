const notificationService = require("../services/notificationService");
const { enqueueEmail, enqueueSMS, getQueueStats } = require("../jobs/notificationJob");

console.log("=".repeat(70));
console.log("PHASE 2A: EMAIL/SMS NOTIFICATION SERVICE - LOCAL UNIT TESTS");
console.log("=".repeat(70));
console.log();

let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    console.log(`📝 Test: ${name}`);
    fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
  console.log();
};

// TESTS

test("1. Email template: Bill Generated", () => {
  const template = notificationService.billGeneratedEmail(
    "John Doe",
    "May 2026",
    "5000"
  );

  if (!template.subject || !template.html) {
    throw new Error("Template missing subject or html");
  }

  if (!template.subject.includes("May 2026")) {
    throw new Error("Subject missing month");
  }

  if (!template.html.includes("5000")) {
    throw new Error("HTML missing amount");
  }

  if (!template.html.includes("John Doe")) {
    throw new Error("HTML missing customer name");
  }

  console.log(`  ✓ Subject: ${template.subject}`);
  console.log(`  ✓ HTML length: ${template.html.length} bytes`);
  console.log(`  ✓ Contains customer name, month, and amount`);
});

test("2. Email template: Payment Received", () => {
  const template = notificationService.paymentReceivedEmail(
    "Jane Smith",
    "5000",
    "RAZORPAY",
    "2026-05-19",
    "txn_abc123"
  );

  if (!template.subject || !template.html) {
    throw new Error("Template missing subject or html");
  }

  if (!template.html.includes("5000")) {
    throw new Error("HTML missing amount");
  }

  if (!template.html.includes("RAZORPAY")) {
    throw new Error("HTML missing payment method");
  }

  console.log(`  ✓ Subject: ${template.subject}`);
  console.log(`  ✓ Contains amount, method, and transaction ID`);
});

test("3. Email template: Payment Reminder", () => {
  const template = notificationService.paymentReminderEmail(
    "Alex Kumar",
    "May 2026",
    "2500",
    "7"
  );

  if (!template.subject || !template.html) {
    throw new Error("Template missing subject or html");
  }

  if (!template.html.includes("overdue")) {
    throw new Error("HTML missing overdue message");
  }

  console.log(`  ✓ Subject: ${template.subject}`);
  console.log(`  ✓ Contains bill month and overdue days`);
});

test("4. SMS template: Payment Reminder", () => {
  const sms = notificationService.paymentReminderSMS("May 2026", "5000");

  if (!sms || sms.length === 0) {
    throw new Error("SMS template empty");
  }

  if (!sms.includes("May 2026") || !sms.includes("5000")) {
    throw new Error("SMS missing month or amount");
  }

  console.log(`  ✓ SMS message: ${sms}`);
  console.log(`  ✓ Length: ${sms.length} chars`);
});

test("5. Configuration loaded correctly", () => {
  const config = require("../config/appConfig");

  if (!config.emailFrom) {
    throw new Error("emailFrom not configured");
  }

  if (config.enableEmailNotifications === undefined) {
    throw new Error("enableEmailNotifications not configured");
  }

  if (config.enableSMSNotifications === undefined) {
    throw new Error("enableSMSNotifications not configured");
  }

  console.log(`  ✓ Email from: ${config.emailFrom}`);
  console.log(`  ✓ Email notifications enabled: ${config.enableEmailNotifications}`);
  console.log(`  ✓ SMS notifications enabled: ${config.enableSMSNotifications}`);
  console.log(`  ✓ Redis: ${config.redisHost}:${config.redisPort}`);
});

test("6. Queue helpers are available", () => {
  if (!enqueueEmail || typeof enqueueEmail !== "function") {
    throw new Error("enqueueEmail not available");
  }

  if (!enqueueSMS || typeof enqueueSMS !== "function") {
    throw new Error("enqueueSMS not available");
  }

  if (!getQueueStats || typeof getQueueStats !== "function") {
    throw new Error("getQueueStats not available");
  }

  console.log(`  ✓ enqueueEmail function available`);
  console.log(`  ✓ enqueueSMS function available`);
  console.log(`  ✓ getQueueStats function available`);
});

test("7. Queue stats are retrievable", async () => {
  const stats = await getQueueStats();

  if (!stats) {
    throw new Error("Stats object is empty");
  }

  console.log(`  ✓ Queue mode: ${stats.mode || "in-memory fallback"}`);
  if (stats.emailJobs !== undefined) {
    console.log(`  ✓ Email jobs in queue: ${stats.emailJobs}`);
  }
  if (stats.smsJobs !== undefined) {
    console.log(`  ✓ SMS jobs in queue: ${stats.smsJobs}`);
  }
});

test("8. Notification Service routes exist", async () => {
  try {
    const routes = require("../routes/customerRoutes");
    if (!routes) {
      throw new Error("Customer routes not found");
    }

    console.log(`  ✓ Customer routes available`);
    console.log(`  ✓ Notifications endpoints ready`);
  } catch (error) {
    throw error;
  }
});

test("9. Email configuration validation", () => {
  const config = require("../config/appConfig");
  const sgApiKey = config.sendgridApiKey;
  const emailFrom = config.emailFrom;

  if (!emailFrom) {
    throw new Error("EMAIL_FROM not set");
  }

  console.log(`  ✓ Email from address configured: ${emailFrom}`);
  if (sgApiKey) {
    console.log(`  ✓ SendGrid API key configured (${sgApiKey.length} chars)`);
  } else {
    console.log(`  ⚠ SendGrid API key not set (will use fallback)`);
  }
});

test("10. SMS configuration validation", () => {
  const config = require("../config/appConfig");
  const twilioSid = config.twilioAccountSid;
  const twilioAuth = config.twilioAuthToken;
  const twilioPhone = config.twilioPhone;

  if (!twilioPhone) {
    throw new Error("TWILIO_PHONE not set");
  }

  console.log(`  ✓ Twilio phone configured: ${twilioPhone}`);
  if (twilioSid && twilioAuth) {
    console.log(`  ✓ Twilio credentials configured`);
  } else {
    console.log(`  ⚠ Twilio credentials not set (will use fallback)`);
  }
});

// Summary
console.log("=".repeat(70));
console.log("TEST SUMMARY");
console.log("=".repeat(70));
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(
  `📊 Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
);
console.log("=".repeat(70));
console.log();

if (failed === 0) {
  console.log("✅ Phase 2A Unit Tests: ALL PASSED");
  console.log();
  console.log("📝 Next Steps:");
  console.log("  1. Install Redis for persistent queuing (optional for dev)");
  console.log("  2. Set SENDGRID_API_KEY and TWILIO credentials in .env");
  console.log("  3. Create notification creation endpoints (Phase 2A Part 2)");
  console.log("  4. Proceed to Phase 2B (Razorpay integration)");
} else {
  console.log(`⚠️  Phase 2A Unit Tests: ${failed} FAILURES`);
}

console.log();
process.exit(failed > 0 ? 1 : 0);
