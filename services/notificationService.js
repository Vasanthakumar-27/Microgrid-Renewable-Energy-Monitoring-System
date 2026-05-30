const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const config = require('../config/appConfig');

// SendGrid setup
if (config.sendgridApiKey) {
  sgMail.setApiKey(config.sendgridApiKey);
}

// Twilio setup
let twilioClient = null;
if (config.twilioAccountSid && config.twilioAuthToken) {
  twilioClient = twilio(
    config.twilioAccountSid,
    config.twilioAuthToken
  );
}

const notificationService = {
  // Send email via SendGrid
  async sendEmail(to, subject, htmlContent) {
    try {
      if (!config.sendgridApiKey) {
        console.warn('SendGrid API key not configured. Skipping email send.');
        return { success: false, message: 'SendGrid not configured' };
      }

      const msg = {
        to,
        from: config.emailFrom || 'billing@microgrid-system.com',
        subject,
        html: htmlContent,
        track_opens: true,
        track_clicks: true
      };
      
      const result = await sgMail.send(msg);
      console.log(`✓ Email sent to ${to}: Status ${result[0].statusCode}`);
      return { success: true, messageId: result[0].messageId };
    } catch (error) {
      console.error(`✗ Failed to send email to ${to}:`, error.message);
      throw error;
    }
  },

  // Send SMS via Twilio
  async sendSMS(toPhone, message) {
    try {
      if (!twilioClient) {
        console.warn('Twilio not configured. Skipping SMS send.');
        return { success: false, message: 'Twilio not configured' };
      }

      const result = await twilioClient.messages.create({
        body: message,
        from: config.twilioPhone,
        to: toPhone
      });
      console.log(`✓ SMS sent to ${toPhone}: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error(`✗ Failed to send SMS to ${toPhone}:`, error.message);
      throw error;
    }
  },

  // Email template: Bill Generated
  billGeneratedEmail: (customerName, billMonth, amount) => ({
    subject: `Bill Generated for ${billMonth} - ₹${amount}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${customerName},</h2>
        <p>Your electricity bill for <strong>${billMonth}</strong> has been generated.</p>
        
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Bill Summary</h3>
          <p><strong>Amount Due: ₹${amount}</strong></p>
          <p>Month: ${billMonth}</p>
        </div>
        
        <p>Please log in to your account and make payment at your earliest convenience.</p>
        <p>
          <a href="http://localhost:5000/dashboard/customer.html" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View & Pay Bill
          </a>
        </p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          Best regards,<br>
          Microgrid City System<br>
          © 2026 All Rights Reserved
        </p>
      </div>
    `
  }),

  // Email template: Payment Received
  paymentReceivedEmail: (customerName, amount, method, date, transactionId) => ({
    subject: 'Payment Receipt - Transaction Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for Your Payment!</h2>
        <p>Dear ${customerName},</p>
        <p>We have successfully received your payment.</p>
        
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #4CAF50;">Payment Confirmed</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Method</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${method}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Date</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${date}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transaction ID</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${transactionId}</td>
            </tr>
          </table>
        </div>
        
        <p>Your account balance has been updated accordingly. Thank you for your prompt payment!</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          Best regards,<br>
          Microgrid City System<br>
          © 2026 All Rights Reserved
        </p>
      </div>
    `
  }),

  // Email template: Payment Reminder
  paymentReminderEmail: (customerName, billMonth, remainingAmount, daysOverdue) => ({
    subject: `Payment Reminder - ${billMonth} Bill Overdue`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder</h2>
        <p>Dear ${customerName},</p>
        <p>This is a friendly reminder that your payment for <strong>${billMonth}</strong> is overdue.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0;">Action Required</h3>
          <p><strong>Overdue Days:</strong> ${daysOverdue} days</p>
          <p><strong>Remaining Amount: ₹${remainingAmount}</strong></p>
        </div>
        
        <p>To avoid service disconnection, please make payment immediately.</p>
        <p>
          <a href="http://localhost:5000/dashboard/customer.html" style="background-color: #ff9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Pay Now
          </a>
        </p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          Best regards,<br>
          Microgrid City System<br>
          © 2026 All Rights Reserved
        </p>
      </div>
    `
  }),

  // SMS template: Payment Reminder
  paymentReminderSMS: (billMonth, amount) => {
    return `Reminder: Your ${billMonth} bill of ₹${amount} is pending. Pay now via your Microgrid account. Reply STOP to opt-out.`;
  }
};

module.exports = notificationService;
