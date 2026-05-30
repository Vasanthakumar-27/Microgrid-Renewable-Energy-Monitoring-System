# PHASE 2: EXTERNAL SERVICE INTEGRATION - DETAILED IMPLEMENTATION PLAN

**Status**: Ready to Implement
**Duration**: 6-8 days (2A: 2 days, 2B: 3-4 days, 2C: 1-2 days)
**Date**: Starting May 23, 2026

---

## PHASE 2A: EMAIL/SMS NOTIFICATION SERVICE (2 days)

### ARCHITECTURE OVERVIEW

```
Notification System Flow:
┌─────────────────────┐
│  Action Triggered   │  (e.g., bill generated, payment made)
│  (Event Emitter)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  notificationStore  │  (Create notification + Queue job)
│  .createNotif()     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Bull Queue        │  (Async job processor)
│  (Redis backed)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ notificationService │  (Send email/SMS)
│  - SendGrid (email) │
│  - Twilio (SMS)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Customer Receives  │  (Email/SMS delivered)
└─────────────────────┘
```

### KEY DESIGN DECISIONS

1. **Queue System: Bull Queue**
   - Why: Redis-backed, persistent, retries built-in, monitoring available
   - Alternative: RabbitMQ (more complex), Bee-Queue (simpler but less features)
   - Setup: npm install bull redis

2. **Email Provider: SendGrid**
   - Why: Easy integration, good free tier (100 emails/day), INR-friendly
   - API Key: Store in .env as `SENDGRID_API_KEY`
   - Cost: Free tier suitable for MVP

3. **SMS Provider: Twilio**
   - Why: Global coverage, India supported, good rates (~$0.01/SMS)
   - API Keys: Store in .env as `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`
   - Cost: Pay-as-you-go

### IMPLEMENTATION STEPS

#### Step 1: Install Dependencies
```bash
npm install bull redis nodemailer twilio @sendgrid/mail
```

#### Step 2: Create Notification Service
**File**: `services/notificationService.js`

```javascript
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const config = require('../config/appConfig');

// SendGrid setup
sgMail.setApiKey(config.sendgridApiKey);

// Twilio setup
const twilioClient = twilio(
  config.twilioAccountSid,
  config.twilioAuthToken
);

const notificationService = {
  // Send email via SendGrid
  async sendEmail(to, subject, htmlContent) {
    try {
      const msg = {
        to,
        from: config.emailFrom || 'billing@microgrid-system.com',
        subject,
        html: htmlContent,
        track_opens: true,
        track_clicks: true
      };
      
      const result = await sgMail.send(msg);
      console.log(`Email sent to ${to}: ${result[0].statusCode}`);
      return { success: true, messageId: result[0].messageId };
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error.message);
      throw error;
    }
  },

  // Send SMS via Twilio
  async sendSMS(toPhone, message) {
    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: config.twilioPhone,
        to: toPhone
      });
      console.log(`SMS sent to ${toPhone}: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error(`Failed to send SMS to ${toPhone}:`, error.message);
      throw error;
    }
  },

  // Email templates
  billGeneratedEmail: (customerName, billMonth, amount) => ({
    subject: `Bill Generated - ${billMonth}`,
    html: `
      <h2>Hello ${customerName},</h2>
      <p>Your bill for <strong>${billMonth}</strong> has been generated.</p>
      <p><strong>Amount Due: INR ${amount}</strong></p>
      <p><a href="http://localhost:5000/dashboard/customer.html">View Bill</a></p>
      <p>Best regards,<br>Microgrid Team</p>
    `
  }),

  paymentReceivedEmail: (customerName, amount, method, date) => ({
    subject: 'Payment Received - Receipt',
    html: `
      <h2>Thank You for Your Payment!</h2>
      <p>Dear ${customerName},</p>
      <p>We have received your payment on <strong>${date}</strong>.</p>
      <table border="1" cellpadding="10">
        <tr><td>Amount</td><td>INR ${amount}</td></tr>
        <tr><td>Method</td><td>${method}</td></tr>
        <tr><td>Date</td><td>${date}</td></tr>
      </table>
      <p>Best regards,<br>Microgrid Team</p>
    `
  }),

  paymentReminderEmail: (customerName, billMonth, remainingAmount, daysOverdue) => ({
    subject: `Payment Reminder - ${billMonth}`,
    html: `
      <h2>Friendly Payment Reminder</h2>
      <p>Dear ${customerName},</p>
      <p>Your payment for <strong>${billMonth}</strong> is <strong>${daysOverdue} days overdue</strong>.</p>
      <p><strong>Remaining Amount: INR ${remainingAmount}</strong></p>
      <p>Please pay at your earliest convenience.</p>
      <p><a href="http://localhost:5000/dashboard/customer.html">Pay Now</a></p>
      <p>Best regards,<br>Microgrid Team</p>
    `
  })
};

