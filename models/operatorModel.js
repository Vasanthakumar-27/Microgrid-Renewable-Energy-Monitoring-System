const mongoose = require("mongoose");

const operatorSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    gridCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    location: {
      type: String,
      default: "Unassigned",
      trim: true,
    },
    assignedMicrogrids: [
      {
        type: String,
      },
    ],
    customers: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Operator", operatorSchema);
