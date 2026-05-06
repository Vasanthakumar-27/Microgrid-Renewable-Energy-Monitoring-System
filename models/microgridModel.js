const mongoose = require("mongoose");

const microgridSchema = new mongoose.Schema(
  {
    gridId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    energyGenerated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    consumption: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    batteryLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      required: true,
      enum: ["normal", "fault"],
      default: "normal",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Microgrid", microgridSchema);