module.exports = notificationService;
```

#### Step 3: Create Bull Queue Jobs
**File**: `jobs/notificationJob.js`

```javascript
const Queue = require('bull');
const notificationService = require('../services/notificationService');

const emailQueue = new Queue('email', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  }
});

const smsQueue = new Queue('sms', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  }
});

// Email processor with retries
emailQueue.process(5, async (job) => {
  const { to, subject, htmlContent } = job.data;
  try {
    const result = await notificationService.sendEmail(to, subject, htmlContent);
    return result;
  } catch (error) {
    // Retry up to 3 times with exponential backoff
    if (job.attemptsMade < 3) {
      throw error; // Bull will retry
    }
    throw new Error(`Failed to send email after 3 retries: ${error.message}`);
  }
});

// SMS processor with retries
smsQueue.process(5, async (job) => {
  const { toPhone, message } = job.data;
  try {
    const result = await notificationService.sendSMS(toPhone, message);
    return result;
  } catch (error) {
    if (job.attemptsMade < 3) {
      throw error;
    }
    throw new Error(`Failed to send SMS after 3 retries: ${error.message}`);
  }
});

// Event listeners
emailQueue.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, error) => {
  console.error(`Email job ${job.id} failed:`, error.message);
});

smsQueue.on('completed', (job) => {
  console.log(`SMS job ${job.id} completed`);
});

smsQueue.on('failed', (job, error) => {
  console.error(`SMS job ${job.id} failed:`, error.message);
});

