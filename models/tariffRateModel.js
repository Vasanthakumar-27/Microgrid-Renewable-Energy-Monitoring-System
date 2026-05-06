const mongoose = require("mongoose");

const tariffRateSchema = new mongoose.Schema(
  {
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changedBy: {
      type: String,
      required: true,
      default: "admin",
    },
    description: {
      type: String,
      default: "Tariff rate update",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("TariffRate", tariffRateSchema);
