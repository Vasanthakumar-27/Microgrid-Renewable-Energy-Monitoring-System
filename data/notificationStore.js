const Notification = require("../models/notificationModel");
const notificationService = require("../services/notificationService");
let { enqueueEmail, enqueueSMS } = require("../jobs/notificationJob");

// Fallback if queues not yet initialized
const safeEnqueueEmail = async (...args) => {
  try {
    return await enqueueEmail(...args);
  } catch (error) {
    console.warn("Email queue not available:", error.message);
  }
};

const safeEnqueueSMS = async (...args) => {
  try {
    return await enqueueSMS(...args);
  } catch (error) {
    console.warn("SMS queue not available:", error.message);
  }
};

function buildNotificationId() {
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function createNotification({ userId, role, title, message, type = "INFO", email = null, phone = null, billData = null }) {
  if (!userId || !role || !title || !message) {
    return null;
  }

  const payload = {
    notificationId: buildNotificationId(),
    userId: String(userId),
    role: String(role),
    title: String(title),
    message: String(message),
    type: String(type).toUpperCase(),
    read: false,
  };

  const notification = await Notification.create(payload);

  // Queue external notifications (email/SMS) based on type
  if (type === "BILL_GENERATED" && email) {
    try {
      const emailTemplate = notificationService.billGeneratedEmail(
        title || "Valued Customer",
        billData?.month || "This Month",
        billData?.amount || "0"
      );
      await safeEnqueueEmail(email, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error("Failed to queue bill email:", error.message);
    }
  }

  if (type === "PAYMENT_REMINDER" && phone) {
    try {
      const smsMessage = notificationService.paymentReminderSMS(
        billData?.month || "This Month",
        billData?.amount || "0"
      );
      await safeEnqueueSMS(phone, smsMessage);
    } catch (error) {
      console.error("Failed to queue reminder SMS:", error.message);
    }
  }

  if (type === "PAYMENT_RECEIPT" && email) {
    try {
      const emailTemplate = notificationService.paymentReceivedEmail(
        title || "Valued Customer",
        billData?.amount || "0",
        billData?.method || "ONLINE",
        new Date().toLocaleDateString(),
        billData?.transactionId || "N/A"
      );
      await safeEnqueueEmail(email, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error("Failed to queue payment receipt email:", error.message);
    }
  }

  return notification;
}

async function listNotifications(userId, { limit = 50, page = 1 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);

  const rows = await Notification.find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .skip((safePage - 1) * safeLimit)
    .lean();

  return rows.map((row) => ({
    id: row.notificationId,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    createdAt: row.createdAt,
  }));
}

async function markNotificationRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { userId: String(userId), notificationId: String(notificationId) },
    { $set: { read: true } },
    { returnDocument: "after" }
  ).lean();

  return updated;
}

module.exports = {
  createNotification,
  listNotifications,
  markNotificationRead,
  safeEnqueueEmail,
  safeEnqueueSMS
};
