const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    usageUnits: {
      type: Number,
      required: true,
      min: 0,
    },
    pricingModel: {
      type: Object,
      required: true,
    },
    billBreakdown: {
      type: Object,
      required: true,
    },
    calculatedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["pending", "paid"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

billSchema.index({ customerId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Bill", billSchema);
