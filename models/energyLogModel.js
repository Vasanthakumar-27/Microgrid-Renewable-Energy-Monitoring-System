const mongoose = require("mongoose");

const energyLogSchema = new mongoose.Schema(
  {
    gridId: {
      type: Number,
      required: true,
    },
    solar: {
      type: Number,
      required: true,
      min: 0,
    },
    wind: {
      type: Number,
      required: true,
      min: 0,
    },
    generation: {
      type: Number,
      required: true,
      min: 0,
    },
    consumption: {
      type: Number,
      required: true,
      min: 0,
    },
    battery: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      required: true,
      enum: ["normal", "warning", "critical"],
      default: "normal",
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("EnergyLog", energyLogSchema);
