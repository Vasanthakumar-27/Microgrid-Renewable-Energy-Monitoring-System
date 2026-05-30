const mongoose = require("mongoose");

const maintenanceTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    gridId: {
      type: Number,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      default: "OPEN",
    },
    createdByRole: {
      type: String,
      required: true,
    },
    createdById: {
      type: String,
      required: true,
    },
    assignedTo: {
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

maintenanceTicketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("MaintenanceTicket", maintenanceTicketSchema);
