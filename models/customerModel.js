const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    energyUsage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    energyGenerated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    billAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["pending", "paid", "overdue"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Customer", customerSchema);
