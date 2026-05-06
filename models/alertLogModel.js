const mongoose = require("mongoose");

const alertLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["LOW_BATTERY", "OVERLOAD", "FAULT"],
    },
    gridId: {
      type: Number,
      required: true,
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

module.exports = mongoose.model("AlertLog", alertLogSchema);
