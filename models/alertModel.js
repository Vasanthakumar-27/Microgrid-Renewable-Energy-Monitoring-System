const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["LOW", "HIGH"],
    },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    gridId: {
      type: Number,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    fake: {
      type: Boolean,
      required: true,
      default: true,
    },
    sensorData: {
      type: Object,
      default: {},
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    deletableAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionReason: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("Alert", alertSchema);
