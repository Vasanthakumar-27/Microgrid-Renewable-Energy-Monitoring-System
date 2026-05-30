const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
} catch (error) {
  // dotenv is optional in case env vars are provided by the runtime.
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  port: toNumber(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/microgrid",
  jwtSecret: process.env.JWT_SECRET || "microgrid-dev-secret",
  alertTtlMs: toNumber(process.env.ALERT_TTL_MS, 3 * 60 * 1000),
  alertDeleteDelayMs: toNumber(process.env.ALERT_DELETE_DELAY_MS, 30 * 1000),
  alertGenerateIntervalMs: toNumber(process.env.ALERT_GENERATE_INTERVAL_MS, 20 * 1000),
  alertMaxOpen: toNumber(process.env.ALERT_MAX_OPEN, 40),
  reminderSweepMs: toNumber(process.env.REMINDER_SWEEP_MS, 24 * 60 * 60 * 1000),
  billSweepMs: toNumber(process.env.BILL_SWEEP_MS, 12 * 60 * 60 * 1000),
  tariffMin: toNumber(process.env.TARIFF_MIN, 1),
  tariffMax: toNumber(process.env.TARIFF_MAX, 100),

  // Phase 2A: Email/SMS Service
  sendgridApiKey: process.env.SENDGRID_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "billing@microgrid-system.com",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhone: process.env.TWILIO_PHONE || "+1234567890",
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: toNumber(process.env.REDIS_PORT, 6379),
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== "false",
  enableSMSNotifications: process.env.ENABLE_SMS_NOTIFICATIONS !== "false",

  // Phase 2B: Payment Gateway
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  enableRazorpay: process.env.ENABLE_RAZORPAY !== "false",

  // Phase 2C: File Upload
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "public/uploads"),
  maxFileSize: toNumber(process.env.MAX_FILE_SIZE, 5 * 1024 * 1024), // 5MB
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || "jpg,jpeg,png,pdf").split(",")
};

module.exports = config;
