const mongoose = require("mongoose");

const billDisputeSchema = new mongoose.Schema(
  {
    disputeId: {
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
    reason: {
      type: String,
      required: true,
    },
    evidenceText: {
      type: String,
      default: '',
    },
    evidenceFile: {
      filename: String,
      originalName: String,
      filepath: String,
      mimetype: String,
      size: Number,
      uploadedAt: Date
    },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "RESOLVED", "REJECTED"],
      default: "OPEN",
    },
    resolution: {
      type: String,
      default: null,
    },
    handledBy: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

billDisputeSchema.index({ customerId: 1, month: 1, status: 1 });

module.exports = mongoose.model("BillDispute", billDisputeSchema);
