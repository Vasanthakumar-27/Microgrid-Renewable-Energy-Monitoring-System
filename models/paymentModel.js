const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    status: {
      type: String,
      required: true,
      enum: ["PAID"],
      default: "PAID",
    },
    method: {
      type: String,
      required: true,
      default: "ONLINE",
      enum: ["ONLINE", "RAZORPAY", "CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "E_WALLET"],
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    razorpayOrderId: {
      type: String,
      index: true,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ customerId: 1, date: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
