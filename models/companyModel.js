const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    totalEnergyGenerated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalConsumption: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    batteryStatus: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Company", companySchema);