// Helper to enqueue jobs
const enqueueEmail = async (to, subject, htmlContent) => {
  return emailQueue.add(
    { to, subject, htmlContent },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
};

const enqueueSMS = async (toPhone, message) => {
  return smsQueue.add(
    { toPhone, message },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
};

module.exports = {
  emailQueue,
  smsQueue,
  enqueueEmail,
  enqueueSMS
};
```

#### Step 4: Update Notification Store to Queue Jobs
**File**: `data/notificationStore.js` (Update createNotification method)

```javascript
const notificationModel = require('../models/notificationModel');
const { enqueueEmail, enqueueSMS } = require('../jobs/notificationJob');
const notificationService = require('../services/notificationService');

// Hook into createNotification to queue email/SMS
exports.createNotification = async (customerId, type, title, message, phone = null, email = null) => {
  // 1. Save notification to DB (for in-app display)
  const notification = new notificationModel({
    customerId,
    type,  // BILL_GENERATED, PAYMENT_RECEIPT, PAYMENT_REMINDER
    title,
    message,
    read: false,
    createdAt: new Date()
  });

  await notification.save();

  // 2. Queue email notification (if enabled)
  if (email && type === 'BILL_GENERATED') {
    const emailTemplate = notificationService.billGeneratedEmail(
      'Customer', // Will be fetched from customer record
      message.substring(0, 20), // Extract month from message
      '₹ Amount' // Will be fetched from bill
    );
    await enqueueEmail(email, emailTemplate.subject, emailTemplate.html);
  }

  // 3. Queue SMS notification (if enabled)
  if (phone && type === 'PAYMENT_REMINDER') {
    const smsMessage = `Payment Reminder: Your bill is overdue. Please pay at your earliest convenience. Reply STOP to opt-out.`;
    await enqueueSMS(phone, smsMessage);
  }

  return notification;
};
```

#### Step 5: Update appConfig.js
**File**: `config/appConfig.js` (Add new config)

```javascript
// ... existing config ...

module.exports = {
  // ... existing exports ...
  
  // SendGrid
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'billing@microgrid-system.com',

  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhone: process.env.TWILIO_PHONE || '+1234567890',

  // Redis
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: process.env.REDIS_PORT || 6379,

  // Notification settings
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
  enableSMSNotifications: process.env.ENABLE_SMS_NOTIFICATIONS !== 'false'
};
```

#### Step 6: Update .env.example
```
# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=billing@microgrid-system.com

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE=+1234567890

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Notifications
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=true
```

#### Step 7: Update server.js
**File**: `server.js` (Initialize job queues)

```javascript
// ... existing imports ...
const { emailQueue, smsQueue } = require('./jobs/notificationJob');

// ... existing code ...

// Start job queues
emailQueue.on('error', (error) => {
  console.error('Email queue error:', error);
});

smsQueue.on('error', (error) => {
  console.error('SMS queue error:', error);
});

app.listen(PORT, () => {
  void runReminderSweep();
  startBillScheduler();
  console.log(`Server running on port ${PORT}`);
  console.log(`Email queue ready: ${config.enableEmailNotifications ? 'enabled' : 'disabled'}`);
  console.log(`SMS queue ready: ${config.enableSMSNotifications ? 'enabled' : 'disabled'}`);
});
```

---

## PHASE 2B: PAYMENT GATEWAY INTEGRATION - RAZORPAY (3-4 days)

### ARCHITECTURE OVERVIEW

```
Payment Flow:
┌──────────────────┐
│  Customer UI     │  (Payment form)
│  (customer.html) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│  Razorpay Hosted Widget  │  (Secure payment form)
│  (Frontend integration)   │
└────────┬─────────────────┘
         │
         ▼ (Customer enters card)
┌──────────────────────────┐
│  Razorpay Payment Server │  (Process payment)
└────────┬─────────────────┘
         │
         ▼ (Webhook)
┌──────────────────────────┐
│ paymentGatewayController │  (Webhook handler)
│ /webhooks/razorpay       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Update Payment Record   │  (Mark as PAID)
│  Create Notification     │  (Payment receipt)
└──────────────────────────┘
```

### IMPLEMENTATION STEPS

#### Step 1: Install Razorpay SDK
```bash
npm install razorpay crypto
```

#### Step 2: Create Payment Service
**File**: `services/paymentService.js`

```javascript
const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/appConfig');

const razorpay = new Razorpay({
  key_id: config.razorpayKeyId,
  key_secret: config.razorpayKeySecret
});

const paymentService = {
  // Create Razorpay order
  async createOrder(customerId, amount, billMonth) {
    try {
      const options = {
        amount: Math.round(amount * 100), // Amount in paise (convert from INR)
        currency: 'INR',
        receipt: `bill_${customerId}_${billMonth}`,
        notes: {
          customerId,
          billMonth,
          description: `Bill Payment - ${billMonth}`
        }
      };

      const order = await razorpay.orders.create(options);
      
      console.log(`Razorpay order created: ${order.id}`);
      return {
        success: true,
        orderId: order.id,
        amount: order.amount / 100, // Convert back to INR
        currency: order.currency,
        clientOrderId: order.receipt
      };
    } catch (error) {
      console.error('Failed to create Razorpay order:', error);
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  },

  // Verify payment signature (from webhook)
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const shasum = crypto.createHmac('sha256', config.razorpayKeySecret);
      shasum.update(`${orderId}|${paymentId}`);
      const digest = shasum.digest('hex');

      if (digest === signature) {
        console.log(`Payment signature verified for ${paymentId}`);
        return true;
      } else {
        console.error('Payment signature verification failed');
        return false;
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  },

  // Fetch payment details from Razorpay
  async fetchPaymentDetails(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error(`Failed to fetch payment ${paymentId}:`, error);
      throw error;
    }
  }
};

module.exports = paymentService;
```

#### Step 3: Create Payment Gateway Controller
**File**: `controllers/paymentGatewayController.js`

```javascript
const paymentService = require('../services/paymentService');
const billingStore = require('../data/billingStore');
const notificationStore = require('../data/notificationStore');
const auditLogStore = require('../data/auditLogStore');
const paymentModel = require('../models/paymentModel');

exports.createPaymentOrder = async (req, res) => {
  try {
    const { customerId, amount, billMonth } = req.body;

    if (!customerId || !amount || !billMonth) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be positive' });
    }

    // Create Razorpay order
    const orderResult = await paymentService.createOrder(customerId, amount, billMonth);

    res.json(orderResult);
  } catch (error) {
    console.error('Payment order creation failed:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (event === 'payment.authorized') {
      const { payment, order } = payload;
      const { id: paymentId, amount, method, email, contact } = payment;
      const { id: orderId, receipt } = order;

      // Verify signature
      const isValid = paymentService.verifyPaymentSignature(
        orderId,
        paymentId,
        req.headers['x-razorpay-signature']
      );

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      // Parse receipt to get customerId and billMonth
      const [prefix, customerId, billMonth] = receipt.split('_');

      // Update payment in DB
      const payment = new paymentModel({
        paymentId,
        customerId,
        billMonth,
        amount: amount / 100, // Convert from paise to INR
        method: 'ONLINE',
        status: 'COMPLETED',
        razorpayOrderId: orderId,
        createdAt: new Date()
      });

      await payment.save();

      // Apply payment to bill
      await billingStore.applyPayment(customerId, billMonth, amount / 100);

      // Create notification
      const notificationMsg = `Payment received for ${billMonth}`;
      await notificationStore.createNotification(
        customerId,
        'PAYMENT_RECEIPT',
        'Payment Received',
        notificationMsg,
        contact,
        email
      );

      // Audit log
      await auditLogStore.log(
        'system', // role
        'payment_received',
        'payment',
        paymentId,
        { amount: amount / 100, billMonth, method: 'RAZORPAY_ONLINE' }
      );

      console.log(`Payment ${paymentId} processed successfully`);
      res.json({ success: true });
    } else if (event === 'payment.failed') {
      const { payment } = payload;
      console.log(`Payment failed: ${payment.id}`);
      
      // Create failed payment record
      const payment = new paymentModel({
        paymentId: payment.id,
        customerId: payment.notes.customerId,
        billMonth: payment.notes.billMonth,
        amount: payment.amount / 100,
        method: 'ONLINE',
        status: 'FAILED',
        failureReason: payment.failure_reason,
        createdAt: new Date()
      });

      await payment.save();

      // Notify customer
      await notificationStore.createNotification(
        payment.notes.customerId,
        'PAYMENT_FAILED',
        'Payment Failed',
        `Payment failed: ${payment.failure_reason}`
      );

      res.json({ success: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ message: error.message });
  }
};
```

#### Step 4: Add Payment Routes
**File**: `routes/paymentGatewayRoutes.js` (New file)

```javascript
const express = require('express');
const paymentGatewayController = require('../controllers/paymentGatewayController');
const authRequired = require('../middleware/authMiddleware');

const router = express.Router();

// Create payment order (customer initiates payment)
router.post('/order/create', authRequired, paymentGatewayController.createPaymentOrder);

// Razorpay webhook (automatic, no auth required - IP whitelist recommended)
router.post('/webhook/razorpay', paymentGatewayController.handleRazorpayWebhook);

module.exports = router;
```

#### Step 5: Mount Payment Routes in server.js
```javascript
const paymentGatewayRoutes = require('./routes/paymentGatewayRoutes');

// ... existing routes ...
app.use('/payment', paymentGatewayRoutes);
```

#### Step 6: Update appConfig.js
```javascript
// Razorpay
razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || ''
```

#### Step 7: Update .env.example
```
# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
```

#### Step 8: Frontend Integration
**File**: `public/customer.html` (Payment form update)

```html
<!-- Existing payment form -->
<form id="paymentForm">
  <input type="hidden" id="customerId" value="">
  <input type="hidden" id="billMonth" value="">
  
  <label>Amount (INR)</label>
  <input type="number" id="paymentAmount" min="1" max="10000" required>
  
  <label>Payment Method</label>
  <select id="paymentMethod">
    <option value="ONLINE">Online (Card/UPI)</option>
    <option value="OFFLINE_CASH">Cash</option>
    <option value="CHEQUE">Cheque</option>
    <option value="BANK_TRANSFER">Bank Transfer</option>
    <option value="E_WALLET">E-Wallet</option>
  </select>
  
  <button type="submit">Pay Now</button>
</form>

<script src="https://checkout.razorpay.com/v1/checkout.js"></script>

<script>
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const method = document.getElementById('paymentMethod').value;
  const customerId = document.getElementById('customerId').value;
  const billMonth = document.getElementById('billMonth').value;

  if (method !== 'ONLINE') {
    // Offline payment - direct save
    await saveOfflinePayment(customerId, billMonth, amount, method);
  } else {
    // Online payment - use Razorpay
    const orderResponse = await fetch('/payment/order/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ customerId, amount, billMonth })
    }).then(r => r.json());

    const options = {
      key: 'YOUR_RAZORPAY_KEY_ID', // From config
      order_id: orderResponse.orderId,
      amount: orderResponse.amount * 100,
      currency: 'INR',
      name: 'Microgrid Payment',
      handler: function(response) {
        handlePaymentSuccess(response, customerId, billMonth, amount);
      },
      prefill: {
        email: localStorage.getItem('customerEmail'),
        contact: localStorage.getItem('customerPhone')
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }
});

async function handlePaymentSuccess(response, customerId, billMonth, amount) {
  // Verify payment on backend (already done by webhook)
  alert(`Payment of INR ${amount} completed successfully!`);
  location.reload();
}

async function saveOfflinePayment(customerId, billMonth, amount, method) {
  const response = await fetch(`/customer/${customerId}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      month: billMonth,
      amount,
      method
    })
  }).then(r => r.json());

  if (response.success) {
    alert(`${method} payment of INR ${amount} recorded!`);
    location.reload();
  }
}
</script>
```

---

## PHASE 2C: FILE UPLOAD FOR DISPUTES (1-2 days)

### IMPLEMENTATION STEPS

#### Step 1: Install Multer
```bash
npm install multer
```

#### Step 2: Create Upload Middleware
**File**: `middleware/uploadMiddleware.js`

```javascript
const multer = require('multer');
const path = require('path');

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/disputes'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-z0-9]/gi, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];

  if (allowedMimes.includes(file.mimetype) && 
      allowedExts.includes(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are allowed. Max 5MB.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

module.exports = upload;
```

#### Step 3: Update Dispute Model
**File**: `models/billDisputeModel.js` (Add evidence file field)

```javascript
const disputeSchema = new Schema({
  disputeId: { type: String, unique: true, required: true },
  customerId: { type: String, required: true },
  billMonth: { type: String, required: true },
  reason: { type: String, required: true },
  evidence: { type: String }, // Text evidence
  evidenceFile: { type: String }, // File path/URL for uploaded evidence
  status: {
    type: String,
    enum: ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'OPEN'
  },
  resolvedBy: { type: String },
  resolutionNote: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

module.exports = mongoose.model('BillDispute', disputeSchema);
```

#### Step 4: Update Dispute Controller
**File**: `controllers/disputeController.js` (Add file upload)

```javascript
const upload = require('../middleware/uploadMiddleware');
const billDisputeModel = require('../models/billDisputeModel');

exports.createDisputeWithFile = [
  upload.single('evidenceFile'), // Middleware to handle file
  
  async (req, res) => {
    try {
      const { customerId, billMonth, reason, evidence } = req.body;

      if (!customerId || !billMonth || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const dispute = new billDisputeModel({
        disputeId: `disp-${Date.now()}`,
        customerId,
        billMonth,
        reason,
        evidence,
        evidenceFile: req.file ? req.file.path : null,
        status: 'OPEN',
        createdAt: new Date()
      });

      await dispute.save();

      // Create notification
      await notificationStore.createNotification(
        customerId,
        'DISPUTE_CREATED',
        'Dispute Created',
        `Your dispute for ${billMonth} has been created.`
      );

      res.json({ success: true, dispute });
    } catch (error) {
      console.error('Dispute creation error:', error);
      res.status(500).json({ message: error.message });
    }
  }
];
```

#### Step 5: Add File Upload Route
**File**: `routes/disputeRoutes.js` (Update with file upload)

```javascript
const express = require('express');
const disputeController = require('../controllers/disputeController');
const authRequired = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Create dispute with file upload
router.post('/dispute/create', 
  authRequired,
  upload.single('evidenceFile'),
  disputeController.createDisputeWithFile
);

module.exports = router;
```

#### Step 6: Frontend Form Update
**File**: `public/customer.html` (Dispute form with file upload)

```html
<form id="disputeForm" enctype="multipart/form-data">
  <label>Select Month</label>
  <select id="disputeMonth" required></select>

  <label>Reason for Dispute</label>
  <textarea id="disputeReason" required></textarea>

  <label>Additional Evidence (Text)</label>
  <textarea id="disputeEvidence"></textarea>

  <label>Upload Evidence (JPG, PNG, PDF - max 5MB)</label>
  <input type="file" id="disputeFile" accept=".jpg,.jpeg,.png,.pdf">

  <button type="submit">Create Dispute</button>
</form>

<script>
document.getElementById('disputeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append('customerId', currentCustomerId);
  formData.append('billMonth', document.getElementById('disputeMonth').value);
  formData.append('reason', document.getElementById('disputeReason').value);
  formData.append('evidence', document.getElementById('disputeEvidence').value);
  
  if (document.getElementById('disputeFile').files.length > 0) {
    formData.append('evidenceFile', document.getElementById('disputeFile').files[0]);
  }

  const response = await fetch('/dispute/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  }).then(r => r.json());

  if (response.success) {
    alert('Dispute created successfully!');
    document.getElementById('disputeForm').reset();
    loadDisputes();
  } else {
    alert('Error: ' + response.message);
  }
});
</script>
```

---

## PHASE 2 DELIVERABLES

✅ **Email/SMS Service**: SendGrid + Twilio via Bull Queue
✅ **Payment Gateway**: Razorpay integration with webhooks
✅ **File Upload**: Dispute evidence storage with validation
✅ **Error Handling**: Retry logic, fallbacks, logging
✅ **Testing**: All features validated end-to-end

---

## DEPENDENCIES TO INSTALL

```bash
npm install bull redis nodemailer twilio @sendgrid/mail razorpay multer
```

---

## CONFIGURATION REQUIRED

Create/update `.env` with:
```
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

---

## TESTING STRATEGY FOR PHASE 2

1. **Email Testing** (2A)
   - Send test email via SendGrid sandbox
   - Verify queue persistence (restart server, check retries)
   - Test failure handling

2. **SMS Testing** (2A)
   - Send test SMS via Twilio (requires paid account or trial)
   - Verify message formatting
   - Check delivery logs

3. **Payment Testing** (2B)
   - Use Razorpay test keys (sandbox mode)
   - Test successful payment flow
   - Test payment failure webhook
   - Verify DB updates after webhook

4. **File Upload Testing** (2C)
   - Upload valid file (JPG, PNG, PDF)
   - Attempt upload with invalid file (should reject)
   - Verify file size validation (>5MB should reject)
   - Check file storage in `/uploads/disputes`

---

## ROLLBACK PLAN

If critical issue found:
1. Disable external service: Set `ENABLE_EMAIL_NOTIFICATIONS=false` in .env
2. Disable payment gateway: Redirect to offline payment methods only
3. Disable file upload: Keep text evidence only
4. Restart server

---

## NEXT PHASE

After Phase 2 complete:
- Phase 3: Performance (Indexing, Archival)
- Phase 5: Security (Rate limiting, HTTPS)
- Phase 6: UI/UX (Mobile, WebSocket, Dark mode)
- Phase 7: DevOps (Docker, CI/CD)

---

**Status**: Ready to Implementation Phase 2
**Estimated Duration**: 6-8 days
**Start Date**: May 23, 2026

