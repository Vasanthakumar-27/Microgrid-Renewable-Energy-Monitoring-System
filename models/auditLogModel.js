const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    actorId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      required: true,
    },
    targetId: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
